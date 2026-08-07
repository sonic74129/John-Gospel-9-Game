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

test("fixed source artifact matches recorded bytes and identity", () => {
  assert.equal(sha256(bytes), source.artifact.sha256);
  assert.equal(artifact.source.commit, source.commit);
  assert.equal(artifact.source.upstreamSha256, source.upstreamSha256);
  assert.equal(artifact.translation.divineNameVariant, "神");
  assert.equal(source.artifact.containsShangdi, false);
});

test("John 9:1-7 contains exactly seven ordered, individually hashed verses", () => {
  assert.equal(artifact.verses.length, 7);
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

test("only the approved John 9:1-7 source data enters runtime story content", () => {
  const runtimeVerseKeys = [
    ...STORY_BEATS.flatMap(({ verseKeys }) => verseKeys),
    ...DIALOGUE_SEGMENTS.map(({ verseKey }) => verseKey),
  ];
  assert.ok(runtimeVerseKeys.every((key) => /^john9:[1-7]$/.test(key)));
});

test("owner review is transparent and cannot masquerade as approval", () => {
  assert.equal(artifact.review.status, "pending-owner-review");
  assert.equal(review.status, "pending-owner-review");
  assert.equal(review.approval.status, "pending");
  assert.equal(review.approval.reviewedAt, null);
});
