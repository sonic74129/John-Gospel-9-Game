import type { CardinalDirection } from "../story/actors.ts";

export const WALK_FRAME_DURATION_MS = 160;

export type ActorMotion = "idle" | "walk";
export type WalkStep = 0 | 1;

export function focusDirection(
  actorX: number,
  focusX: number,
): "left" | "right" {
  return actorX < focusX ? "right" : "left";
}

export function directionFromDelta(
  deltaX: number,
  deltaY: number,
  fallback: CardinalDirection,
): CardinalDirection {
  if (deltaX === 0 && deltaY === 0) {
    return fallback;
  }
  if (Math.abs(deltaY) > Math.abs(deltaX)) {
    return deltaY < 0 ? "up" : "down";
  }
  return deltaX < 0 ? "left" : "right";
}

export function walkStepAt(
  elapsedMs: number,
  frameDurationMs = WALK_FRAME_DURATION_MS,
): WalkStep {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new RangeError("Walk elapsed time must be a finite non-negative value.");
  }
  if (!Number.isFinite(frameDurationMs) || frameDurationMs <= 0) {
    throw new RangeError("Walk frame duration must be a finite positive value.");
  }
  return Math.floor(elapsedMs / frameDurationMs) % 2 === 0 ? 0 : 1;
}

export function directionalFrameName(
  actorId: string,
  direction: CardinalDirection,
  motion: ActorMotion,
  walkStep: WalkStep = 0,
): string {
  return motion === "idle"
    ? `${actorId}-${direction}-idle`
    : `${actorId}-${direction}-walk-${walkStep + 1}`;
}
