import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

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
const rawByFile = new Map();
const contracts = {};

for (const fileName of fileNames) {
  const raw = await readFile(path.join(worldDirectory, fileName), "utf8");
  rawByFile.set(fileName, raw);
  contracts[path.basename(fileName, ".json")] = JSON.parse(raw);
}

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
const cameraZoneById = new Map(camera.cameraZones.map((zone) => [zone.id, zone]));

function pointOnSegment(point, start, end, epsilon = 1e-8) {
  const cross =
    (point.y - start.y) * (end.x - start.x) -
    (point.x - start.x) * (end.y - start.y);
  if (Math.abs(cross) > epsilon) {
    return false;
  }

  const dot =
    (point.x - start.x) * (end.x - start.x) +
    (point.y - start.y) * (end.y - start.y);
  if (dot < -epsilon) {
    return false;
  }

  const squaredLength =
    (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  return dot <= squaredLength + epsilon;
}

function pointInPolygon(point, polygon) {
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    if (pointOnSegment(point, start, end)) {
      return true;
    }
  }

  let inside = false;
  for (
    let current = 0, previous = polygon.length - 1;
    current < polygon.length;
    previous = current, current += 1
  ) {
    const a = polygon[current];
    const b = polygon[previous];
    const crosses =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInBounds(point, bounds) {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

function boundsInBounds(inner, outer) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToSegment(point, start, end) {
  const squaredLength = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  if (squaredLength === 0) {
    return distanceBetween(point, start);
  }

  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * (end.x - start.x) +
        (point.y - start.y) * (end.y - start.y)) /
        squaredLength
    )
  );
  return distanceBetween(point, {
    x: start.x + projection * (end.x - start.x),
    y: start.y + projection * (end.y - start.y)
  });
}

function distanceToPolygon(point, polygon) {
  if (pointInPolygon(point, polygon)) {
    return 0;
  }

  return Math.min(
    ...polygon.map((start, index) =>
      distanceToSegment(point, start, polygon[(index + 1) % polygon.length])
    )
  );
}

function pathLength(points) {
  return points
    .slice(1)
    .reduce(
      (length, point, index) =>
        length + distanceBetween(points[index], point),
      0
    );
}

function assertUniqueIds(items, label) {
  const ids = items.map((item) => item.id);
  assert.equal(
    new Set(ids).size,
    ids.length,
    `${label} must not contain duplicate IDs`
  );
  for (const id of ids) {
    assert.match(id, /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/, `${label}: ${id}`);
  }
}

test("all world JSON contracts parse and share the pinned schema identity", () => {
  assert.deepEqual(fileNames, expectedFiles);
  for (const [fileName, contract] of Object.entries(contracts)) {
    assert.equal(contract.schemaVersion, "1.0.0", fileName);
    assert.equal(contract.worldId, "john-9-jerusalem-graybox", fileName);
    assert.equal(typeof contract.contractType, "string", fileName);
  }
});

test("IDs are stable and unique within and across world entity collections", () => {
  const collections = {
    regions: layout.regions,
    portals: layout.portals,
    anchors: anchors.anchors,
    collisions: collisions.collisionPolygons,
    spawns: spawns.actorSpawns,
    cameras: camera.cameraZones,
    occluders: occlusion.foregroundOccluders,
    props: props.movablePropAnchors,
    paths: paths.sequencePaths,
    profiles: framing.profiles,
    frames: framing.sequenceFrames
  };

  for (const [label, items] of Object.entries(collections)) {
    assertUniqueIds(items, label);
  }

  const allIds = Object.values(collections).flatMap((items) =>
    items.map((item) => item.id)
  );
  assert.equal(new Set(allIds).size, allIds.length, "all entity IDs are global");
});

