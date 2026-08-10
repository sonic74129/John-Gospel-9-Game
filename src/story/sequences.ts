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

export const NARRATIVE_PATHS = Object.freeze([
  "man-to-pool",
  "pool-to-neighbors",
  "group-to-inquiry",
  "parents-entry",
  "parents-exit",
  "expulsion",
  "jesus-entry",
  "ending",
]);

export const BEAT_TRANSITIONS = Object.freeze({
  b07: Object.freeze({
    mode: "npc-arrives",
    pathIds: Object.freeze(["pool-to-neighbors"]),
  }),
  b08: Object.freeze({ mode: "player-seeks", pathIds: Object.freeze([]) }),
  b09: Object.freeze({
    mode: "npc-leads-player",
    pathIds: Object.freeze(["group-to-inquiry"]),
  }),
  b10: Object.freeze({ mode: "player-seeks", pathIds: Object.freeze([]) }),
  b11: Object.freeze({ mode: "player-seeks", pathIds: Object.freeze([]) }),
  b12: Object.freeze({
    mode: "npc-arrives",
    pathIds: Object.freeze(["parents-entry"]),
  }),
  b13: Object.freeze({
    mode: "npc-arrives",
    pathIds: Object.freeze(["parents-exit"]),
  }),
  b14: Object.freeze({ mode: "player-seeks", pathIds: Object.freeze([]) }),
  b15: Object.freeze({ mode: "player-seeks", pathIds: Object.freeze([]) }),
  b16: Object.freeze({ mode: "player-seeks", pathIds: Object.freeze([]) }),
  b17: Object.freeze({ mode: "player-seeks", pathIds: Object.freeze([]) }),
  b18: Object.freeze({
    mode: "npc-leads-player",
    pathIds: Object.freeze(["expulsion"]),
  }),
  b19: Object.freeze({
    mode: "npc-arrives",
    pathIds: Object.freeze(["jesus-entry"]),
  }),
  b20: Object.freeze({
    mode: "npc-arrives",
    pathIds: Object.freeze(["ending"]),
  }),
});

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
  ],
  b07: [
    command("actor-follow-path", {
      pathId: "pool-to-neighbors",
      primaryActorId: "man-born-blind",
      participantActorIds: ["neighbors"],
    }),
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
    command("actor-follow-path", {
      pathId: "group-to-inquiry",
      primaryActorId: "man-born-blind",
      participantActorIds: ["neighbors"],
      playerArrivalAnchorId: "courtyard.inquiry-entry",
    }),
    command("focus-camera", { anchorId: "courtyard.inquiry-man" }),
    dialogueStep("b09"),
  ],
  b10: [dialogueStep("b10")],
  b11: [dialogueStep("b11")],
  b12: [
    command("actor-follow-path", {
      pathId: "parents-entry",
      primaryActorId: "parents",
      participantActorIds: [],
    }),
    command("focus-camera", { anchorId: "courtyard.parents" }),
    dialogueStep("b12"),
  ],
  b13: [
    dialogueStep("b13"),
    command("actor-follow-path", {
      pathId: "parents-exit",
      primaryActorId: "parents",
      participantActorIds: [],
    }),
    command("set-actor-visible", { actorId: "parents", visible: false }),
  ],
  b14: [dialogueStep("b14")],
  b15: [dialogueStep("b15")],
  b16: [dialogueStep("b16")],
  b17: [dialogueStep("b17")],
  b18: [
    dialogueStep("b18"),
    command("actor-follow-path", {
      pathId: "expulsion",
      primaryActorId: "man-born-blind",
      participantActorIds: [],
      playerArrivalAnchorId: "courtyard.gate",
    }),
    command("set-actor-visible", {
      actorId: "judean-authorities",
      visible: false,
    }),
    command("focus-camera", { anchorId: "courtyard.expelled" }),
  ],
  b19: [
    command("actor-follow-path", {
      pathId: "jesus-entry",
      primaryActorId: "jesus",
      participantActorIds: [],
    }),
    command("focus-camera", { anchorId: "courtyard.belief" }),
    dialogueStep("b19"),
    command("set-actor-pose", { actorId: "man-born-blind", pose: "worship" }, "S1"),
  ],
  b20: [
    command("actor-follow-path", {
      pathId: "ending",
      primaryActorId: "pharisees",
      participantActorIds: [],
    }),
    command("camera-follow-path", { pathId: "ending" }),
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
