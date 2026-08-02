const optionalRecall = (id, afterBeatId, focusTestimonyIds) =>
  Object.freeze({
    id,
    afterBeatId,
    trigger: Object.freeze({ type: "event", event: `beat:${afterBeatId}:completed` }),
    sourceLevel: "S2",
    sourceLabel: "遊戲提示",
    responseMode: "review-only",
    focusTestimonyIds: Object.freeze(focusTestimonyIds),
    blocking: false,
    requiredForProgress: false,
    score: null,
    failureState: null,
    onDismiss: "continue",
  });

export const RECALL_INTERACTIONS = Object.freeze([
  optionalRecall("recall-after-b07", "b07", [
    "testimony-man-first-account",
    "testimony-man-whereabouts-unknown",
  ]),
  optionalRecall("recall-after-b12", "b12", [
    "testimony-parents-known-facts",
    "testimony-parents-unknown-details",
  ]),
  optionalRecall("recall-after-b14", "b14", [
    "testimony-man-known-fact",
    "testimony-man-limited-knowledge",
  ]),
]);

export const RECALL_BY_AFTER_BEAT = Object.freeze(
  Object.fromEntries(RECALL_INTERACTIONS.map((recall) => [recall.afterBeatId, recall])),
);
