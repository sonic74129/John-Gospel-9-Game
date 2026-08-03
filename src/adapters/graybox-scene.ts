import Phaser from "phaser";

import type { Point } from "@sonic74129/content-schema";

import occlusion from "../world/occlusion.json";
import props from "../world/props.json";
import {
  actorTextureForSpawn,
  STORY_ART,
  STORY_ART_ASSET_LIST,
} from "./art-asset-adapter.ts";
import {
  applyCanonicalCameraFinalState,
  type AppliedCanonicalCameraState,
} from "./canonical-camera.ts";
import type { SliceFinalState } from "./sequence-adapter.ts";
import type { WorldRuntime } from "./world-adapter.ts";
import type {
  PlayerTraversal,
  WorldNavigationObjective,
} from "./world-navigation.ts";
import {
  createViewportResizeTransaction,
  type ViewportResizeTransaction,
} from "../platform/viewport-resize-transaction.ts";

const AREA_COLORS = [0xd2b887, 0x8ca6a3, 0xc5a16e, 0xa85f3e, 0x66704b];
const COLLISION_COLOR = 0x3c352f;
const WATER_COLLISION_COLOR = 0x526c73;
const PORTAL_COLOR = 0xe2d2b2;
const LANDMARK_COLOR = 0xffe2a6;

function drawPolygon(
  graphics: Phaser.GameObjects.Graphics,
  polygon: readonly Point[],
): void {
  const first = polygon[0];
  if (first === undefined) {
    throw new Error("Graybox polygons must contain at least one point.");
  }
  graphics.beginPath();
  graphics.moveTo(first.x, first.y);
  for (const point of polygon.slice(1)) {
    graphics.lineTo(point.x, point.y);
  }
  graphics.closePath();
  graphics.fillPath();
  graphics.strokePath();
}

function polygonCenter(polygon: readonly Point[]): Point {
  return {
    x: polygon.reduce((sum, point) => sum + point.x, 0) / polygon.length,
    y: polygon.reduce((sum, point) => sum + point.y, 0) / polygon.length,
  };
}

interface ActorVisual {
  readonly actorId: string;
  readonly storyActorId: string;
  readonly body: Phaser.GameObjects.Image;
  readonly label: Phaser.GameObjects.Text;
  readonly anchorOffset: Point;
  readonly collisionRadius: number;
  pose: string;
  collisionEnabled: boolean;
}

interface OccluderVisual {
  readonly image: Phaser.GameObjects.Image;
  readonly polygon: Phaser.Geom.Polygon;
  readonly fadedOpacity: number;
}

export interface SceneInteractionHandlers {
  readonly onWorldUpdate: (
    reason: "gameplay" | "viewport",
    traversal?: PlayerTraversal,
  ) => void;
  readonly onInteract: (storyActorId: string) => void;
}

export interface GrayboxSceneSnapshot {
  readonly actors: Readonly<
    Record<
      string,
      Readonly<{
        x: number;
        y: number;
        visible: boolean;
        label: string;
        pose: string;
        collisionEnabled: boolean;
      }>
    >
  >;
  readonly clay: Readonly<{
    x: number;
    y: number;
    visible: boolean;
    state: string;
    collisionEnabled: boolean;
  }>;
  readonly controls: SliceFinalState["controls"];
  readonly sequenceInputEnabled: boolean;
  readonly camera: Readonly<{
    scrollX: number;
    scrollY: number;
    zoom: number;
    followingObserver: boolean;
    followOffset: Point;
  }>;
  readonly appliedFinalState: AppliedGrayboxFinalState | null;
}

export interface AppliedGrayboxFinalState {
  readonly finalState: SliceFinalState;
  readonly actors: Readonly<
    Record<
      string,
      SliceFinalState["actors"][string] &
        Readonly<{
          resolvedPositions: readonly Point[];
        }>
    >
  >;
  readonly props: Readonly<{
    clay: SliceFinalState["props"]["clay"] &
      Readonly<{ position: Point }>;
  }>;
  readonly camera: AppliedCanonicalCameraState;
  readonly controls: SliceFinalState["controls"] &
    Readonly<{
      sequenceInputEnabled: boolean;
      effectiveMovementEnabled: boolean;
      effectiveInteractionEnabled: boolean;
    }>;
}

function abortError(): Error {
  const error = new Error("Sequence operation aborted");
  error.name = "AbortError";
  return error;
}

