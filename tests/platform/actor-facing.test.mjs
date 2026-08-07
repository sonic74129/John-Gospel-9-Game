import assert from "node:assert/strict";
import test from "node:test";

import {
  directionalFrameName,
  directionFromDelta,
  focusDirection,
  walkStepAt,
} from "../../src/adapters/actor-facing.ts";
import { CANDIDATE_JESUS_SHEET } from "../../src/adapters/candidate-asset-adapter.ts";

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

test("directional walk frames alternate in two steps and return to idle", () => {
  assert.equal(walkStepAt(0), 0);
  assert.equal(walkStepAt(159), 0);
  assert.equal(walkStepAt(160), 1);
  assert.equal(walkStepAt(320), 0);
  assert.equal(directionalFrameName("jesus", "up", "walk", 0), "jesus-up-walk-1");
  assert.equal(directionalFrameName("jesus", "up", "walk", 1), "jesus-up-walk-2");
  assert.equal(directionalFrameName("jesus", "up", "idle"), "jesus-up-idle");
  assert.throws(() => walkStepAt(-1), /non-negative/);
});

test("pinned Jesus sheet maps four rows to idle and two walk cells", () => {
  assert.equal(CANDIDATE_JESUS_SHEET.frameWidth, 96);
  assert.equal(CANDIDATE_JESUS_SHEET.frameHeight, 200);
  assert.equal(CANDIDATE_JESUS_SHEET.footBaseline, 193);
  assert.deepEqual(CANDIDATE_JESUS_SHEET.frames, {
    down: { idle: 0, walk: [1, 2] },
    up: { idle: 3, walk: [4, 5] },
    right: { idle: 6, walk: [7, 8] },
    left: { idle: 9, walk: [10, 11] },
  });
});

test("the scene registers actual observer atlas frames and never puts pose text in labels", async () => {
  const scene = await import("node:fs/promises").then(({ readFile }) =>
    readFile("src/adapters/story-scene.ts", "utf8"),
  );
  for (const direction of ["down", "up", "right", "left"]) {
    assert.match(scene, /directionalFrameName\("observer", direction, "idle"\)/);
    assert.match(
      scene,
      new RegExp(`directionalFrameName\\("jesus", direction, "(?:idle|walk)"`),
    );
  }
  assert.match(scene, /#setVisualMotion\(this\.#player, false, 0\)/);
  assert.match(scene, /#syncActorFacingToMan\(visual\)/);
  assert.doesNotMatch(scene, /\$\{runtimeActor\.state\.label\} · \$\{pose\}/);
  assert.doesNotMatch(scene, /\$\{actorState\.label\} · \$\{actorState\.pose\}/);
});
