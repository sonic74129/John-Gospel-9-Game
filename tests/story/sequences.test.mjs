import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  NARRATIVE_ANCHORS,
  NARRATIVE_PATHS,
  SEQUENCES,
} from "../../src/story/sequences.ts";

const readWorldContract = (fileName) =>
  JSON.parse(readFileSync(`src/world/${fileName}`, "utf8"));

test("the narrative depends only on courtyard, pool, and the one pool path", () => {
  const worldAnchors = new Set(
    readWorldContract("anchors.json").anchors.map(({ id }) => id),
  );
  const worldPaths = new Set(
    readWorldContract("paths.json").sequencePaths.map(({ id }) => id),
  );

  assert.deepEqual(NARRATIVE_PATHS, ["man-to-pool"]);
  assert.ok(NARRATIVE_ANCHORS.every((id) => worldAnchors.has(id)));
  assert.ok(NARRATIVE_PATHS.every((id) => worldPaths.has(id)));
  assert.ok(
    NARRATIVE_ANCHORS.every(
      (id) => id.startsWith("courtyard.") || id.startsWith("pool."),
    ),
  );
});

test("only the man travels on the one route before the observer follows to the pool", () => {
  const path = readWorldContract("paths.json").sequencePaths.find(
    ({ id }) => id === "man-to-pool",
  );
  const followStep = SEQUENCES[4].steps.find(
    ({ command }) => command === "actor-follow-path",
  );

  assert.deepEqual(
    {
      subject: path.subject,
      startAnchorId: path.startAnchorId,
      endAnchorId: path.endAnchorId,
    },
    {
      subject: "man-born-blind",
      startAnchorId: "courtyard.man-center",
      endAnchorId: "pool.wash-edge",
    },
  );
  assert.deepEqual(followStep.payload, {
    pathId: "man-to-pool",
    subjectId: "man-born-blind",
    primaryActorId: "man-born-blind",
    participantActorIds: [],
    allowPlayerMovement: true,
  });
  assert.equal(SEQUENCES[4].steps.at(-1).payload.anchorId, "pool.camera");
  assert.equal(SEQUENCES[5].steps.some(({ payload }) => payload.pathId), false);
});

test("all sequences are skippable coordinate-free contracts with no post-verse-seven content", () => {
  const anchors = new Set(NARRATIVE_ANCHORS);
  const paths = new Set(NARRATIVE_PATHS);
  assert.equal(SEQUENCES.length, 6);
  for (const sequence of SEQUENCES) {
    assert.equal(sequence.cancellable, true);
    assert.equal(sequence.skippable, true);
    assert.equal(sequence.reentrant, false);
    assert.equal(sequence.finalState.beatId, sequence.beatId);
    assert.doesNotMatch(JSON.stringify(sequence), /neighbors|inquiry|outside|ending/);
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
