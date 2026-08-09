export interface MovementPoint {
  readonly x: number;
  readonly y: number;
}

export interface FixedPointNavigation {
  readonly target: MovementPoint;
  readonly waypoints: readonly MovementPoint[];
}

export interface PlayerMovementTick {
  readonly position: MovementPoint;
  readonly moved: boolean;
  readonly navigation: FixedPointNavigation | null;
}

const clonePoint = ({ x, y }: MovementPoint): MovementPoint => ({ x, y });

export function beginFixedPointNavigation(
  target: MovementPoint,
  waypoints: readonly MovementPoint[],
): FixedPointNavigation {
  return Object.freeze({
    target: Object.freeze(clonePoint(target)),
    waypoints: Object.freeze(waypoints.map(clonePoint)),
  });
}

export function cancelNavigationForDirectionalInput(
  navigation: FixedPointNavigation | null,
  directionalInput: MovementPoint,
): FixedPointNavigation | null {
  return directionalInput.x === 0 && directionalInput.y === 0
    ? navigation
    : null;
}

export function resolvePlayerMovementTick({
  position,
  directionalInput,
  navigation,
  speed,
  deltaMs,
}: Readonly<{
  position: MovementPoint;
  directionalInput: MovementPoint;
  navigation: FixedPointNavigation | null;
  speed: number;
  deltaMs: number;
}>): PlayerMovementTick {
  const distance = (speed * deltaMs) / 1000;
  const directionLength = Math.hypot(directionalInput.x, directionalInput.y);
  if (directionLength > 0) {
    return {
      position: {
        x: position.x + (directionalInput.x / directionLength) * distance,
        y: position.y + (directionalInput.y / directionLength) * distance,
      },
      moved: distance > 0,
      navigation: null,
    };
  }

  const next = navigation?.waypoints[0];
  if (navigation === null || next === undefined) {
    return { position: clonePoint(position), moved: false, navigation };
  }
  const remaining = Math.hypot(next.x - position.x, next.y - position.y);
  if (remaining <= distance) {
    return {
      position: clonePoint(next),
      moved: remaining > 0,
      navigation: Object.freeze({
        target: navigation.target,
        waypoints: Object.freeze(navigation.waypoints.slice(1)),
      }),
    };
  }
  return {
    position: {
      x: position.x + ((next.x - position.x) / remaining) * distance,
      y: position.y + ((next.y - position.y) / remaining) * distance,
    },
    moved: distance > 0,
    navigation,
  };
}
