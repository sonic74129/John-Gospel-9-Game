import type { Point, StoryTrigger } from "@sonic74129/content-schema";

import type { SliceStoryEvent } from "./story-adapter.ts";

export const STORY_DISTANCE_UNIT_PIXELS = 96;
export const ARRIVAL_RADIUS_PIXELS = 72;

export interface PlayerTraversal {
  readonly previousPosition: Point;
  readonly currentPosition: Point;
}

export interface WorldNavigationObjective {
  readonly kind: "arrival" | "proximity" | "interaction";
  readonly targetId: string;
  readonly label: string;
  readonly position: Point;
}

export interface WorldNavigationResolver {
  anchorPosition(anchorId: string): Point;
  storyActorPosition(storyActorId: string): Point;
  storyActorLabel(storyActorId: string): string;
}

export function segmentIntersectsArrivalRadius(
  start: Point,
  end: Point,
  anchor: Point,
  radius = ARRIVAL_RADIUS_PIXELS,
): boolean {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentLengthSquared = segmentX ** 2 + segmentY ** 2;
  const projection =
    segmentLengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((anchor.x - start.x) * segmentX +
              (anchor.y - start.y) * segmentY) /
              segmentLengthSquared,
          ),
        );
  const closestX = start.x + segmentX * projection;
  const closestY = start.y + segmentY * projection;
  return Math.hypot(anchor.x - closestX, anchor.y - closestY) <= radius;
}

export function worldNavigationEvent(
  trigger: StoryTrigger | undefined,
  traversal: PlayerTraversal,
  resolver: Pick<
    WorldNavigationResolver,
    "anchorPosition" | "storyActorPosition"
  >,
): SliceStoryEvent | null {
  if (trigger?.type === "proximity") {
    const actor =
      trigger.actorId === "observer"
        ? traversal.currentPosition
        : resolver.storyActorPosition(trigger.actorId);
    const target = resolver.storyActorPosition(trigger.targetId);
    return {
      type: "proximity",
      actorId: trigger.actorId,
      targetId: trigger.targetId,
      distance:
        Math.hypot(actor.x - target.x, actor.y - target.y) /
        STORY_DISTANCE_UNIT_PIXELS,
    };
  }
  if (
    trigger?.type === "event" &&
    trigger.event.startsWith("arrival:")
  ) {
    const anchorId = trigger.event.slice("arrival:".length);
    if (
      segmentIntersectsArrivalRadius(
        traversal.previousPosition,
        traversal.currentPosition,
        resolver.anchorPosition(anchorId),
      )
    ) {
      return { type: "event", name: trigger.event };
    }
  }
  return null;
}

export function resolveWorldNavigationObjective(
  trigger: StoryTrigger | undefined,
  resolver: WorldNavigationResolver,
): WorldNavigationObjective | null {
  if (trigger?.type === "proximity") {
    return {
      kind: "proximity",
      targetId: trigger.targetId,
      label: resolver.storyActorLabel(trigger.targetId),
      position: resolver.storyActorPosition(trigger.targetId),
    };
  }
  if (trigger?.type !== "event") {
    return null;
  }
  if (trigger.event.startsWith("arrival:")) {
    const anchorId = trigger.event.slice("arrival:".length);
    return {
      kind: "arrival",
      targetId: anchorId,
      label: "目標地點",
      position: resolver.anchorPosition(anchorId),
    };
  }
  if (trigger.event.startsWith("interact:")) {
    const actorId = trigger.event.slice("interact:".length);
    return {
      kind: "interaction",
      targetId: actorId,
      label: resolver.storyActorLabel(actorId),
      position: resolver.storyActorPosition(actorId),
    };
  }
  return null;
}

export function describeWorldNavigationObjective(
  objective: WorldNavigationObjective,
  playerPosition: Point,
): string {
  const deltaX = objective.position.x - playerPosition.x;
  const deltaY = objective.position.y - playerPosition.y;
  const direction = describeDirection(deltaX, deltaY);
  const routeDistance = Math.max(
    1,
    Math.ceil(Math.hypot(deltaX, deltaY) / STORY_DISTANCE_UNIT_PIXELS),
  );
  const location = `${direction} · 距離約 ${routeDistance} 段路`;

  if (objective.kind === "arrival") {
    return `前往${objective.label} · ${location} · 點按標記移動`;
  }
  if (objective.kind === "proximity") {
    return `接近${objective.label} · ${location} · 點按標記移動，接近後自動繼續`;
  }
  return `與${objective.label}互動 · ${location} · 點按標記移動，靠近後按 Space 或點按人物`;
}

function describeDirection(deltaX: number, deltaY: number): string {
  const horizontal =
    Math.abs(deltaX) < STORY_DISTANCE_UNIT_PIXELS / 2
      ? ""
      : deltaX > 0
        ? "東"
        : "西";
  const vertical =
    Math.abs(deltaY) < STORY_DISTANCE_UNIT_PIXELS / 2
      ? ""
      : deltaY > 0
        ? "南"
        : "北";
  return `${vertical}${horizontal}` || "附近";
}
