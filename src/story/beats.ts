import { FINAL_SNAPSHOTS } from "./completion.ts";
import { SEQUENCE_BY_BEAT } from "./sequences.ts";
import { STAGE_GOAL_BY_BEAT } from "./stage-goals.ts";

const BEAT_VERSES = Object.freeze([
  ["john9:1"],
  ["john9:2"],
  ["john9:3", "john9:4", "john9:5"],
  ["john9:6"],
  ["john9:7"],
  ["john9:7"],
]);

const TRIGGERS = Object.freeze([
  { type: "event", event: "story:start" },
  { type: "event", event: "beat:b01:completed" },
  { type: "event", event: "beat:b02:completed" },
  { type: "event", event: "beat:b03:completed" },
  { type: "event", event: "beat:b04:completed" },
  { type: "event", event: "arrival:pool.wash-edge" },
]);

const SUPPORTED_ACTIONS = Object.freeze(["move", "observe", "listen", "interact"]);

export const STORY_BEATS = Object.freeze(
  BEAT_VERSES.map((verseKeys, index) => {
    const order = index + 1;
    const beatId = `b${String(order).padStart(2, "0")}`;
    const previousBeatId = order === 1 ? null : `b${String(order - 1).padStart(2, "0")}`;
    const sequence = SEQUENCE_BY_BEAT[beatId];
    return Object.freeze({
      id: beatId,
      order,
      verseKeys: Object.freeze(verseKeys),
      verseIds: Object.freeze(verseKeys),
      sourceLevel: "scripture",
      contentLevel: "S1",
      stagingLevel: "S2",
      prerequisite: previousBeatId === null ? "story-start" : { beatCompleted: previousBeatId },
      trigger: Object.freeze(TRIGGERS[index]),
      supportedActions: SUPPORTED_ACTIONS,
      sequence,
      stageGoal: STAGE_GOAL_BY_BEAT[beatId],
      finalState: FINAL_SNAPSHOTS[beatId],
      handoff: order === 5 ? "manual" : order === 6 ? null : "automatic",
      actions: Object.freeze(
        sequence.steps
          .filter(({ kind }) => kind === "command")
          .map(({ command, payload, sourceLevel }) => ({
            type: command,
            payload,
            contentLevel: sourceLevel,
          })),
      ),
    });
  }),
);

export const STORY_BEAT_BY_ID = Object.freeze(
  Object.fromEntries(STORY_BEATS.map((beat) => [beat.id, beat])),
);
