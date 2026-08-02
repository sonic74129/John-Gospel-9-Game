const ACTOR_DEFAULTS = Object.freeze({
  observer: ["roadside.player-start", "idle", "觀察者", true, true],
  jesus: ["roadside.jesus", "idle", "耶穌", true, true],
  disciples: ["roadside.disciples", "idle", "門徒", true, true],
  "man-born-blind": ["roadside.blind-man-seat", "seated", "那人", true, true],
  neighbors: ["neighbors.group-left", "idle", "鄰舍與見過他的人", false, false],
  pharisees: ["inquiry.pharisees-left", "idle", "法利賽人", false, false],
  parents: ["inquiry.waiting", "idle", "他的父母", false, false],
  "judean-authorities": ["inquiry.pharisees-right", "idle", "猶太人", false, false],
});

const PHASE_BY_BEAT = Object.freeze({
  b01: "roadside",
  b02: "roadside",
  b03: "roadside",
  b04: "clay",
  b05: "siloam",
  b06: "neighborhood",
  b07: "neighborhood",
  b08: "inquiry-arrival",
  b09: "inquiry",
  b10: "inquiry",
  b11: "parents",
  b12: "parents-departed",
  b13: "inquiry-after-parents",
  b14: "inquiry-after-parents",
  b15: "inquiry-after-parents",
  b16: "inquiry-after-parents",
  b17: "outside",
  b18: "reencounter",
  b19: "ending",
});

const CAMERA_ANCHOR_BY_PHASE = Object.freeze({
  roadside: "roadside.clay-action",
  clay: "roadside.clay-action",
  siloam: "pool.return",
  neighborhood: "neighbors.center",
  "inquiry-arrival": "inquiry.man-center",
  inquiry: "inquiry.man-center",
  parents: "inquiry.man-center",
  "parents-departed": "inquiry.man-center",
  "inquiry-after-parents": "inquiry.man-center",
  outside: "outside.expelled",
  reencounter: "outside.belief",
  ending: "ending.camera",
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
        "man-born-blind": ["roadside.blind-man-seat", "clay-on-eyes", "那人", true, true],
      };
    case "siloam":
      return {
        observer: ["pool.return", "idle", "觀察者", true, true],
        jesus: ["roadside.pool-exit", "departed", "耶穌", false, false],
        disciples: ["roadside.pool-exit", "departed", "門徒", false, false],
        "man-born-blind": ["pool.return", "standing-seeing", "那人", true, true],
      };
    case "neighborhood":
      return {
        observer: ["neighbors.pool-entry", "idle", "觀察者", true, true],
        jesus: ["roadside.pool-exit", "departed", "耶穌", false, false],
        disciples: ["roadside.pool-exit", "departed", "門徒", false, false],
        "man-born-blind": ["neighbors.center", "standing-seeing", "那人", true, true],
        neighbors: ["neighbors.center", "questioning", "鄰舍與見過他的人", true, true],
      };
    case "inquiry":
      return {
        observer: ["inquiry.gate", "idle", "觀察者", true, true],
        jesus: ["roadside.pool-exit", "departed", "耶穌", false, false],
        disciples: ["roadside.pool-exit", "departed", "門徒", false, false],
        "man-born-blind": ["inquiry.man-center", "standing-seeing", "那人", true, true],
        neighbors: ["inquiry.man-center", "idle", "鄰舍與見過他的人", false, false],
        pharisees: ["inquiry.pharisees-left", "questioning", "法利賽人", true, true],
        parents: ["inquiry.parents-entry", "idle", "他的父母", false, false],
        "judean-authorities": ["inquiry.pharisees-right", "questioning", "猶太人", true, true],
      };
    case "inquiry-arrival":
      return {
        ...phaseOverrides("inquiry"),
        neighbors: ["inquiry.man-center", "standing", "鄰舍與見過他的人", true, true],
      };
    case "parents":
      return {
        ...phaseOverrides("inquiry"),
        parents: ["inquiry.parents", "standing", "他的父母", true, true],
      };
    case "parents-departed":
    case "inquiry-after-parents":
      return {
        ...phaseOverrides("inquiry"),
        parents: ["inquiry.parents-exit", "departed", "他的父母", false, false],
      };
    case "outside":
      return {
        observer: ["outside.inquiry-entry", "idle", "觀察者", true, true],
        jesus: ["outside.jesus-entry", "walking", "耶穌", false, false],
        disciples: ["roadside.pool-exit", "departed", "門徒", false, false],
        "man-born-blind": ["outside.expelled", "standing-seeing", "那人", true, true],
        neighbors: ["inquiry.man-center", "idle", "鄰舍與見過他的人", false, false],
        pharisees: ["inquiry.pharisees-left", "idle", "法利賽人", false, false],
        parents: ["inquiry.parents-exit", "idle", "他的父母", false, false],
        "judean-authorities": ["inquiry.pharisees-right", "idle", "猶太人", false, false],
      };
    case "reencounter":
    case "ending":
      return {
        ...phaseOverrides("outside"),
        jesus: ["outside.expelled", "standing", "耶穌", true, true],
        "man-born-blind": ["outside.expelled", "worship", "那人", true, true],
        pharisees: ["outside.inquiry-entry", "listening", "法利賽人", true, true],
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
          collisionEnabled: visible ? collisionEnabled : false,
          contentLevel: id === "observer" ? "S2" : "S1",
          stagingLevel: "S2",
        }),
      ]),
    ),
  );
};

const propState = (phase) =>
  Object.freeze({
    clay: Object.freeze({
      visible: phase === "clay",
      anchorId: "roadside.clay-action",
      state:
        phase === "clay" ? "applied" : phase === "roadside" ? "available" : "cleared",
      collisionEnabled: false,
      contentLevel: "S1",
      stagingLevel: "S2",
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
