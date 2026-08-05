import assert from "node:assert/strict";
import test from "node:test";

import { DIALOGUE_SEGMENTS } from "../../src/story/dialogue.ts";

test("dialogue is bound to exact source text and hashes", () => {
  const allowedKeys = [
    "beatId",
    "exactText",
    "id",
    "segmentId",
    "sourceLabel",
    "sourceLevel",
    "speakerId",
    "textSha256",
    "verseKey",
  ];
  assert.ok(DIALOGUE_SEGMENTS.length > 0);
  for (const line of DIALOGUE_SEGMENTS) {
    assert.deepEqual(Object.keys(line).sort(), allowedKeys);
    assert.equal(line.sourceLevel, "S0");
    assert.equal(line.sourceLabel, "1919 和合本（繁體神版）");
    assert.match(line.verseKey, /^john9:(?:[1-9]|[1-3][0-9]|4[01])$/);
    assert.match(line.segmentId, /^john9:/);
    assert.ok(line.exactText.length > 0);
    assert.match(line.textSha256, /^[a-f0-9]{64}$/);
    assert.equal(line.speakerId, "scripture");
    assert.equal("quote" in line, false);
  }
});
