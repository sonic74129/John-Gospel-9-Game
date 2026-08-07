import type { CardinalDirection } from "../story/actors.ts";

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
