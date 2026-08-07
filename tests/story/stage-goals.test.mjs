import assert from "node:assert/strict";
import test from "node:test";

import { STAGE_GOALS } from "../../src/story/stage-goals.ts";

test("the six concise goals cover the courtyard through the pool only", () => {
  assert.deepEqual(
    STAGE_GOALS.map(({ beatId }) => beatId),
    ["b01", "b02", "b03", "b04", "b05", "b06"],
  );
  assert.equal(STAGE_GOALS[4].description, "跟隨前行");
  for (const goal of STAGE_GOALS) {
    assert.equal(goal.sourceLevel, "S2");
    assert.deepEqual(goal.requiredBeatIds, [goal.beatId]);
    assert.ok([...goal.description].length <= 8);
    assert.doesNotMatch(goal.description, /耶穌|神蹟|瞎眼|看見|法利賽/);
  }
});
