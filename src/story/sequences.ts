import { FINAL_SNAPSHOTS } from "./completion.ts";

export const NARRATIVE_ANCHORS = Object.freeze([
  "anchor-temple-road-observer",
  "anchor-temple-road-jesus",
  "anchor-temple-road-disciples",
  "anchor-temple-road-man",
  "anchor-temple-road-ground",
  "anchor-temple-road-exit",
  "anchor-man-eyes",
  "anchor-siloam-pool",
  "anchor-neighborhood-center",
  "anchor-neighborhood-gathering",
  "anchor-pharisee-hearing",
  "anchor-pharisee-hearing-center",
  "anchor-parents-waiting",
  "anchor-parents-testimony",
  "anchor-hearing-exit",
  "anchor-reencounter-approach",
  "anchor-reencounter-jesus",
  "anchor-reencounter-man",
  "anchor-reencounter-nearby",
  "anchor-observer-follow",
  "anchor-camera-temple-road",
  "anchor-camera-siloam-pool",
  "anchor-camera-neighborhood",
  "anchor-camera-pharisee-hearing",
  "anchor-camera-hearing-exit",
  "anchor-camera-reencounter",
]);

export const NARRATIVE_PATHS = Object.freeze([
  "path-temple-road-to-siloam",
  "path-siloam-to-neighborhood",
  "path-neighborhood-to-hearing",
  "path-hearing-to-exit",
  "path-reencounter-approach",
]);

const command = (commandName, payload, sourceLevel = "S2") =>
  Object.freeze({
    kind: "command",
    command: commandName,
    payload: Object.freeze(payload),
    sourceLevel,
  });

const dialogueStep = (beatId) => command("present-scripture-segments", { beatId }, "S0");

const STEPS_BY_BEAT = Object.freeze({
  b01: [command("focus-camera", { anchorId: "anchor-camera-temple-road" })],
  b02: [dialogueStep("b02")],
  b03: [dialogueStep("b03")],
  b04: [
    command("set-actor-pose", { actorId: "man-born-blind", pose: "clay-on-eyes" }, "S1"),
    dialogueStep("b04"),
  ],
  b05: [
    command("actor-follow-path", {
      actorId: "man-born-blind",
      pathId: "path-temple-road-to-siloam",
    }),
    command("focus-camera", { anchorId: "anchor-camera-siloam-pool" }),
  ],
  b06: [
    command("actor-follow-path", {
      actorId: "man-born-blind",
      pathId: "path-siloam-to-neighborhood",
    }),
    dialogueStep("b06"),
  ],
  b07: [dialogueStep("b07")],
  b08: [
    command("actor-follow-path", {
      actorId: "man-born-blind",
      pathId: "path-neighborhood-to-hearing",
    }),
    command("focus-camera", { anchorId: "anchor-camera-pharisee-hearing" }),
  ],
  b09: [dialogueStep("b09")],
  b10: [dialogueStep("b10")],
  b11: [
    command("set-actor-visible", { actorId: "parents", visible: true }, "S1"),
    dialogueStep("b11"),
  ],
  b12: [dialogueStep("b12")],
  b13: [dialogueStep("b13")],
  b14: [dialogueStep("b14")],
  b15: [dialogueStep("b15")],
  b16: [dialogueStep("b16")],
  b17: [
    dialogueStep("b17"),
    command("actor-follow-path", {
      actorId: "man-born-blind",
      pathId: "path-hearing-to-exit",
    }),
  ],
  b18: [
    command("actor-follow-path", {
      actorId: "jesus",
      pathId: "path-reencounter-approach",
    }),
    dialogueStep("b18"),
  ],
  b19: [dialogueStep("b19")],
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