test("layout defines five bounded, connected regions with only Siloam named", () => {
  const expectedRegions = [
    "roadside",
    "siloam-pool",
    "neighbor-gathering",
    "inquiry-courtyard",
    "outer-road"
  ];
  assert.deepEqual(
    layout.regions.map((region) => region.id),
    expectedRegions
  );
  assert.deepEqual(layout.sourcePolicy.scriptureNamedRegionIds, ["siloam-pool"]);
  assert.equal(
    layout.sourcePolicy.neutralStagingSourceLevel,
    "approved-bridge"
  );

  for (const region of layout.regions) {
    assert.ok(boundsInBounds(region.bounds, layout.worldBounds), region.id);
    assert.ok(region.walkablePolygon.length >= 4, region.id);
    for (const point of region.walkablePolygon) {
      assert.ok(pointInBounds(point, region.bounds), `${region.id} polygon`);
      assert.ok(pointInBounds(point, layout.worldBounds), `${region.id} world`);
    }

    if (region.id === "siloam-pool") {
      assert.equal(region.sourceLevel, "scripture");
      assert.equal(region.scriptureLocationName, "Siloam");
    } else {
      assert.equal(region.sourceLevel, "approved-bridge");
      assert.equal(region.scriptureLocationName, undefined);
    }
  }

  const adjacency = new Map(
    layout.regions.map((region) => [region.id, new Set()])
  );
  for (const portal of layout.portals) {
    assert.equal(portal.sourceLevel, "approved-bridge", portal.id);
    const from = regionById.get(portal.fromRegionId);
    const to = regionById.get(portal.toRegionId);
    assert.ok(from, `${portal.id} from region`);
    assert.ok(to, `${portal.id} to region`);
    assert.ok(portal.clearance >= navigation.agent.minimumGroupLaneWidth / 2);
    for (const point of portal.segment) {
      assert.ok(pointInPolygon(point, from.walkablePolygon), `${portal.id} from`);
      assert.ok(pointInPolygon(point, to.walkablePolygon), `${portal.id} to`);
    }
    adjacency.get(from.id).add(to.id);
    adjacency.get(to.id).add(from.id);
  }

  const visited = new Set();
  const pending = [layout.regions[0].id];
  while (pending.length > 0) {
    const regionId = pending.shift();
    if (visited.has(regionId)) {
      continue;
    }
    visited.add(regionId);
    pending.push(...adjacency.get(regionId));
  }
  assert.equal(visited.size, layout.regions.length);
});

test("required anchors exist, use valid source levels, and sit inside walkable regions", () => {
  const requiredAnchorIds = [
    "roadside.player-start",
    "roadside.blind-man-seat",
    "roadside.jesus",
    "roadside.disciples",
    "roadside.clay-action",
    "route.pool-entry",
    "pool.wash-edge",
    "pool.return",
    "neighbors.center",
    "neighbors.group-left",
    "neighbors.group-right",
    "inquiry.gate",
    "inquiry.man-center",
    "inquiry.pharisees-left",
    "inquiry.pharisees-right",
    "inquiry.parents",
    "inquiry.waiting",
    "outside.expelled",
    "outside.jesus-entry",
    "outside.belief",
    "ending.camera"
  ];
  for (const id of requiredAnchorIds) {
    assert.ok(anchorById.has(id), `missing required anchor ${id}`);
  }

  for (const anchor of anchors.anchors) {
    const region = regionById.get(anchor.regionId);
    assert.ok(region, `${anchor.id} region`);
    assert.ok(
      pointInPolygon(anchor.position, region.walkablePolygon),
      `${anchor.id} must be walkable`
    );
    assert.ok(
      ["scripture", "approved-bridge"].includes(anchor.sourceLevel),
      `${anchor.id} sourceLevel`
    );
    if (
      ["entrance", "exit", "route", "camera-focus"].includes(anchor.kind)
    ) {
      assert.equal(anchor.sourceLevel, "approved-bridge", anchor.id);
    }
  }
});

test("collision polygons are valid and actor spawns have collision-safe clearance", () => {
  for (const collision of collisions.collisionPolygons) {
    const region = regionById.get(collision.regionId);
    assert.ok(region, collision.id);
    assert.ok(collision.polygon.length >= 3, collision.id);
    for (const point of collision.polygon) {
      assert.ok(pointInBounds(point, layout.worldBounds), collision.id);
      assert.ok(pointInPolygon(point, region.walkablePolygon), collision.id);
    }
  }

  for (const spawn of spawns.actorSpawns) {
    const region = regionById.get(spawn.regionId);
    const anchor = anchorById.get(spawn.anchorId);
    assert.ok(region, `${spawn.id} region`);
    assert.ok(anchor, `${spawn.id} anchor`);
    assert.equal(anchor.regionId, spawn.regionId, `${spawn.id} anchor region`);
    assert.ok(pointInPolygon(spawn.position, region.walkablePolygon), spawn.id);
    assert.ok(spawn.collisionRadius >= navigation.agent.radius, spawn.id);
    for (const collision of collisions.collisionPolygons) {
      assert.ok(
        distanceToPolygon(spawn.position, collision.polygon) >
          spawn.collisionRadius,
        `${spawn.id} overlaps ${collision.id}`
      );
    }
  }

  for (let left = 0; left < spawns.actorSpawns.length; left += 1) {
    for (let right = left + 1; right < spawns.actorSpawns.length; right += 1) {
      const a = spawns.actorSpawns[left];
      const b = spawns.actorSpawns[right];
      assert.ok(
        distanceBetween(a.position, b.position) >=
          a.collisionRadius + b.collisionRadius,
        `${a.id} overlaps ${b.id}`
      );
    }
  }
});

