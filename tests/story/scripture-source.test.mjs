import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { STORY_BEATS } from "../../src/story/beats.ts";
import { DIALOGUE_SEGMENTS } from "../../src/story/dialogue.ts";

const bytes = await readFile(
  "src/story/licensed-artifacts/scrollmapper-chiun-john9.json",
);
const artifact = JSON.parse(bytes);
const source = JSON.parse(
  await readFile("planning/evidence/scripture-source.json", "utf8"),
);
const review = JSON.parse(
  await readFile("planning/evidence/owner-review.json", "utf8"),
);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

test("fixed source artifact preserves recorded provenance identity", () => {
  assert.equal(
    sha256(bytes),
    "9d3f8ef447849c9545df32ca2ef78a88de91762e148203316d2505916079a814",
  );
  assert.equal(artifact.source.commit, source.commit);
  assert.equal(artifact.source.upstreamSha256, source.upstreamSha256);
  assert.equal(artifact.translation.divineNameVariant, "神");
  assert.equal(source.artifact.containsShangdi, false);
});

test("John 9:1-41 contains exactly 41 ordered, individually hashed verses", () => {
  assert.equal(artifact.passage.verseStart, 1);
  assert.equal(artifact.passage.verseEnd, 41);
  assert.equal(artifact.verses.length, 41);
  artifact.verses.forEach((verse, index) => {
    assert.equal(verse.key, `john9:${index + 1}`);
    assert.equal(verse.reference, `John 9:${index + 1}`);
    assert.ok(verse.exactText.length > 0);
    assert.equal(sha256(verse.exactText), verse.sha256);
  });

  const text = artifact.verses.map(({ exactText }) => exactText).join("\n");
  assert.match(text, /神/u);
  assert.doesNotMatch(text, /上帝/u);
});

test("all runtime story content stays within John 9:1-41", () => {
  const runtimeVerseKeys = [
    ...STORY_BEATS.flatMap(({ verseKeys }) => verseKeys),
    ...DIALOGUE_SEGMENTS.map(({ verseKey }) => verseKey),
  ];
  assert.ok(
    runtimeVerseKeys.every((key) =>
      /^john9:(?:[1-9]|[1-3][0-9]|4[01])$/.test(key)),
  );
  assert.deepEqual(
    new Set(artifact.verses.map(({ key }) => key)),
    new Set(Array.from({ length: 41 }, (_, index) => `john9:${index + 1}`)),
  );
});

test("owner review is transparent and cannot masquerade as approval", () => {
  assert.equal(artifact.review.status, "pending-owner-review");
  assert.equal(review.status, "pending-owner-review");
  assert.equal(review.approval.status, "pending");
  assert.equal(review.approval.reviewedAt, null);
});
