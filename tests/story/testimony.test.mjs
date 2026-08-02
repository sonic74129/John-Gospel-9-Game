import assert from "node:assert/strict";
import test from "node:test";

import { ACTOR_IDS } from "../../src/story/actors.ts";
import { DIALOGUE_SEGMENTS } from "../../src/story/dialogue.ts";
import { TESTIMONY, TESTIMONY_CATEGORIES } from "../../src/story/testimony.ts";

test("testimony uses only approved neutral categories and scripture provenance", () => {
  const dialogueSegmentIds = new Set(DIALOGUE_SEGMENTS.map(({ segmentId }) => segmentId));
  for (const entry of TESTIMONY) {
    assert.ok(TESTIMONY_CATEGORIES.includes(entry.category));
    assert.ok(ACTOR_IDS.includes(entry.speakerId));
    assert.equal(entry.sourceLevel, "S1");
    assert.ok(entry.verseKeys.length > 0);
    assert.ok(entry.segmentIds.length > 0);
    assert.ok(entry.segmentIds.every((segmentId) => dialogueSegmentIds.has(segmentId)));
    assert.equal("verdict" in entry, false);
    assert.equal("truth" in entry, false);
    assert.equal("lie" in entry, false);
    assert.equal("text" in entry, false);
  }
});
