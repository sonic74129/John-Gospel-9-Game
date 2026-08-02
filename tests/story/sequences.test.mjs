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
  "pool.roadside-entry",
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
  "inquiry.parents-entry",
  "inquiry.parents-exit",
  "outside.inquiry-entry",
  "outside.expelled",
  "outside.jesus-entry",
  "outside.belief",
  "outside.east-exit",
  "ending.camera",
];

const CANONICAL_WORLD_PATHS = [
  "man-to-pool",
  "pool-wash-to-return",
  "pool-to-neighbors",
  "group-to-inquiry",
  "parents-entry",
  "parents-exit",
  "expulsion",
  "jesus-entry",
  "ending",
];

const ACTORS_BY_PATH_SUBJECT = Object.freeze({
  "man-born-blind": {
    primaryActorId: "man-born-blind",
    participantActorIds: [],
  },
  "man-and-neighbor-group": {
    primaryActorId: "man-born-blind",
    participantActorIds: ["neighbors"],
  },
  parents: { primaryActorId: "parents", participantActorIds: [] },
  jesus: { primaryActorId: "jesus", participantActorIds: [] },
  "camera-focus": { primaryActorId: null, participantActorIds: [] },
});

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

test("path subjects and endpoints chain from prior snapshots into final snapshots", () => {
  const pathById = new Map(
    readWorldContract("paths.json").sequencePaths.map((path) => [path.id, path]),
  );

  for (let index = 1; index < SEQUENCES.length; index += 1) {
    const sequence = SEQUENCES[index];
    const pathSteps = sequence.steps.filter(({ payload }) => payload.pathId);
    if (pathSteps.length === 0) {
      continue;
    }

    const priorSnapshot = SEQUENCES[index - 1].finalState;
    const currentActorAnchors = Object.fromEntries(
      Object.entries(priorSnapshot.actors).map(([actorId, actor]) => [
        actorId,
        actor.anchorId,
      ]),
    );
    const currentActorVisibility = Object.fromEntries(
      Object.entries(priorSnapshot.actors).map(([actorId, actor]) => [
        actorId,
        actor.visible,
      ]),
    );
    let currentCameraAnchor = priorSnapshot.camera.anchorId;
    const movedActorIds = new Set();
    let cameraMoved = false;

    for (const step of pathSteps) {
      const path = pathById.get(step.payload.pathId);
      assert.ok(path, `${sequence.beatId}:${step.payload.pathId}`);
      assert.equal(path.sourceLevel, "approved-bridge");
      assert.equal(step.payload.subjectId, path.subject);
      assert.deepEqual(
        {
          primaryActorId: step.payload.primaryActorId,
          participantActorIds: step.payload.participantActorIds,
        },
        ACTORS_BY_PATH_SUBJECT[path.subject],
      );

      if (step.payload.primaryActorId === null) {
        assert.equal(path.subject, "camera-focus");
        assert.equal(currentCameraAnchor, path.startAnchorId);
        currentCameraAnchor = path.endAnchorId;
        cameraMoved = true;
        continue;
      }

      const actorId = step.payload.primaryActorId;
      assert.ok(currentActorAnchors[actorId], `${sequence.beatId}:${actorId}`);
      assert.equal(
        currentActorAnchors[actorId],
        path.startAnchorId,
        `${sequence.beatId}:${path.id}:${actorId}:start`,
      );
      currentActorAnchors[actorId] = path.endAnchorId;
      movedActorIds.add(actorId);

      for (const participantActorId of step.payload.participantActorIds) {
        assert.equal(currentActorVisibility[participantActorId], true);
        assert.notEqual(
          priorSnapshot.actors[participantActorId].anchorId,
          path.startAnchorId,
        );
        assert.equal(sequence.finalState.actors[participantActorId].visible, true);
        assert.notEqual(
          sequence.finalState.actors[participantActorId].anchorId,
          path.endAnchorId,
        );
      }
    }

    for (const actorId of movedActorIds) {
      assert.equal(
        sequence.finalState.actors[actorId].anchorId,
        currentActorAnchors[actorId],
        `${sequence.beatId}:${actorId}:final`,
      );
    }
    if (cameraMoved) {
      assert.equal(sequence.finalState.camera.anchorId, currentCameraAnchor);
    }
  }
});

test("hidden entrance actors are revealed before movement and dialogue", () => {
  const revealedEntranceActors = [];
  for (let index = 1; index < SEQUENCES.length; index += 1) {
    const sequence = SEQUENCES[index];
    const priorSnapshot = SEQUENCES[index - 1].finalState;

    for (const [pathIndex, step] of sequence.steps.entries()) {
      if (!step.payload.pathId || step.payload.primaryActorId === null) {
        continue;
      }
      const actorId = step.payload.primaryActorId;
      if (priorSnapshot.actors[actorId].visible) {
        continue;
      }

      const revealIndex = sequence.steps.findIndex(
        ({ command, payload }) =>
          command === "set-actor-visible" &&
          payload.actorId === actorId &&
          payload.visible === true,
      );
      const dialogueIndex = sequence.steps.findIndex(
        ({ command }) => command === "present-scripture-segments",
      );
      const hideBeforeDialogue = sequence.steps.findIndex(
        ({ command, payload }, stepIndex) =>
          stepIndex > revealIndex &&
          stepIndex < dialogueIndex &&
          command === "set-actor-visible" &&
          payload.actorId === actorId &&
          payload.visible === false,
      );
      assert.ok(revealIndex >= 0, `${sequence.beatId}:${actorId}:reveal`);
      assert.ok(revealIndex < pathIndex, `${sequence.beatId}:${actorId}:before-path`);
      assert.ok(dialogueIndex > pathIndex, `${sequence.beatId}:${actorId}:before-dialogue`);
      assert.equal(hideBeforeDialogue, -1);
      assert.equal(sequence.finalState.actors[actorId].visible, true);
      revealedEntranceActors.push(`${sequence.beatId}:${actorId}`);
    }
  }
  assert.deepEqual(revealedEntranceActors, ["b11:parents", "b18:jesus"]);
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
