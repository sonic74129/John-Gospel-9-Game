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
    command("escort-actor-to-anchor", {
      pathId: "man-to-pool",
      actorId: "man-born-blind",
      playerArrivalAnchorId: "pool.observer-approach",
    }),
    command("focus-camera", { anchorId: "pool.wash-edge" }),
  ],
  b06: [
    dialogueStep("b06"),
    command(
      "set-actor-pose",
      { actorId: "man-born-blind", pose: "washed-seeing" },
      "S1",
    ),
    command("set-actor-visible", { actorId: "neighbors", visible: true }),
  ],
  b07: [
    command("set-actor-pose", { actorId: "neighbors", pose: "questioning" }, "S1"),
    dialogueStep("b07"),
  ],
  b08: [dialogueStep("b08")],
  b09: [
    command("set-actor-visible", { actorId: "pharisees", visible: true }),
    command("set-actor-visible", {
      actorId: "judean-authorities",
      visible: true,
    }),
    command("focus-camera", { anchorId: "courtyard.inquiry-man" }),
    dialogueStep("b09"),
  ],
  b10: [dialogueStep("b10")],
  b11: [dialogueStep("b11")],
  b12: [
    command("set-actor-visible", { actorId: "parents", visible: true }),
    command("focus-camera", { anchorId: "courtyard.parents" }),
    dialogueStep("b12"),
  ],
  b13: [
    dialogueStep("b13"),
    command("set-actor-visible", { actorId: "parents", visible: false }),
  ],
  b14: [dialogueStep("b14")],
  b15: [dialogueStep("b15")],
  b16: [dialogueStep("b16")],
  b17: [dialogueStep("b17")],
  b18: [
    dialogueStep("b18"),
    command("focus-camera", { anchorId: "courtyard.expelled" }),
  ],
  b19: [
    command("set-actor-visible", { actorId: "jesus", visible: true }),
    command("focus-camera", { anchorId: "courtyard.belief" }),
    dialogueStep("b19"),
    command("set-actor-pose", { actorId: "man-born-blind", pose: "worship" }, "S1"),
  ],
  b20: [
    command("set-actor-visible", { actorId: "pharisees", visible: true }),
    dialogueStep("b20"),
    command("focus-camera", { anchorId: "courtyard.ending-camera" }),
  ],
});

export const SEQUENCES = Object.freeze(
  Array.from({ length: 20 }, (_, index) => {
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
