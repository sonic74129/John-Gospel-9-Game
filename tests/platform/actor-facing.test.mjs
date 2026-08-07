import assert from "node:assert/strict";
import test from "node:test";

import {
  directionFromDelta,
  focusDirection,
} from "../../src/adapters/actor-facing.ts";

test("actors select an explicit gaze direction toward the central man", async () => {
  assert.equal(focusDirection(540, 760), "right");
  assert.equal(focusDirection(830, 760), "left");
  assert.equal(focusDirection(760, 760), "left");

  const scene = await import("node:fs/promises").then(({ readFile }) =>
    readFile("src/adapters/story-scene.ts", "utf8"),
  );
  assert.match(scene, /focusDirection/);
  assert.doesNotMatch(scene, /\.setFlipX/);
});

test("movement resolves all four cardinal directions without mirroring", () => {
  assert.equal(directionFromDelta(0, -1, "down"), "up");
  assert.equal(directionFromDelta(0, 1, "up"), "down");
  assert.equal(directionFromDelta(-1, 0, "down"), "left");
  assert.equal(directionFromDelta(1, 0, "down"), "right");
  assert.equal(directionFromDelta(0, 0, "left"), "left");
});

test("the scene registers actual observer atlas frames and never puts pose text in labels", async () => {
  const scene = await import("node:fs/promises").then(({ readFile }) =>
    readFile("src/adapters/story-scene.ts", "utf8"),
  );
  for (const direction of ["down", "up", "right", "left"]) {
    assert.match(scene, new RegExp(`observer-\\$\\{direction\\}|observer-${direction}`));
  }
  assert.doesNotMatch(scene, /\$\{runtimeActor\.state\.label\} · \$\{pose\}/);
  assert.doesNotMatch(scene, /\$\{actorState\.label\} · \$\{actorState\.pose\}/);
});
