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

test("every John 9:1-7 beat has a deterministic, later-content-free final state", () => {
  const anchors = new Set(NARRATIVE_ANCHORS);
  assert.deepEqual(Object.keys(FINAL_SNAPSHOTS), [
    "b01",
    "b02",
    "b03",
    "b04",
    "b05",
    "b06",
  ]);
  for (const [beatId, snapshot] of Object.entries(FINAL_SNAPSHOTS)) {
    assert.equal(snapshot.id, `john9-${beatId}-final`);
    assert.deepEqual(Object.keys(snapshot.actors).sort(), [
      "disciples",
      "jesus",
      "man-born-blind",
      "observer",
    ]);
    assert.ok(Object.values(snapshot.actors).every(({ anchorId }) => anchors.has(anchorId)));
    assert.ok(anchors.has(snapshot.props.clay.anchorId));
    assert.ok(anchors.has(snapshot.camera.anchorId));
  }
  assert.equal(FINAL_SNAPSHOTS.b05.controls.movementEnabled, true);
  assert.equal(FINAL_SNAPSHOTS.b06.controls.movementEnabled, false);
  assert.equal(FINAL_SNAPSHOTS.b06.actors["man-born-blind"].pose, "washed-seeing");
});

test("completion occurs at washing in John 9:7", () => {
  assert.equal(STORY_COMPLETION.finalBeatId, "b06");
  assert.equal(STORY_COMPLETION.finalSnapshotId, "john9-b06-final");
  assert.equal(STORY_COMPLETION.outcomeMutableByPlayer, false);
  assert.equal(STORY_COMPLETION.playerDecisionRequired, false);
  assert.equal(isStoryComplete(STORY_COMPLETION.requiredBeatIds), true);
  assert.equal(isStoryComplete(["b01", "b02", "b03", "b04", "b05"]), false);
});

test("normal and skip apply the same snapshots, including resumed pool and final states", async () => {
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
  const normalFinalState = await applyBeatFinalState(host, "b06", "completed");
  const skippedFinalState = await applyBeatFinalState(host, "b06", "skipped");

  assert.strictEqual(normalPoolState, skippedPoolState);
  assert.strictEqual(normalFinalState, skippedFinalState);
  assert.deepEqual(applications, [
    FINAL_SNAPSHOTS.b05,
    FINAL_SNAPSHOTS.b05,
    FINAL_SNAPSHOTS.b06,
    FINAL_SNAPSHOTS.b06,
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
    true,
  );
});
