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
] as const);

export type ManBornBlindPose = (typeof MAN_BORN_BLIND_POSES)[number];

export interface ManBornBlindPathTransition {
  readonly standPose: "standing";
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
