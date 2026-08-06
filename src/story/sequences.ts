import { FINAL_SNAPSHOTS } from "./completion.ts";

export const NARRATIVE_ANCHORS = Object.freeze([
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
  "neighbors.gathered",
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
]);

export const NARRATIVE_PATHS = Object.freeze([
  "man-to-pool",
  "pool-wash-to-return",
  "pool-to-neighbors",
  "neighbors-to-center",
  "group-to-inquiry",
  "parents-entry",
  "parents-exit",
  "expulsion",
  "jesus-entry",
  "ending",
]);

const command = (commandName, payload, sourceLevel = "S2") =>
  Object.freeze({
    kind: "command",
    command: commandName,
    payload: Object.freeze(payload),
    sourceLevel,
  });

const dialogueStep = (beatId) => command("present-scripture-segments", { beatId }, "S0");

const actorPathStep = (
  pathId,
  subjectId,
  primaryActorId,
  participantActorIds = Object.freeze([]),
) =>
  command("actor-follow-path", {
    pathId,
    subjectId,
    primaryActorId,
    participantActorIds: Object.freeze(participantActorIds),
  });

const cameraPathStep = (pathId, subjectId) =>
  command("camera-follow-path", {
    pathId,
    subjectId,
    primaryActorId: null,
    participantActorIds: Object.freeze([]),
  });

const STEPS_BY_BEAT = Object.freeze({
  b01: [command("focus-camera", { anchorId: "roadside.clay-action" })],
  b02: [dialogueStep("b02")],
  b03: [dialogueStep("b03")],
  b04: [
    command("set-actor-pose", { actorId: "man-born-blind", pose: "clay-on-eyes" }, "S1"),
    dialogueStep("b04"),
  ],
  b05: [
    command(
      "set-actor-pose",
      { actorId: "man-born-blind", pose: "walking-blind" },
      "S1",
    ),
    actorPathStep("man-to-pool", "man-born-blind", "man-born-blind"),
    command("set-actor-pose", { actorId: "man-born-blind", pose: "standing-seeing" }, "S1"),
    command("focus-camera", { anchorId: "pool.wash-edge" }),
    actorPathStep("pool-wash-to-return", "man-born-blind", "man-born-blind"),
  ],
  b06: [
    command("set-actor-visible", { actorId: "neighbors", visible: true }),
    actorPathStep("pool-to-neighbors", "man-born-blind", "man-born-blind"),
    actorPathStep("neighbors-to-center", "neighbors", "neighbors"),
    dialogueStep("b06"),
  ],
  b07: [dialogueStep("b07")],
  b08: [
    actorPathStep(
      "group-to-inquiry",
      "man-and-neighbor-group",
      "man-born-blind",
      ["neighbors"],
    ),
    command("focus-camera", { anchorId: "inquiry.man-center" }),
  ],
  b09: [dialogueStep("b09")],
  b10: [dialogueStep("b10")],
  b11: [
    command("set-actor-visible", { actorId: "parents", visible: true }),
    actorPathStep("parents-entry", "parents", "parents"),
    dialogueStep("b11"),
  ],
  b12: [
    dialogueStep("b12"),
    actorPathStep("parents-exit", "parents", "parents"),
  ],
  b13: [dialogueStep("b13")],
  b14: [dialogueStep("b14")],
  b15: [dialogueStep("b15")],
  b16: [dialogueStep("b16")],
  b17: [
    dialogueStep("b17"),
    actorPathStep("expulsion", "man-born-blind", "man-born-blind"),
  ],
  b18: [
    command("set-actor-visible", { actorId: "jesus", visible: true }),
    actorPathStep("jesus-entry", "jesus", "jesus"),
    dialogueStep("b18"),
  ],
  b19: [dialogueStep("b19"), cameraPathStep("ending", "camera-focus")],
});

export const SEQUENCES = Object.freeze(
  Array.from({ length: 19 }, (_, index) => {
    const beatId = `b${String(index + 1).padStart(2, "0")}`;
    return Object.freeze({
      id: `sequence-${beatId}`,
      beatId,
      cancellable: true,
      skippable: true,
      reentrant: false,
      steps: Object.freeze(STEPS_BY_BEAT[beatId]),
      finalState: FINAL_SNAPSHOTS[beatId],
    });
  }),
);

export const SEQUENCE_BY_BEAT = Object.freeze(
  Object.fromEntries(SEQUENCES.map((sequence) => [sequence.beatId, sequence])),
);
