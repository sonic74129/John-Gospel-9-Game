import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  NARRATIVE_ANCHORS,
  NARRATIVE_PATHS,
  SEQUENCES,
} from "../../src/story/sequences.ts";

const CANONICAL_WORLD_ANCHORS = [
  "roadside.player-start",
  "roadside.blind-man-seat",
  "roadside.jesus",
  "roadside.disciples",
  "roadside.clay-action",
  "roadside.pool-exit",
  "pool.wash-edge",
  "pool.return",
  "neighbors.pool-entry",
  "neighbors.center",
  "neighbors.group-left",
  "inquiry.gate",
  "inquiry.man-center",
  "inquiry.pharisees-left",
  "inquiry.pharisees-right",
  "inquiry.parents",
  "inquiry.waiting",
  "inquiry.parents-exit",
  "outside.inquiry-entry",
  "outside.expelled",
  "outside.jesus-entry",
  "outside.belief",
  "ending.camera",
];

const CANONICAL_WORLD_PATHS = [
  "man-to-pool",
  "pool-to-neighbors",
  "group-to-inquiry",
  "parents-entry-exit",
  "expulsion",
  "jesus-entry",
  "ending",
];

const readWorldContract = (fileName) => {
  const localUrl = new URL(`../../src/world/${fileName}`, import.meta.url);
  try {
    return JSON.parse(readFileSync(fileURLToPath(localUrl), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    return JSON.parse(
      execFileSync(
        "git",
        [
          "show",
          `sonic74129-build-john9-world-graybox:src/world/${fileName}`,
        ],
        { encoding: "utf8" },
      ),
    );
  }
};

test("exports the exact canonical world vocabulary required by the narrative", () => {
  const worldAnchors = new Set(
    readWorldContract("anchors.json").anchors.map(({ id }) => id),
  );
  const worldPaths = new Set(
    readWorldContract("paths.json").sequencePaths.map(({ id }) => id),
  );
  assert.deepEqual(NARRATIVE_ANCHORS, CANONICAL_WORLD_ANCHORS);
  assert.deepEqual(NARRATIVE_PATHS, CANONICAL_WORLD_PATHS);
  assert.ok(NARRATIVE_ANCHORS.every((id) => worldAnchors.has(id)));
  assert.ok(NARRATIVE_PATHS.every((id) => worldPaths.has(id)));
});

test("sequence contracts use plan vocabulary without embedding coordinates", () => {
  const anchors = new Set(NARRATIVE_ANCHORS);
  const paths = new Set(NARRATIVE_PATHS);
  assert.equal(SEQUENCES.length, 19);
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
        assert.equal(step.sourceLevel, "S2");
      }
    }
  }
});
