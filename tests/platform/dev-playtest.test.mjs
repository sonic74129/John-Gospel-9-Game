import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_DEV_PLAYTEST_BEAT_IDS,
  getCompletedPredecessorBeatIds,
  parseDevPlaytestRequest,
} from "../../src/platform/dev-playtest.ts";

test("null and absent playtest requests return null", () => {
  assert.equal(parseDevPlaytestRequest(null), null);
  assert.equal(parseDevPlaytestRequest(undefined), null);
  assert.equal(parseDevPlaytestRequest(""), null);
  assert.equal(parseDevPlaytestRequest(new URLSearchParams("foo=bar")), null);
});

test("first, middle, and final beats resolve to canonical predecessor lists", () => {
  assert.deepEqual(parseDevPlaytestRequest("playtest=b01"), {
    beatId: "b01",
    completedBeatIds: [],
  });
  assert.deepEqual(parseDevPlaytestRequest(new URLSearchParams("playtest=b05")), {
    beatId: "b05",
    completedBeatIds: ["b01", "b02", "b03", "b04"],
  });
  assert.deepEqual(parseDevPlaytestRequest("?playtest=b20"), {
    beatId: "b20",
    completedBeatIds: DEFAULT_DEV_PLAYTEST_BEAT_IDS.slice(0, 19),
  });
});

test("malformed and unsupported playtest IDs are rejected", () => {
  assert.throws(() => parseDevPlaytestRequest("playtest="), /empty/i);
  assert.throws(() => parseDevPlaytestRequest("playtest=b21"), /Unsupported/);
  assert.throws(
    () =>
      getCompletedPredecessorBeatIds("chapter-04", [
        "chapter-01",
        "chapter-02",
        "chapter-03",
      ]),
    /Unsupported/,
  );
});

