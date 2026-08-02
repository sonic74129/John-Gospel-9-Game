import {
  assertValid,
  validateActorDefinition,
  validateWorldDefinition,
  type ActorDefinition,
  type AreaDefinition,
  type WorldDefinition,
} from "@sonic74129/content-schema";
import {
  MapActor,
  MapArea,
  NavigationGrid,
  type GridCell,
  type Point,
} from "@sonic74129/map-runtime";

import collisions from "../world/collisions.json";
import layout from "../world/layout.json";
import navigation from "../world/navigation.json";
import spawns from "../world/spawns.json";
import {
  buildBlockedCells,
  findWalkablePath,
  isWalkablePoint,
  isWalkableSegment as segmentIsWalkable,
} from "./navigation-geometry.js";

export interface GrayboxActorState {
  readonly role: "player" | "actor";
  readonly visible: boolean;
}

export interface GrayboxAreaMetadata {
  readonly sourceLevel: string;
}

export interface WorldRuntime {
  readonly definition: WorldDefinition;
  readonly navigation: NavigationGrid;
  readonly blockedCells: readonly GridCell[];
  readonly agentRadius: number;
  readonly actors: readonly MapActor<GrayboxActorState>[];
  readonly areas: readonly MapArea<GrayboxAreaMetadata>[];
  isWalkable(point: Point): boolean;
  isWalkableSegment(start: Point, end: Point): boolean;
  findPath(start: Point, target: Point): readonly Point[];
}

function createActorDefinitions(): readonly ActorDefinition[] {
  return spawns.actorSpawns.map((spawn) => {
    const actor: ActorDefinition = {
      id: spawn.actorId,
      label: spawn.actorId,
      position: spawn.position,
      metadata: {
        anchorId: spawn.anchorId,
        regionId: spawn.regionId,
        sourceLevel: spawn.sourceLevel,
      },
    };
    assertValid<ActorDefinition>(actor, validateActorDefinition);
    return actor;
  });
}

function createAreaDefinitions(): readonly AreaDefinition[] {
  return layout.regions.map(({ id, bounds }) => ({
    id,
    ...bounds,
  }));
}

export function createWorldRuntime(): WorldRuntime {
  if (
    layout.worldId !== navigation.worldId ||
    layout.worldId !== spawns.worldId ||
    layout.worldId !== collisions.worldId
  ) {
    throw new Error("World contract IDs do not match.");
  }

  const actorDefinitions = createActorDefinitions();
  const areaDefinitions = createAreaDefinitions();
  const definition: WorldDefinition = {
    id: layout.worldId,
    width: layout.worldBounds.width,
    height: layout.worldBounds.height,
    tileSize: navigation.grid.cellSize,
    actors: actorDefinitions,
    areas: areaDefinitions,
  };
  assertValid<WorldDefinition>(definition, validateWorldDefinition);

  const agentRadius = navigation.agent.radius;
  const walkablePolygons = layout.regions.map(
    ({ walkablePolygon }) => walkablePolygon,
  );
  const collisionPolygons = collisions.collisionPolygons.map(
    ({ polygon }) => polygon,
  );
  const isWalkable = (point: Point): boolean =>
    isWalkablePoint(
      point,
      agentRadius,
      layout.worldBounds,
      walkablePolygons,
      collisionPolygons,
    );
  const blockedCells = buildBlockedCells({
    width: definition.width,
    height: definition.height,
    cellSize: definition.tileSize,
    radius: agentRadius,
    bounds: layout.worldBounds,
    walkablePolygons,
    collisionPolygons,
  });
  const navigationRuntime = new NavigationGrid({
    width: definition.width,
    height: definition.height,
    cellSize: definition.tileSize,
    blocked: blockedCells,
  });

  return {
    definition,
    navigation: navigationRuntime,
    blockedCells,
    agentRadius,
    actors: actorDefinitions.map(
      (actor) =>
        new MapActor(actor, {
          role: actor.id === "player-observer" ? "player" : "actor",
          visible:
            spawns.actorSpawns.find(({ actorId }) => actorId === actor.id)
              ?.initiallyVisible ?? false,
        }),
    ),
    areas: layout.regions.map(
      (region, index) =>
        new MapArea(areaDefinitions[index]!, {
          sourceLevel: region.sourceLevel,
        }),
    ),
    isWalkable,
    isWalkableSegment: (start, end) =>
      segmentIsWalkable(start, end, agentRadius, isWalkable),
    findPath: (start, target) =>
      findWalkablePath(navigationRuntime, start, target, isWalkable),
  };
}
