const goal = (id, beatId, description) =>
  Object.freeze({
    id,
    beatId,
    description,
    requiredBeatIds: Object.freeze([beatId]),
    sourceLevel: "S2",
  });

export const STAGE_GOALS = Object.freeze([
  goal("goal-b01", "b01", "留心路旁"),
  goal("goal-b02", "b02", "靠近聆聽"),
  goal("goal-b03", "b03", "留心聆聽"),
  goal("goal-b04", "b04", "靜候觀看"),
  goal("goal-b05", "b05", "沿路前行"),
  goal("goal-b06", "b06", "查看四周"),
  goal("goal-b07", "b07", "聆聽回答"),
  goal("goal-b08", "b08", "跟隨眾人"),
  goal("goal-b09", "b09", "留心查問"),
  goal("goal-b10", "b10", "聆聽回答"),
  goal("goal-b11", "b11", "等候查證"),
  goal("goal-b12", "b12", "留心聆聽"),
  goal("goal-b13", "b13", "聆聽再問"),
  goal("goal-b14", "b14", "記住回答"),
  goal("goal-b15", "b15", "繼續聆聽"),
  goal("goal-b16", "b16", "留心眾人的話"),
  goal("goal-b17", "b17", "靜候結果"),
  goal("goal-b18", "b18", "跟隨前行"),
  goal("goal-b19", "b19", "留心聆聽"),
]);

export const STAGE_GOAL_BY_BEAT = Object.freeze(
  Object.fromEntries(STAGE_GOALS.map((goal) => [goal.beatId, goal])),
);
