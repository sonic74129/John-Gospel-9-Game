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
const [
  layout,
  navigationContract,
  collisions,
  spawns,
  anchors,
  paths,
] = await Promise.all([
  readJson("src/world/layout.json"),
  readJson("src/world/navigation.json"),
  readJson("src/world/collisions.json"),
  readJson("src/world/spawns.json"),
  readJson("src/world/anchors.json"),
  readJson("src/world/paths.json"),
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
const anchorById = new Map(
  anchors.anchors.map((anchor) => [anchor.id, anchor]),
);
const playerStart = spawns.actorSpawns.find(
  ({ actorId }) => actorId === "player-observer",
).position;

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
    assert.equal(isWalkable(point), true, `${label} pointer point`);
    assert.equal(
      isWalkableSegment(previous, point, radius, isWalkable),
      true,
      `${label} pointer segment`,
    );
    previous = point;
  }
  assert.deepEqual(
    path.at(-1),
    navigation.cellToWorld(navigation.worldToCell(target)),
    `${label} target cell`,
  );
  return path.at(-1);
}

function assertKeyboardPolyline(points, label) {
  let previous = points[0];
  assert.equal(isWalkable(previous), true, `${label} start`);
  for (const endpoint of points.slice(1)) {
    const distance = Math.hypot(
      endpoint.x - previous.x,
      endpoint.y - previous.y,
    );
    const steps = Math.max(1, Math.ceil(distance / 12));
    const segmentStart = previous;
    for (let step = 1; step <= steps; step += 1) {
      const progress = step / steps;
      const next = {
        x: segmentStart.x + (endpoint.x - segmentStart.x) * progress,
        y: segmentStart.y + (endpoint.y - segmentStart.y) * progress,
      };
      assert.equal(
        isWalkableSegment(previous, next, radius, isWalkable),
        true,
        `${label} keyboard step ${step}/${steps}`,
      );
      previous = next;
    }
  }
}

test("radius-aware geometry rejects walls, landmarks, the pool basin, and world edges", () => {
  assert.equal(isWalkable(playerStart), true);
  for (const point of [
    { x: 400, y: 560 },
    { x: 1120, y: 1560 },
    { x: 2050, y: 1320 },
    { x: 10, y: 10 },
  ]) {
    assert.equal(isWalkable(point), false);
    assert.equal(navigation.isWalkable(navigation.worldToCell(point)), false);
  }
});

test("keyboard movement cannot cut through obstacle faces or corners", () => {
  for (const [start, end] of [
    [
      { x: 200, y: 560 },
      { x: 660, y: 560 },
    ],
    [
      { x: 850, y: 1560 },
      { x: 1460, y: 1560 },
    ],
    [
      { x: 1600, y: 780 },
      { x: 1800, y: 1000 },
    ],
  ]) {
    assert.equal(isWalkable(start), true);
    assert.equal(isWalkable(end), true);
    assert.equal(
      isWalkableSegment(start, end, radius, isWalkable),
      false,
    );
  }
});

test("pointer paths keep the SDK first step and exact target cell endpoint", () => {
  const target = requireAnchor("roadside.blind-man-seat").position;
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
    { x: 400, y: 560 },
    { x: 1120, y: 1560 },
    { x: 2050, y: 1320 },
    { x: 10, y: 10 },
  ]) {
    assert.deepEqual(
      findWalkablePath(navigation, playerStart, target, isWalkable),
      [],
    );
  }
});

test("pointer traversal reaches every beat region, vertical pocket, and backtracks", () => {
  const narrativeTargets = [
    "roadside.blind-man-seat",
    "pool.wash-edge",
    "pool.return",
    "neighbors.center",
    "inquiry.gate",
    "inquiry.man-center",
    "outside.inquiry-entry",
    "outside.expelled",
    "outside.belief",
  ];
  let current = playerStart;
  for (const anchorId of narrativeTargets) {
    current = assertPointerPath(
      current,
      requireAnchor(anchorId).position,
      anchorId,
    );
  }

  for (const anchorId of layout.topology.landmarkAnchorIds.toReversed()) {
    current = assertPointerPath(
      current,
      requireAnchor(anchorId).position,
      `${anchorId} exploration`,
    );
  }
  assertPointerPath(current, playerStart, "full-world backtrack");
});

test("keyboard simulation clears every actor sequence and both local approaches", () => {
  for (const sequencePath of paths.sequencePaths) {
    if (sequencePath.subject === "camera-focus") {
      continue;
    }
    assertKeyboardPolyline(sequencePath.points, sequencePath.id);
  }
  for (const circulation of navigationContract.localCirculation) {
    for (const alternative of circulation.alternatives) {
      assertKeyboardPolyline(
        alternative.points,
        `${circulation.id}/${alternative.id}`,
      );
    }
  }
});

test("the grid remains fully connected across all five ordered region transitions", () => {
  const transitionTargets = layout.portals.map(({ segment, id }) => ({
    id,
    point: {
      x: (segment[0].x + segment[1].x) / 2,
      y: (segment[0].y + segment[1].y) / 2,
    },
  }));
  let current = playerStart;
  for (const { id, point } of transitionTargets) {
    current = assertPointerPath(current, point, id);
  }
  assertPointerPath(
    current,
    requireAnchor("outside.lower-turn").position,
    "outer-road completion",
  );
});
