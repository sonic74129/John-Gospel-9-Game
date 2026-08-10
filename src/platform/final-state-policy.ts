export const NORMAL_FINAL_STATE_POSITION_EPSILON = 1;

export type FinalStateApplicationMode = "normal" | "converge";

export interface VisualFinalState {
  readonly x: number;
  readonly y: number;
  readonly visible: boolean;
}

export function assertNormalFinalStateVisualDelta(
  before: Readonly<Record<string, VisualFinalState>>,
  expected: Readonly<Record<string, VisualFinalState>>,
): void {
  for (const [actorId, expectedState] of Object.entries(expected)) {
    const beforeState = before[actorId];
    if (beforeState === undefined) {
      throw new Error(
        `${actorId} is missing before normal final-state validation.`,
      );
    }
    if (!beforeState.visible && expectedState.visible) {
      throw new Error(
        `${actorId} has an unsourced hidden-to-visible normal final-state delta.`,
      );
    }
    if (!beforeState.visible || !expectedState.visible) {
      continue;
    }
    const positionDelta = Math.hypot(
      expectedState.x - beforeState.x,
      expectedState.y - beforeState.y,
    );
    if (positionDelta > NORMAL_FINAL_STATE_POSITION_EPSILON) {
      throw new Error(
        `${actorId} normal final-state position delta ${positionDelta.toFixed(2)} exceeds ${NORMAL_FINAL_STATE_POSITION_EPSILON}.`,
      );
    }
  }
}
