import assert from "node:assert/strict";
import test from "node:test";

import { PLAYER_ROLE } from "../../src/story/actors.ts";
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

test("active final states contain only the John 9:1-7 participants", () => {
  const anchors = new Set(NARRATIVE_ANCHORS);
  const activeIds = new Set(["observer", "jesus", "disciples", "man-born-blind"]);
  for (const snapshot of Object.values(FINAL_SNAPSHOTS)) {
    assert.deepEqual(new Set(Object.keys(snapshot.actors)), activeIds);
    for (const actor of Object.values(snapshot.actors)) {
      assert.ok(anchors.has(actor.anchorId));
      assert.equal("position" in actor, false);
    }
  }
});
