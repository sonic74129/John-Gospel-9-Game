import assert from "node:assert/strict";
import test from "node:test";

import { STAGE_GOALS } from "../../src/story/stage-goals.ts";

test("twenty concise goals cover the complete chapter", () => {
  assert.deepEqual(
    STAGE_GOALS.map(({ beatId }) => beatId),
    Array.from(
      { length: 20 },
      (_, index) => `b${String(index + 1).padStart(2, "0")}`,
    ),
  );
  assert.equal(STAGE_GOALS[4].description, "跟隨前行");
  for (const goal of STAGE_GOALS) {
    assert.equal(goal.sourceLevel, "S2");
    assert.deepEqual(goal.requiredBeatIds, [goal.beatId]);
    assert.ok([...goal.description].length <= 8);
    assert.doesNotMatch(goal.description, /耶穌|神蹟|瞎眼|看見|法利賽/);
  }
});