test("navigation grid covers the world and references every region exactly once", () => {
  const { grid } = navigation;
  assert.equal(grid.origin.x, layout.worldBounds.x);
  assert.equal(grid.origin.y, layout.worldBounds.y);
  assert.equal(grid.columns * grid.cellSize, layout.worldBounds.width);
  assert.equal(grid.rows * grid.cellSize, layout.worldBounds.height);
  assert.equal(grid.diagonalMovement, false);
  assert.equal(grid.preventCornerCutting, true);
  assert.equal(navigation.generation.debugOverlay, true);
  assert.deepEqual(
    navigation.regionCosts.map(({ regionId }) => regionId).sort(),
    [...regionById.keys()].sort()
  );
});

test("required sequence paths use walkable points, safe endpoints, and 10-20 second travel", () => {
  const requiredPathIds = [
    "man-to-pool",
    "group-to-inquiry",
    "parents-entry-exit",
    "expulsion",
    "jesus-entry",
    "ending"
  ];
  assert.deepEqual(
    paths.sequencePaths.map((sequencePath) => sequencePath.id),
    requiredPathIds
  );
  assert.deepEqual(paths.travelTargetSeconds, { minimum: 10, maximum: 20 });

  for (const sequencePath of paths.sequencePaths) {
    const startAnchor = anchorById.get(sequencePath.startAnchorId);
    const endAnchor = anchorById.get(sequencePath.endAnchorId);
    assert.ok(startAnchor, `${sequencePath.id} start anchor`);
    assert.ok(endAnchor, `${sequencePath.id} end anchor`);
    assert.deepEqual(sequencePath.points[0], startAnchor.position);
    assert.deepEqual(
      sequencePath.points[sequencePath.points.length - 1],
      endAnchor.position
    );
    assert.ok(
      sequencePath.expectedDurationSeconds >= paths.travelTargetSeconds.minimum
    );
    assert.ok(
      sequencePath.expectedDurationSeconds <= paths.travelTargetSeconds.maximum
    );
    const calculatedDuration =
      pathLength(sequencePath.points) / sequencePath.movementSpeed;
    assert.ok(
      Math.abs(calculatedDuration - sequencePath.expectedDurationSeconds) <= 2,
      `${sequencePath.id} duration does not match path length and speed`
    );

    for (const point of sequencePath.points) {
      assert.ok(
        layout.regions.some((region) =>
          pointInPolygon(point, region.walkablePolygon)
        ),
        `${sequencePath.id} has non-walkable point ${JSON.stringify(point)}`
      );
      for (const collision of collisions.collisionPolygons) {
        assert.ok(
          !pointInPolygon(point, collision.polygon),
          `${sequencePath.id} point intersects ${collision.id}`
        );
      }
    }
  }
});

