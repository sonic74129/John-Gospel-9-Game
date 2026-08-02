import Phaser from "phaser";

import type { Point } from "@sonic74129/content-schema";

import type { WorldRuntime } from "./world-adapter.ts";

const AREA_COLORS = [0xd2b887, 0x8ca6a3, 0xc5a16e, 0xa85f3e, 0x66704b];

export class GrayboxScene extends Phaser.Scene {
  readonly #world: WorldRuntime;
  readonly #onReady: (scene: GrayboxScene) => void;
  #player?: Phaser.GameObjects.Arc;
  #cursorKeys?: Phaser.Types.Input.Keyboard.CursorKeys;
  #wasd?: Readonly<{
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  }>;
  #path: readonly Point[] = [];

  constructor(world: WorldRuntime, onReady: (scene: GrayboxScene) => void) {
    super({ key: "john-9-graybox" });
    this.#world = world;
    this.#onReady = onReady;
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
      if (!actor.state.visible) {
        continue;
      }
      const isPlayer = actor.state.role === "player";
      const marker = this.add
        .circle(
          actor.definition.position.x,
          actor.definition.position.y,
          isPlayer ? 24 : 18,
          isPlayer ? 0x526c73 : 0x5a3d4b,
        )
        .setStrokeStyle(4, 0xe2d2b2)
        .setDepth(4);
      if (isPlayer) {
        this.#player = marker;
      }
    }

    if (this.#player === undefined) {
      throw new Error("The world contract must expose one player spawn.");
    }

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
    }
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.#player === undefined) {
        return;
      }
      this.#path = this.#world.findPath(
        { x: this.#player.x, y: this.#player.y },
        { x: pointer.worldX, y: pointer.worldY },
      );
    });
    this.cameras.main.startFollow(this.#player, true, 0.08, 0.08);
    this.#onReady(this);
  }

  update(_time: number, delta: number): void {
    if (this.#player === undefined) {
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
      next.x - this.#player.x,
      next.y - this.#player.y,
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

  #movePlayer(deltaX: number, deltaY: number): boolean {
    if (this.#player === undefined) {
      return false;
    }
    const start = { x: this.#player.x, y: this.#player.y };
    const target = { x: start.x + deltaX, y: start.y + deltaY };
    if (!this.#world.isWalkableSegment(start, target)) {
      return false;
    }
    this.#player.setPosition(target.x, target.y);
    return true;
  }
}
