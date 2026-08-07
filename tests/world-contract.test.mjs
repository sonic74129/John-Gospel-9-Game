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

test("courtyard-to-Siloam contracts are complete, pinned, and retire later-story space", () => {
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
  assert.deepEqual(layout.worldBounds, { x: 0, y: 0, width: 1248, height: 1280 });
  assert.deepEqual(regionById.get("courtyard").bounds, {
    x: 304,
    y: 16,
    width: 920,
    height: 900
  });
  assert.deepEqual(regionById.get("siloam-pool").bounds, {
    x: 24,
    y: 796,
    width: 620,
    height: 460
  });
  assert.deepEqual(navigation.grid, {
    origin: { x: 0, y: 0 },
    cellSize: 32,
    columns: 39,
    rows: 40,
    diagonalMovement: false,
    preventCornerCutting: true,
    defaultWalkCost: 1
  });
  assert.equal(layout.portals.length, 1);
  assert.equal(layout.portals[0].id, "portal.courtyard-siloam");
  assert.deepEqual(layout.portals[0].segment, [
    { x: 424, y: 846 },
    { x: 524, y: 906 }
  ]);
  assert.equal(paths.sequencePaths.length, 1);
  assert.equal(paths.sequencePaths[0].id, "man-to-pool");
  assert.equal(navigation.localCirculation.length, 0);
  assert.equal(
    JSON.stringify(contracts).match(
      /neighbor|inquiry|outside|pharisee|parent|expulsion|jesus-entry/i
    ),
    null,
    "John 9:8-41 regions, NPC routes, and spatial triggers must be absent"
  );
});

test("camera bounds and focal anchors match the cropped world", () => {
  assert.deepEqual(anchorById.get("courtyard.camera").position, { x: 894, y: 256 });
  assert.deepEqual(anchorById.get("pool.camera").position, { x: 514, y: 916 });
  assert.deepEqual(camera.cameraZones.map(({ bounds }) => bounds), [
    { x: 304, y: 16, width: 920, height: 900 },
    { x: 24, y: 796, width: 620, height: 460 }
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
    spawns.actorSpawns.map(({ actorId }) => actorId),
    ["player-observer", "man-born-blind", "jesus", "disciple-left", "disciple-right"]
  );
});

test("the single short man-to-pool path is radius-safe and crosses the only portal", () => {
  const sequencePath = paths.sequencePaths[0];
  assert.equal(sequencePath.startAnchorId, "courtyard.man-center");
  assert.equal(sequencePath.endAnchorId, "pool.wash-edge");
  assert.deepEqual(sequencePath.points[0], anchorById.get(sequencePath.startAnchorId).position);
  assert.deepEqual(sequencePath.points.at(-1), anchorById.get(sequencePath.endAnchorId).position);
  assert.equal(sequencePath.expectedDurationSeconds >= paths.travelTargetSeconds.minimum, true);
  assert.equal(sequencePath.expectedDurationSeconds <= paths.travelTargetSeconds.maximum, true);
  const length = sequencePath.points.slice(1).reduce(
    (total, point, index) => total + distance(sequencePath.points[index], point),
    0
  );
  assert.ok(length < 900, "the route remains a short continuous walk");
  assert.ok(
    Math.abs(length / sequencePath.movementSpeed - sequencePath.expectedDurationSeconds) <= 1,
    "route duration matches its pace"
  );
  for (let index = 0; index < sequencePath.points.length - 1; index += 1) {
    assert.equal(
      isWalkableSegment(
        sequencePath.points[index],
        sequencePath.points[index + 1],
        sequencePath.actorRadius,
        isWalkable
      ),
      true,
      `path segment ${index}`
    );
  }
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
