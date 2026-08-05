import assert from "node:assert/strict";
import test from "node:test";

import {
  applyBeatFinalState,
  FINAL_SNAPSHOTS,
  isStoryComplete,
  resolveFinalSnapshot,
  STORY_COMPLETION,
} from "../../src/story/completion.ts";
import { NARRATIVE_ANCHORS } from "../../src/story/sequences.ts";

test("every beat has a complete deterministic final snapshot", () => {
  const canonicalAnchors = new Set(NARRATIVE_ANCHORS);
  assert.equal(Object.keys(FINAL_SNAPSHOTS).length, 19);
  for (const [beatId, snapshot] of Object.entries(FINAL_SNAPSHOTS)) {
    assert.equal(snapshot.id, `john9-${beatId}-final`);
    assert.ok(snapshot.actors.observer);
    assert.ok(snapshot.props.clay);
    assert.ok(snapshot.camera.anchorId);
    assert.equal(snapshot.controls.playerActorId, "observer");
    assert.equal(snapshot.controls.dialogueEnabled, false);
    assert.ok(Array.isArray(snapshot.testimony.activeIds));
    assert.ok(Array.isArray(snapshot.triggers.completedBeatIds));
    assert.equal(typeof snapshot.music.playing, "boolean");
    const occupiedAnchors = new Map();
    for (const actor of Object.values(snapshot.actors)) {
      assert.deepEqual(Object.keys(actor).sort(), [
        "anchorId",
        "collisionEnabled",
        "contentLevel",
        "label",
        "pose",
        "stagingLevel",
        "visible",
      ]);
      assert.ok(canonicalAnchors.has(actor.anchorId));
      assert.ok(["S1", "S2"].includes(actor.contentLevel));
      assert.equal(actor.stagingLevel, "S2");
      if (!actor.visible) {
        assert.equal(actor.collisionEnabled, false);
      }
      if (actor.visible && actor.collisionEnabled) {
        assert.equal(
          occupiedAnchors.has(actor.anchorId),
          false,
          `${beatId}:${actor.anchorId} is shared by visible collidable actors`,
        );
        occupiedAnchors.set(actor.anchorId, actor.label);
      }
    }
    assert.ok(canonicalAnchors.has(snapshot.props.clay.anchorId));
    assert.equal(snapshot.props.clay.contentLevel, "S1");
    assert.equal(snapshot.props.clay.stagingLevel, "S2");
    assert.ok(canonicalAnchors.has(snapshot.camera.anchorId));
    assert.equal(snapshot.camera.sourceLevel, "S2");
    assert.equal(snapshot.controls.sourceLevel, "S2");
    assert.equal(snapshot.testimony.sourceLevel, "S1");
    assert.equal(snapshot.triggers.sourceLevel, "S2");
    assert.equal(snapshot.music.sourceLevel, "S2");
  }
});

test("story completion requires the fixed 19-beat outcome", () => {
  assert.equal(STORY_COMPLETION.finalBeatId, "b19");
  assert.equal(STORY_COMPLETION.finalSnapshotId, "john9-b19-final");
  assert.equal(STORY_COMPLETION.outcomeMutableByPlayer, false);
  assert.equal(STORY_COMPLETION.playerDecisionRequired, false);
  assert.equal(isStoryComplete(STORY_COMPLETION.requiredBeatIds), true);
  assert.equal(isStoryComplete(STORY_COMPLETION.requiredBeatIds.slice(0, -1)), false);
});

test("normal and skip resolve and apply the same snapshot", async () => {
  for (const beatId of Object.keys(FINAL_SNAPSHOTS)) {
    assert.strictEqual(
      resolveFinalSnapshot(beatId, "completed"),
      resolveFinalSnapshot(beatId, "skipped"),
    );
  }

  const applications = [];
  const handoffs = [];
  const host = {
    applyFinalState(snapshot) {
      applications.push(snapshot);
    },
    handoff(status) {
      handoffs.push(status);
    },
  };
  const completed = await applyBeatFinalState(host, "b19", "completed");
  const skipped = await applyBeatFinalState(host, "b19", "skipped");
  assert.strictEqual(completed, skipped);
  assert.strictEqual(applications[0], applications[1]);
  assert.deepEqual(handoffs, ["completed", "skipped"]);
});
