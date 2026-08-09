import Phaser from "phaser";

import type { Point } from "@sonic74129/content-schema";

import occlusion from "../world/occlusion.json";
import props from "../world/props.json";
import {
  actorArtForSpawn,
  actorRenderProfileForSpawn,
  JESUS_DIRECTIONAL_FRAMES,
  STORY_ART,
  STORY_ART_ASSET_LIST,
} from "./art-asset-adapter.ts";
import {
  directionalFrameName,
  directionFromDelta,
  focusDirection,
  walkStepAt,
} from "./actor-facing.ts";
import {
  manBornBlindPathTransition,
  type CardinalDirection,
  type ManBornBlindPose,
} from "../story/actors.ts";
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
import { INTERACTION_RADIUS_PIXELS } from "./world-navigation.ts";
import {
  createViewportResizeTransaction,
  type ViewportResizeTransaction,
} from "../platform/viewport-resize-transaction.ts";
import {
  beginFixedPointNavigation,
  cancelNavigationForDirectionalInput,
  type FixedPointNavigation,
} from "../platform/player-navigation-state.ts";
import {
  assertNormalFinalStateVisualDelta,
  type FinalStateApplicationMode,
  type VisualFinalState,
} from "../platform/final-state-policy.ts";

interface ActorVisual {
  readonly actorId: string;
  readonly storyActorId: string;
  readonly body: Phaser.GameObjects.Image;
  readonly label: Phaser.GameObjects.Text;
  readonly anchorOffset: Point;
  readonly collisionRadius: number;
  readonly art: ReturnType<typeof actorArtForSpawn>;
  pose: string;
  direction: CardinalDirection;
  moving: boolean;
  walkElapsedMs: number;
  collisionEnabled: boolean;
}

interface OccluderVisual {
  readonly image: Phaser.GameObjects.Image;
  readonly polygon: Phaser.Geom.Polygon;
  readonly fadedOpacity: number;
}

interface TransientCameraFocus {
  readonly position: Point;
  readonly regionId: string;
}

export interface SceneInteractionHandlers {
  readonly onWorldUpdate: (
    reason: "gameplay" | "viewport",
    traversal?: PlayerTraversal,
  ) => void;
  readonly onInteract: (storyActorId: string) => void;
}

export interface StorySceneSnapshot {
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
    width: number;
    height: number;
    scrollX: number;
    scrollY: number;
    zoom: number;
    followingObserver: boolean;
    followOffset: Point;
  }>;
  readonly appliedFinalState: AppliedStoryFinalState | null;
  readonly transientCameraFocus: TransientCameraFocus | null;
}

export interface AppliedStoryFinalState {
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

export class StoryScene extends Phaser.Scene {
  readonly #world: WorldRuntime;
  readonly #onReady: (scene: StoryScene) => void;
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
  #fixedPointNavigation: FixedPointNavigation | null = null;
  #virtualDirection: Point = { x: 0, y: 0 };
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
  #appliedFinalState: AppliedStoryFinalState | null = null;
  #transientCameraFocus: TransientCameraFocus | null = null;
  #tearingDown = false;
  #handlers: SceneInteractionHandlers | undefined;
  #navigationObjective: WorldNavigationObjective | null = null;
  #objectiveMarker?: Phaser.GameObjects.Container;
  #objectiveRing?: Phaser.GameObjects.Arc;
  #objectiveArrow?: Phaser.GameObjects.Triangle;
  #objectiveLabel?: Phaser.GameObjects.Text;
  #playerMovedSinceLastFinalState = false;

