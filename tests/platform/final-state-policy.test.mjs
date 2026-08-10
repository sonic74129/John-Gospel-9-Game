import assert from "node:assert/strict";
import test from "node:test";

import {
  assertNormalFinalStateVisualDelta,
  NORMAL_FINAL_STATE_POSITION_EPSILON,
} from "../../src/platform/final-state-policy.ts";

test("normal final-state application rejects visible actor snaps above threshold", () => {
  const before = {
    observer: { x: 100, y: 100, visible: true },
    "man-born-blind": { x: 200, y: 200, visible: true },
  };
  const expected = {
    observer: { x: 100, y: 100, visible: true },
    "man-born-blind": {
      x: 200 + NORMAL_FINAL_STATE_POSITION_EPSILON + 1,
      y: 200,
      visible: true,
    },
  };
  assert.throws(
    () => assertNormalFinalStateVisualDelta(before, expected),
    /man-born-blind.*normal final-state.*position delta/i,
  );
});

test("normal final-state application rejects unsourced hidden-to-visible pop-in", () => {
  assert.throws(
    () =>
      assertNormalFinalStateVisualDelta(
        { pharisees: { x: 120, y: 120, visible: false } },
        { pharisees: { x: 120, y: 120, visible: true } },
      ),
    /pharisees.*hidden-to-visible/i,
  );
});
