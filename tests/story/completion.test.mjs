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

test("every John 9 beat has a deterministic final state without legacy UI data", () => {
  const anchors = new Set(NARRATIVE_ANCHORS);
  assert.equal(Object.keys(FINAL_SNAPSHOTS).length, 20);
  for (const [beatId, snapshot] of Object.entries(FINAL_SNAPSHOTS)) {
    assert.equal(snapshot.id, `john9-${beatId}-final`);
    assert.equal("testimony" in snapshot, false);
    assert.equal("recall" in snapshot, false);
    assert.equal("optionalRecallIds" in snapshot.triggers, false);
    assert.ok(Object.values(snapshot.actors).every(({ anchorId }) => anchors.has(anchorId)));
    assert.ok(anchors.has(snapshot.props.clay.anchorId));
    assert.ok(anchors.has(snapshot.camera.anchorId));
    const serialised = JSON.stringify(snapshot);
    assert.doesNotMatch(serialised, /testimony/i);
    assert.doesNotMatch(serialised, /recall/i);
  }
  assert.equal(FINAL_SNAPSHOTS.b05.controls.movementEnabled, true);
  assert.equal(FINAL_SNAPSHOTS.b06.controls.movementEnabled, true);
  assert.equal(FINAL_SNAPSHOTS.b20.controls.movementEnabled, false);
  assert.equal(FINAL_SNAPSHOTS.b20.controls.locked, true);
  assert.equal(FINAL_SNAPSHOTS.b06.actors["man-born-blind"].pose, "washed-seeing");
});

test("completion occurs only at B20 after John 9:41", () => {
  assert.equal(STORY_COMPLETION.finalBeatId, "b20");
  assert.equal(STORY_COMPLETION.finalSnapshotId, "john9-b20-final");
  assert.equal(STORY_COMPLETION.outcomeMutableByPlayer, false);
  assert.equal(STORY_COMPLETION.playerDecisionRequired, false);
  assert.equal(isStoryComplete(STORY_COMPLETION.requiredBeatIds), true);
  assert.equal(isStoryComplete(STORY_COMPLETION.requiredBeatIds.slice(0, -1)), false);
});

test("normal and skip apply the same snapshots, including final state", async () => {
  for (const beatId of Object.keys(FINAL_SNAPSHOTS)) {
    assert.strictEqual(
      resolveFinalSnapshot(beatId, "completed"),
      resolveFinalSnapshot(beatId, "skipped"),
    );
  }

  const applications = [];
  const host = {
    applyFinalState(snapshot) {
      applications.push(snapshot);
    },
  };
  const normalPoolState = await applyBeatFinalState(host, "b05", "completed");
  const skippedPoolState = await applyBeatFinalState(host, "b05", "skipped");
  const normalFinalState = await applyBeatFinalState(host, "b20", "completed");
  const skippedFinalState = await applyBeatFinalState(host, "b20", "skipped");

  assert.strictEqual(normalPoolState, skippedPoolState);
  assert.strictEqual(normalFinalState, skippedFinalState);
  assert.deepEqual(applications, [
    FINAL_SNAPSHOTS.b05,
    FINAL_SNAPSHOTS.b05,
    FINAL_SNAPSHOTS.b20,
    FINAL_SNAPSHOTS.b20,
  ]);
});

test("restart is incomplete and resume restores the exact settled state", () => {
  const restartedBeatIds = [];
  const resumedBeatIds = [...FINAL_SNAPSHOTS.b05.triggers.completedBeatIds];

  assert.equal(isStoryComplete(restartedBeatIds), false);
  assert.equal(isStoryComplete(resumedBeatIds), false);
  assert.strictEqual(
    resolveFinalSnapshot(resumedBeatIds.at(-1), "completed"),
    FINAL_SNAPSHOTS.b05,
  );
  assert.equal(
    isStoryComplete(FINAL_SNAPSHOTS.b06.triggers.completedBeatIds),
    false,
  );
  assert.equal(isStoryComplete(FINAL_SNAPSHOTS.b20.triggers.completedBeatIds), true);
});
