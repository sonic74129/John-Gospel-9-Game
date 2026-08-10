export const PLAYER_ROLE = Object.freeze({
  actorId: "observer",
  type: "observer",
  named: false,
  acknowledgedByScriptureCharacters: false,
  hasDialogue: false,
  mayControlJesus: false,
  mayCauseMiracle: false,
  mayAnswerForCharacters: false,
  mayChangeScriptureOutcome: false,
  supportedActions: Object.freeze(["move", "observe", "listen", "interact"]),
});

export const CARDINAL_DIRECTIONS = Object.freeze([
  "up",
  "down",
  "left",
  "right",
] as const);

export type CardinalDirection = (typeof CARDINAL_DIRECTIONS)[number];

export const DIRECTIONAL_IDLE_REQUIREMENTS = Object.freeze({
  observer: CARDINAL_DIRECTIONS,
  jesus: CARDINAL_DIRECTIONS,
  disciples: CARDINAL_DIRECTIONS,
  "man-born-blind": CARDINAL_DIRECTIONS,
  neighbors: CARDINAL_DIRECTIONS,
  pharisees: CARDINAL_DIRECTIONS,
  parents: CARDINAL_DIRECTIONS,
  "judean-authorities": CARDINAL_DIRECTIONS,
});

export const DIRECTIONAL_WALK_REQUIREMENTS = Object.freeze({
  observer: CARDINAL_DIRECTIONS,
  "man-born-blind": CARDINAL_DIRECTIONS,
});

export const MAN_BORN_BLIND_POSES = Object.freeze([
  "seated",
  "clay-on-eyes",
  "standing",
  "walking",
  "washing",
  "standing-seeing",
  "washed-seeing",
  "worship",
] as const);

export type ManBornBlindPose = (typeof MAN_BORN_BLIND_POSES)[number];

export interface ManBornBlindPathTransition {
  readonly standPose: "standing" | "standing-seeing";
  readonly walkingPose: "walking";
  readonly finalPose: "washing" | "standing-seeing";
}

export function manBornBlindPathTransition(
  pathId: string,
  currentPose: string,
): ManBornBlindPathTransition {
  if (pathId === "man-to-pool") {
    if (currentPose !== "clay-on-eyes" && currentPose !== "standing") {
      throw new RangeError(
        `The man must receive clay and stand before walking to the pool; received ${currentPose}.`,
      );
    }
    return {
      standPose: "standing",
      walkingPose: "walking",
      finalPose: "washing",
    };
  }

  if (
    pathId === "pool-to-neighbors" ||
    pathId === "group-to-inquiry" ||
    pathId === "expulsion"
  ) {
    if (currentPose !== "washed-seeing" && currentPose !== "standing-seeing") {
      throw new RangeError(
        `The healed man must be seeing before walking ${pathId}; received ${currentPose}.`,
      );
    }
    return {
      standPose: "standing-seeing",
      walkingPose: "walking",
      finalPose: "standing-seeing",
    };
  }

  throw new RangeError(`Unsupported story path ${pathId}.`);
}

export const ACTORS = Object.freeze([
  {
    id: "observer",
    label: "觀察者",
    kind: "player-observer",
    initialAnchorId: "courtyard.player-start",
    sourceLevel: "S2",
    stagingLevel: "S2",
    scriptureCharacter: false,
    hasDialogue: false,
  },
  {
    id: "jesus",
    label: "耶穌",
    kind: "scripture-character",
    initialAnchorId: "courtyard.jesus",
    sourceLevel: "S1",
    stagingLevel: "S2",
    scriptureCharacter: true,
    hasDialogue: true,
  },
  {
    id: "disciples",
    label: "門徒",
    kind: "scripture-group",
    initialAnchorId: "courtyard.disciples",
    sourceLevel: "S1",
    stagingLevel: "S2",
    scriptureCharacter: true,
    hasDialogue: true,
  },
  {
    id: "man-born-blind",
    label: "那人",
    kind: "scripture-character",
    initialAnchorId: "courtyard.man-center",
    sourceLevel: "S1",
    stagingLevel: "S2",
    scriptureCharacter: true,
    hasDialogue: true,
  },
  {
    id: "neighbors",
    label: "鄰舍與見過他的人",
    kind: "scripture-group",
    initialAnchorId: "pool.neighbors",
    sourceLevel: "S1",
    stagingLevel: "S2",
    scriptureCharacter: true,
    hasDialogue: true,
  },
  {
    id: "pharisees",
    label: "法利賽人",
    kind: "scripture-group",
    initialAnchorId: "courtyard.pharisees-left",
    sourceLevel: "S1",
    stagingLevel: "S2",
    scriptureCharacter: true,
    hasDialogue: true,
  },
  {
    id: "parents",
    label: "他的父母",
    kind: "scripture-group",
    initialAnchorId: "courtyard.waiting",
    sourceLevel: "S1",
    stagingLevel: "S2",
    scriptureCharacter: true,
    hasDialogue: true,
  },
  {
    id: "judean-authorities",
    label: "猶太人",
    kind: "scripture-group",
    initialAnchorId: "courtyard.pharisees-right",
    sourceLevel: "S1",
    stagingLevel: "S2",
    scriptureCharacter: true,
    hasDialogue: true,
  },
]);

export const PROPS = Object.freeze([
  {
    id: "clay",
    label: "泥",
    initialAnchorId: "courtyard.clay-action",
    sourceLevel: "S1",
    stagingLevel: "S2",
  },
]);

export const ACTOR_IDS = Object.freeze(ACTORS.map(({ id }) => id));
