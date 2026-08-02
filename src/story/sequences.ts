import { FINAL_SNAPSHOTS } from "./completion.ts";

export const NARRATIVE_ANCHORS = Object.freeze([
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
]);

export const NARRATIVE_PATHS = Object.freeze([
  "man-to-pool",
  "pool-to-neighbors",
  "group-to-inquiry",
  "parents-entry-exit",
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

const STEPS_BY_BEAT = Object.freeze({
  b01: [command("focus-camera", { anchorId: "roadside.clay-action" })],
  b02: [dialogueStep("b02")],
  b03: [dialogueStep("b03")],
  b04: [
    command("set-actor-pose", { actorId: "man-born-blind", pose: "clay-on-eyes" }, "S1"),
    dialogueStep("b04"),
  ],
  b05: [
    command("actor-follow-path", {
      actorId: "man-born-blind",
      pathId: "man-to-pool",
    }),
    command("focus-camera", { anchorId: "pool.wash-edge" }),
  ],
  b06: [
    command("actor-follow-path", {
      actorId: "man-born-blind",
      pathId: "pool-to-neighbors",
    }),
    dialogueStep("b06"),
  ],
  b07: [dialogueStep("b07")],
  b08: [
    command("actor-follow-path", {
      actorId: "man-born-blind",
      pathId: "group-to-inquiry",
    }),
    command("focus-camera", { anchorId: "inquiry.man-center" }),
  ],
  b09: [dialogueStep("b09")],
  b10: [dialogueStep("b10")],
  b11: [
    command("set-actor-visible", { actorId: "parents", visible: true }, "S1"),
    dialogueStep("b11"),
  ],
  b12: [
    dialogueStep("b12"),
    command("actor-follow-path", { actorId: "parents", pathId: "parents-entry-exit" }),
  ],
  b13: [dialogueStep("b13")],
  b14: [dialogueStep("b14")],
  b15: [dialogueStep("b15")],
  b16: [dialogueStep("b16")],
  b17: [
    dialogueStep("b17"),
    command("actor-follow-path", {
      actorId: "man-born-blind",
      pathId: "expulsion",
    }),
  ],
  b18: [
    command("actor-follow-path", {
      actorId: "jesus",
      pathId: "jesus-entry",
    }),
    dialogueStep("b18"),
  ],
  b19: [dialogueStep("b19"), command("camera-follow-path", { pathId: "ending" })],
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
