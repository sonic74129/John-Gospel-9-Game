const ACTOR_DEFAULTS = Object.freeze({
  observer: ["courtyard.observer", "idle", "觀察者", true, true],
  jesus: ["courtyard.jesus", "idle", "耶穌", true, true],
  disciples: ["courtyard.disciples", "idle", "門徒", true, true],
  "man-born-blind": ["courtyard.man-center", "seated", "那人", true, true],
});

const PHASE_BY_BEAT = Object.freeze({
  b01: "courtyard",
  b02: "courtyard",
  b03: "courtyard",
  b04: "clay",
  b05: "pool-awaiting",
  b06: "washed",
});

const CAMERA_ANCHOR_BY_PHASE = Object.freeze({
  courtyard: "courtyard.camera",
  clay: "courtyard.camera",
  "pool-awaiting": "pool.camera",
  washed: "pool.camera",
});

const phaseOverrides = (phase) => {
  switch (phase) {
    case "clay":
      return {
        "man-born-blind": ["courtyard.man-center", "clay-on-eyes", "那人", true, true],
      };
    case "pool-awaiting":
      return {
        observer: ["pool.observer-approach", "idle", "觀察者", true, true],
        jesus: ["courtyard.pool-approach", "departed", "耶穌", false, false],
        disciples: ["courtyard.pool-approach", "departed", "門徒", false, false],
        "man-born-blind": ["pool.wash-edge", "standing", "那人", true, false],
      };
    case "washed":
      return {
        observer: ["pool.observer-approach", "idle", "觀察者", true, true],
        jesus: ["courtyard.pool-approach", "departed", "耶穌", false, false],
        disciples: ["courtyard.pool-approach", "departed", "門徒", false, false],
        "man-born-blind": ["pool.wash-edge", "washed-seeing", "那人", true, false],
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
  const isComplete = beatId === "b06";
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
        Array.from({ length: order }, (_, index) => `b${String(index + 1).padStart(2, "0")}`),
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
    Array.from({ length: 6 }, (_, index) => {
      const beatId = `b${String(index + 1).padStart(2, "0")}`;
      return [beatId, snapshotForBeat(beatId)];
    }),
  ),
);

export const STORY_COMPLETION = Object.freeze({
  id: "john9-story-complete",
  requiredBeatIds: Object.freeze(
    Array.from({ length: 6 }, (_, index) => `b${String(index + 1).padStart(2, "0")}`),
  ),
  finalBeatId: "b06",
  finalSnapshotId: FINAL_SNAPSHOTS.b06.id,
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
