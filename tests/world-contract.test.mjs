import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  isWalkablePoint,
  isWalkableSegment
} from "../src/adapters/navigation-geometry.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const worldDirectory = path.join(repoRoot, "src", "world");
const expectedFiles = [
  "anchors.json",
  "camera.json",
  "collisions.json",
  "framing.json",
  "layout.json",
  "navigation.json",
  "occlusion.json",
  "paths.json",
  "props.json",
  "spawns.json"
];
const fileNames = (await readdir(worldDirectory))
  .filter((fileName) => fileName.endsWith(".json"))
  .sort();
const contracts = Object.fromEntries(
  await Promise.all(
    fileNames.map(async (fileName) => [
      path.basename(fileName, ".json"),
      JSON.parse(await readFile(path.join(worldDirectory, fileName), "utf8"))
    ])
  )
);
const {
  anchors,
  camera,
  collisions,
  framing,
  layout,
  navigation,
  occlusion,
  paths,
  props,
  spawns
} = contracts;
const regionById = new Map(layout.regions.map((region) => [region.id, region]));
const anchorById = new Map(anchors.anchors.map((anchor) => [anchor.id, anchor]));
const radius = navigation.agent.radius;
const walkablePolygons = layout.regions.map(({ walkablePolygon }) => walkablePolygon);
const collisionPolygons = collisions.collisionPolygons.map(({ polygon }) => polygon);
const isWalkable = (point) =>
  isWalkablePoint(
    point,
    radius,
    layout.worldBounds,
    walkablePolygons,
    collisionPolygons
  );

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const start = polygon[previous];
    const end = polygon[index];
    const onEdge =
      Math.abs(
        (point.y - start.y) * (end.x - start.x) -
          (point.x - start.x) * (end.y - start.y)
      ) < 1e-7 &&
      point.x >= Math.min(start.x, end.x) &&
      point.x <= Math.max(start.x, end.x) &&
      point.y >= Math.min(start.y, end.y) &&
      point.y <= Math.max(start.y, end.y);
    if (onEdge) {
      return true;
    }
    if (
      start.y > point.y !== end.y > point.y &&
      point.x < ((end.x - start.x) * (point.y - start.y)) / (end.y - start.y) + start.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function boundsContains(bounds, point) {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

function assertUnique(items, label) {
  const ids = items.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length, `${label} IDs`);
}

function projectedBounds(anchor, frame, zone, profile) {
  const zoom = profile.viewport.width === 1280 ? zone.desktopZoom : zone.mobileZoom;
  const cameraCenter = anchorById.get(zone.focusAnchorId).position;
  const extent = {
    x: (anchor.clearanceRadius + frame.horizontalPadding) * zoom,
    y: (anchor.clearanceRadius + frame.verticalPadding) * zoom
  };
  return {
    x: profile.viewport.width / 2 + (anchor.position.x - cameraCenter.x) * zoom - extent.x,
    y: profile.viewport.height / 2 + (anchor.position.y - cameraCenter.y) * zoom - extent.y,
    width: extent.x * 2,
    height: extent.y * 2
  };
}

function boundsInBounds(inner, outer) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

test("compact gameplay contracts align to the complete single-source world", () => {
  assert.deepEqual(fileNames, expectedFiles);
  for (const contract of Object.values(contracts)) {
    assert.equal(contract.schemaVersion, "1.0.0");
    assert.equal(contract.worldId, "john-9-jerusalem-story-world");
  }
  assert.deepEqual(
    layout.regions.map(({ id }) => id),
    ["courtyard", "siloam-pool"]
  );
  assert.deepEqual(layout.topology.canonicalRegionOrder, ["courtyard", "siloam-pool"]);
  assert.deepEqual(layout.sourcePolicy.scriptureNamedRegionIds, ["siloam-pool"]);
  assert.deepEqual(layout.worldBounds, { x: 0, y: 0, width: 2688, height: 1792 });
  assert.deepEqual(regionById.get("courtyard").bounds, {
    x: 944,
    y: 240,
    width: 920,
    height: 900
  });
  assert.deepEqual(regionById.get("siloam-pool").bounds, {
    x: 664,
    y: 1020,
    width: 620,
    height: 460
  });
  assert.deepEqual(navigation.grid, {
    origin: { x: 0, y: 0 },
    cellSize: 32,
    columns: 84,
    rows: 56,
    diagonalMovement: false,
    preventCornerCutting: true,
    defaultWalkCost: 1
  });
  assert.equal(layout.portals.length, 1);
  assert.equal(layout.portals[0].id, "portal.courtyard-siloam");
  assert.deepEqual(layout.portals[0].segment, [
    { x: 1064, y: 1070 },
    { x: 1164, y: 1130 }
  ]);
  assert.deepEqual(
    paths.sequencePaths.map(({ id }) => id),
    [
      "man-to-pool",
      "pool-to-neighbors",
      "group-to-inquiry",
      "parents-entry",
      "parents-exit",
      "expulsion",
      "jesus-entry",
      "ending"
    ]
  );
  assert.equal(navigation.localCirculation.length, 0);
  assert.equal(layout.regions.length, 2);
  assert.doesNotMatch(
    JSON.stringify(layout),
    /"roadside"|"neighbor-gathering"|"inquiry-courtyard"|"outer-road"/,
    "retired empty regions must remain absent"
  );
});

test("camera bounds and focal anchors match the complete source world", () => {
  assert.deepEqual(anchorById.get("courtyard.camera").position, { x: 1534, y: 480 });
  assert.deepEqual(anchorById.get("pool.camera").position, { x: 1104, y: 1140 });
  assert.deepEqual(camera.cameraZones.map(({ bounds }) => bounds), [
    { x: 944, y: 240, width: 920, height: 900 },
    { x: 664, y: 1020, width: 620, height: 460 }
  ]);
});

test("all anchors, actors, props, and obstacles use safe walkable ground", () => {
  for (const collection of [
    layout.regions,
    layout.portals,
    anchors.anchors,
    collisions.collisionPolygons,
    spawns.actorSpawns,
    camera.cameraZones,
    occlusion.foregroundOccluders,
    props.movablePropAnchors,
    paths.sequencePaths,
    framing.profiles,
    framing.sequenceFrames
  ]) {
    assertUnique(collection, "world collection");
  }

  for (const anchor of anchors.anchors) {
    const region = regionById.get(anchor.regionId);
    assert.ok(region, anchor.id);
    assert.ok(pointInPolygon(anchor.position, region.walkablePolygon), anchor.id);
    if (anchor.clearanceRadius > 0) {
      assert.equal(isWalkable(anchor.position), true, `${anchor.id} must clear visual obstacles`);
    }
  }
  for (const collision of collisions.collisionPolygons) {
    const region = regionById.get(collision.regionId);
    assert.ok(region, collision.id);
    for (const point of collision.polygon) {
      assert.equal(boundsContains(layout.worldBounds, point), true, collision.id);
    }
  }
  for (const spawn of spawns.actorSpawns) {
    assert.equal(isWalkable(spawn.position), true, spawn.id);
    assert.equal(anchorById.get(spawn.anchorId).regionId, spawn.regionId, spawn.id);
  }
  for (let left = 0; left < spawns.actorSpawns.length; left += 1) {
    for (let right = left + 1; right < spawns.actorSpawns.length; right += 1) {
      const a = spawns.actorSpawns[left];
      const b = spawns.actorSpawns[right];
      assert.ok(
        distance(a.position, b.position) >= a.collisionRadius + b.collisionRadius,
        `${a.id}/${b.id} overlap`
      );
    }
  }
});

test("opening tableau keeps the man central, the disciples compact, and labels clear", () => {
  const tableau = layout.openingTableau;
  const man = anchorById.get(tableau.focusAnchorId);
  const jesus = anchorById.get("courtyard.jesus");
  const disciples = anchorById.get("courtyard.disciples");
  const observer = anchorById.get(tableau.observerAnchorId);
  assert.deepEqual(tableau.semicircleAnchorIds, ["courtyard.jesus", "courtyard.disciples"]);
  assert.equal(jesus.lookAtAnchorId, man.id);
  assert.equal(disciples.lookAtAnchorId, man.id);
  assert.equal(observer.lookAtAnchorId, man.id);
  assert.ok(distance(jesus.position, man.position) < 120, "Jesus remains close to the man");
  assert.ok(distance(disciples.position, man.position) < 110, "disciples remain a compact semicircle");
  assert.ok(distance(observer.position, man.position) >= 120, "observer remains on the perimeter");
  assert.ok(tableau.labelClearancePixels >= 72);
  assert.deepEqual(
    spawns.actorSpawns.filter(({ initiallyVisible }) => initiallyVisible).map(({ actorId }) => actorId),
    ["player-observer", "man-born-blind", "jesus", "disciple-left", "disciple-right"]
  );
});

test("full-story anchors and hidden actor spawns stay compact, distinct, and walkable", () => {
  const requiredAnchorIds = [
    "pool.neighbors",
    "courtyard.inquiry-entry",
    "courtyard.inquiry-man",
    "courtyard.pharisees-left",
    "courtyard.pharisees-right",
    "courtyard.parents",
    "courtyard.waiting",
    "courtyard.gate",
    "courtyard.expelled",
    "courtyard.jesus-entry",
    "courtyard.belief",
    "courtyard.ending-camera"
  ];
  for (const anchorId of requiredAnchorIds) {
    const anchor = anchorById.get(anchorId);
    assert.ok(anchor, anchorId);
    assert.equal(isWalkable(anchor.position), true, anchorId);
  }
  assert.deepEqual(
    requiredAnchorIds.map((anchorId) => anchorById.get(anchorId).regionId),
    ["siloam-pool", ...Array(11).fill("courtyard")]
  );

  const hiddenSpawns = spawns.actorSpawns.filter(({ initiallyVisible }) => !initiallyVisible);
  assert.deepEqual(
    hiddenSpawns.map(({ actorId }) => actorId),
    [
      "neighbor-left",
      "neighbor-right",
      "pharisee-left",
      "pharisee-right",
      "parent-left",
      "parent-right"
    ]
  );
  assert.deepEqual(
    hiddenSpawns.map(({ position }) => position),
    [
      { x: 934, y: 1090 },
      { x: 1034, y: 1090 },
      { x: 1220, y: 664 },
      { x: 1380, y: 664 },
      { x: 1240, y: 834 },
      { x: 1310, y: 804 }
    ]
  );
  for (const spawn of hiddenSpawns) {
    assert.equal(isWalkable(spawn.position), true, spawn.id);
    for (const other of spawns.actorSpawns) {
      if (other.id !== spawn.id) {
        assert.ok(
          distance(spawn.position, other.position) >=
            spawn.collisionRadius + other.collisionRadius,
          `${spawn.id}/${other.id} must remain visibly distinct`
        );
      }
    }
  }
});

test("all sequence paths are radius-safe, reachable, and short without empty corridors", () => {
  const pathById = new Map(paths.sequencePaths.map((sequencePath) => [sequencePath.id, sequencePath]));
  const sequencePath = pathById.get("man-to-pool");
  assert.equal(sequencePath.startAnchorId, "courtyard.man-center");
  assert.equal(sequencePath.endAnchorId, "pool.wash-edge");
  assert.equal(sequencePath.expectedDurationSeconds >= paths.travelTargetSeconds.minimum, true);
  assert.equal(sequencePath.expectedDurationSeconds <= paths.travelTargetSeconds.maximum, true);

  const maximumLengths = new Map([
    ["man-to-pool", 900],
    ["pool-to-neighbors", 250],
    ["group-to-inquiry", 550],
    ["parents-entry", 200],
    ["parents-exit", 200],
    ["expulsion", 350],
    ["jesus-entry", 250],
    ["ending", 40]
  ]);
  for (const currentPath of paths.sequencePaths) {
    assert.deepEqual(
      currentPath.points[0],
      anchorById.get(currentPath.startAnchorId).position,
      `${currentPath.id} start`
    );
    assert.deepEqual(
      currentPath.points.at(-1),
      anchorById.get(currentPath.endAnchorId).position,
      `${currentPath.id} end`
    );
    const length = currentPath.points.slice(1).reduce(
      (total, point, index) => total + distance(currentPath.points[index], point),
      0
    );
    assert.ok(length < maximumLengths.get(currentPath.id), `${currentPath.id} is compact`);
    assert.ok(
      Math.abs(length / currentPath.movementSpeed - currentPath.expectedDurationSeconds) <= 1,
      `${currentPath.id} duration matches its pace`
    );
    for (const point of currentPath.points) {
      assert.equal(isWalkable(point), true, `${currentPath.id} point is reachable`);
    }
    for (let index = 0; index < currentPath.points.length - 1; index += 1) {
      assert.equal(
        isWalkableSegment(
          currentPath.points[index],
          currentPath.points[index + 1],
          currentPath.actorRadius,
          isWalkable
        ),
        true,
        `${currentPath.id} segment ${index}`
      );
    }
  }

  assert.ok(
    pathById
      .get("group-to-inquiry")
      .points.some(
        (point) =>
          distance(point, anchorById.get("courtyard.inquiry-entry").position) === 0
      ),
    "group enters through the compact inquiry anchor"
  );
  assert.ok(
    pathById
      .get("expulsion")
      .points.some(
        (point) => distance(point, anchorById.get("courtyard.gate").position) === 0
      ),
    "expulsion reaches the compact gate"
  );

  const portal = layout.portals[0];
  assert.equal(
    sequencePath.points.some((point) => pointInPolygon(point, regionById.get("siloam-pool").walkablePolygon)),
    true
  );
  for (const point of portal.segment) {
    assert.equal(pointInPolygon(point, regionById.get("courtyard").walkablePolygon), true);
    assert.equal(pointInPolygon(point, regionById.get("siloam-pool").walkablePolygon), true);
  }
});

test("desktop and 390x844 cameras contain the opening and washing frames inside UI-safe space", () => {
  assert.deepEqual(
    framing.profiles.map(({ viewport }) => `${viewport.width}x${viewport.height}`),
    ["1280x720", "390x844"]
  );
  const zoneById = new Map(camera.cameraZones.map((zone) => [zone.id, zone]));
  for (const zone of camera.cameraZones) {
    const region = regionById.get(zone.regionId);
    assert.ok(boundsContains(zone.bounds, anchorById.get(zone.focusAnchorId).position), zone.id);
    assert.ok(boundsInBounds(region.bounds, zone.bounds), `${zone.id} covers its region`);
  }
  for (const frame of framing.sequenceFrames) {
    const zone = zoneById.get(frame.cameraZoneId);
    for (const profile of framing.profiles) {
      const zoom = profile.viewport.width === 1280 ? zone.desktopZoom : zone.mobileZoom;
      assert.ok(zoom >= profile.cameraZoomRange.minimum && zoom <= profile.cameraZoomRange.maximum);
      for (const anchorId of frame.focusAnchorIds) {
        const anchor = anchorById.get(anchorId);
        assert.ok(
          boundsInBounds(projectedBounds(anchor, frame, zone, profile), profile.gameplaySafeRect),
          `${frame.id}/${profile.id}/${anchorId} conflicts with UI`
        );
      }
    }
  }
});
