import assert from "node:assert/strict";
import test from "node:test";

import { STORY_BEATS } from "../../src/story/beats.ts";
import { NARRATIVE_ANCHORS } from "../../src/story/sequences.ts";

test("the approved 19 beats are unique, ordered, and acyclic", () => {
  const expectedIds = Array.from(
    { length: 19 },
    (_, index) => `b${String(index + 1).padStart(2, "0")}`,
  );
  assert.deepEqual(
    STORY_BEATS.map(({ id }) => id),
    expectedIds,
  );
  assert.equal(new Set(STORY_BEATS.map(({ id }) => id)).size, 19);

  const completed = new Set();
  for (const beat of STORY_BEATS) {
    if (beat.prerequisite !== "story-start") {
      assert.ok(completed.has(beat.prerequisite.beatCompleted));
    }
    completed.add(beat.id);
  }
});

test("beat verse keys stay in John 9:1-41 and source levels stay approved", () => {
  const expectedVerseKeys = [
    ["john9:1"],
    ["john9:2"],
    ["john9:3", "john9:4", "john9:5"],
    ["john9:6", "john9:7"],
    ["john9:7"],
    ["john9:8", "john9:9"],
    ["john9:10", "john9:11", "john9:12"],
    ["john9:13", "john9:14"],
    ["john9:15", "john9:16"],
    ["john9:17"],
    ["john9:18", "john9:19"],
    ["john9:20", "john9:21", "john9:22", "john9:23"],
    ["john9:24"],
    ["john9:25"],
    ["john9:26", "john9:27"],
    ["john9:28", "john9:29"],
    ["john9:30", "john9:31", "john9:32", "john9:33", "john9:34"],
    ["john9:35", "john9:36", "john9:37", "john9:38"],
    ["john9:39", "john9:40", "john9:41"],
  ];
  for (const beat of STORY_BEATS) {
    assert.equal(beat.sourceLevel, "scripture");
    assert.equal(beat.contentLevel, "S1");
    assert.equal(beat.stagingLevel, "S2");
    assert.ok(beat.verseKeys.length > 0);
    for (const verseKey of beat.verseKeys) {
      const match = /^john9:(\d+)$/.exec(verseKey);
      assert.ok(match);
      assert.ok(Number(match[1]) >= 1 && Number(match[1]) <= 41);
    }
  }
  assert.deepEqual(
    STORY_BEATS.map(({ verseKeys }) => verseKeys),
    expectedVerseKeys,
  );
});

test("beats preserve observer restrictions and snapshot linkage", () => {
  const canonicalAnchors = new Set(NARRATIVE_ANCHORS);
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
    assert.equal(beat.actions.every(({ type }) => typeof type === "string"), true);
    assert.ok(
      beat.actions.every(({ contentLevel }) => ["S0", "S1", "S2"].includes(contentLevel)),
    );
    assert.ok(
      beat.actions
        .filter(({ contentLevel }) => contentLevel === "S2")
        .every(({ type }) =>
          ["actor-follow-path", "camera-follow-path", "focus-camera"].includes(type),
        ),
    );
    if (beat.trigger.event?.startsWith("arrival:")) {
      assert.ok(canonicalAnchors.has(beat.trigger.event.slice("arrival:".length)));
    }
  }
});
