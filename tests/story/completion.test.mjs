import assert from "node:assert/strict";
import test from "node:test";

import {
  applyBeatFinalState,
  FINAL_SNAPSHOTS,
  isStoryComplete,
  resolveFinalSnapshot,
  STORY_COMPLETION,
} from "../../src/story/completion.ts";

test("every beat has a complete deterministic final snapshot", () => {
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
    for (const actor of Object.values(snapshot.actors)) {
      assert.deepEqual(Object.keys(actor).sort(), [
        "anchorId",
        "collisionEnabled",
        "label",
        "pose",
        "sourceLevel",
        "visible",
      ]);
      assert.ok(["S1", "S2"].includes(actor.sourceLevel));
    }
    assert.equal(snapshot.props.clay.sourceLevel, "S1");
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
