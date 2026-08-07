import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { NavigationGrid } from "@sonic74129/map-runtime";

import {
  buildBlockedCells,
  findWalkablePath,
  isWalkablePoint,
  isWalkableSegment
} from "../../src/adapters/navigation-geometry.js";

const readJson = async (filePath) => JSON.parse(await readFile(filePath, "utf8"));
const [layout, navigationContract, collisions, spawns, anchors, paths] = await Promise.all([
  readJson("src/world/layout.json"),
  readJson("src/world/navigation.json"),
  readJson("src/world/collisions.json"),
  readJson("src/world/spawns.json"),
  readJson("src/world/anchors.json"),
  readJson("src/world/paths.json")
]);
const radius = navigationContract.agent.radius;
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
const blocked = buildBlockedCells({
  width: layout.worldBounds.width,
  height: layout.worldBounds.height,
  cellSize: navigationContract.grid.cellSize,
  radius,
  bounds: layout.worldBounds,
  walkablePolygons,
  collisionPolygons
});
const navigation = new NavigationGrid({
  width: layout.worldBounds.width,
  height: layout.worldBounds.height,
  cellSize: navigationContract.grid.cellSize,
  blocked
});
const anchorById = new Map(anchors.anchors.map((anchor) => [anchor.id, anchor]));
const playerStart = spawns.actorSpawns.find(({ actorId }) => actorId === "player-observer").position;

function requireAnchor(anchorId) {
  const anchor = anchorById.get(anchorId);
  assert.ok(anchor, anchorId);
  return anchor;
}

function assertPointerPath(start, target, label) {
  const path = findWalkablePath(navigation, start, target, isWalkable);
  assert.ok(path.length > 0, `${label} pointer path`);
  let previous = start;
  for (const point of path) {
    assert.equal(isWalkable(point), true, `${label} point`);
    assert.equal(isWalkableSegment(previous, point, radius, isWalkable), true, `${label} segment`);
    previous = point;
  }
  return path.at(-1);
}

test("all active courtyard and Siloam anchors are radius-safe", () => {
  for (const anchor of anchors.anchors) {
    if (anchor.clearanceRadius > 0) {
      assert.equal(isWalkable(anchor.position), true, anchor.id);
    }
  }
  for (const point of [
    { x: 1400, y: 310 },
    { x: 1600, y: 440 },
    { x: 820, y: 1260 },
    { x: 10, y: 10 }
  ]) {
    assert.equal(isWalkable(point), false, JSON.stringify(point));
  }
});

test("pointer navigation reaches the opening tableau and short pool destination", () => {
  let current = assertPointerPath(
    playerStart,
    requireAnchor("courtyard.man-center").position,
    "opening tableau"
  );
  current = assertPointerPath(
    current,
    requireAnchor("courtyard.pool-approach").position,
    "courtyard approach"
  );
  assertPointerPath(current, requireAnchor("pool.wash-edge").position, "Siloam wash edge");
});

test("the actor route cannot cut through roofs, planter, wall, or pool water", () => {
  const [manToPool] = paths.sequencePaths;
  assert.equal(manToPool.id, "man-to-pool");
  for (let index = 0; index < manToPool.points.length - 1; index += 1) {
    assert.equal(
      isWalkableSegment(
        manToPool.points[index],
        manToPool.points[index + 1],
        manToPool.actorRadius,
        isWalkable
      ),
      true,
      `segment ${index}`
    );
  }
  for (const target of [
    { x: 1400, y: 310 },
    { x: 1600, y: 440 },
    { x: 820, y: 1260 }
  ]) {
    assert.deepEqual(findWalkablePath(navigation, playerStart, target, isWalkable), []);
  }
});
