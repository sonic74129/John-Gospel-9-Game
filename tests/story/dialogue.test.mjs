import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import scriptureArtifact from "../../src/story/licensed-artifacts/scrollmapper-chiun-john9.json" with {
  type: "json",
};
import { DIALOGUE_BY_BEAT, DIALOGUE_SEGMENTS } from "../../src/story/dialogue.ts";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

test("dialogue uses exact CUV-Traditional text only through John 9:7", () => {
  const sourceByKey = new Map(
    scriptureArtifact.verses.map((verse) => [verse.key, verse.exactText]),
  );
  assert.deepEqual(Object.keys(DIALOGUE_BY_BEAT), [
    "b01",
    "b02",
    "b03",
    "b04",
    "b05",
    "b06",
  ]);
  for (const line of DIALOGUE_SEGMENTS) {
    assert.equal(line.sourceLevel, "S0");
    assert.equal(line.sourceLabel, "1919 和合本（繁體神版）");
    assert.match(line.verseKey, /^john9:[1-7]$/);
    assert.ok(sourceByKey.get(line.verseKey).includes(line.exactText));
    assert.equal(sha256(line.exactText), line.textSha256);
    assert.equal(line.speakerId, "scripture");
  }
});

test("John 9:7 preserves its exact instruction before its exact washing outcome", () => {
  const instruction = DIALOGUE_BY_BEAT.b05[0];
  const outcome = DIALOGUE_BY_BEAT.b06[0];
  assert.equal(instruction.segmentId, "john9:7:instruction");
  assert.equal(outcome.segmentId, "john9:7:outcome");
  assert.equal(
    `${instruction.exactText}${outcome.exactText}`,
    scriptureArtifact.verses[6].exactText,
  );
});
