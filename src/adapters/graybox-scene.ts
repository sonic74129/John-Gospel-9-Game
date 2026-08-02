import Phaser from "phaser";

import type { Point } from "@sonic74129/content-schema";

import { CANDIDATE_JESUS_SHEET } from "./candidate-asset-adapter.ts";
import type { SliceFinalState } from "./sequence-adapter.ts";
import type { WorldRuntime } from "./world-adapter.ts";

const AREA_COLORS = [0xd2b887, 0x8ca6a3, 0xc5a16e, 0xa85f3e, 0x66704b];

interface ActorVisual {
  readonly actorId: string;
  readonly storyActorId: string;
  readonly body: Phaser.GameObjects.Arc | Phaser.GameObjects.Sprite;
  readonly label: Phaser.GameObjects.Text;
  readonly anchorOffset: Point;
  pose: string;
}

export interface SceneInteractionHandlers {
  readonly onWorldUpdate: () => void;
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
      }>
    >
  >;
  readonly clayVisible: boolean;
  readonly movementEnabled: boolean;
}

function abortError(): Error {
  const error = new Error("Sequence operation aborted");
  error.name = "AbortError";
  return error;
}

export class GrayboxScene extends Phaser.Scene {
  readonly #world: WorldRuntime;
  readonly #onReady: (scene: GrayboxScene) => void;
  readonly #visuals = new Map<string, ActorVisual>();
  #player?: ActorVisual;
  #clay?: Phaser.GameObjects.Arc;
  #cursorKeys?: Phaser.Types.Input.Keyboard.CursorKeys;
  #interactKey?: Phaser.Input.Keyboard.Key;
  #wasd?: Readonly<{
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  }>;
  #path: readonly Point[] = [];
  #movementEnabled = true;
  #handlers?: SceneInteractionHandlers;

  constructor(world: WorldRuntime, onReady: (scene: GrayboxScene) => void) {
    super({ key: "john-9-graybox" });
    this.#world = world;
    this.#onReady = onReady;
  }

  get navigation(): WorldRuntime["navigation"] {
    return this.#world.navigation;
  }

  preload(): void {
    this.load.spritesheet(
      CANDIDATE_JESUS_SHEET.key,
      `${import.meta.env.BASE_URL}${CANDIDATE_JESUS_SHEET.path}`,
      {
        frameWidth: CANDIDATE_JESUS_SHEET.frameWidth,
        frameHeight: CANDIDATE_JESUS_SHEET.frameHeight,
      },
    );
  }

  create(): void {
    const { definition } = this.#world;
    this.cameras.main.setBounds(0, 0, definition.width, definition.height);

    const graphics = this.add.graphics();
    this.#world.areas.forEach((area, index) => {
      const { x, y, width, height, id } = area.definition;
      graphics.fillStyle(AREA_COLORS[index % AREA_COLORS.length]!, 0.72);
      graphics.lineStyle(4, 0x3c352f, 0.55);
      graphics.fillRoundedRect(x, y, width, height, 28);
      graphics.strokeRoundedRect(x, y, width, height, 28);
      this.add
        .text(x + 24, y + 20, id, {
          color: "#3c352f",
          fontFamily: "system-ui, sans-serif",
          fontSize: "24px",
          fontStyle: "bold",
        })
        .setDepth(2);
    });

    for (const actor of this.#world.actors) {
      const isPlayer = actor.state.role === "player";
      const isCandidateJesus = actor.state.storyActorId === "jesus";
      const body = isCandidateJesus
        ? this.add
            .sprite(
              actor.definition.position.x,
              actor.definition.position.y,
              CANDIDATE_JESUS_SHEET.key,
              CANDIDATE_JESUS_SHEET.idleFrontFrame,
            )
            .setOrigin(
              0.5,
              CANDIDATE_JESUS_SHEET.footBaseline /
                CANDIDATE_JESUS_SHEET.frameHeight,
            )
            .setScale(0.42)
        : this.add.circle(
            actor.definition.position.x,
            actor.definition.position.y,
            isPlayer ? 24 : 18,
            isPlayer ? 0x526c73 : 0x5a3d4b,
          );
      body.setDepth(4);
      if (body instanceof Phaser.GameObjects.Arc) {
        body.setStrokeStyle(4, 0xe2d2b2);
      }
      const labelText = isCandidateJesus
        ? `${actor.state.label} · 候選身分灰盒`
        : actor.state.label;
      const label = this.add
        .text(actor.definition.position.x, actor.definition.position.y - 44, labelText, {
          color: "#fffaf1",
          backgroundColor: "#3c352fe6",
          fontFamily: "system-ui, sans-serif",
          fontSize: "15px",
          padding: { x: 7, y: 4 },
        })
        .setOrigin(0.5, 1)
        .setDepth(5);
      const visual: ActorVisual = {
        actorId: actor.definition.id,
        storyActorId: actor.state.storyActorId,
        body,
        label,
        anchorOffset: actor.state.anchorOffset,
        pose: actor.state.pose,
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
      .circle(clayAnchor.x, clayAnchor.y, 10, 0x8f5f42)
      .setStrokeStyle(2, 0x3c352f)
      .setDepth(3)
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
      if (!this.#movementEnabled || this.#player === undefined) {
        return;
      }
      const target = { x: pointer.worldX, y: pointer.worldY };
      const nearby = this.#nearestStoryActor(target, 52);
      if (nearby !== undefined) {
        this.#handlers?.onInteract(nearby);
        return;
      }
      this.#path = this.#world.findPath(this.playerPosition(), target);
    });
    this.cameras.main.startFollow(this.#player.body, true, 0.08, 0.08);
    this.#onReady(this);
    this.#handlers?.onWorldUpdate();
  }

  update(_time: number, delta: number): void {
    if (this.#player === undefined) {
      return;
    }
    if (
      this.#movementEnabled &&
      this.#interactKey !== undefined &&
      Phaser.Input.Keyboard.JustDown(this.#interactKey)
    ) {
      const nearby = this.#nearestStoryActor(this.playerPosition(), 110);
      if (nearby !== undefined) {
        this.#handlers?.onInteract(nearby);
      }
    }
    if (!this.#movementEnabled) {
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

  setMovementEnabled(enabled: boolean): void {
    this.#movementEnabled = enabled;
    if (!enabled) {
      this.#path = [];
    }
  }

  captureRuntimeState(): GrayboxSceneSnapshot {
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
          },
        ]),
      ),
      clayVisible: this.#clay?.visible ?? false,
      movementEnabled: this.#movementEnabled,
    };
  }

  restoreRuntimeState(snapshot: GrayboxSceneSnapshot): void {
    this.tweens.killAll();
    this.cameras.main.resetFX();
    for (const [actorId, actorState] of Object.entries(snapshot.actors)) {
      const visual = this.#visuals.get(actorId);
      if (visual === undefined) {
        throw new Error(`Cannot restore unknown map actor ${actorId}.`);
      }
      visual.body.setPosition(actorState.x, actorState.y);
      visual.pose = actorState.pose;
      visual.label.setText(actorState.label);
      this.#syncLabel(visual);
      this.#setVisualVisible(visual, actorState.visible);
    }
    this.#clay?.setVisible(snapshot.clayVisible);
    this.#movementEnabled = snapshot.movementEnabled;
    this.#path = [];
    if (this.#player !== undefined) {
      this.cameras.main.startFollow(this.#player.body, true, 0.08, 0.08);
    }
    this.#handlers?.onWorldUpdate();
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

  anchorPosition(anchorId: string): Point {
    return this.#requireAnchor(anchorId);
  }

  focusAnchor(anchorId: string): void {
    const anchor = this.#requireAnchor(anchorId);
    this.cameras.main.stopFollow();
    this.cameras.main.pan(anchor.x, anchor.y, 350, "Sine.easeInOut");
  }

  setActorPose(storyActorId: string, pose: string): void {
    for (const visual of this.#storyActorVisuals(storyActorId)) {
      visual.pose = pose;
      visual.label.setText(
        `${visual.label.text.split(" · ")[0]} · ${pose}`,
      );
    }
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
    for (const point of path.points) {
      if (signal.aborted) {
        throw abortError();
      }
      this.cameras.main.pan(point.x, point.y, 250, "Sine.easeInOut");
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(resolve, 250);
        signal.addEventListener(
          "abort",
          () => {
            window.clearTimeout(timer);
            reject(abortError());
          },
          { once: true },
        );
      });
    }
  }

  async applyFinalState(
    state: SliceFinalState,
    signal: AbortSignal,
  ): Promise<void> {
    if (signal.aborted) {
      throw abortError();
    }
    for (const [storyActorId, actorState] of Object.entries(state.actors)) {
      const anchor = this.#requireAnchor(actorState.anchorId);
      for (const visual of this.#storyActorVisuals(storyActorId)) {
        visual.body.setPosition(
          anchor.x + visual.anchorOffset.x,
          anchor.y + visual.anchorOffset.y,
        );
        visual.label.setPosition(
          visual.body.x,
          visual.body.y - this.#labelOffset(visual),
        );
        visual.pose = actorState.pose;
        visual.label.setText(
          visual.storyActorId === "jesus"
            ? `${actorState.label} · 候選身分灰盒`
            : `${actorState.label} · ${actorState.pose}`,
        );
        this.#setVisualVisible(visual, actorState.visible);
      }
    }
    if (this.#clay !== undefined) {
      this.#clay.setVisible(state.props.clay.visible);
    }
    this.#movementEnabled = state.controls.movementEnabled;
    this.#path = [];
    if (this.#player !== undefined) {
      this.cameras.main.resetFX();
      this.cameras.main.startFollow(this.#player.body, true, 0.08, 0.08);
    }
    this.#handlers?.onWorldUpdate();
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
      if (!visual.body.visible || visual.storyActorId === "observer") {
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
  }

  #labelOffset(visual: ActorVisual): number {
    return visual.storyActorId === "jesus" ? 78 : 44;
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
    this.#player.body.setPosition(target.x, target.y);
    this.#syncLabel(this.#player);
    this.#handlers?.onWorldUpdate();
    return true;
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
        onUpdate: () => this.#syncLabel(visual),
        onComplete: () => finish(resolve),
      });
      const onAbort = (): void => {
        tween.stop();
        finish(() => reject(abortError()));
      };
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }
}
