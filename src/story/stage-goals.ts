const goal = (id, beatId, description) =>
  Object.freeze({
    id,
    beatId,
    description,
    requiredBeatIds: Object.freeze([beatId]),
    sourceLevel: "S2",
  });

export const STAGE_GOALS = Object.freeze([
  goal("goal-b01", "b01", "路旁"),
  goal("goal-b02", "b02", "路旁"),
  goal("goal-b03", "b03", "路旁"),
  goal("goal-b04", "b04", "路旁"),
  goal("goal-b05", "b05", "西羅亞"),
  goal("goal-b06", "b06", "鄰舍"),
  goal("goal-b07", "b07", "鄰舍"),
  goal("goal-b08", "b08", "鄰舍"),
  goal("goal-b09", "b09", "查問"),
  goal("goal-b10", "b10", "查問"),
  goal("goal-b11", "b11", "查問"),
  goal("goal-b12", "b12", "查問"),
  goal("goal-b13", "b13", "查問"),
  goal("goal-b14", "b14", "查問"),
  goal("goal-b15", "b15", "查問"),
  goal("goal-b16", "b16", "查問"),
  goal("goal-b17", "b17", "查問"),
  goal("goal-b18", "b18", "重遇"),
  goal("goal-b19", "b19", "重遇"),
]);

export const STAGE_GOAL_BY_BEAT = Object.freeze(
  Object.fromEntries(STAGE_GOALS.map((goal) => [goal.beatId, goal])),
);
