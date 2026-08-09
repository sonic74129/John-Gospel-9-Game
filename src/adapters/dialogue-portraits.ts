import { STORY_ART, type RuntimeArtAsset } from "./art-asset-adapter.ts";
import type { SliceDialogueLine } from "./sequence-adapter.ts";

export interface DialoguePortrait {
  readonly art: RuntimeArtAsset;
  readonly alt: string;
  readonly provenance: "derived-selected-source-art";
}

const portrait = (
  art: RuntimeArtAsset,
  alt: string,
): Readonly<DialoguePortrait> =>
  Object.freeze({
    art,
    alt,
    provenance: "derived-selected-source-art",
  });

export function dialoguePortraitFor(
  line: SliceDialogueLine,
): Readonly<DialoguePortrait> | null {
  switch (line.portraitSubjectId) {
    case "jesus":
      return portrait(STORY_ART.portraits.jesus, "耶穌");
    case "disciples":
      return portrait(STORY_ART.portraits.disciples, "門徒");
    case "man-born-blind":
      if (line.portraitState === "blind") {
        return portrait(STORY_ART.portraits.manBlind, "那人（尚未看見）");
      }
      if (line.portraitState === "seeing") {
        return portrait(STORY_ART.portraits.manSeeing, "那人（已能看見）");
      }
      return null;
    case "neighbors":
      return portrait(STORY_ART.portraits.neighbors, "鄰舍與見過他的人");
    case "parents":
      return portrait(STORY_ART.portraits.parents, "他的父母");
    case "pharisees":
    case "judean-authorities":
      return portrait(STORY_ART.portraits.authorities, "查問的人");
    default:
      return null;
  }
}
