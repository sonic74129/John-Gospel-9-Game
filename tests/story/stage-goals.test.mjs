import assert from "node:assert/strict";
import test from "node:test";

import { STAGE_GOALS } from "../../src/story/stage-goals.ts";

test("all beats have short non-spoiling zh-Hant goals", () => {
  assert.equal(STAGE_GOALS.length, 19);
  assert.deepEqual(
    STAGE_GOALS.map(({ beatId }) => beatId),
    Array.from({ length: 19 }, (_, index) => `b${String(index + 1).padStart(2, "0")}`),
  );
  for (const goal of STAGE_GOALS) {
    assert.equal(goal.sourceLevel, "S2");
    assert.deepEqual(goal.requiredBeatIds, [goal.beatId]);
    assert.ok([...goal.description].length <= 8);
    assert.doesNotMatch(goal.description, /耶穌|神蹟|瞎眼|看見|法利賽/);
  }
  assert.deepEqual(
    [...new Set(STAGE_GOALS.map(({ description }) => description))],
    ["路旁", "西羅亞", "鄰舍", "查問", "重遇"],
  );
});
