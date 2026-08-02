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
  supportedActions: Object.freeze(["move", "observe", "listen", "interact", "recall"]),
});

export const ACTORS = Object.freeze([
  {
    id: "observer",
    label: "觀察者",
    kind: "player-observer",
    initialAnchorId: "anchor-temple-road-observer",
    sourceLevel: "S2",
    scriptureCharacter: false,
    hasDialogue: false,
  },
  {
    id: "jesus",
    label: "耶穌",
    kind: "scripture-character",
    initialAnchorId: "anchor-temple-road-jesus",
    sourceLevel: "S1",
    scriptureCharacter: true,
    hasDialogue: true,
  },
  {
    id: "disciples",
    label: "門徒",
    kind: "scripture-group",
    initialAnchorId: "anchor-temple-road-disciples",
    sourceLevel: "S1",
    scriptureCharacter: true,
    hasDialogue: true,
  },
  {
    id: "man-born-blind",
    label: "那人",
    kind: "scripture-character",
    initialAnchorId: "anchor-temple-road-man",
    sourceLevel: "S1",
    scriptureCharacter: true,
    hasDialogue: true,
  },
  {
    id: "neighbors",
    label: "鄰舍與見過他的人",
    kind: "scripture-group",
    initialAnchorId: "anchor-neighborhood-gathering",
    sourceLevel: "S1",
    scriptureCharacter: true,
    hasDialogue: true,
  },
  {
    id: "pharisees",
    label: "法利賽人",
    kind: "scripture-group",
    initialAnchorId: "anchor-pharisee-hearing",
    sourceLevel: "S1",
    scriptureCharacter: true,
    hasDialogue: true,
  },
  {
    id: "parents",
    label: "他的父母",
    kind: "scripture-group",
    initialAnchorId: "anchor-parents-waiting",
    sourceLevel: "S1",
    scriptureCharacter: true,
    hasDialogue: true,
  },
  {
    id: "judean-authorities",
    label: "猶太人",
    kind: "scripture-group",
    initialAnchorId: "anchor-pharisee-hearing",
    sourceLevel: "S1",
    scriptureCharacter: true,
    hasDialogue: true,
  },
]);

export const PROPS = Object.freeze([
  {
    id: "clay",
    label: "泥",
    initialAnchorId: "anchor-temple-road-ground",
    sourceLevel: "S1",
  },
]);

export const ACTOR_IDS = Object.freeze(ACTORS.map(({ id }) => id));
