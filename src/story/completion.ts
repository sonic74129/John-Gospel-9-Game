const ACTOR_DEFAULTS = Object.freeze({
  observer: ["anchor-observer-follow", "idle", "觀察者", true, true],
  jesus: ["anchor-temple-road-jesus", "idle", "耶穌", true, true],
  disciples: ["anchor-temple-road-disciples", "idle", "門徒", true, true],
  "man-born-blind": ["anchor-temple-road-man", "seated", "那人", true, true],
  neighbors: ["anchor-neighborhood-gathering", "idle", "鄰舍與見過他的人", false, true],
  pharisees: ["anchor-pharisee-hearing", "idle", "法利賽人", false, true],
  parents: ["anchor-parents-waiting", "idle", "他的父母", false, true],
  "judean-authorities": ["anchor-pharisee-hearing", "idle", "猶太人", false, true],
});

const PHASE_BY_BEAT = Object.freeze({
  b01: "temple",
  b02: "temple",
  b03: "temple",
  b04: "clay",
  b05: "siloam",
  b06: "neighborhood",
  b07: "neighborhood",
  b08: "hearing",
  b09: "hearing",
  b10: "hearing",
  b11: "parents",
  b12: "parents",
  b13: "hearing",
  b14: "hearing",
  b15: "hearing",
  b16: "hearing",
  b17: "outside",
  b18: "reencounter",
  b19: "reencounter",
});

const CAMERA_ANCHOR_BY_PHASE = Object.freeze({
  temple: "anchor-camera-temple-road",
  clay: "anchor-camera-temple-road",
  siloam: "anchor-camera-siloam-pool",
  neighborhood: "anchor-camera-neighborhood",
  hearing: "anchor-camera-pharisee-hearing",
  parents: "anchor-camera-pharisee-hearing",
  outside: "anchor-camera-hearing-exit",
  reencounter: "anchor-camera-reencounter",
});

const TESTIMONY_UNLOCKS_BY_BEAT = Object.freeze({
  b06: ["testimony-neighbors-identity-disagreement", "testimony-man-identifies-self"],
  b07: [
    "testimony-man-first-account",
    "testimony-man-whereabouts-unknown",
  ],
  b09: ["testimony-man-pharisee-account", "testimony-pharisees-disagree"],
  b10: ["testimony-man-opinion"],
  b12: [
    "testimony-parents-known-facts",
    "testimony-parents-unknown-details",
  ],
  b14: [
    "testimony-man-known-fact",
    "testimony-man-limited-knowledge",
  ],
  b15: ["testimony-man-repeated-answer"],
  b16: ["testimony-pharisees-claim"],
  b17: ["testimony-man-final-answer"],
});

const testimonyIdsThrough = (beatId) => {
  const order = Number(beatId.slice(1));
  return Object.freeze(
    Array.from({ length: order }, (_, index) => `b${String(index + 1).padStart(2, "0")}`).flatMap(
      (completedBeatId) => TESTIMONY_UNLOCKS_BY_BEAT[completedBeatId] ?? [],
    ),
  );
};

const phaseOverrides = (phase) => {
  switch (phase) {
    case "clay":
      return {
        "man-born-blind": ["anchor-temple-road-man", "clay-on-eyes", "那人", true, true],
      };
    case "siloam":
      return {
        jesus: ["anchor-temple-road-exit", "departed", "耶穌", false, false],
        disciples: ["anchor-temple-road-exit", "departed", "門徒", false, false],
        "man-born-blind": ["anchor-siloam-pool", "standing-seeing", "那人", true, true],
      };
    case "neighborhood":
      return {
        jesus: ["anchor-temple-road-exit", "departed", "耶穌", false, false],
        disciples: ["anchor-temple-road-exit", "departed", "門徒", false, false],
        "man-born-blind": ["anchor-neighborhood-center", "standing-seeing", "那人", true, true],
        neighbors: ["anchor-neighborhood-gathering", "questioning", "鄰舍與見過他的人", true, true],
      };
    case "hearing":
      return {
        jesus: ["anchor-temple-road-exit", "departed", "耶穌", false, false],
        disciples: ["anchor-temple-road-exit", "departed", "門徒", false, false],
        "man-born-blind": ["anchor-pharisee-hearing-center", "standing-seeing", "那人", true, true],
        neighbors: ["anchor-neighborhood-gathering", "idle", "鄰舍與見過他的人", false, true],
        pharisees: ["anchor-pharisee-hearing", "questioning", "法利賽人", true, true],
        "judean-authorities": ["anchor-pharisee-hearing", "questioning", "猶太人", true, true],
      };
    case "parents":
      return {
        ...phaseOverrides("hearing"),
        parents: ["anchor-parents-testimony", "standing", "他的父母", true, true],
      };
    case "outside":
      return {
        jesus: ["anchor-reencounter-approach", "walking", "耶穌", false, true],
        disciples: ["anchor-temple-road-exit", "departed", "門徒", false, false],
        "man-born-blind": ["anchor-hearing-exit", "standing-seeing", "那人", true, true],
        neighbors: ["anchor-neighborhood-gathering", "idle", "鄰舍與見過他的人", false, true],
        pharisees: ["anchor-pharisee-hearing", "idle", "法利賽人", false, true],
        parents: ["anchor-parents-waiting", "idle", "他的父母", false, true],
        "judean-authorities": ["anchor-pharisee-hearing", "idle", "猶太人", false, true],
      };
    case "reencounter":
      return {
        ...phaseOverrides("outside"),
        jesus: ["anchor-reencounter-jesus", "standing", "耶穌", true, true],
        "man-born-blind": ["anchor-reencounter-man", "worship", "那人", true, true],
        pharisees: ["anchor-reencounter-nearby", "listening", "法利賽人", true, true],
      };
    default:
      return {};
  }
};

