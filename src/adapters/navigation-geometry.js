const CLEARANCE_SAMPLES = 32;
const EPSILON = 1e-7;

/**
 * @typedef {{ readonly x: number, readonly y: number }} Point
 * @typedef {{ readonly column: number, readonly row: number }} GridCell
 * @typedef {readonly Point[]} Polygon
 * @typedef {{
 *   readonly x: number,
 *   readonly y: number,
 *   readonly width: number,
 *   readonly height: number
 * }} Bounds
 * @typedef {{
 *   readonly columns: number,
 *   readonly rows: number,
 *   readonly cellSize: number,
 *   isWalkable(cell: GridCell): boolean,
 *   worldToCell(point: Point): GridCell,
 *   cellToWorld(cell: GridCell): Point,
 *   findPath(start: Point, target: Point): readonly Point[]
 * }} NavigationLike
 */

/** @param {Point} point @param {Point} start @param {Point} end */
function distanceToSegment(point, start, end) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) /
        lengthSquared,
    ),
  );
  return Math.hypot(
    point.x - (start.x + projection * deltaX),
    point.y - (start.y + projection * deltaY),
  );
}

/** @param {Point} point @param {Polygon} polygon */
export function pointInPolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const start = polygon[previous];
    const end = polygon[index];
    if (start === undefined || end === undefined) {
      continue;
    }
    if (distanceToSegment(point, start, end) <= EPSILON) {
      return true;
    }
    const crosses =
      start.y > point.y !== end.y > point.y &&
      point.x <
        ((end.x - start.x) * (point.y - start.y)) /
          (end.y - start.y) +
          start.x;
    if (crosses) {
      inside = !inside;
    }
  }
  return inside;
}

/** @param {Point} point @param {Polygon} polygon @param {number} radius */
function diskIntersectsPolygon(point, polygon, radius) {
  if (pointInPolygon(point, polygon)) {
    return true;
  }
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    if (
      start !== undefined &&
      end !== undefined &&
      distanceToSegment(point, start, end) <= radius
    ) {
      return true;
    }
  }
  return false;
}

/**
 * @param {Point} point
 * @param {number} radius
 * @param {Bounds} bounds
 * @param {readonly Polygon[]} walkablePolygons
 * @param {readonly Polygon[]} collisionPolygons
 */
export function isWalkablePoint(
  point,
  radius,
  bounds,
  walkablePolygons,
  collisionPolygons,
) {
  if (
    point.x - radius < bounds.x ||
    point.y - radius < bounds.y ||
    point.x + radius > bounds.x + bounds.width ||
    point.y + radius > bounds.y + bounds.height
  ) {
    return false;
  }

  if (!walkablePolygons.some((polygon) => pointInPolygon(point, polygon))) {
    return false;
  }
  for (let index = 0; index < CLEARANCE_SAMPLES; index += 1) {
    const angle = (index / CLEARANCE_SAMPLES) * Math.PI * 2;
    const sample = {
      x: point.x + Math.cos(angle) * radius,
      y: point.y + Math.sin(angle) * radius,
    };
    if (!walkablePolygons.some((polygon) => pointInPolygon(sample, polygon))) {
      return false;
    }
  }

  return !collisionPolygons.some((polygon) =>
    diskIntersectsPolygon(point, polygon, radius),
  );
}

/**
 * @param {Point} start
 * @param {Point} end
 * @param {number} radius
 * @param {(point: Point) => boolean} isWalkable
 */
export function isWalkableSegment(start, end, radius, isWalkable) {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const steps = Math.max(1, Math.ceil(distance / Math.max(1, radius / 2)));
  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps;
    if (
      !isWalkable({
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress,
      })
    ) {
      return false;
    }
  }
  return true;
}

/**
 * @param {{
 *   readonly width: number,
 *   readonly height: number,
 *   readonly cellSize: number,
 *   readonly radius: number,
 *   readonly bounds: Bounds,
 *   readonly walkablePolygons: readonly Polygon[],
 *   readonly collisionPolygons: readonly Polygon[]
 * }} options
 * @returns {readonly GridCell[]}
 */
export function buildBlockedCells(options) {
  const columns = Math.ceil(options.width / options.cellSize);
  const rows = Math.ceil(options.height / options.cellSize);
  /** @type {GridCell[]} */
  const blocked = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const left = column * options.cellSize;
      const top = row * options.cellSize;
      const center = {
        x: (left + Math.min(left + options.cellSize, options.width)) / 2,
        y: (top + Math.min(top + options.cellSize, options.height)) / 2,
      };
      if (
        !isWalkablePoint(
          center,
          options.radius,
          options.bounds,
          options.walkablePolygons,
          options.collisionPolygons,
        )
      ) {
        blocked.push({ column, row });
      }
    }
  }
  return blocked;
}

/**
 * Rejects invalid pointer endpoints before NavigationGrid can relocate them.
 * @param {NavigationLike} navigation
 * @param {Point} start
 * @param {Point} target
 * @param {(point: Point) => boolean} isWalkable
 */
export function findWalkablePath(navigation, start, target, isWalkable) {
  if (
    !isWalkable(start) ||
    !isWalkable(target) ||
    !navigation.isWalkable(navigation.worldToCell(start)) ||
    !navigation.isWalkable(navigation.worldToCell(target))
  ) {
    return [];
  }
  return navigation.findPath(start, target);
}
