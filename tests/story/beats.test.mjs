import assert from "node:assert/strict";
import test from "node:test";

import { STORY_BEATS } from "../../src/story/beats.ts";
import { NARRATIVE_ANCHORS } from "../../src/story/sequences.ts";

test("the John 9:1-7 beats are unique, ordered, and acyclic", () => {
  const expectedIds = ["b01", "b02", "b03", "b04", "b05", "b06"];
  assert.deepEqual(
    STORY_BEATS.map(({ id }) => id),
    expectedIds,
  );

  const completed = new Set();
  for (const beat of STORY_BEATS) {
    if (beat.prerequisite !== "story-start") {
      assert.ok(completed.has(beat.prerequisite.beatCompleted));
    }
    completed.add(beat.id);
  }
});

test("the formal flow ends with John 9:7 and has no later-chapter dependency", () => {
  assert.deepEqual(
    STORY_BEATS.map(({ verseKeys }) => verseKeys),
    [
      ["john9:1"],
      ["john9:2"],
      ["john9:3", "john9:4", "john9:5"],
      ["john9:6"],
      ["john9:7"],
      ["john9:7"],
    ],
  );
  for (const beat of STORY_BEATS) {
    assert.equal(beat.sourceLevel, "scripture");
    assert.equal(beat.contentLevel, "S1");
    assert.equal(beat.stagingLevel, "S2");
    assert.ok(
      beat.verseKeys.every((verseKey) => /^john9:[1-7]$/.test(verseKey)),
    );
    assert.doesNotMatch(JSON.stringify(beat), /john9:(?:[89]|[1-4]\d)/);
  }
});

test("beats retain observer limits and reserve one manual pool-follow handoff", () => {
  const anchors = new Set(NARRATIVE_ANCHORS);
  const forbiddenActions = new Set([
    "control-jesus",
    "cause-miracle",
    "answer-for-character",
    "change-outcome",
    "speak",
  ]);
  for (const beat of STORY_BEATS) {
    assert.ok(beat.supportedActions.every((action) => !forbiddenActions.has(action)));
    assert.strictEqual(beat.finalState, beat.sequence.finalState);
    assert.equal(beat.finalState.controls.dialogueEnabled, false);
    if (beat.trigger.event?.startsWith("arrival:")) {
      assert.ok(anchors.has(beat.trigger.event.slice("arrival:".length)));
    }
  }
  assert.equal(STORY_BEATS[4].handoff, "manual");
  assert.equal(STORY_BEATS[5].handoff, null);
  assert.deepEqual(STORY_BEATS[5].trigger, {
    type: "event",
    event: "arrival:pool.wash-edge",
  });
});
