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
} from "@sonic74129/map-runtime";

import layout from "../world/layout.json";
import navigation from "../world/navigation.json";
import spawns from "../world/spawns.json";

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
  readonly actors: readonly MapActor<GrayboxActorState>[];
  readonly areas: readonly MapArea<GrayboxAreaMetadata>[];
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
    layout.worldId !== spawns.worldId
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

  return {
    definition,
    navigation: new NavigationGrid({
      width: definition.width,
      height: definition.height,
      cellSize: definition.tileSize,
    }),
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
  };
}
