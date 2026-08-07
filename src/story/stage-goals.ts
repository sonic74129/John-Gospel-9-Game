const goal = (id, beatId, description) =>
  Object.freeze({
    id,
    beatId,
    description,
    requiredBeatIds: Object.freeze([beatId]),
    sourceLevel: "S2",
  });

export const STAGE_GOALS = Object.freeze([
  goal("goal-b01", "b01", "留心觀看"),
  goal("goal-b02", "b02", "聆聽提問"),
  goal("goal-b03", "b03", "留心聆聽"),
  goal("goal-b04", "b04", "靜候觀看"),
  goal("goal-b05", "b05", "跟隨前行"),
  goal("goal-b06", "b06", "留心觀看"),
]);

export const STAGE_GOAL_BY_BEAT = Object.freeze(
  Object.fromEntries(STAGE_GOALS.map((goal) => [goal.beatId, goal])),
);
