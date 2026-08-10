import { STORY_ART, type RuntimeArtAsset } from "./art-asset-adapter.ts";
import type { SliceDialogueLine } from "./sequence-adapter.ts";

export interface DialoguePortrait {
  readonly art: RuntimeArtAsset;
  readonly alt: string;
  readonly provenance: "derived-selected-source-art";
  readonly framing: Readonly<{
    focusY: number;
    scale: number;
    offsetY: number;
    mobileFocusY: number;
    mobileScale: number;
    mobileOffsetY: number;
  }>;
}

const DEFAULT_FRAMING = Object.freeze({
  focusY: 50,
  scale: 0.94,
  offsetY: -8,
  mobileFocusY: 50,
  mobileScale: 0.92,
  mobileOffsetY: -6,
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
      offsetY: framing.offsetY ?? DEFAULT_FRAMING.offsetY,
      mobileFocusY: framing.mobileFocusY ?? DEFAULT_FRAMING.mobileFocusY,
      mobileScale: framing.mobileScale ?? DEFAULT_FRAMING.mobileScale,
      mobileOffsetY: framing.mobileOffsetY ?? DEFAULT_FRAMING.mobileOffsetY,
    }),
  });

export function dialoguePortraitFor(
  line: SliceDialogueLine,
): Readonly<DialoguePortrait> | null {
  switch (line.portraitSubjectId) {
    case "jesus":
      return portrait(STORY_ART.portraits.jesus, "耶穌", {
        focusY: 50,
        scale: 0.9,
        offsetY: -12,
        mobileFocusY: 50,
        mobileScale: 0.88,
        mobileOffsetY: -10,
      });
    case "disciples":
      return portrait(STORY_ART.portraits.disciples, "門徒", {
        focusY: 50,
        scale: 0.93,
        offsetY: -10,
        mobileFocusY: 50,
        mobileScale: 0.91,
        mobileOffsetY: -8,
      });
    case "man-born-blind":
      if (line.portraitState === "blind") {
        return portrait(STORY_ART.portraits.manBlind, "那人（尚未看見）", {
          focusY: 50,
          scale: 0.92,
          offsetY: -22,
          mobileFocusY: 50,
          mobileScale: 0.9,
          mobileOffsetY: -18,
        });
      }
      if (line.portraitState === "washing") {
        return portrait(STORY_ART.portraits.manBlind, "那人（正在池邊洗）", {
          focusY: 52,
          scale: 0.92,
          offsetY: -19,
          mobileFocusY: 52,
          mobileScale: 0.9,
          mobileOffsetY: -16,
        });
      }
      if (line.portraitState === "seeing") {
        return portrait(STORY_ART.portraits.manSeeing, "那人（已能看見）", {
          focusY: 50,
          scale: 0.92,
          offsetY: -16,
          mobileFocusY: 50,
          mobileScale: 0.9,
          mobileOffsetY: -14,
        });
      }
      return null;
    case "neighbors":
      return portrait(STORY_ART.portraits.neighbors, "鄰舍與見過他的人", {
        focusY: 50,
        offsetY: -10,
        mobileFocusY: 50,
        mobileOffsetY: -8,
      });
    case "parents":
      return portrait(STORY_ART.portraits.parents, "他的父母", {
        focusY: 50,
        offsetY: -12,
        mobileFocusY: 50,
        mobileOffsetY: -10,
      });
    case "pharisees":
    case "judean-authorities":
      return portrait(STORY_ART.portraits.authorities, "查問的人", {
        focusY: 50,
        offsetY: -9,
        mobileFocusY: 50,
        mobileOffsetY: -7,
      });
    default:
      return null;
  }
}
