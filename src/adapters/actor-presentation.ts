export interface ActorPresentationInput {
  readonly actorId: string;
  readonly storyActorId: string;
  readonly pose: string;
  readonly artKey: string;
  readonly frameHeight: number;
}

export interface ActorPresentation {
  readonly displayHeight: number;
  readonly labelOffset: number;
  readonly scale: number;
}

export function actorPresentationFor({
  actorId,
  storyActorId,
  pose,
  artKey,
  frameHeight,
}: ActorPresentationInput): ActorPresentation {
  if (!Number.isFinite(frameHeight) || frameHeight <= 0) {
    throw new RangeError("Actor frame height must be positive.");
  }

  const displayHeight =
    storyActorId === "jesus"
      ? 132
      : storyActorId === "man-born-blind"
        ? 160
        : frameHeight;

  let labelOffset = Math.max(74, displayHeight * 0.76);
  if (storyActorId === "jesus") {
    labelOffset = artKey.includes("clay-action") ? 71 : 114;
  } else if (storyActorId === "man-born-blind") {
    labelOffset =
      pose === "clay-on-eyes"
        ? 86
        : artKey.includes("man-seeing")
          ? 107
          : 85;
  } else if (storyActorId === "observer") {
    labelOffset = 85;
  } else if (actorId === "disciple-left") {
    labelOffset = 115;
  } else if (actorId === "disciple-right") {
    labelOffset = 116;
  }

  return Object.freeze({
    displayHeight,
    labelOffset,
    scale: displayHeight / frameHeight,
  });
}