const actorState = (phase) => {
  const state = { ...ACTOR_DEFAULTS, ...phaseOverrides(phase) };
  return Object.freeze(
    Object.fromEntries(
      Object.entries(state).map(([id, [anchorId, pose, label, visible, collisionEnabled]]) => [
        id,
        Object.freeze({
          visible,
          anchorId,
          pose,
          label,
          collisionEnabled,
          sourceLevel: id === "observer" || pose === "departed" || pose === "walking" ? "S2" : "S1",
        }),
      ]),
    ),
  );
};

const propState = (phase) =>
  Object.freeze({
    clay: Object.freeze({
      visible: phase === "clay",
      anchorId: phase === "clay" ? "anchor-man-eyes" : "anchor-temple-road-ground",
      state: phase === "clay" ? "applied" : phase === "temple" ? "available" : "cleared",
      collisionEnabled: false,
      sourceLevel: "S1",
    }),
  });

const recallIdsThrough = (beatId) => {
  const order = Number(beatId.slice(1));
  return Object.freeze(
    [
      [7, "recall-after-b07"],
      [12, "recall-after-b12"],
      [14, "recall-after-b14"],
    ]
      .filter(([afterOrder]) => afterOrder <= order)
      .map(([, id]) => id),
  );
};

const snapshotForBeat = (beatId) => {
  const order = Number(beatId.slice(1));
  const phase = PHASE_BY_BEAT[beatId];
  return Object.freeze({
    id: `john9-${beatId}-final`,
    beatId,
    actors: actorState(phase),
    props: propState(phase),
    camera: Object.freeze({
      anchorId: CAMERA_ANCHOR_BY_PHASE[phase],
      mode: "follow-observer",
      transition: "settled",
      sourceLevel: "S2",
    }),
    controls: Object.freeze({
      playerActorId: "observer",
      movementEnabled: true,
      interactionEnabled: true,
      dialogueEnabled: false,
      locked: false,
      sourceLevel: "S2",
    }),
    testimony: Object.freeze({
      activeIds: testimonyIdsThrough(beatId),
      verdictMode: "provenance-only",
      sourceLevel: "S1",
    }),
    triggers: Object.freeze({
      completedBeatIds: Object.freeze(
        Array.from({ length: order }, (_, index) => `b${String(index + 1).padStart(2, "0")}`),
      ),
      nextBeatId: order === 19 ? null : `b${String(order + 1).padStart(2, "0")}`,
      optionalRecallIds: recallIdsThrough(beatId),
      sourceLevel: "S2",
    }),
    music: Object.freeze({
      cueId: order === 19 ? "music-john9-closing" : "music-john9-map",
      playing: true,
      ducked: false,
      sourceLevel: "S2",
    }),
  });
};

export const FINAL_SNAPSHOTS = Object.freeze(
  Object.fromEntries(
    Array.from({ length: 19 }, (_, index) => {
      const beatId = `b${String(index + 1).padStart(2, "0")}`;
      return [beatId, snapshotForBeat(beatId)];
    }),
  ),
);

export const STORY_COMPLETION = Object.freeze({
  id: "john9-story-complete",
  requiredBeatIds: Object.freeze(
    Array.from({ length: 19 }, (_, index) => `b${String(index + 1).padStart(2, "0")}`),
  ),
  finalBeatId: "b19",
  finalSnapshotId: FINAL_SNAPSHOTS.b19.id,
  outcomeMutableByPlayer: false,
  playerDecisionRequired: false,
});

export const isStoryComplete = (completedBeatIds) => {
  const completed = new Set(completedBeatIds);
  return STORY_COMPLETION.requiredBeatIds.every((beatId) => completed.has(beatId));
};

export const resolveFinalSnapshot = (beatId, status) => {
  if (status !== "completed" && status !== "skipped") {
    throw new TypeError(`Unsupported sequence completion status: ${status}`);
  }
  const snapshot = FINAL_SNAPSHOTS[beatId];
  if (!snapshot) {
    throw new RangeError(`Unknown beat: ${beatId}`);
  }
  return snapshot;
};

export const applyBeatFinalState = async (host, beatId, status, signal) => {
  const snapshot = resolveFinalSnapshot(beatId, status);
  await host.applyFinalState(snapshot, signal);
  await host.handoff?.(status, signal);
  return snapshot;
};
