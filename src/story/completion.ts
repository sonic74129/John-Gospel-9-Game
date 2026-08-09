const ACTOR_DEFAULTS = Object.freeze({
  observer: ["courtyard.observer", "idle", "觀察者", true, true],
  jesus: ["courtyard.jesus", "idle", "耶穌", true, true],
  disciples: ["courtyard.disciples", "idle", "門徒", true, true],
  "man-born-blind": ["courtyard.man-center", "seated", "那人", true, true],
  neighbors: ["pool.neighbors", "idle", "鄰舍與見過他的人", false, false],
  pharisees: ["courtyard.pharisees-left", "idle", "法利賽人", false, false],
  parents: ["courtyard.waiting", "idle", "他的父母", false, false],
  "judean-authorities": [
    "courtyard.pharisees-right",
    "idle",
    "猶太人",
    false,
    false,
  ],
});

const PHASE_BY_BEAT = Object.freeze({
  b01: "courtyard",
  b02: "courtyard",
  b03: "courtyard",
  b04: "clay",
  b05: "pool-awaiting",
  b06: "washed",
  b07: "neighbors",
  b08: "neighbors",
  b09: "inquiry-arrival",
  b10: "inquiry",
  b11: "inquiry",
  b12: "parents-called",
  b13: "parents-departed",
  b14: "inquiry-after-parents",
  b15: "inquiry-after-parents",
  b16: "inquiry-after-parents",
  b17: "inquiry-after-parents",
  b18: "expelled",
  b19: "belief",
  b20: "ending",
});

const CAMERA_ANCHOR_BY_PHASE = Object.freeze({
  courtyard: "courtyard.camera",
  clay: "courtyard.camera",
  "pool-awaiting": "pool.camera",
  washed: "pool.camera",
  neighbors: "pool.camera",
  "inquiry-arrival": "courtyard.inquiry-man",
  inquiry: "courtyard.inquiry-man",
  "parents-called": "courtyard.parents",
  "parents-departed": "courtyard.inquiry-man",
  "inquiry-after-parents": "courtyard.inquiry-man",
  expelled: "courtyard.expelled",
  belief: "courtyard.belief",
  ending: "courtyard.ending-camera",
});

const poolState = {
  observer: ["pool.observer-approach", "idle", "觀察者", true, true],
  jesus: ["courtyard.pool-approach", "departed", "耶穌", false, false],
  disciples: ["courtyard.pool-approach", "departed", "門徒", false, false],
};

const inquiryState = {
  observer: ["courtyard.inquiry-entry", "idle", "觀察者", true, true],
  jesus: ["courtyard.pool-approach", "departed", "耶穌", false, false],
  disciples: ["courtyard.pool-approach", "departed", "門徒", false, false],
  "man-born-blind": [
    "courtyard.inquiry-man",
    "standing-seeing",
    "那人",
    true,
    true,
  ],
  neighbors: ["courtyard.waiting", "standing", "鄰舍與見過他的人", false, false],
  pharisees: [
    "courtyard.pharisees-left",
    "questioning",
    "法利賽人",
    true,
    true,
  ],
  parents: ["courtyard.waiting", "idle", "他的父母", false, false],
  "judean-authorities": [
    "courtyard.pharisees-right",
    "questioning",
    "猶太人",
    true,
    true,
  ],
};