export class GrayboxScene extends Phaser.Scene {
  readonly #world: WorldRuntime;
  readonly #onReady: (scene: GrayboxScene) => void;
  readonly #viewportResize: ViewportResizeTransaction;
  readonly #visuals = new Map<string, ActorVisual>();
  readonly #occluders: OccluderVisual[] = [];
  #player?: ActorVisual;
  #clay?: Phaser.GameObjects.Image;
  #cursorKeys?: Phaser.Types.Input.Keyboard.CursorKeys;
  #interactKey?: Phaser.Input.Keyboard.Key;
  #wasd?: Readonly<{
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  }>;
  #path: readonly Point[] = [];
  #sequenceInputEnabled = true;
  #canonicalControls: SliceFinalState["controls"] = {
    playerActorId: "observer",
    movementEnabled: true,
    interactionEnabled: true,
    dialogueEnabled: false,
    locked: false,
  };
  #clayState = "absent";
  #clayCollisionEnabled = false;
  #cameraFollowingObserver = false;
  #appliedFinalState: AppliedGrayboxFinalState | null = null;
  #tearingDown = false;
  #handlers: SceneInteractionHandlers | undefined;
  #navigationObjective: WorldNavigationObjective | null = null;
  #objectiveMarker?: Phaser.GameObjects.Container;
  #objectiveLabel?: Phaser.GameObjects.Text;

  constructor(world: WorldRuntime, onReady: (scene: GrayboxScene) => void) {
    super({ key: "john-9-graybox" });
    this.#world = world;
    this.#onReady = onReady;
    this.#viewportResize = createViewportResizeTransaction({
      isReady: () => !this.#tearingDown && this.sys.isActive(),
      apply: (size) => this.#applyViewportResize(size.width, size.height),
    });
  }

  get navigation(): WorldRuntime["navigation"] {
    return this.#world.navigation;
  }

  preload(): void {
    for (const asset of STORY_ART_ASSET_LIST) {
      this.load.image(asset.key, `${import.meta.env.BASE_URL}${asset.path}`);
    }
  }

  create(): void {
    const { definition } = this.#world;
    this.cameras.main.setBounds(0, 0, definition.width, definition.height);
    this.add
      .image(0, 0, STORY_ART.worldBase.key)
      .setOrigin(0)
      .setDisplaySize(definition.width, definition.height)
      .setDepth(0);

    const debugEnabled =
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get("debug") === "1";
    const debugLayer = this.add
      .container(0, 0)
      .setDepth(100)
      .setVisible(debugEnabled);
    const graphics = this.add.graphics();
    debugLayer.add(graphics);
    this.#world.regionContracts.forEach((region, index) => {
      const { x, y, id } = this.#world.areas[index]!.definition;
      graphics.fillStyle(AREA_COLORS[index % AREA_COLORS.length]!, 0.72);
      graphics.lineStyle(4, 0x3c352f, 0.55);
      drawPolygon(graphics, region.walkablePolygon);
      if (import.meta.env.DEV) {
        debugLayer.add(
          this.add.text(x + 24, y + 20, `${id} · walkable`, {
            color: "#3c352f",
            fontFamily: "system-ui, sans-serif",
            fontSize: "22px",
            fontStyle: "bold",
          }),
        );
      }
    });

    for (const collision of this.#world.collisionPolygons) {
      graphics.fillStyle(
        collision.material === "water-boundary"
          ? WATER_COLLISION_COLOR
          : COLLISION_COLOR,
        0.88,
      );
      graphics.lineStyle(3, 0xfffaf1, 0.7);
      drawPolygon(graphics, collision.polygon);
      if (import.meta.env.DEV) {
        const center = polygonCenter(collision.polygon);
        debugLayer.add(
          this.add.text(center.x, center.y, collision.id.replace("collision.", ""), {
            color: "#fffaf1",
            fontFamily: "system-ui, sans-serif",
            fontSize: "13px",
            align: "center",
          }).setOrigin(0.5),
        );
      }
    }

    graphics.lineStyle(10, PORTAL_COLOR, 0.9);
    for (const portal of this.#world.portals) {
      const [start, end] = portal.segment;
      if (start === undefined || end === undefined) {
        throw new Error(`Portal ${portal.id} must define a segment.`);
      }
      graphics.lineBetween(start.x, start.y, end.x, end.y);
      const center = {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
      };
      if (import.meta.env.DEV) {
        debugLayer.add(
          this.add.text(center.x, center.y - 18, "transition", {
            color: "#3c352f",
            backgroundColor: "#e2d2b2dd",
            fontFamily: "system-ui, sans-serif",
            fontSize: "12px",
            padding: { x: 4, y: 2 },
          }).setOrigin(0.5, 1),
        );
      }
    }

    graphics.fillStyle(LANDMARK_COLOR, 1);
    graphics.lineStyle(3, COLLISION_COLOR, 0.8);
    for (const anchor of this.#world.anchorById.values()) {
      if (anchor.kind !== "landmark") {
        continue;
      }
      graphics.fillCircle(anchor.position.x, anchor.position.y, 12);
      graphics.strokeCircle(anchor.position.x, anchor.position.y, 12);
      if (import.meta.env.DEV) {
        debugLayer.add(
          this.add.text(
            anchor.position.x,
            anchor.position.y - 18,
            anchor.id.split(".").at(-1) ?? anchor.id,
            {
              color: "#3c352f",
              backgroundColor: "#fffaf1dd",
              fontFamily: "system-ui, sans-serif",
              fontSize: "12px",
              padding: { x: 4, y: 2 },
            },
          ).setOrigin(0.5, 1),
        );
      }
    }
    if (import.meta.env.DEV && this.input.keyboard !== null) {
      this.input.keyboard
        .addKey(Phaser.Input.Keyboard.KeyCodes.G)
        .on("down", () => debugLayer.setVisible(!debugLayer.visible));
    }

    this.#createStaticProps();
    this.#createOccluders();

    for (const actor of this.#world.actors) {
      const isPlayer = actor.state.role === "player";
      const body = this.add
        .image(
          actor.definition.position.x,
          actor.definition.position.y,
          actorTextureForSpawn(actor.definition.id),
        )
        .setOrigin(0.5, 0.92)
        .setDepth(this.#actorDepth(actor.definition.position.y));
      const label = this.add
        .text(actor.definition.position.x, actor.definition.position.y - 84, actor.state.label, {
          color: "#fffaf1",
          backgroundColor: "#3c352fe6",
          fontFamily: "system-ui, sans-serif",
          fontSize: "15px",
          padding: { x: 7, y: 4 },
        })
        .setOrigin(0.5, 1)
        .setDepth(30);
      const visual: ActorVisual = {
        actorId: actor.definition.id,
        storyActorId: actor.state.storyActorId,
        body,
        label,
        anchorOffset: actor.state.anchorOffset,
        collisionRadius: actor.state.collisionRadius,
        pose: actor.state.pose,
        collisionEnabled: actor.state.collisionEnabled,
      };
      this.#visuals.set(actor.definition.id, visual);
      this.#setVisualVisible(visual, actor.state.visible);
      if (isPlayer) {
        this.#player = visual;
      }
    }

    if (this.#player === undefined) {
      throw new Error("The world contract must expose one player spawn.");
    }

    const clayAnchor = this.#requireAnchor("roadside.clay-action");
    this.#clay = this.add
      .image(clayAnchor.x, clayAnchor.y, STORY_ART.props.clayVessel.key)
      .setOrigin(0.5, 0.82)
      .setDepth(this.#actorDepth(clayAnchor.y) - 0.01)
      .setVisible(false);
    const objectiveRing = this.add
      .circle(0, 0, 30, 0xf0dfbd, 0.22)
      .setStrokeStyle(5, 0xfff4d6, 0.96);
    const objectiveArrow = this.add
      .triangle(0, -48, -12, -10, 12, -10, 0, 8, 0xfff4d6, 0.96)
      .setStrokeStyle(2, 0x3c352f, 0.8);
    this.#objectiveLabel = this.add
      .text(0, -68, "目標", {
        color: "#3c352f",
        backgroundColor: "#fff4d6f2",
        fontFamily: "system-ui, sans-serif",
        fontSize: "16px",
        fontStyle: "bold",
        padding: { x: 8, y: 5 },
      })
      .setOrigin(0.5, 1);
    this.#objectiveMarker = this.add
      .container(0, 0, [objectiveRing, objectiveArrow, this.#objectiveLabel])
      .setDepth(40)
      .setVisible(false);

    const cursorKeys = this.input.keyboard?.createCursorKeys();
    if (cursorKeys !== undefined) {
      this.#cursorKeys = cursorKeys;
    }
    if (this.input.keyboard !== null) {
      this.#wasd = {
        up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
      this.#interactKey = this.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.SPACE,
      );
    }
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.#player === undefined || this.#tearingDown) {
        return;
      }
      const target = { x: pointer.worldX, y: pointer.worldY };
      if (
        this.#navigationObjective !== null &&
        Phaser.Math.Distance.Between(
          target.x,
          target.y,
          this.#navigationObjective.position.x,
          this.#navigationObjective.position.y,
        ) <= 64
      ) {
        this.#activateNavigationObjective();
        return;
      }
      const nearby = this.#nearestStoryActor(target, 52);
      if (nearby !== undefined && this.#interactionAllowed()) {
        this.#handlers?.onInteract(nearby);
        return;
      }
      if (!this.#movementAllowed()) {
        return;
      }
      this.#path = this.#world.findPath(this.playerPosition(), target);
    });
    this.cameras.main.startFollow(this.#player.body, true, 0.08, 0.08);
    this.#cameraFollowingObserver = true;
    this.#syncNarrativeTextures();
    this.#syncOccluderAlpha();
    this.#onReady(this);
    this.#handlers?.onWorldUpdate("gameplay");
  }

  update(_time: number, delta: number): void {
    if (this.#player === undefined) {
      return;
    }
    this.#syncOccluderAlpha();
    if (
      this.#interactionAllowed() &&
      this.#interactKey !== undefined &&
      Phaser.Input.Keyboard.JustDown(this.#interactKey)
    ) {
      const nearby = this.#nearestStoryActor(this.playerPosition(), 110);
      if (nearby !== undefined) {
        this.#handlers?.onInteract(nearby);
      }
    }
    if (!this.#movementAllowed()) {
      return;
    }

    const direction = new Phaser.Math.Vector2(
      Number(this.#cursorKeys?.right.isDown || this.#wasd?.right.isDown) -
        Number(this.#cursorKeys?.left.isDown || this.#wasd?.left.isDown),
      Number(this.#cursorKeys?.down.isDown || this.#wasd?.down.isDown) -
        Number(this.#cursorKeys?.up.isDown || this.#wasd?.up.isDown),
    );
    const distance = (240 * delta) / 1000;

    if (direction.lengthSq() > 0) {
      this.#path = [];
      direction.normalize().scale(distance);
      if (!this.#movePlayer(direction.x, direction.y)) {
        if (!this.#movePlayer(direction.x, 0)) {
          this.#movePlayer(0, direction.y);
        }
      }
      return;
    }

    const next = this.#path[0];
    if (next === undefined) {
      return;
    }
    const toNext = new Phaser.Math.Vector2(
      next.x - this.#player.body.x,
      next.y - this.#player.body.y,
    );
    if (toNext.length() <= distance) {
      if (this.#movePlayer(toNext.x, toNext.y)) {
        this.#path = this.#path.slice(1);
      } else {
        this.#path = [];
      }
      return;
    }
    toNext.normalize().scale(distance);
    if (!this.#movePlayer(toNext.x, toNext.y)) {
      this.#path = [];
    }
  }

  setInteractionHandlers(handlers: SceneInteractionHandlers): void {
    this.#handlers = handlers;
  }

  setNavigationObjective(objective: WorldNavigationObjective | null): void {
    this.#navigationObjective =
      objective === null ? null : structuredClone(objective);
    if (this.#objectiveMarker === undefined) {
      return;
    }
    if (objective === null || this.#tearingDown) {
      this.#objectiveMarker.setVisible(false);
      return;
    }
    this.#objectiveMarker
      .setPosition(objective.position.x, objective.position.y)
      .setVisible(true);
    this.#objectiveLabel?.setText(
      objective.kind === "arrival"
        ? "前往此處"
        : objective.kind === "proximity"
          ? `接近${objective.label}`
          : `與${objective.label}互動`,
    );
  }

  setMovementEnabled(enabled: boolean): void {
    this.#sequenceInputEnabled = enabled;
    if (!enabled) {
      this.#path = [];
    }
  }

  resizeViewport(width: number, height: number): void {
    this.#viewportResize.queue({ width, height });
  }

  flushPendingViewportResize(): boolean {
    return this.#viewportResize.flush();
  }

  #applyViewportResize(width: number, height: number): void {
    this.cameras.main.setSize(width, height);
    if (this.#appliedFinalState !== null && this.#sequenceInputEnabled) {
      const camera = this.#applyCanonicalCamera(
        this.#appliedFinalState.finalState,
      );
      this.#appliedFinalState = {
        ...this.#appliedFinalState,
        camera,
      };
    }
    this.#handlers?.onWorldUpdate("viewport");
  }

  captureRuntimeState(): GrayboxSceneSnapshot {
    const camera = this.cameras.main;
    return {
      actors: Object.fromEntries(
        [...this.#visuals.entries()].map(([actorId, visual]) => [
          actorId,
          {
            x: visual.body.x,
            y: visual.body.y,
            visible: visual.body.visible,
            label: visual.label.text,
            pose: visual.pose,
            collisionEnabled: visual.collisionEnabled,
          },
        ]),
      ),
      clay: {
        x: this.#clay?.x ?? 0,
        y: this.#clay?.y ?? 0,
        visible: this.#clay?.visible ?? false,
        state: this.#clayState,
        collisionEnabled: this.#clayCollisionEnabled,
      },
      controls: structuredClone(this.#canonicalControls),
      sequenceInputEnabled: this.#sequenceInputEnabled,
      camera: {
        scrollX: camera.scrollX,
        scrollY: camera.scrollY,
        zoom: camera.zoom,
        followingObserver: this.#cameraFollowingObserver,
        followOffset: {
          x: camera.followOffset.x,
          y: camera.followOffset.y,
        },
      },
      appliedFinalState:
        this.#appliedFinalState === null
          ? null
          : structuredClone(this.#appliedFinalState),
    };
  }

  restoreRuntimeState(snapshot: GrayboxSceneSnapshot): void {
    if (this.#tearingDown) {
      return;
    }
    this.tweens.killAll();
    this.cameras.main.resetFX();
    for (const [actorId, actorState] of Object.entries(snapshot.actors)) {
      const visual = this.#visuals.get(actorId);
      if (visual === undefined) {
        throw new Error(`Cannot restore unknown map actor ${actorId}.`);
      }
      visual.body.setPosition(actorState.x, actorState.y);
      visual.body.setDepth(this.#actorDepth(actorState.y));
      visual.pose = actorState.pose;
      visual.collisionEnabled = actorState.collisionEnabled;
      visual.label.setText(actorState.label);
      const runtimeActor = this.#runtimeActor(visual.actorId);
      runtimeActor.state.pose = actorState.pose;
      runtimeActor.state.collisionEnabled = actorState.collisionEnabled;
      runtimeActor.state.label = actorState.label;
      this.#syncLabel(visual);
      this.#setVisualVisible(visual, actorState.visible);
    }
    this.#clay
      ?.setPosition(snapshot.clay.x, snapshot.clay.y)
      .setVisible(snapshot.clay.visible);
    this.#clayState = snapshot.clay.state;
    this.#clayCollisionEnabled = snapshot.clay.collisionEnabled;
    this.#canonicalControls = structuredClone(snapshot.controls);
    this.#sequenceInputEnabled = snapshot.sequenceInputEnabled;
    this.#appliedFinalState =
      snapshot.appliedFinalState === null
        ? null
        : structuredClone(snapshot.appliedFinalState);
    this.#path = [];
    this.cameras.main.setZoom(snapshot.camera.zoom);
    this.cameras.main.setScroll(
      snapshot.camera.scrollX,
      snapshot.camera.scrollY,
    );
    this.#cameraFollowingObserver = snapshot.camera.followingObserver;
    if (snapshot.camera.followingObserver && this.#player !== undefined) {
      this.cameras.main.startFollow(
        this.#player.body,
        true,
        0.08,
        0.08,
        snapshot.camera.followOffset.x,
        snapshot.camera.followOffset.y,
      );
      this.cameras.main.setScroll(
        snapshot.camera.scrollX,
        snapshot.camera.scrollY,
      );
    } else {
      this.cameras.main.stopFollow();
    }
    this.#syncNarrativeTextures();
    this.#syncOccluderAlpha();
    this.#handlers?.onWorldUpdate("gameplay");
  }

  playerPosition(): Point {
    if (this.#player === undefined) {
      throw new Error("The player is not ready.");
    }
    return { x: this.#player.body.x, y: this.#player.body.y };
  }

  storyActorPosition(storyActorId: string): Point {
    const visuals = this.#storyActorVisuals(storyActorId).filter(
      ({ body }) => body.visible,
    );
    if (visuals.length === 0) {
      throw new Error(`Story actor ${storyActorId} has no visible map actor.`);
    }
    return {
      x:
        visuals.reduce((sum, { body }) => sum + body.x, 0) /
        visuals.length,
      y:
        visuals.reduce((sum, { body }) => sum + body.y, 0) /
        visuals.length,
    };
  }

  storyActorLabel(storyActorId: string): string {
    const visual = this.#storyActorVisuals(storyActorId).find(
      ({ body }) => body.visible,
    );
    if (visual === undefined) {
      throw new Error(`Story actor ${storyActorId} has no visible map actor.`);
    }
    return this.#runtimeActor(visual.actorId).state.label;
  }

  anchorPosition(anchorId: string): Point {
    return this.#requireAnchor(anchorId);
  }

  focusAnchor(anchorId: string): void {
    const anchor = this.#requireAnchor(anchorId);
    this.cameras.main.stopFollow();
    this.#cameraFollowingObserver = false;
    this.cameras.main.pan(anchor.x, anchor.y, 350, "Sine.easeInOut");
  }

  setActorPose(storyActorId: string, pose: string): void {
    for (const visual of this.#storyActorVisuals(storyActorId)) {
      visual.pose = pose;
      const runtimeActor = this.#runtimeActor(visual.actorId);
      runtimeActor.state.pose = pose;
      visual.label.setText(
        import.meta.env.DEV
          ? `${runtimeActor.state.label} · ${pose}`
          : runtimeActor.state.label,
      );
    }
    this.#syncNarrativeTextures();
  }

  setActorVisible(storyActorId: string, visible: boolean): void {
    for (const visual of this.#storyActorVisuals(storyActorId)) {
      this.#setVisualVisible(visual, visible);
    }
  }

  async followActorPath(
    pathId: string,
    storyActorId: string,
    signal: AbortSignal,
  ): Promise<void> {
    const path = this.#world.pathById.get(pathId);
    if (path === undefined) {
      throw new RangeError(`Unknown canonical path ${pathId}.`);
    }
    const visuals = this.#storyActorVisuals(storyActorId);
    for (const point of path.points) {
      await Promise.all(
        visuals.map((visual) => {
          const target = {
            x: point.x + visual.anchorOffset.x,
            y: point.y + visual.anchorOffset.y,
          };
          const distance = Phaser.Math.Distance.Between(
            visual.body.x,
            visual.body.y,
            target.x,
            target.y,
          );
          return this.#tweenVisual(
            visual,
            target,
            (distance / path.movementSpeed) * 1000,
            signal,
          );
        }),
      );
    }
  }

  async followCameraPath(pathId: string, signal: AbortSignal): Promise<void> {
    const path = this.#world.pathById.get(pathId);
    if (path === undefined) {
      throw new RangeError(`Unknown canonical path ${pathId}.`);
    }
    this.cameras.main.stopFollow();
    this.#cameraFollowingObserver = false;
    for (const point of path.points) {
      if (signal.aborted) {
        throw abortError();
      }
      this.cameras.main.pan(point.x, point.y, 250, "Sine.easeInOut");
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        let timer: Phaser.Time.TimerEvent;
        const finish = (operation: () => void): void => {
          if (settled) {
            return;
          }
          settled = true;
          signal.removeEventListener("abort", onAbort);
          operation();
        };
        const onAbort = (): void => {
          timer.remove(false);
          finish(() => reject(abortError()));
        };
        timer = this.time.delayedCall(250, () => finish(resolve));
        signal.addEventListener("abort", onAbort, { once: true });
      });
    }
  }

  async applyFinalState(
    state: SliceFinalState,
    signal: AbortSignal,
  ): Promise<void> {
    if (signal.aborted || this.#tearingDown) {
      throw abortError();
    }
    for (const [storyActorId, actorState] of Object.entries(state.actors)) {
      const anchor = this.#requireAnchor(actorState.anchorId);
      for (const visual of this.#storyActorVisuals(storyActorId)) {
        visual.body.setPosition(
          anchor.x + visual.anchorOffset.x,
          anchor.y + visual.anchorOffset.y,
        );
        visual.body.setDepth(this.#actorDepth(visual.body.y));
        visual.label.setPosition(
          visual.body.x,
          visual.body.y - this.#labelOffset(visual),
        );
        visual.pose = actorState.pose;
        visual.collisionEnabled = actorState.collisionEnabled;
        const runtimeActor = this.#runtimeActor(visual.actorId);
        runtimeActor.state.pose = actorState.pose;
        runtimeActor.state.label = actorState.label;
        runtimeActor.state.collisionEnabled = actorState.collisionEnabled;
        runtimeActor.state.anchorId = actorState.anchorId;
        visual.label.setText(
          import.meta.env.DEV && visual.storyActorId === "jesus"
            ? `${actorState.label} · 候選身分灰盒`
            : import.meta.env.DEV
              ? `${actorState.label} · ${actorState.pose}`
              : actorState.label,
        );
        this.#setVisualVisible(visual, actorState.visible);
      }
    }
    if (this.#clay !== undefined) {
      const clayAnchor = this.#requireAnchor(state.props.clay.anchorId);
      this.#clay
        .setPosition(clayAnchor.x, clayAnchor.y)
        .setVisible(state.props.clay.visible);
    }
    this.#clayState = state.props.clay.state;
    this.#clayCollisionEnabled = state.props.clay.collisionEnabled;
    this.#canonicalControls = structuredClone(state.controls);
    this.#syncNarrativeTextures();
    this.#syncOccluderAlpha();
    const playerVisuals = this.#storyActorVisuals(state.controls.playerActorId);
    if (!playerVisuals.includes(this.#player!)) {
      throw new Error(
        `Canonical player actor ${state.controls.playerActorId} is not the rendered player.`,
      );
    }
    this.#path = [];
    const cameraAnchorContract = this.#world.anchorById.get(
      state.camera.anchorId,
    );
    if (cameraAnchorContract === undefined) {
      throw new RangeError(`Unknown canonical anchor ${state.camera.anchorId}.`);
    }
    const appliedCamera = this.#applyCanonicalCamera(state);
    this.#appliedFinalState = {
      finalState: structuredClone(state),
      actors: Object.fromEntries(
        Object.entries(state.actors).map(([storyActorId, actorState]) => [
          storyActorId,
          {
            ...structuredClone(actorState),
            resolvedPositions: this.#storyActorVisuals(storyActorId).map(
              ({ body }) => ({ x: body.x, y: body.y }),
            ),
          },
        ]),
      ),
      props: {
        clay: {
          ...structuredClone(state.props.clay),
          position: {
            x: this.#clay?.x ?? cameraAnchorContract.position.x,
            y: this.#clay?.y ?? cameraAnchorContract.position.y,
          },
        },
      },
      camera: appliedCamera,
      controls: {
        ...structuredClone(state.controls),
        sequenceInputEnabled: this.#sequenceInputEnabled,
        effectiveMovementEnabled: this.#movementAllowed(),
        effectiveInteractionEnabled: this.#interactionAllowed(),
      },
    };
    this.#handlers?.onWorldUpdate("gameplay");
  }

  snapshotAppliedFinalState(): AppliedGrayboxFinalState | null {
    if (this.#appliedFinalState === null) {
      return null;
    }
    return {
      ...structuredClone(this.#appliedFinalState),
      controls: {
        ...structuredClone(this.#appliedFinalState.controls),
        sequenceInputEnabled: this.#sequenceInputEnabled,
        effectiveMovementEnabled: this.#movementAllowed(),
        effectiveInteractionEnabled: this.#interactionAllowed(),
      },
    };
  }

  beginTeardown(): void {
    this.#tearingDown = true;
    this.setNavigationObjective(null);
    this.#viewportResize.cancel();
    this.#handlers = undefined;
    this.#path = [];
  }

  get tearingDown(): boolean {
    return this.#tearingDown;
  }

  #applyCanonicalCamera(state: SliceFinalState): AppliedCanonicalCameraState {
    const cameraAnchorContract = this.#world.anchorById.get(
      state.camera.anchorId,
    );
    if (cameraAnchorContract === undefined) {
      throw new RangeError(`Unknown canonical anchor ${state.camera.anchorId}.`);
    }
    const zone = this.#world.cameraZoneByRegionId.get(
      cameraAnchorContract.regionId,
    );
    if (zone === undefined) {
      throw new RangeError(
        `No canonical camera zone exists for ${cameraAnchorContract.regionId}.`,
      );
    }
    const camera = this.cameras.main;
    const appliedCamera = applyCanonicalCameraFinalState({
      camera,
      canonical: state.camera,
      zone,
      anchorPosition: cameraAnchorContract.position,
      playerActorId: state.controls.playerActorId,
      playerTarget: this.#player!.body,
      worldWidth: this.#world.definition.width,
      worldHeight: this.#world.definition.height,
      mobile: Math.min(camera.width, camera.height) <= 640,
    });
    this.#cameraFollowingObserver =
      appliedCamera.actual.followTargetActorId === state.controls.playerActorId;
    return appliedCamera;
  }

  #storyActorVisuals(storyActorId: string): readonly ActorVisual[] {
    const spawnIds = this.#world.storyActorSpawnIds[storyActorId];
    if (spawnIds === undefined) {
      throw new RangeError(`Unknown canonical story actor ${storyActorId}.`);
    }
    return spawnIds.map((spawnId) => {
      const visual = this.#visuals.get(spawnId);
      if (visual === undefined) {
        throw new Error(`Map actor ${spawnId} is not rendered.`);
      }
      return visual;
    });
  }

  #nearestStoryActor(point: Point, maximumDistance: number): string | undefined {
    let nearest:
      | Readonly<{ storyActorId: string; distance: number }>
      | undefined;
    for (const visual of this.#visuals.values()) {
      if (
        !visual.body.visible ||
        visual.storyActorId === "observer" ||
        !visual.collisionEnabled
      ) {
        continue;
      }
      const distance = Phaser.Math.Distance.Between(
        point.x,
        point.y,
        visual.body.x,
        visual.body.y,
      );
      if (
        distance <= maximumDistance &&
        (nearest === undefined || distance < nearest.distance)
      ) {
        nearest = { storyActorId: visual.storyActorId, distance };
      }
    }
    return nearest?.storyActorId;
  }

  #requireAnchor(anchorId: string): Point {
    const anchor = this.#world.anchorById.get(anchorId);
    if (anchor === undefined) {
      throw new RangeError(`Unknown canonical anchor ${anchorId}.`);
    }
    return anchor.position;
  }

  #setVisualVisible(visual: ActorVisual, visible: boolean): void {
    visual.body.setVisible(visible);
    visual.label.setVisible(visible);
    this.#runtimeActor(visual.actorId).state.visible = visible;
  }

  #runtimeActor(actorId: string): WorldRuntime["actors"][number] {
    const actor = this.#world.actors.find(
      ({ definition }) => definition.id === actorId,
    );
    if (actor === undefined) {
      throw new Error(`Map actor ${actorId} has no runtime state.`);
    }
    return actor;
  }

  #labelOffset(visual: ActorVisual): number {
    return Math.max(74, visual.body.displayHeight * 0.76);
  }

  #syncLabel(visual: ActorVisual): void {
    visual.label.setPosition(
      visual.body.x,
      visual.body.y - this.#labelOffset(visual),
    );
  }

  #movePlayer(deltaX: number, deltaY: number): boolean {
    if (this.#player === undefined) {
      return false;
    }
    const start = this.playerPosition();
    const target = { x: start.x + deltaX, y: start.y + deltaY };
    if (!this.#world.isWalkableSegment(start, target)) {
      return false;
    }
    for (const visual of this.#visuals.values()) {
      if (
        visual === this.#player ||
        !visual.body.visible ||
        !visual.collisionEnabled
      ) {
        continue;
      }
      if (
        Phaser.Math.Distance.Between(
          target.x,
          target.y,
          visual.body.x,
          visual.body.y,
        ) <
        this.#world.agentRadius + visual.collisionRadius
      ) {
        return false;
      }
    }
    if (
      this.#clay?.visible &&
      this.#clayCollisionEnabled &&
      Phaser.Math.Distance.Between(
        target.x,
        target.y,
        this.#clay.x,
        this.#clay.y,
      ) <
        this.#world.agentRadius + 10
    ) {
      return false;
    }
    this.#player.body.setPosition(target.x, target.y);
    this.#player.body.setDepth(this.#actorDepth(target.y));
    this.#syncLabel(this.#player);
    this.#syncOccluderAlpha();
    this.#handlers?.onWorldUpdate("gameplay", {
      previousPosition: start,
      currentPosition: target,
    });
    return true;
  }

  #activateNavigationObjective(): void {
    if (
      this.#navigationObjective === null ||
      this.#player === undefined ||
      !this.#movementAllowed()
    ) {
      return;
    }
    if (
      this.#navigationObjective.kind === "interaction" &&
      Phaser.Math.Distance.Between(
        this.#player.body.x,
        this.#player.body.y,
        this.#navigationObjective.position.x,
        this.#navigationObjective.position.y,
      ) <= 110 &&
      this.#interactionAllowed()
    ) {
      this.#handlers?.onInteract(this.#navigationObjective.targetId);
      return;
    }
    this.#path = this.#world.findPath(
      this.playerPosition(),
      this.#navigationObjective.position,
    );
  }

  #tweenVisual(
    visual: ActorVisual,
    target: Point,
    duration: number,
    signal: AbortSignal,
  ): Promise<void> {
    if (signal.aborted) {
      return Promise.reject(abortError());
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (operation: () => void): void => {
        if (settled) {
          return;
        }
        settled = true;
        signal.removeEventListener("abort", onAbort);
        operation();
      };
      const tween = this.tweens.add({
        targets: visual.body,
        x: target.x,
        y: target.y,
        duration: Math.max(0, duration),
        ease: "Linear",
        onUpdate: () => {
          if (!this.#tearingDown) {
            visual.body.setDepth(this.#actorDepth(visual.body.y));
            this.#syncLabel(visual);
          }
        },
        onComplete: () => finish(resolve),
      });
      const onAbort = (): void => {
        tween.stop();
        finish(() => reject(abortError()));
      };
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  #actorDepth(y: number): number {
    return 10 + y / 10000;
  }

  #createStaticProps(): void {
    const textureById: Readonly<Record<string, string>> = {
      "prop.pool-edge-marker": STORY_ART.props.poolMarker.key,
      "prop.inquiry-gate-panel": STORY_ART.props.courtyardGate.key,
      "prop.waiting-stool": STORY_ART.props.waitingStool.key,
    };
    for (const prop of props.movablePropAnchors) {
      const texture = textureById[prop.id];
      if (texture === undefined || prop.id === "prop.clay-container") {
        continue;
      }
      this.add
        .image(prop.position.x, prop.position.y, texture)
        .setOrigin(0.5, 0.82)
        .setDepth(8 + prop.position.y / 10000);
    }
  }

  #createOccluders(): void {
    const textureById: Readonly<Record<string, string>> = {
      "occluder.roadside-canopy": STORY_ART.props.roadsideCanopy.key,
      "occluder.pool-south-frond": STORY_ART.props.poolPalmFrond.key,
      "occluder.neighbors-awning": STORY_ART.props.neighborsAwning.key,
      "occluder.inquiry-gate-edge": STORY_ART.props.courtyardGate.key,
      "occluder.outside-branch": STORY_ART.props.outerOliveBranch.key,
    };
    for (const occluder of occlusion.foregroundOccluders) {
      const xs = occluder.polygon.map(({ x }) => x);
      const ys = occluder.polygon.map(({ y }) => y);
      const left = Math.min(...xs);
      const right = Math.max(...xs);
      const top = Math.min(...ys);
      const bottom = Math.max(...ys);
      const image = this.add
        .image(
          (left + right) / 2,
          (top + bottom) / 2,
          textureById[occluder.id]!,
        )
        .setDisplaySize(right - left, bottom - top)
        .setDepth(25);
      this.#occluders.push({
        image,
        polygon: new Phaser.Geom.Polygon(occluder.polygon),
        fadedOpacity: occluder.fadedOpacity,
      });
    }
  }

  #syncOccluderAlpha(): void {
    if (this.#player === undefined) {
      return;
    }
    for (const occluder of this.#occluders) {
      occluder.image.setAlpha(
        Phaser.Geom.Polygon.Contains(
          occluder.polygon,
          this.#player.body.x,
          this.#player.body.y,
        )
          ? occluder.fadedOpacity
          : 1,
      );
    }
  }

  #syncNarrativeTextures(): void {
    const man = this.#storyActorVisuals("man-born-blind")[0];
    if (man !== undefined) {
      const textureByPose: Readonly<Record<string, string>> = {
        idle: STORY_ART.actors.manBlind.key,
        "clay-on-eyes": STORY_ART.actors.manClay.key,
        "standing-seeing": STORY_ART.actors.manSeeing.key,
        worship: STORY_ART.actors.manWorship.key,
      };
      man.body.setTexture(textureByPose[man.pose] ?? STORY_ART.actors.manSeeing.key);
    }
    const jesus = this.#storyActorVisuals("jesus")[0];
    if (jesus !== undefined) {
      const texture =
        man?.pose === "clay-on-eyes"
          ? STORY_ART.actors.jesusClayAction.key
          : jesus.pose === "standing" || jesus.pose === "walking"
            ? STORY_ART.actors.jesusFoundMan.key
            : STORY_ART.actors.jesusIdle.key;
      jesus.body.setTexture(texture);
    }
  }

  #movementAllowed(): boolean {
    return (
      this.#sequenceInputEnabled &&
      this.#canonicalControls.movementEnabled &&
      !this.#canonicalControls.locked &&
      !this.#tearingDown
    );
  }

  #interactionAllowed(): boolean {
    return (
      this.#sequenceInputEnabled &&
      this.#canonicalControls.interactionEnabled &&
      !this.#canonicalControls.locked &&
      !this.#tearingDown
    );
  }

}
