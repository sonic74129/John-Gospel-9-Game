import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTOR_IDS,
  DIRECTIONAL_WALK_REQUIREMENTS,
  manBornBlindPathTransition,
  PLAYER_ROLE,
} from "../../src/story/actors.ts";
import { FINAL_SNAPSHOTS } from "../../src/story/completion.ts";
import { NARRATIVE_ANCHORS } from "../../src/story/sequences.ts";

test("the player remains a silent unnamed observer", () => {
  assert.equal(PLAYER_ROLE.named, false);
  assert.equal(PLAYER_ROLE.acknowledgedByScriptureCharacters, false);
  assert.equal(PLAYER_ROLE.hasDialogue, false);
  assert.equal(PLAYER_ROLE.mayControlJesus, false);
  assert.equal(PLAYER_ROLE.mayCauseMiracle, false);
  assert.equal(PLAYER_ROLE.mayAnswerForCharacters, false);
  assert.equal(PLAYER_ROLE.mayChangeScriptureOutcome, false);
});

test("final states include all John 9 participants on compact-map anchors", () => {
  const anchors = new Set(NARRATIVE_ANCHORS);
  const actorIds = new Set([
    "observer",
    "jesus",
    "disciples",
    "man-born-blind",
    "neighbors",
    "pharisees",
    "parents",
    "judean-authorities",
  ]);
  assert.deepEqual(new Set(ACTOR_IDS), actorIds);
  for (const snapshot of Object.values(FINAL_SNAPSHOTS)) {
    assert.deepEqual(new Set(Object.keys(snapshot.actors)), actorIds);
    for (const actor of Object.values(snapshot.actors)) {
      assert.ok(anchors.has(actor.anchorId));
      assert.equal("position" in actor, false);
    }
  }
});

test("the man born blind always stands before path movement", () => {
  assert.deepEqual(manBornBlindPathTransition("man-to-pool", "clay-on-eyes"), {
    standPose: "standing",
    walkingPose: "walking",
    finalPose: "washing",
  });
  assert.throws(
    () => manBornBlindPathTransition("man-to-pool", "seated"),
    /must receive clay and stand before walking/,
  );
  for (const pathId of [
    "pool-to-neighbors",
    "group-to-inquiry",
    "expulsion",
  ]) {
    assert.deepEqual(manBornBlindPathTransition(pathId, "standing-seeing"), {
      standPose: "standing-seeing",
      walkingPose: "walking",
      finalPose: "standing-seeing",
    });
  }
});

test("directional walk requirements stay scoped to actors with reliable walk mappings", () => {
  assert.deepEqual(Object.keys(DIRECTIONAL_WALK_REQUIREMENTS), ["observer", "jesus"]);
});
