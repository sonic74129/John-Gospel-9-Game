import assert from "node:assert/strict";
import test from "node:test";

import { DIALOGUE_SEGMENTS } from "../../src/story/dialogue.ts";

test("dialogue contains references and provenance but no fabricated text", () => {
  const allowedKeys = [
    "beatId",
    "id",
    "segmentId",
    "sourceLabel",
    "sourceLevel",
    "speakerId",
    "verseKey",
  ];
  assert.ok(DIALOGUE_SEGMENTS.length > 0);
  for (const line of DIALOGUE_SEGMENTS) {
    assert.deepEqual(Object.keys(line).sort(), allowedKeys);
    assert.equal(line.sourceLevel, "S0");
    assert.equal(line.sourceLabel, "經文原文");
    assert.match(line.verseKey, /^john9:(?:[1-9]|[1-3][0-9]|4[01])$/);
    assert.match(line.segmentId, /^john9:/);
    assert.equal("text" in line, false);
    assert.equal("quote" in line, false);
  }
});
