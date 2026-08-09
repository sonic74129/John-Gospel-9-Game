import { STORY_ART, type RuntimeArtAsset } from "./art-asset-adapter.ts";
import type { SliceDialogueLine } from "./sequence-adapter.ts";

export interface DialoguePortrait {
  readonly art: RuntimeArtAsset;
  readonly alt: string;
  readonly provenance: "derived-selected-source-art";
  readonly framing: Readonly<{
    focusY: number;
    scale: number;
    mobileFocusY: number;
    mobileScale: number;
  }>;
}

const DEFAULT_FRAMING = Object.freeze({
  focusY: 42,
  scale: 0.94,
  mobileFocusY: 40,
  mobileScale: 0.92,
});

const portrait = (
  art: RuntimeArtAsset,
  alt: string,
  framing: Partial<DialoguePortrait["framing"]> = {},
): Readonly<DialoguePortrait> =>
  Object.freeze({
    art,
    alt,
    provenance: "derived-selected-source-art",
    framing: Object.freeze({
      focusY: framing.focusY ?? DEFAULT_FRAMING.focusY,
      scale: framing.scale ?? DEFAULT_FRAMING.scale,
      mobileFocusY: framing.mobileFocusY ?? DEFAULT_FRAMING.mobileFocusY,
      mobileScale: framing.mobileScale ?? DEFAULT_FRAMING.mobileScale,
    }),
  });

export function dialoguePortraitFor(
  line: SliceDialogueLine,
): Readonly<DialoguePortrait> | null {
  switch (line.portraitSubjectId) {
    case "jesus":
      return portrait(STORY_ART.portraits.jesus, "耶穌", {
        focusY: 36,
        scale: 0.9,
        mobileFocusY: 34,
        mobileScale: 0.88,
      });
    case "disciples":
      return portrait(STORY_ART.portraits.disciples, "門徒", {
        focusY: 49,
        mobileFocusY: 47,
      });
    case "man-born-blind":
      if (line.portraitState === "blind") {
        return portrait(STORY_ART.portraits.manBlind, "那人（尚未看見）", {
          focusY: 34,
          scale: 0.92,
          mobileFocusY: 32,
          mobileScale: 0.9,
        });
      }
      if (line.portraitState === "seeing") {
        return portrait(STORY_ART.portraits.manSeeing, "那人（已能看見）", {
          focusY: 36,
          scale: 0.92,
          mobileFocusY: 34,
          mobileScale: 0.9,
        });
      }
      return null;
    case "neighbors":
      return portrait(STORY_ART.portraits.neighbors, "鄰舍與見過他的人", {
        focusY: 40,
        mobileFocusY: 38,
      });
    case "parents":
      return portrait(STORY_ART.portraits.parents, "他的父母", {
        focusY: 38,
        mobileFocusY: 36,
      });
    case "pharisees":
    case "judean-authorities":
      return portrait(STORY_ART.portraits.authorities, "查問的人", {
        focusY: 41,
        mobileFocusY: 39,
      });
    default:
      return null;
  }
}
