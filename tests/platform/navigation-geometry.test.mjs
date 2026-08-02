import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { NavigationGrid } from "@sonic74129/map-runtime";

import {
  buildBlockedCells,
  findWalkablePath,
  isWalkablePoint,
  isWalkableSegment,
} from "../../src/adapters/navigation-geometry.js";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const [layout, navigationContract, collisions, spawns] = await Promise.all([
  readJson("src/world/layout.json"),
  readJson("src/world/navigation.json"),
  readJson("src/world/collisions.json"),
  readJson("src/world/spawns.json"),
]);
const radius = navigationContract.agent.radius;
const walkablePolygons = layout.regions.map(
  ({ walkablePolygon }) => walkablePolygon,
);
const collisionPolygons = collisions.collisionPolygons.map(
  ({ polygon }) => polygon,
);
const isWalkable = (point) =>
  isWalkablePoint(
    point,
    radius,
    layout.worldBounds,
    walkablePolygons,
    collisionPolygons,
  );
const blocked = buildBlockedCells({
  width: layout.worldBounds.width,
  height: layout.worldBounds.height,
  cellSize: navigationContract.grid.cellSize,
  radius,
  bounds: layout.worldBounds,
  walkablePolygons,
  collisionPolygons,
});
const navigation = new NavigationGrid({
  width: layout.worldBounds.width,
  height: layout.worldBounds.height,
  cellSize: navigationContract.grid.cellSize,
  blocked,
});
const playerStart = spawns.actorSpawns.find(
  ({ actorId }) => actorId === "player-observer",
).position;

test("radius-aware geometry rejects walls, the pool basin, and world edges", () => {
  assert.equal(isWalkable(playerStart), true);
  assert.equal(isWalkable({ x: 300, y: 660 }), false);
  assert.equal(isWalkable({ x: 1200, y: 1080 }), false);
  assert.equal(isWalkable({ x: 10, y: 10 }), false);

  for (const point of [
    { x: 300, y: 660 },
    { x: 1200, y: 1080 },
    { x: 10, y: 10 },
  ]) {
    assert.equal(navigation.isWalkable(navigation.worldToCell(point)), false);
  }
});

test("keyboard segments cannot cross collision geometry", () => {
  const wallStart = { x: 190, y: 660 };
  const wallEnd = { x: 510, y: 660 };
  assert.equal(isWalkable(wallStart), true);
  assert.equal(isWalkable(wallEnd), true);
  assert.equal(
    isWalkableSegment(wallStart, wallEnd, radius, isWalkable),
    false,
  );

  const poolStart = { x: 1000, y: 1080 };
  const poolEnd = { x: 1400, y: 1080 };
  assert.equal(isWalkable(poolStart), true);
  assert.equal(isWalkable(poolEnd), true);
  assert.equal(
    isWalkableSegment(poolStart, poolEnd, radius, isWalkable),
    false,
  );
});

test("pointer paths keep the SDK first step and exact target cell endpoint", () => {
  const target = { x: 700, y: 980 };
  assert.equal(isWalkable(target), true);
  const path = findWalkablePath(navigation, playerStart, target, isWalkable);
  assert.ok(path.length > 1);

  const startCell = navigation.worldToCell(playerStart);
  const firstCell = navigation.worldToCell(path[0]);
  assert.equal(
    Math.abs(firstCell.column - startCell.column) +
      Math.abs(firstCell.row - startCell.row),
    1,
  );
  assert.deepEqual(
    path.at(-1),
    navigation.cellToWorld(navigation.worldToCell(target)),
  );
});

test("pointer endpoints on blocked geometry are rejected before SDK relocation", () => {
  for (const target of [
    { x: 300, y: 660 },
    { x: 1200, y: 1080 },
    { x: 10, y: 10 },
  ]) {
    assert.deepEqual(
      findWalkablePath(navigation, playerStart, target, isWalkable),
      [],
    );
  }
});

test("radius-aware cells preserve the continuous route across all regions", () => {
  for (const target of [
    { x: 1200, y: 900 },
    { x: 1800, y: 900 },
    { x: 2450, y: 850 },
    { x: 2950, y: 900 },
  ]) {
    assert.equal(isWalkable(target), true);
    assert.ok(
      findWalkablePath(navigation, playerStart, target, isWalkable).length > 0,
    );
  }
});