  constructor(world: WorldRuntime, onReady: (scene: StoryScene) => void) {
    super({ key: "john-9-story" });
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
    this.cameras.main.setBackgroundColor("#ead9b7");
    this.add
      .image(0, 0, STORY_ART.worldBase.key)
      .setOrigin(0)
      .setDisplaySize(definition.width, definition.height)
      .setDepth(0);

    if (import.meta.env.DEV) {
      void import("./dev-graybox-overlay.ts")
        .then(({ installDevelopmentGrayboxOverlay }) => {
          if (!this.#tearingDown) {
            installDevelopmentGrayboxOverlay(this, this.#world);
          }
        })
        .catch((error: unknown) => console.error(error));
    }

    this.#createStaticProps();
    this.#createOccluders();
    this.#registerDirectionalActorFrames();

    for (const actor of this.#world.actors) {
      const isPlayer = actor.state.role === "player";
      const art = actorArtForSpawn(actor.definition.id);
      const renderProfile = actorRenderProfileForSpawn(actor.definition.id);
      const body = this.add
        .image(
          actor.definition.position.x,
          actor.definition.position.y,
          art.key,
        )
        .setOrigin(0.5, art.footBaseline! / art.frameHeight)
        .setScale(renderProfile.targetDisplayHeight / art.frameHeight)
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
        art,
        pose: actor.state.pose,
        direction: "down",
        moving: false,
        walkElapsedMs: 0,
        collisionEnabled: actor.state.collisionEnabled,
      };
      this.#visuals.set(actor.definition.id, visual);
      this.#syncLabel(visual);
      this.#setVisualVisible(visual, actor.state.visible);
      this.#setVisualDirection(visual, "down");
      if (isPlayer) {
        this.#player = visual;
      }
    }

    if (this.#player === undefined) {
      throw new Error("The world contract must expose one player spawn.");
    }
    this.#syncActorFacingToMan();

    const clayAnchor = this.#requireAnchor("courtyard.clay-action");
    this.#clay = this.add
      .image(clayAnchor.x, clayAnchor.y, STORY_ART.props.clayVessel.key)
      .setOrigin(0.5, 0.82)
      .setDepth(this.#actorDepth(clayAnchor.y) - 0.01)
      .setVisible(false);
    this.#objectiveRing = this.add
      .circle(0, 0, 30, 0xf0dfbd, 0.22)
      .setStrokeStyle(5, 0xfff4d6, 0.96);
    this.#objectiveArrow = this.add
      .triangle(0, -48, -12, -10, 12, -10, 0, 8, 0xfff4d6, 0.96)
      .setStrokeStyle(2, 0x3c352f, 0.8);
    this.#objectiveLabel = this.add
      .text(0, -68, "前往", {
        color: "#3c352f",
        backgroundColor: "#fff4d6f2",
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        fontStyle: "bold",
        padding: { x: 7, y: 4 },
      })
      .setOrigin(0.5, 1);
    this.#objectiveMarker = this.add
      .container(0, 0, [this.#objectiveRing, this.#objectiveArrow, this.#objectiveLabel])
      .setDepth(42)
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
      if (this.#navigationObjective !== null) {
        const markerPosition = this.#objectiveMarkerPosition(this.#navigationObjective);
        if (
          Phaser.Math.Distance.Between(
            target.x,
            target.y,
            markerPosition.x,
            markerPosition.y,
          ) <= this.#objectiveTapRadius(this.#navigationObjective.kind)
        ) {
          this.#activateNavigationObjective();
          return;
        }
      }
      const nearby = this.#nearestStoryActor(target, 52);
      const playerPosition = this.playerPosition();
      const nearbyPosition =
        nearby === undefined ? null : this.storyActorPosition(nearby);
      if (
        nearby !== undefined &&
        nearbyPosition !== null &&
        Phaser.Math.Distance.Between(
          playerPosition.x,
          playerPosition.y,
          nearbyPosition.x,
          nearbyPosition.y,
        ) <= INTERACTION_RADIUS_PIXELS &&
        this.#interactionAllowed()
      ) {
        this.#handlers?.onInteract(nearby);
        return;
      }
      if (!this.#movementAllowed()) {
        this.#setVisualMotion(this.#player, false, 0);
        return;
      }
      this.#beginFixedPointNavigation(target);
    });
    this.#applyInitialCourtyardCamera();
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
    this.#syncActorFacingToMan();
    this.#syncNavigationObjectiveMarker();
    if (
      this.#interactionAllowed() &&
      this.#interactKey !== undefined &&
      Phaser.Input.Keyboard.JustDown(this.#interactKey)
    ) {
      const playerPosition = this.playerPosition();
      if (this.#navigationObjective !== null) {
        const objectivePosition = this.#objectiveTargetPosition(
          this.#navigationObjective,
        );
        const objectiveDistance = Phaser.Math.Distance.Between(
          playerPosition.x,
          playerPosition.y,
          objectivePosition.x,
          objectivePosition.y,
        );
        if (
          this.#navigationObjective.kind === "interaction" &&
          objectiveDistance <= INTERACTION_RADIUS_PIXELS
        ) {
          this.#handlers?.onInteract(this.#navigationObjective.targetId);
        } else {
          const nearby = this.#nearestStoryActor(playerPosition, 110);
          if (nearby !== undefined) {
            this.#handlers?.onInteract(nearby);
          }
        }
      } else {
        const nearby = this.#nearestStoryActor(playerPosition, 110);
        if (nearby !== undefined) {
          this.#handlers?.onInteract(nearby);
        }
      }
    }
    if (!this.#movementAllowed()) {
      return;
    }

    const direction = new Phaser.Math.Vector2(
      Number(this.#cursorKeys?.right.isDown || this.#wasd?.right.isDown) -
        Number(this.#cursorKeys?.left.isDown || this.#wasd?.left.isDown) +
        this.#virtualDirection.x,
      Number(this.#cursorKeys?.down.isDown || this.#wasd?.down.isDown) -
        Number(this.#cursorKeys?.up.isDown || this.#wasd?.up.isDown) +
        this.#virtualDirection.y,
    );
    const distance = (240 * delta) / 1000;

    if (direction.lengthSq() > 0) {
      this.#fixedPointNavigation = cancelNavigationForDirectionalInput(
        this.#fixedPointNavigation,
        direction,
      );
      direction.normalize().scale(distance);
      const moved =
        this.#movePlayer(direction.x, direction.y) ||
        this.#movePlayer(direction.x, 0) ||
        this.#movePlayer(0, direction.y);
      this.#setVisualMotion(this.#player, moved, delta);
      return;
    }

    const next = this.#fixedPointNavigation?.waypoints[0];
    if (next === undefined) {
      this.#setVisualMotion(this.#player, false, 0);
      return;
    }
    const toNext = new Phaser.Math.Vector2(
      next.x - this.#player.body.x,
      next.y - this.#player.body.y,
    );
    if (toNext.length() <= distance) {
      if (this.#movePlayer(toNext.x, toNext.y)) {
        this.#fixedPointNavigation = Object.freeze({
          target: this.#fixedPointNavigation!.target,
          waypoints: Object.freeze(
            this.#fixedPointNavigation!.waypoints.slice(1),
          ),
        });
        this.#setVisualMotion(this.#player, true, delta);
      } else {
        this.#fixedPointNavigation = null;
        this.#setVisualMotion(this.#player, false, 0);
      }
      return;
    }
    toNext.normalize().scale(distance);
    if (!this.#movePlayer(toNext.x, toNext.y)) {
      this.#fixedPointNavigation = null;
      this.#setVisualMotion(this.#player, false, 0);
    } else {
      this.#setVisualMotion(this.#player, true, delta);
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
    this.#syncNavigationObjectiveMarker();
  }

  setMovementEnabled(enabled: boolean): void {
    this.#sequenceInputEnabled = enabled;
    if (!enabled) {
      this.#fixedPointNavigation = null;
      if (this.#player !== undefined) {
        this.#setVisualMotion(this.#player, false, 0);
      }
    }
  }

  setVirtualDirection(direction: Point): void {
    this.#virtualDirection = {
      x: Math.sign(direction.x),
      y: Math.sign(direction.y),
    };
    this.#fixedPointNavigation = cancelNavigationForDirectionalInput(
      this.#fixedPointNavigation,
      this.#virtualDirection,
    );
  }

  resizeViewport(width: number, height: number): void {
    this.#viewportResize.queue({ width, height });
  }

  flushPendingViewportResize(): boolean {
    return this.#viewportResize.flush();
  }

  #applyViewportResize(width: number, height: number): void {
    this.cameras.main.setSize(width, height);
    if (this.#transientCameraFocus !== null) {
      this.#applyTransientCameraFocus(this.#transientCameraFocus);
    } else if (this.#appliedFinalState !== null) {
      const camera = this.#applyCanonicalCamera(
        this.#appliedFinalState.finalState,
      );
      this.#appliedFinalState = {
        ...this.#appliedFinalState,
        camera,
      };
    } else {
      this.#applyInitialCourtyardCamera();
    }
    this.#handlers?.onWorldUpdate("viewport");
  }

  captureRuntimeState(): StorySceneSnapshot {
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
        width: camera.width,
        height: camera.height,
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
      transientCameraFocus:
        this.#transientCameraFocus === null
          ? null
          : structuredClone(this.#transientCameraFocus),
    };
  }

  restoreRuntimeState(snapshot: StorySceneSnapshot): void {
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
    this.#transientCameraFocus =
      snapshot.transientCameraFocus === null
        ? null
        : structuredClone(snapshot.transientCameraFocus);
    this.#fixedPointNavigation = null;
    const viewportChanged =
      this.cameras.main.width !== snapshot.camera.width ||
      this.cameras.main.height !== snapshot.camera.height;
    if (viewportChanged) {
      if (this.#transientCameraFocus !== null) {
        this.#applyTransientCameraFocus(this.#transientCameraFocus);
      } else if (this.#appliedFinalState === null) {
        this.#applyInitialCourtyardCamera();
      } else {
        const camera = this.#applyCanonicalCamera(
          this.#appliedFinalState.finalState,
        );
        this.#appliedFinalState = {
          ...this.#appliedFinalState,
          camera,
        };
      }
    } else {
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
    }
    this.#syncNarrativeTextures();
    this.#syncActorFacingToMan();
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
    if (!this.#world.anchorById.has(anchorId)) {
      throw new RangeError(`Unknown canonical anchor ${anchorId}.`);
    }
  }

  setActorPose(storyActorId: string, pose: string): void {
    if (storyActorId === "man-born-blind" && pose === "clay-on-eyes") {
      const man = this.#storyActorVisuals(storyActorId)[0];
      if (man?.pose !== "seated" && man?.pose !== "idle") {
        throw new RangeError(
          `The man can receive clay only while seated; received ${man?.pose ?? "missing"}.`,
        );
      }
    }
    for (const visual of this.#storyActorVisuals(storyActorId)) {
      visual.pose = pose;
      const runtimeActor = this.#runtimeActor(visual.actorId);
      runtimeActor.state.pose = pose;
      visual.label.setText(runtimeActor.state.label);
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
    if (visuals.every(({ body }) => !body.visible)) {
      const start = path.points[0];
      if (start === undefined) {
        throw new Error(`Canonical path ${pathId} has no starting point.`);
      }
      for (const visual of visuals) {
        visual.body.setPosition(
          start.x + visual.anchorOffset.x,
          start.y + visual.anchorOffset.y,
        );
        visual.body.setDepth(this.#actorDepth(visual.body.y));
        this.#syncLabel(visual);
        this.#setVisualVisible(visual, true);
      }
    }
    const manTransition =
      storyActorId === "man-born-blind"
        ? manBornBlindPathTransition(pathId, visuals[0]?.pose ?? "")
        : undefined;
    if (manTransition !== undefined) {
      this.#setManBornBlindPose(manTransition.standPose);
      this.#setManBornBlindPose(manTransition.walkingPose);
    }
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
    if (manTransition !== undefined) {
      this.#setManBornBlindPose(manTransition.finalPose);
    }
  }

  async escortActorToAnchor(
    pathId: string,
    actorId: string,
    playerArrivalAnchorId: string,
    signal: AbortSignal,
    setNavigationHint: (message: string | null) => void,
  ): Promise<void> {
    await this.leadActorsAlongPath(
      pathId,
      [actorId],
      playerArrivalAnchorId,
      signal,
      setNavigationHint,
    );
  }

  async leadActorsAlongPath(
    pathId: string,
    actorIds: readonly string[],
    playerArrivalAnchorId: string,
    signal: AbortSignal,
    setNavigationHint: (message: string | null) => void,
  ): Promise<void> {
    const playerArrival = this.#requireAnchor(playerArrivalAnchorId);
    const sequenceInputWasEnabled = this.#sequenceInputEnabled;
    const traversableVisuals = [...this.#visuals.values()].filter(
      (visual) => visual !== this.#player,
    );
    const collisionStates = traversableVisuals.map(
      ({ collisionEnabled }) => collisionEnabled,
    );
    traversableVisuals.forEach((visual) => {
      visual.collisionEnabled = false;
      this.#runtimeActor(visual.actorId).state.collisionEnabled = false;
    });
    this.setMovementEnabled(true);
    this.setNavigationObjective({
      kind: "arrival",
      targetId: playerArrivalAnchorId,
      label: "那人",
      position: playerArrival,
    });
    try {
      await Promise.all([
        ...actorIds.map((actorId) =>
          this.followActorPath(pathId, actorId, signal),
        ),
        this.#waitForPlayerArrival(playerArrival, 48, signal, () => {
          setNavigationHint(this.#escortNavigationHint(playerArrival));
        }),
      ]);
    } finally {
      setNavigationHint(null);
      this.setNavigationObjective(null);
      this.setMovementEnabled(sequenceInputWasEnabled);
      traversableVisuals.forEach((visual, index) => {
        const collisionEnabled = collisionStates[index] ?? false;
        visual.collisionEnabled = collisionEnabled;
        this.#runtimeActor(visual.actorId).state.collisionEnabled =
          collisionEnabled;
      });
    }
  }

  async waitForPlayerAtAnchor(
    anchorId: string,
    label: string,
    signal: AbortSignal,
    setNavigationHint: (message: string | null) => void,
  ): Promise<void> {
    const target = this.#requireAnchor(anchorId);
    const sequenceInputWasEnabled = this.#sequenceInputEnabled;
    this.setMovementEnabled(true);
    this.setNavigationObjective({
      kind: "arrival",
      targetId: anchorId,
      label,
      position: target,
    });
    try {
      await this.#waitForPlayerArrival(target, 56, signal, () => {
        setNavigationHint(`前往${label}所在的位置`);
      });
    } finally {
      setNavigationHint(null);
      this.setNavigationObjective(null);
      this.setMovementEnabled(sequenceInputWasEnabled);
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
      this.#transientCameraFocus = {
        position: structuredClone(point),
        regionId: this.#regionIdForPoint(point),
      };
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
    mode: FinalStateApplicationMode,
  ): Promise<void> {
    if (signal.aborted || this.#tearingDown) {
      throw abortError();
    }
    const playerActorState = state.actors[state.controls.playerActorId];
    if (playerActorState === undefined) {
      throw new RangeError(
        `Canonical player actor ${state.controls.playerActorId} has no final-state snapshot.`,
      );
    }
    const playerAnchor = this.#world.anchorById.get(playerActorState.anchorId);
    if (playerAnchor === undefined) {
      throw new RangeError(`Unknown canonical anchor ${playerActorState.anchorId}.`);
    }
    const preservePlayerPosition = mode === "normal";
    const preservedPlayerPosition = preservePlayerPosition
      ? this.playerPosition()
      : null;
    const preservedCameraFocus = preservePlayerPosition
      ? {
          x: this.cameras.main.scrollX + this.cameras.main.width / 2,
          y: this.cameras.main.scrollY + this.cameras.main.height / 2,
        }
      : null;
    if (mode === "normal") {
      const before: Record<string, VisualFinalState> = {};
      const expected: Record<string, VisualFinalState> = {};
      for (const [storyActorId, actorState] of Object.entries(state.actors)) {
        if (storyActorId === state.controls.playerActorId) {
          continue;
        }
        const anchor = this.#requireAnchor(actorState.anchorId);
        const visuals = this.#storyActorVisuals(storyActorId);
        for (const visual of visuals) {
          const key =
            visuals.length === 1
              ? storyActorId
              : `${storyActorId}:${visual.actorId}`;
          before[key] = {
            x: visual.body.x,
            y: visual.body.y,
            visible: visual.body.visible,
          };
          expected[key] = {
            x: anchor.x + visual.anchorOffset.x,
            y: anchor.y + visual.anchorOffset.y,
            visible: actorState.visible,
          };
        }
      }
      assertNormalFinalStateVisualDelta(before, expected);
    }
    for (const [storyActorId, actorState] of Object.entries(state.actors)) {
      const anchor = this.#requireAnchor(actorState.anchorId);
      for (const visual of this.#storyActorVisuals(storyActorId)) {
        const keepPlayerPosition =
          preservedPlayerPosition !== null &&
          storyActorId === state.controls.playerActorId;
        if (mode === "converge" || keepPlayerPosition) {
          visual.body.setPosition(
            keepPlayerPosition
              ? preservedPlayerPosition.x
              : anchor.x + visual.anchorOffset.x,
            keepPlayerPosition
              ? preservedPlayerPosition.y
              : anchor.y + visual.anchorOffset.y,
          );
        }
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
          actorState.label,
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
    this.#syncActorFacingToMan();
    this.#syncOccluderAlpha();
    const playerVisuals = this.#storyActorVisuals(state.controls.playerActorId);
    if (!playerVisuals.includes(this.#player!)) {
      throw new Error(
        `Canonical player actor ${state.controls.playerActorId} is not the rendered player.`,
      );
    }
    this.#fixedPointNavigation = null;
    this.#setVisualMotion(this.#player!, false, 0);
    const cameraAnchorContract = this.#world.anchorById.get(
      state.camera.anchorId,
    );
    if (cameraAnchorContract === undefined) {
      throw new RangeError(`Unknown canonical anchor ${state.camera.anchorId}.`);
    }
    const appliedCamera = this.#applyCanonicalCamera(state, preservedCameraFocus);
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
    this.#playerMovedSinceLastFinalState = false;
    this.#handlers?.onWorldUpdate("gameplay");
  }

  snapshotAppliedFinalState(): AppliedStoryFinalState | null {
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
    this.#fixedPointNavigation = null;
    this.#virtualDirection = { x: 0, y: 0 };
  }

  get tearingDown(): boolean {
    return this.#tearingDown;
  }

  #applyCanonicalCamera(
    state: SliceFinalState,
    anchorOverride: Point | null = null,
  ): AppliedCanonicalCameraState {
    this.#transientCameraFocus = null;
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
      anchorPosition: anchorOverride ?? cameraAnchorContract.position,
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

  #applyTransientCameraFocus(focus: TransientCameraFocus): void {
    const zone = this.#world.cameraZoneByRegionId.get(focus.regionId);
    if (zone === undefined) {
      throw new RangeError(
        `No canonical camera zone exists for ${focus.regionId}.`,
      );
    }
    const camera = this.cameras.main;
    const mobile = Math.min(camera.width, camera.height) <= 640;
    camera.resetFX();
    camera.stopFollow();
    camera.setZoom(mobile ? zone.mobileZoom : zone.desktopZoom);
    camera.setDeadzone(zone.deadZone.width, zone.deadZone.height);
    camera.centerOn(focus.position.x, focus.position.y);
    this.#cameraFollowingObserver = false;
  }

  #regionIdForPoint(point: Point): string {
    const region = this.#world.regionContracts.find(
      ({ bounds }) =>
        point.x >= bounds.x &&
        point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.height,
    );
    if (region === undefined) {
      throw new RangeError(
        `Camera path point (${point.x}, ${point.y}) is outside every region.`,
      );
    }
    return region.id;
  }

  #applyInitialCourtyardCamera(): void {
    const anchor = this.#world.anchorById.get("courtyard.camera");
    const zone = this.#world.cameraZoneByRegionId.get("courtyard");
    if (anchor === undefined || zone === undefined || this.#player === undefined) {
      throw new Error("The opening composition requires its canonical courtyard camera.");
    }
    const camera = this.cameras.main;
    const mobile = Math.min(camera.width, camera.height) <= 640;
    camera.setZoom(mobile ? zone.mobileZoom : zone.desktopZoom);
    camera.setDeadzone(zone.deadZone.width, zone.deadZone.height);
    camera.startFollow(
      this.#player.body,
      true,
      0.08,
      0.08,
      this.#player.body.x - anchor.position.x,
      this.#player.body.y - anchor.position.y,
    );
    this.#cameraFollowingObserver = true;
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

  #registerDirectionalActorFrames(): void {
    const observerTexture = this.textures.get(STORY_ART.actors.observer.key);
    for (const [direction, x] of Object.entries({
      down: 0,
      up: 36,
      right: 72,
      left: 108,
    }) as readonly [CardinalDirection, number][]) {
      const frame = directionalFrameName("observer", direction, "idle");
      if (!observerTexture.has(frame)) {
        observerTexture.add(frame, 0, x, 0, 36, 128);
      }
    }

    const jesusTexture = this.textures.get(
      STORY_ART.actors.jesusDirectional.key,
    );
    for (const [direction, frames] of Object.entries(
      JESUS_DIRECTIONAL_FRAMES.frames,
    ) as readonly [
      CardinalDirection,
      Readonly<{ idle: number; walk: readonly number[] }>,
    ][]) {
      const addFrame = (name: string, frameIndex: number): void => {
        if (jesusTexture.has(name)) {
          return;
        }
        const column = frameIndex % 3;
        const row = Math.floor(frameIndex / 3);
        jesusTexture.add(
          name,
          0,
          column * JESUS_DIRECTIONAL_FRAMES.frameWidth,
          row * JESUS_DIRECTIONAL_FRAMES.frameHeight,
          JESUS_DIRECTIONAL_FRAMES.frameWidth,
          JESUS_DIRECTIONAL_FRAMES.frameHeight,
        );
      };
      addFrame(
        directionalFrameName("jesus", direction, "idle"),
        frames.idle,
      );
      frames.walk.forEach((frameIndex, index) => {
        if (index !== 0 && index !== 1) {
          throw new Error("Jesus walk animation must contain exactly two steps.");
        }
        addFrame(
          directionalFrameName("jesus", direction, "walk", index),
          frameIndex,
        );
      });
    }
  }

  #setVisualMotion(
    visual: ActorVisual,
    moving: boolean,
    elapsedDeltaMs: number,
  ): void {
    visual.moving = moving;
    visual.walkElapsedMs = moving
      ? visual.walkElapsedMs + elapsedDeltaMs
      : 0;
    const actorFrameId =
      visual.storyActorId === "observer"
        ? "observer"
        : visual.storyActorId === "jesus"
          ? "jesus"
          : null;
    if (actorFrameId === null) {
      return;
    }
    const motion = moving && actorFrameId === "jesus" ? "walk" : "idle";
    const frame = directionalFrameName(
      actorFrameId,
      visual.direction,
      motion,
      walkStepAt(visual.walkElapsedMs),
    );
    if (!visual.body.texture.has(frame)) {
      throw new Error(`Directional runtime frame ${frame} is not registered.`);
    }
    visual.body.setFrame(frame);
  }

  #setVisualArt(
    visual: ActorVisual,
    art: ReturnType<typeof actorArtForSpawn>,
  ): void {
    const renderProfile = actorRenderProfileForSpawn(visual.actorId);
    visual.body
      .setTexture(art.key)
      .setOrigin(0.5, art.footBaseline! / art.frameHeight)
      .setScale(renderProfile.targetDisplayHeight / art.frameHeight);
    if (art === STORY_ART.actors.jesusDirectional) {
      this.#setVisualMotion(visual, visual.moving, 0);
    }
    this.#syncLabel(visual);
  }

  #setVisualDirection(
    visual: ActorVisual,
    direction: CardinalDirection,
  ): void {
    visual.direction = direction;
    if (
      visual.storyActorId === "observer" ||
      visual.storyActorId === "jesus"
    ) {
      this.#setVisualMotion(visual, visual.moving, 0);
    }
  }

  #setManBornBlindPose(pose: ManBornBlindPose): void {
    const visual = this.#storyActorVisuals("man-born-blind")[0];
    if (visual === undefined) {
      throw new Error("The man born blind must have one map visual.");
    }
    visual.pose = pose;
    const runtimeActor = this.#runtimeActor(visual.actorId);
    runtimeActor.state.pose = pose;
    visual.label.setText(runtimeActor.state.label);
    this.#syncNarrativeTextures();
  }

  #syncActorFacingToMan(excludedVisual?: ActorVisual): void {
    const man = this.#storyActorVisuals("man-born-blind")[0];
    if (man === undefined) {
      return;
    }
    for (const visual of this.#visuals.values()) {
      if (visual === man || visual === excludedVisual) {
        continue;
      }
      if (visual.storyActorId === "observer") {
        continue;
      }
      const direction = focusDirection(visual.body.x, man.body.x);
      const directionalArt =
        visual.storyActorId === "jesus"
          ? this.#jesusArt(direction)
          : visual.actorId === "disciple-left"
            ? direction === "right"
              ? STORY_ART.actors.discipleALookRight
              : STORY_ART.actors.discipleA
            : visual.actorId === "disciple-right"
              ? direction === "right"
                ? STORY_ART.actors.discipleBLookRight
                : STORY_ART.actors.discipleB
              : null;
      if (directionalArt !== null) {
        this.#setVisualArt(visual, directionalArt);
        if (directionalArt === STORY_ART.actors.jesusDirectional) {
          this.#setVisualDirection(visual, direction);
        } else {
          visual.direction = direction;
        }
      }
    }
  }

  #jesusArt(direction: CardinalDirection) {
    const man = this.#storyActorVisuals("man-born-blind")[0];
    if (man?.pose === "worship") {
      return STORY_ART.actors.jesusFoundMan;
    }
    if (man?.pose !== "clay-on-eyes") {
      return STORY_ART.actors.jesusDirectional;
    }
    return direction === "right"
      ? STORY_ART.actors.jesusClayActionLookRight
      : STORY_ART.actors.jesusClayAction;
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
    this.#setVisualDirection(
      this.#player,
      directionFromDelta(deltaX, deltaY, this.#player.direction),
    );
    this.#player.body.setPosition(target.x, target.y);
    this.#playerMovedSinceLastFinalState = true;
    this.#player.body.setDepth(this.#actorDepth(target.y));
    this.#syncLabel(this.#player);
    this.#syncActorFacingToMan();
    this.#syncOccluderAlpha();
    this.#handlers?.onWorldUpdate("gameplay", {
      previousPosition: start,
      currentPosition: target,
    });
    return true;
  }

  #syncNavigationObjectiveMarker(): void {
    if (this.#objectiveMarker === undefined) {
      return;
    }
    if (this.#navigationObjective === null || this.#tearingDown) {
      this.#objectiveMarker.setVisible(false);
      return;
    }
    const objective = this.#navigationObjective;
    const markerPosition = this.#objectiveMarkerPosition(objective);
    const arrivalObjective = objective.kind === "arrival";
    this.#objectiveRing?.setVisible(arrivalObjective);
    this.#objectiveArrow?.setPosition(0, arrivalObjective ? -48 : -4);
    this.#objectiveLabel
      ?.setPosition(0, arrivalObjective ? -68 : -18)
      .setText(this.#objectivePromptText(objective.kind));
    this.#objectiveMarker
      .setPosition(markerPosition.x, markerPosition.y)
      .setDepth(arrivalObjective ? 40 : 42)
      .setVisible(true);
  }

  #objectivePromptText(kind: WorldNavigationObjective["kind"]): string {
    if (kind === "arrival") {
      return "前往";
    }
    if (kind === "proximity") {
      return "接近";
    }
    return "互動";
  }

  #objectiveTargetPosition(objective: WorldNavigationObjective): Point {
    if (objective.kind === "arrival") {
      return objective.position;
    }
    const targetVisual = this.#storyActorVisuals(objective.targetId).find(
      ({ body }) => body.visible,
    );
    if (targetVisual === undefined) {
      return objective.position;
    }
    return {
      x: targetVisual.body.x,
      y: targetVisual.body.y,
    };
  }

  #objectiveMarkerPosition(objective: WorldNavigationObjective): Point {
    if (objective.kind === "arrival") {
      return objective.position;
    }
    const targetVisual = this.#storyActorVisuals(objective.targetId).find(
      ({ body }) => body.visible,
    );
    if (targetVisual === undefined) {
      const fallback = this.#objectiveTargetPosition(objective);
      return {
        x: fallback.x,
        y: fallback.y - 92,
      };
    }
    return {
      x: targetVisual.label.x,
      y: targetVisual.label.y - targetVisual.label.height - 8,
    };
  }

  #objectiveTapRadius(kind: WorldNavigationObjective["kind"]): number {
    return kind === "arrival" ? 64 : 56;
  }

  #activateNavigationObjective(): void {
    if (
      this.#navigationObjective === null ||
      this.#player === undefined ||
      !this.#movementAllowed()
    ) {
      return;
    }
    const objectivePosition = this.#objectiveTargetPosition(
      this.#navigationObjective,
    );
    if (
      this.#navigationObjective.kind === "interaction" &&
      Phaser.Math.Distance.Between(
        this.#player.body.x,
        this.#player.body.y,
        objectivePosition.x,
        objectivePosition.y,
      ) <= INTERACTION_RADIUS_PIXELS &&
      this.#interactionAllowed()
    ) {
      this.#handlers?.onInteract(this.#navigationObjective.targetId);
      return;
    }
    const path = this.#objectivePath(this.#navigationObjective, objectivePosition);
    this.#fixedPointNavigation = beginFixedPointNavigation(
      objectivePosition,
      path,
    );
  }

  #beginFixedPointNavigation(target: Point): void {
    this.#fixedPointNavigation = beginFixedPointNavigation(
      target,
      this.#world.findPath(this.playerPosition(), target),
    );
  }

  #objectivePath(
    objective: WorldNavigationObjective,
    objectivePosition: Point,
  ): readonly Point[] {
    const start = this.playerPosition();
    const direct = this.#world.findPath(start, objectivePosition);
    if (direct.length > 0) {
      return direct;
    }
    if (objective.kind === "arrival") {
      return direct;
    }
    const candidates = this.#interactionApproachCandidates(objectivePosition);
    for (const candidate of candidates) {
      if (!this.#world.isWalkable(candidate)) {
        continue;
      }
      const path = this.#world.findPath(start, candidate);
      if (path.length > 0) {
        return path;
      }
    }
    return direct;
  }

  #interactionApproachCandidates(target: Point): readonly Point[] {
    const ringRadii = [72, 92, 112, 132];
    const candidates: Point[] = [];
    for (const radius of ringRadii) {
      for (let step = 0; step < 16; step += 1) {
        const angle = (Math.PI * 2 * step) / 16;
        candidates.push({
          x: target.x + Math.cos(angle) * radius,
          y: target.y + Math.sin(angle) * radius,
        });
      }
    }
    candidates.sort((left, right) => {
      const start = this.playerPosition();
      return (
        Phaser.Math.Distance.Between(start.x, start.y, left.x, left.y) -
        Phaser.Math.Distance.Between(start.x, start.y, right.x, right.y)
      );
    });
    return candidates;
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
    this.#setVisualDirection(
      visual,
      directionFromDelta(
        target.x - visual.body.x,
        target.y - visual.body.y,
        visual.direction,
      ),
    );
    this.#setVisualMotion(visual, true, 0);
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
            this.#setVisualMotion(visual, true, this.game.loop.delta);
            visual.body.setDepth(this.#actorDepth(visual.body.y));
            this.#syncLabel(visual);
            this.#syncActorFacingToMan(visual);
          }
        },
        onComplete: () =>
          finish(() => {
            this.#setVisualMotion(visual, false, 0);
            resolve();
          }),
      });
      const onAbort = (): void => {
        tween.stop();
        finish(() => {
          this.#setVisualMotion(visual, false, 0);
          reject(abortError());
        });
      };
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  #waitForPlayerArrival(
    anchor: Point,
    radius: number,
    signal: AbortSignal,
    onCheck: () => void,
  ): Promise<void> {
    if (signal.aborted) {
      return Promise.reject(abortError());
    }
    return new Promise((resolve, reject) => {
      let timer: Phaser.Time.TimerEvent | undefined;
      let settled = false;
      const finish = (operation: () => void): void => {
        if (settled) {
          return;
        }
        settled = true;
        timer?.remove(false);
        signal.removeEventListener("abort", onAbort);
        operation();
      };
      const check = (): void => {
        onCheck();
        if (this.#tearingDown) {
          finish(() => reject(abortError()));
          return;
        }
        const player = this.playerPosition();
        if (
          Phaser.Math.Distance.Between(
            player.x,
            player.y,
            anchor.x,
            anchor.y,
          ) <= radius
        ) {
          finish(resolve);
        }
      };
      const onAbort = (): void => finish(() => reject(abortError()));
      timer = this.time.addEvent({
        delay: 50,
        loop: true,
        callback: check,
      });
      signal.addEventListener("abort", onAbort, { once: true });
      check();
    });
  }

  #escortNavigationHint(target: Point): string {
    const player = this.playerPosition();
    const path = this.#world.findPath(player, target);
    const waypoint =
      path.find(
        (point) =>
          Phaser.Math.Distance.Between(player.x, player.y, point.x, point.y) >
          18,
      ) ?? target;
    const deltaX = waypoint.x - player.x;
    const deltaY = waypoint.y - player.y;
    const vertical =
      Math.abs(deltaY) <= 14 ? "" : deltaY < 0 ? "北" : "南";
    const horizontal =
      Math.abs(deltaX) <= 14 ? "" : deltaX < 0 ? "西" : "東";
    const direction = `${vertical}${horizontal}` || "前方";
    return `跟隨那人往${direction}前行`;
  }

  #actorDepth(y: number): number {
    return 10 + y / 10000;
  }

  #createStaticProps(): void {
    const textureById: Readonly<Record<string, string>> = {
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
    const textureById: Readonly<Record<string, string>> = {};
    for (const occluder of occlusion.foregroundOccluders as readonly {
      readonly id: string;
      readonly polygon: readonly Point[];
      readonly fadedOpacity: number;
    }[]) {
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
        polygon: new Phaser.Geom.Polygon([...occluder.polygon]),
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
      const artByPose = {
        idle: STORY_ART.actors.manBlind,
        seated: STORY_ART.actors.manBlind,
        "clay-on-eyes": STORY_ART.actors.manClay,
        standing: STORY_ART.actors.manSeeing,
        walking: STORY_ART.actors.manSeeing,
        washing: STORY_ART.actors.manSeeing,
        "standing-seeing": STORY_ART.actors.manSeeing,
        "washed-seeing": STORY_ART.actors.manSeeing,
        worship: STORY_ART.actors.manWorship,
      };
      const art =
        artByPose[man.pose as keyof typeof artByPose] ??
        STORY_ART.actors.manSeeing;
      this.#setVisualArt(man, art);
    }
    const jesus = this.#storyActorVisuals("jesus")[0];
    if (jesus !== undefined) {
      const art = this.#jesusArt("left");
      this.#setVisualArt(jesus, art);
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
