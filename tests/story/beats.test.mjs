import assert from "node:assert/strict";
import test from "node:test";

import { STORY_BEATS } from "../../src/story/beats.ts";
import { NARRATIVE_ANCHORS } from "../../src/story/sequences.ts";

test("the twenty John 9 beats are unique, ordered, and acyclic", () => {
  const expectedIds = Array.from(
    { length: 20 },
    (_, index) => `b${String(index + 1).padStart(2, "0")}`,
  );
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

test("the formal flow covers every verse in John 9:1-41", () => {
  assert.deepEqual(
    STORY_BEATS.slice(0, 6).map(({ verseKeys }) => verseKeys),
    [
      ["john9:1"],
      ["john9:2"],
      ["john9:3", "john9:4", "john9:5"],
      ["john9:6"],
      ["john9:7"],
      ["john9:7"],
    ],
  );
  const verseNumbers = new Set(
    STORY_BEATS.flatMap(({ verseKeys }) =>
      verseKeys.map((verseKey) => Number(verseKey.slice("john9:".length))),
    ),
  );
  assert.deepEqual([...verseNumbers].sort((left, right) => left - right), [
    ...Array.from({ length: 41 }, (_, index) => index + 1),
  ]);
  for (const beat of STORY_BEATS) {
    assert.equal(beat.sourceLevel, "scripture");
    assert.equal(beat.contentLevel, "S1");
    assert.equal(beat.stagingLevel, "S2");
    assert.ok(
      beat.verseKeys.every((verseKey) =>
        /^john9:(?:[1-9]|[1-3][0-9]|4[01])$/.test(verseKey)),
    );
  }
});

test("beats retain observer limits, RPG finding triggers, and completion handoffs", () => {
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
  assert.equal(STORY_BEATS[5].handoff, "automatic");
  assert.equal(STORY_BEATS[19].handoff, null);
  assert.deepEqual(
    STORY_BEATS.slice(0, 6).map(({ trigger }) => trigger.event),
    [
      "story:start",
      "beat:b01:completed",
      "beat:b02:completed",
      "beat:b03:completed",
      "beat:b04:completed",
      "arrival:pool.wash-edge",
    ],
  );
  assert.deepEqual(STORY_BEATS[5].trigger, {
    type: "event",
    event: "arrival:pool.wash-edge",
  });
  assert.deepEqual(
    STORY_BEATS.slice(6).map(({ trigger }) => trigger.event),
    [
      "interact:neighbors",
      "interact:man-born-blind",
      "interact:neighbors",
      "interact:pharisees",
      "interact:man-born-blind",
      "interact:judean-authorities",
      "interact:parents",
      "interact:man-born-blind",
      "interact:man-born-blind",
      "interact:man-born-blind",
      "interact:pharisees",
      "interact:man-born-blind",
      "interact:man-born-blind",
      "beat:b19:completed",
    ],
  );
});
