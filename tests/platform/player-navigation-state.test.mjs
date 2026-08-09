import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  beginFixedPointNavigation,
  cancelNavigationForDirectionalInput,
  resolvePlayerMovementTick,
} from "../../src/platform/player-navigation-state.ts";

test("B05 observer remains fixed without direct input", () => {
  const position = { x: 1514, y: 620 };
  const result = resolvePlayerMovementTick({
    position,
    directionalInput: { x: 0, y: 0 },
    navigation: null,
    speed: 240,
    deltaMs: 16,
  });
  assert.deepEqual(result.position, position);
  assert.equal(result.moved, false);
  assert.equal(result.navigation, null);
});

test("pointer and touch navigation retain one immutable map target", () => {
  const fixedTarget = { x: 1120, y: 1060 };
  const navigation = beginFixedPointNavigation(
    fixedTarget,
    [
      { x: 1514, y: 620 },
      { x: 1300, y: 820 },
      fixedTarget,
    ],
  );
  const movingNpcPosition = { x: 1180, y: 980 };

  assert.deepEqual(navigation.target, fixedTarget);
  assert.notDeepEqual(navigation.target, movingNpcPosition);
  assert.deepEqual(navigation.waypoints.at(-1), fixedTarget);
});

test("directional input immediately cancels a fixed-point path", () => {
  const navigation = beginFixedPointNavigation(
    { x: 1120, y: 1060 },
    [{ x: 1300, y: 820 }, { x: 1120, y: 1060 }],
  );
  assert.equal(
    cancelNavigationForDirectionalInput(navigation, { x: 0, y: 0 }),
    navigation,
  );
  assert.equal(
    cancelNavigationForDirectionalInput(navigation, { x: 1, y: 0 }),
    null,
  );
});

test("Space remains local interaction and mobile directions use direct input", async () => {
  const [scene, shell, main] = await Promise.all([
    readFile("src/adapters/story-scene.ts", "utf8"),
    readFile("src/platform/app-shell.ts", "utf8"),
    readFile("src/main.ts", "utf8"),
  ]);
  const spaceStart = scene.indexOf("Phaser.Input.Keyboard.JustDown");
  const movementStart = scene.indexOf("if (!this.#movementAllowed())", spaceStart);
  const spaceHandling = scene.slice(spaceStart, movementStart);
  assert.doesNotMatch(spaceHandling, /#activateNavigationObjective/);
  assert.match(spaceHandling, /objectiveDistance <= INTERACTION_RADIUS_PIXELS/);
  for (const direction of ["up", "down", "left", "right"]) {
    assert.match(shell, new RegExp(`data-move-${direction}`));
  }
  assert.match(shell, /pointerdown/);
  assert.match(shell, /pointerup/);
  assert.match(main, /gameScene\?\.setVirtualDirection\(direction\)/);
});
