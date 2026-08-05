import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTORS,
  ACTOR_IDS,
  PLAYER_ROLE,
  PROPS,
} from "../../src/story/actors.ts";
import { NARRATIVE_ANCHORS } from "../../src/story/sequences.ts";

test("the player is a silent unnamed observer with restricted agency", () => {
  assert.equal(PLAYER_ROLE.named, false);
  assert.equal(PLAYER_ROLE.acknowledgedByScriptureCharacters, false);
  assert.equal(PLAYER_ROLE.hasDialogue, false);
  assert.equal(PLAYER_ROLE.mayControlJesus, false);
  assert.equal(PLAYER_ROLE.mayCauseMiracle, false);
  assert.equal(PLAYER_ROLE.mayAnswerForCharacters, false);
  assert.equal(PLAYER_ROLE.mayChangeScriptureOutcome, false);
});

test("actor identities are unique and use anchors rather than coordinates", () => {
  const canonicalAnchors = new Set(NARRATIVE_ANCHORS);
  assert.equal(new Set(ACTOR_IDS).size, ACTORS.length);
  for (const actor of ACTORS) {
    assert.ok(canonicalAnchors.has(actor.initialAnchorId));
    assert.equal("position" in actor, false);
    assert.ok(["S1", "S2"].includes(actor.sourceLevel));
    assert.equal(actor.stagingLevel, "S2");
  }
  for (const prop of PROPS) {
    assert.ok(canonicalAnchors.has(prop.initialAnchorId));
    assert.equal(prop.sourceLevel, "S1");
    assert.equal(prop.stagingLevel, "S2");
  }
});