const phaseOverrides = (phase) => {
  switch (phase) {
    case "clay":
      return {
        "man-born-blind": [
          "courtyard.man-center",
          "clay-on-eyes",
          "那人",
          true,
          true,
        ],
      };
    case "pool-awaiting":
      return {
        ...poolState,
        "man-born-blind": ["pool.wash-edge", "standing", "那人", true, false],
      };
    case "washed":
      return {
        ...poolState,
        "man-born-blind": [
          "pool.wash-edge",
          "washed-seeing",
          "那人",
          true,
          false,
        ],
        neighbors: [
          "pool.neighbors",
          "idle",
          "鄰舍與見過他的人",
          true,
          true,
        ],
      };
    case "neighbors":
      return {
        ...phaseOverrides("washed"),
        "man-born-blind": [
          "pool.wash-edge",
          "washed-seeing",
          "那人",
          true,
          true,
        ],
        neighbors: [
          "pool.neighbors",
          "questioning",
          "鄰舍與見過他的人",
          true,
          true,
        ],
      };
    case "inquiry-arrival":
      return {
        ...inquiryState,
        neighbors: [
          "courtyard.waiting",
          "standing",
          "鄰舍與見過他的人",
          true,
          true,
        ],
      };
    case "inquiry":
    case "inquiry-after-parents":
      return inquiryState;
    case "parents-called":
      return {
        ...inquiryState,
        observer: ["courtyard.gate", "idle", "觀察者", true, true],
        parents: ["courtyard.parents", "standing", "他的父母", true, true],
      };
    case "parents-departed":
      return {
        ...inquiryState,
        parents: ["courtyard.waiting", "departed", "他的父母", false, false],
      };
    case "expelled":
      return {
        observer: ["courtyard.gate", "idle", "觀察者", true, true],
        jesus: ["courtyard.jesus-entry", "walking", "耶穌", false, false],
        disciples: ["courtyard.pool-approach", "departed", "門徒", false, false],
        "man-born-blind": [
          "courtyard.expelled",
          "standing-seeing",
          "那人",
          true,
          true,
        ],
        neighbors: ["courtyard.waiting", "idle", "鄰舍與見過他的人", false, false],
        pharisees: [
          "courtyard.pharisees-left",
          "idle",
          "法利賽人",
          false,
          false,
        ],
        parents: ["courtyard.waiting", "idle", "他的父母", false, false],
        "judean-authorities": [
          "courtyard.pharisees-right",
          "idle",
          "猶太人",
          false,
          false,
        ],
      };
    case "belief":
      return {
        ...phaseOverrides("expelled"),
        observer: ["courtyard.gate", "idle", "觀察者", true, true],
        jesus: ["courtyard.belief", "standing", "耶穌", true, true],
        "man-born-blind": [
          "courtyard.expelled",
          "worship",
          "那人",
          true,
          true,
        ],
      };
    case "ending":
      return {
        ...phaseOverrides("belief"),
        pharisees: [
          "courtyard.gate",
          "listening",
          "法利賽人",
          true,
          true,
        ],
      };
    default:
      return {};
  }
};

const actorState = (phase) => {
  const state = { ...ACTOR_DEFAULTS, ...phaseOverrides(phase) };
  return Object.freeze(
    Object.fromEntries(
      Object.entries(state).map(
        ([id, [anchorId, pose, label, visible, collisionEnabled]]) => [
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
        ],
      ),
    ),
  );
};

const propState = (phase) =>
  Object.freeze({
    clay: Object.freeze({
      visible: phase === "clay",
      anchorId: "courtyard.clay-action",
      state:
        phase === "clay"
          ? "applied"
          : phase === "courtyard"
            ? "available"
            : "cleared",
      collisionEnabled: false,
      contentLevel: "S1",
      stagingLevel: "S2",
    }),
  });

const snapshotForBeat = (beatId) => {
  const order = Number(beatId.slice(1));
  const phase = PHASE_BY_BEAT[beatId];
  const isComplete = beatId === "b20";
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
      movementEnabled: !isComplete,
      interactionEnabled: !isComplete,
      dialogueEnabled: false,
      locked: isComplete,
      sourceLevel: "S2",
    }),
    triggers: Object.freeze({
      completedBeatIds: Object.freeze(
        Array.from({ length: order }, (_, index) =>
          `b${String(index + 1).padStart(2, "0")}`),
      ),
      nextBeatId: isComplete ? null : `b${String(order + 1).padStart(2, "0")}`,
      sourceLevel: "S2",
    }),
    music: Object.freeze({
      cueId: isComplete ? "music-john9-closing" : "music-john9-map",
      playing: true,
      ducked: false,
      sourceLevel: "S2",
    }),
  });
};

export const FINAL_SNAPSHOTS = Object.freeze(
  Object.fromEntries(
    Array.from({ length: 20 }, (_, index) => {
      const beatId = `b${String(index + 1).padStart(2, "0")}`;
      return [beatId, snapshotForBeat(beatId)];
    }),
  ),
);

export const STORY_COMPLETION = Object.freeze({
  id: "john9-story-complete",
  requiredBeatIds: Object.freeze(
    Array.from({ length: 20 }, (_, index) =>
      `b${String(index + 1).padStart(2, "0")}`),
  ),
  finalBeatId: "b20",
  finalSnapshotId: FINAL_SNAPSHOTS.b20.id,
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
