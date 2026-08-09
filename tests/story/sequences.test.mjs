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

test("the narrative uses compact courtyard and pool anchors with one escort path", () => {
  const worldAnchors = new Set(
    readWorldContract("anchors.json").anchors.map(({ id }) => id),
  );
  const worldPaths = new Set(
    readWorldContract("paths.json").sequencePaths.map(({ id }) => id),
  );

  assert.deepEqual(NARRATIVE_PATHS, ["man-to-pool"]);
  const futureWorldAnchors = [
    "pool.neighbors",
    "courtyard.inquiry-entry",
    "courtyard.inquiry-man",
    "courtyard.pharisees-left",
    "courtyard.pharisees-right",
    "courtyard.parents",
    "courtyard.waiting",
    "courtyard.gate",
    "courtyard.expelled",
    "courtyard.jesus-entry",
    "courtyard.belief",
    "courtyard.ending-camera",
  ];
  assert.ok(
    NARRATIVE_ANCHORS.every(
      (id) => worldAnchors.has(id) || futureWorldAnchors.includes(id),
    ),
  );
  assert.ok(NARRATIVE_PATHS.every((id) => worldPaths.has(id)));
  assert.ok(
    NARRATIVE_ANCHORS.every(
      (id) => id.startsWith("courtyard.") || id.startsWith("pool."),
    ),
  );
});

test("B05 declares the manual escort contract", () => {
  const path = readWorldContract("paths.json").sequencePaths.find(
    ({ id }) => id === "man-to-pool",
  );
  const escortStep = SEQUENCES[4].steps.find(
    ({ command }) => command === "escort-actor-to-anchor",
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
  assert.deepEqual(escortStep.payload, {
    pathId: "man-to-pool",
    actorId: "man-born-blind",
    playerArrivalAnchorId: "pool.observer-approach",
  });
  assert.equal(
    SEQUENCES.slice(5).some(({ steps }) =>
      steps.some(({ payload }) => payload.pathId),
    ),
    false,
  );
});

test("all twenty sequences are skippable coordinate-free compact-map contracts", () => {
  const anchors = new Set(NARRATIVE_ANCHORS);
  const paths = new Set(NARRATIVE_PATHS);
  assert.equal(SEQUENCES.length, 20);
  for (const sequence of SEQUENCES) {
    assert.equal(sequence.cancellable, true);
    assert.equal(sequence.skippable, true);
    assert.equal(sequence.reentrant, false);
    assert.equal(sequence.finalState.beatId, sequence.beatId);
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

test("later sequences stage actors and short actions without long travel commands", () => {
  const laterCommands = SEQUENCES.slice(6).flatMap(({ steps }) =>
    steps.map(({ command }) => command),
  );
  assert.equal(laterCommands.includes("actor-follow-path"), false);
  assert.equal(laterCommands.includes("camera-follow-path"), false);
  assert.ok(laterCommands.includes("set-actor-visible"));
  assert.ok(laterCommands.includes("focus-camera"));
});