test("camera zones and safe-frame profiles support desktop and mobile targets", () => {
  for (const zone of camera.cameraZones) {
    assert.ok(regionById.has(zone.regionId), zone.id);
    assert.ok(anchorById.has(zone.focusAnchorId), zone.id);
    assert.ok(boundsInBounds(zone.bounds, layout.worldBounds), zone.id);
    assert.ok(zone.deadZone.width > 0 && zone.deadZone.height > 0, zone.id);
    assert.ok(zone.transitionSeconds > 0, zone.id);
  }

  const expectedViewports = new Set(["1280x720", "390x844"]);
  const actualViewports = new Set(
    framing.profiles.map(
      ({ viewport }) => `${viewport.width}x${viewport.height}`
    )
  );
  assert.deepEqual(actualViewports, expectedViewports);

  for (const profile of framing.profiles) {
    const { viewport, safeInsets, gameplaySafeRect, cameraZoomRange } = profile;
    assert.deepEqual(gameplaySafeRect, {
      x: safeInsets.left,
      y: safeInsets.top,
      width: viewport.width - safeInsets.left - safeInsets.right,
      height: viewport.height - safeInsets.top - safeInsets.bottom
    });
    assert.ok(cameraZoomRange.minimum > 0, profile.id);
    assert.ok(cameraZoomRange.maximum >= cameraZoomRange.minimum, profile.id);
    assert.ok(
      framing.sequenceFrames.every(
        (frame) => frame.horizontalPadding * 2 < gameplaySafeRect.width
      ),
      `${profile.id} horizontal frame padding`
    );
    assert.ok(
      framing.sequenceFrames.every(
        (frame) => frame.verticalPadding * 2 < gameplaySafeRect.height
      ),
      `${profile.id} vertical frame padding`
    );
  }

  const desktop = framing.profiles.find(({ viewport }) => viewport.width === 1280);
  const mobile = framing.profiles.find(({ viewport }) => viewport.width === 390);
  for (const zone of camera.cameraZones) {
    assert.ok(
      zone.desktopZoom >= desktop.cameraZoomRange.minimum &&
        zone.desktopZoom <= desktop.cameraZoomRange.maximum,
      `${zone.id} desktop zoom`
    );
    assert.ok(
      zone.mobileZoom >= mobile.cameraZoomRange.minimum &&
        zone.mobileZoom <= mobile.cameraZoomRange.maximum,
      `${zone.id} mobile zoom`
    );
  }

  for (const frame of framing.sequenceFrames) {
    assert.ok(cameraZoneById.has(frame.cameraZoneId), frame.id);
    assert.ok(frame.focusAnchorIds.length > 0, frame.id);
    for (const anchorId of frame.focusAnchorIds) {
      assert.ok(anchorById.has(anchorId), `${frame.id} focus ${anchorId}`);
    }
  }
});

test("occluders and movable props are graybox-only, bounded, and independently layered", () => {
  assert.equal(layout.grayboxPolicy.metadataOnly, true);
  assert.deepEqual(layout.grayboxPolicy.binaryArtworkReferences, []);
  assert.equal(layout.grayboxPolicy.actorsBakedIntoMap, false);
  assert.equal(layout.grayboxPolicy.movablePropsBakedIntoMap, false);

  for (const occluder of occlusion.foregroundOccluders) {
    assert.ok(regionById.has(occluder.regionId), occluder.id);
    assert.equal(occluder.sourceLevel, "approved-bridge", occluder.id);
    assert.equal(occluder.fadeWhenActorBehind, true, occluder.id);
    assert.ok(
      occluder.fadedOpacity > 0 && occluder.fadedOpacity < 1,
      occluder.id
    );
    for (const point of occluder.polygon) {
      assert.ok(pointInBounds(point, layout.worldBounds), occluder.id);
    }
  }

  for (const prop of props.movablePropAnchors) {
    const region = regionById.get(prop.regionId);
    assert.ok(region, prop.id);
    assert.equal(prop.sourceLevel, "approved-bridge", prop.id);
    assert.equal(prop.isBakedIntoMap, false, prop.id);
    assert.ok(anchorById.has(prop.interactionAnchorId), prop.id);
    assert.ok(pointInPolygon(prop.position, region.walkablePolygon), prop.id);
    assert.ok(prop.states.includes(prop.initialState), prop.id);
  }
});

test("contracts avoid forbidden historical claims, candidate assets, and magical effects", () => {
  const allRaw = [...rawByFile.values()].join("\n");
  const forbidden = [
    /\btemple\b/i,
    /\bsynagogue\b/i,
    /\bsanhedrin\b/i,
    /圣殿|聖殿|会堂|會堂|公会|公會/u,
    /candidate[\s_-]*asset/i,
    /asset[\s_-]*cell/i,
    /halo|magic(?:al)?|miracle[\s_-]*(?:glow|beam|effect)/i,
    /光环|光環|魔法|神迹发光|神蹟發光/u
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(allRaw, pattern);
  }
  assert.doesNotMatch(allRaw, /\.(?:png|jpe?g|webp|gif|svg|mp3|wav|ogg)\b/i);
  assert.match(
    layout.description,
    /not a claimed historical reconstruction/i
  );
});
