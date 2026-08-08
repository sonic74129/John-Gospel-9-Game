import assert from "node:assert/strict";
import test from "node:test";

import {
  directionalFrameName,
  directionFromDelta,
  focusDirection,
  walkStepAt,
} from "../../src/adapters/actor-facing.ts";
import { actorPresentationFor } from "../../src/adapters/actor-presentation.ts";
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

test("actor presentation keeps narrative poses at a stable visual scale with clear labels", () => {
  assert.deepEqual(
    actorPresentationFor({
      actorId: "jesus",
      storyActorId: "jesus",
      pose: "idle",
      artKey: "john9-art-jesus-directional",
      frameHeight: 200,
    }),
    { displayHeight: 132, labelOffset: 114, scale: 0.66 },
  );
  assert.deepEqual(
    actorPresentationFor({
      actorId: "jesus",
      storyActorId: "jesus",
      pose: "idle",
      artKey: "john9-art-jesus-clay-action",
      frameHeight: 132,
    }),
    { displayHeight: 132, labelOffset: 71, scale: 1 },
  );
  assert.deepEqual(
    actorPresentationFor({
      actorId: "man-born-blind",
      storyActorId: "man-born-blind",
      pose: "standing",
      artKey: "john9-art-man-seeing",
      frameHeight: 128,
    }),
    { displayHeight: 160, labelOffset: 107, scale: 1.25 },
  );
  assert.throws(
    () =>
      actorPresentationFor({
        actorId: "observer",
        storyActorId: "observer",
        pose: "idle",
        artKey: "observer",
        frameHeight: 0,
      }),
    /positive/,
  );
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
  assert.match(scene, /#framePathActors\(\)/);
  assert.match(scene, /#sequenceMovementOverride/);
  assert.doesNotMatch(scene, /\$\{runtimeActor\.state\.label\} · \$\{pose\}/);
  assert.doesNotMatch(scene, /\$\{actorState\.label\} · \$\{actorState\.pose\}/);
});
