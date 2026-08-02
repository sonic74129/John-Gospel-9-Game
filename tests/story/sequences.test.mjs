import assert from "node:assert/strict";
import test from "node:test";

import {
  NARRATIVE_ANCHORS,
  NARRATIVE_PATHS,
  SEQUENCES,
} from "../../src/story/sequences.ts";

test("sequence contracts use plan vocabulary without embedding coordinates", () => {
  const anchors = new Set(NARRATIVE_ANCHORS);
  const paths = new Set(NARRATIVE_PATHS);
  assert.equal(SEQUENCES.length, 19);
  for (const sequence of SEQUENCES) {
    assert.equal(sequence.cancellable, true);
    assert.equal(sequence.skippable, true);
    assert.equal(sequence.reentrant, false);
    assert.equal(sequence.finalState.beatId, sequence.beatId);
    for (const step of sequence.steps) {
      assert.equal(step.kind, "command");
      assert.ok(["S0", "S1", "S2"].includes(step.sourceLevel));
      assert.equal("x" in step.payload, false);
      assert.equal("y" in step.payload, false);
      if (step.payload.anchorId) {
        assert.ok(anchors.has(step.payload.anchorId));
      }
      if (step.payload.pathId) {
        assert.ok(paths.has(step.payload.pathId));
      }
    }
  }
});
