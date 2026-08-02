import assert from "node:assert/strict";
import test from "node:test";

import { RECALL_INTERACTIONS } from "../../src/story/recall.ts";
import { TESTIMONY_BY_ID } from "../../src/story/testimony.ts";

test("three recall interactions occur after the approved beats without blocking or scoring", () => {
  assert.deepEqual(
    RECALL_INTERACTIONS.map(({ afterBeatId }) => afterBeatId),
    ["b07", "b12", "b14"],
  );
  for (const recall of RECALL_INTERACTIONS) {
    assert.equal(recall.blocking, false);
    assert.equal(recall.requiredForProgress, false);
    assert.equal(recall.score, null);
    assert.equal(recall.failureState, null);
    assert.equal(recall.onDismiss, "continue");
    assert.equal(recall.responseMode, "review-only");
    assert.ok(recall.focusTestimonyIds.every((id) => TESTIMONY_BY_ID[id]));
  }
});
