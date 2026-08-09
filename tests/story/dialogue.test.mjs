import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import scriptureArtifact from "../../src/story/licensed-artifacts/scrollmapper-chiun-john9.json" with {
  type: "json",
};
import { dialoguePortraitFor } from "../../src/adapters/dialogue-portraits.ts";
import { DIALOGUE_BY_BEAT, DIALOGUE_SEGMENTS } from "../../src/story/dialogue.ts";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

test("dialogue uses exact CUV-Traditional text through John 9:41", () => {
  const sourceByKey = new Map(
    scriptureArtifact.verses.map((verse) => [verse.key, verse.exactText]),
  );
  assert.equal(Object.keys(DIALOGUE_BY_BEAT).length, 20);
  for (const line of DIALOGUE_SEGMENTS) {
    assert.equal(line.sourceLevel, "S0");
    assert.equal(line.sourceLabel, "1919 和合本（繁體神版）");
    assert.match(line.verseKey, /^john9:(?:[1-9]|[1-3][0-9]|4[01])$/);
    assert.ok(sourceByKey.get(line.verseKey).includes(line.exactText));
    assert.equal(sha256(line.exactText), line.textSha256);
    assert.equal(line.speakerId, "scripture");
  }
});

test("verses 8-41 are shifted intact from the old B06-B19 plan to B07-B20", () => {
  const expectedVerseKeys = [
    ["john9:8", "john9:9"],
    ["john9:10", "john9:11", "john9:12"],
    ["john9:13", "john9:14"],
    ["john9:15", "john9:16"],
    ["john9:17"],
    ["john9:18", "john9:19"],
    ["john9:20", "john9:21", "john9:22", "john9:23"],
    ["john9:24"],
    ["john9:25"],
    ["john9:26", "john9:27"],
    ["john9:28", "john9:29"],
    ["john9:30", "john9:31", "john9:32", "john9:33", "john9:34"],
    ["john9:35", "john9:36", "john9:37", "john9:38"],
    ["john9:39", "john9:40", "john9:41"],
  ];
  assert.deepEqual(
    Object.values(DIALOGUE_BY_BEAT)
      .slice(6)
      .map((lines) => lines.map(({ verseKey }) => verseKey)),
    expectedVerseKeys,
  );
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

test("portrait subjects preserve blind and seeing identity while worship stays portraitless", () => {
  const blindPortrait = dialoguePortraitFor(DIALOGUE_BY_BEAT.b01[0]);
  const seeingPortrait = dialoguePortraitFor(DIALOGUE_BY_BEAT.b06[0]);
  assert.match(
    blindPortrait.art.path,
    /portrait-man-blind\.png$/,
  );
  assert.match(
    seeingPortrait.art.path,
    /portrait-man-seeing\.png$/,
  );
  assert.equal(DIALOGUE_BY_BEAT.b01[0].portraitState, "blind");
  assert.equal(DIALOGUE_BY_BEAT.b06[0].portraitState, "seeing");
  assert.notEqual(blindPortrait.art.key, seeingPortrait.art.key);
  assert.notEqual(blindPortrait.framing.focusY, seeingPortrait.framing.focusY);
  assert.equal(dialoguePortraitFor(DIALOGUE_BY_BEAT.b19[0]), null);
});
