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

import anchors from "../world/anchors.json";
import camera from "../world/camera.json";
import collisions from "../world/collisions.json";
import layout from "../world/layout.json";
import navigation from "../world/navigation.json";
import paths from "../world/paths.json";
import spawns from "../world/spawns.json";
import {
  buildBlockedCells,
  findWalkablePath,
  isWalkablePoint,
  isWalkableSegment as segmentIsWalkable,
} from "./navigation-geometry.js";
import { STORY_ACTOR_SPAWN_IDS } from "./story-actor-mapping.ts";
import { ACTORS } from "./story-contracts.ts";

export interface GrayboxActorState {
  readonly role: "player" | "actor";
  readonly storyActorId: string;
  visible: boolean;
  pose: string;
  label: string;
  collisionEnabled: boolean;
  anchorId: string;
  readonly collisionRadius: number;
  readonly anchorOffset: Point;
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
  readonly regionContracts: typeof layout.regions;
  readonly portals: typeof layout.portals;
  readonly collisionPolygons: typeof collisions.collisionPolygons;
  readonly anchorById: ReadonlyMap<string, (typeof anchors.anchors)[number]>;
  readonly cameraZoneByRegionId: ReadonlyMap<
    string,
    (typeof camera.cameraZones)[number]
  >;
  readonly pathById: ReadonlyMap<
    string,
    (typeof paths.sequencePaths)[number]
  >;
  readonly storyActorSpawnIds: Readonly<
    Record<string, readonly string[]>
  >;
  isWalkable(point: Point): boolean;
  isWalkableSegment(start: Point, end: Point): boolean;
  findPath(start: Point, target: Point): readonly Point[];
}

const STORY_ACTOR_BY_ID = new Map(ACTORS.map((actor) => [actor.id, actor]));
const STORY_ACTOR_ID_BY_SPAWN_ID = new Map(
  Object.entries(STORY_ACTOR_SPAWN_IDS).flatMap(([storyActorId, spawnIds]) =>
    spawnIds.map((spawnId) => [spawnId, storyActorId] as const),
  ),
);

function getAnchor(anchorId: string): (typeof anchors.anchors)[number] {
  const anchor = anchors.anchors.find(({ id }) => id === anchorId);
  if (anchor === undefined) {
    throw new Error(`World spawn references unknown anchor ${anchorId}.`);
  }
  return anchor;
}

function createActorDefinitions(): readonly ActorDefinition[] {
  return spawns.actorSpawns.map((spawn) => {
    const storyActorId = STORY_ACTOR_ID_BY_SPAWN_ID.get(spawn.actorId);
    const storyActor =
      storyActorId === undefined
        ? undefined
        : STORY_ACTOR_BY_ID.get(storyActorId);
    if (storyActor === undefined) {
      throw new Error(
        `World actor ${spawn.actorId} has no canonical story actor mapping.`,
      );
    }
    const actor: ActorDefinition = {
      id: spawn.actorId,
      label: storyActor.label,
      position: spawn.position,
      metadata: {
        storyActorId,
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
  const anchorById = new Map(anchors.anchors.map((anchor) => [anchor.id, anchor]));
  const pathById = new Map(
    paths.sequencePaths.map((path) => [path.id, path]),
  );
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
    actors: actorDefinitions.map((actor) => {
      const spawn = spawns.actorSpawns.find(
        ({ actorId }) => actorId === actor.id,
      );
      if (spawn === undefined) {
        throw new Error(`Actor definition ${actor.id} has no world spawn.`);
      }
      const storyActorId = STORY_ACTOR_ID_BY_SPAWN_ID.get(actor.id);
      if (storyActorId === undefined) {
        throw new Error(`Actor ${actor.id} has no story mapping.`);
      }
      const anchor = getAnchor(spawn.anchorId);
      return new MapActor(actor, {
        role: actor.id === "player-observer" ? "player" : "actor",
        storyActorId,
        visible: spawn.initiallyVisible,
        pose: "idle",
        label: actor.label,
        collisionEnabled: spawn.initiallyVisible,
        anchorId: spawn.anchorId,
        collisionRadius: spawn.collisionRadius,
        anchorOffset: {
          x: spawn.position.x - anchor.position.x,
          y: spawn.position.y - anchor.position.y,
        },
      });
    }),
    areas: layout.regions.map(
      (region, index) =>
        new MapArea(areaDefinitions[index]!, {
          sourceLevel: region.sourceLevel,
        }),
    ),
    regionContracts: layout.regions,
    portals: layout.portals,
    collisionPolygons: collisions.collisionPolygons,
    anchorById,
    cameraZoneByRegionId: new Map(
      camera.cameraZones.map((zone) => [zone.regionId, zone]),
    ),
    pathById,
    storyActorSpawnIds: STORY_ACTOR_SPAWN_IDS,
    isWalkable,
    isWalkableSegment: (start, end) =>
      segmentIsWalkable(start, end, agentRadius, isWalkable),
    findPath: (start, target) =>
      findWalkablePath(navigationRuntime, start, target, isWalkable),
  };
}
