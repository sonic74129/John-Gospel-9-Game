import { FINAL_SNAPSHOTS } from "./completion.ts";

export const NARRATIVE_ANCHORS = Object.freeze([
  "courtyard.player-start",
  "courtyard.observer",
  "courtyard.man-center",
  "courtyard.jesus",
  "courtyard.disciples",
  "courtyard.clay-action",
  "courtyard.camera",
  "courtyard.pool-approach",
  "pool.wash-edge",
  "pool.observer-approach",
  "pool.camera",
]);

export const NARRATIVE_PATHS = Object.freeze(["man-to-pool"]);

const command = (commandName, payload, sourceLevel = "S2") =>
  Object.freeze({
    kind: "command",
    command: commandName,
    payload: Object.freeze(payload),
    sourceLevel,
  });

const dialogueStep = (beatId) =>
  command("present-scripture-segments", { beatId }, "S0");

const manToPool = () =>
  command("actor-follow-path", {
    pathId: "man-to-pool",
    subjectId: "man-born-blind",
    primaryActorId: "man-born-blind",
    participantActorIds: Object.freeze([]),
  });

const STEPS_BY_BEAT = Object.freeze({
  b01: [
    command("focus-camera", { anchorId: "courtyard.clay-action" }),
    dialogueStep("b01"),
  ],
  b02: [dialogueStep("b02")],
  b03: [dialogueStep("b03")],
  b04: [
    command(
      "set-actor-pose",
      { actorId: "man-born-blind", pose: "clay-on-eyes" },
      "S1",
    ),
    dialogueStep("b04"),
  ],
  b05: [
    dialogueStep("b05"),
    command(
      "set-actor-pose",
      { actorId: "man-born-blind", pose: "standing" },
      "S1",
    ),
    manToPool(),
    command("focus-camera", { anchorId: "pool.wash-edge" }),
  ],
  b06: [
    dialogueStep("b06"),
    command(
      "set-actor-pose",
      { actorId: "man-born-blind", pose: "washed-seeing" },
      "S1",
    ),
  ],
});

export const SEQUENCES = Object.freeze(
  Array.from({ length: 6 }, (_, index) => {
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
