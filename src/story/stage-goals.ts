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
  goal("goal-b07", "b07", "查看四周"),
  goal("goal-b08", "b08", "聆聽回答"),
  goal("goal-b09", "b09", "跟隨眾人"),
  goal("goal-b10", "b10", "留心查問"),
  goal("goal-b11", "b11", "聆聽回答"),
  goal("goal-b12", "b12", "等候查證"),
  goal("goal-b13", "b13", "留心聆聽"),
  goal("goal-b14", "b14", "聆聽再問"),
  goal("goal-b15", "b15", "記住回答"),
  goal("goal-b16", "b16", "繼續聆聽"),
  goal("goal-b17", "b17", "留心眾人的話"),
  goal("goal-b18", "b18", "靜候結果"),
  goal("goal-b19", "b19", "跟隨前行"),
  goal("goal-b20", "b20", "留心聆聽"),
]);

export const STAGE_GOAL_BY_BEAT = Object.freeze(
  Object.fromEntries(STAGE_GOALS.map((goal) => [goal.beatId, goal])),
);
