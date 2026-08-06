import { STORY_ART } from "./art-asset-adapter.ts";

export interface DialoguePortrait {
  readonly path: string;
  readonly alt: string;
  readonly provenance: "derived-selected-source-art";
}

export function dialoguePortraitFor(
  speakerId: string,
  beatId: string,
): DialoguePortrait {
  const art =
    speakerId === "jesus"
      ? STORY_ART.portraits.jesus
      : speakerId === "man-born-blind"
        ? beatId === "b06"
          ? STORY_ART.portraits.manSeeing
          : STORY_ART.portraits.manSeeing
        : speakerId === "disciples"
          ? STORY_ART.portraits.disciples
          : speakerId === "neighbors"
            ? STORY_ART.portraits.neighbors
            : speakerId === "parents"
              ? STORY_ART.portraits.parents
              : STORY_ART.portraits.authorities;
  const alt =
    speakerId === "man-born-blind"
      ? "那人（已能看見）"
      : ({
          jesus: "耶穌",
          disciples: "門徒",
          neighbors: "鄰舍與見過他的人",
          parents: "他的父母",
          pharisees: "法利賽人",
          "judean-authorities": "猶太人",
        })[speakerId] ?? "故事人物";
  return Object.freeze({
    path: art.path,
    alt,
    provenance: "derived-selected-source-art",
  });
}
