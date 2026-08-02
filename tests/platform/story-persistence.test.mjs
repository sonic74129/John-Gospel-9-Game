import assert from "node:assert/strict";
import test from "node:test";

import { FINAL_SNAPSHOTS } from "../../src/adapters/story-contracts.ts";
import {
  STORY_PROGRESS_KEY,
  STORY_SAVE_KEY,
  createStoryPersistence,
} from "../../src/platform/story-persistence.ts";

const NOW = new Date("2026-08-03T04:00:00.000+08:00");

test("first load publishes not-started progress", () => {
  const storage = createStorage();
  const result = createStoryPersistence(storage, () => NOW).load();
  assert.deepEqual(result, { status: "none" });
  assert.equal(
    JSON.parse(storage.getItem(STORY_PROGRESS_KEY)).status,
    "not-started",
  );
});

test("save, reload, and continue retain only stable canonical progress and preferences", () => {
  const storage = createStorage();
  const persistence = createStoryPersistence(storage, () => NOW);
  const completedBeatIds = FINAL_SNAPSHOTS.b12.triggers.completedBeatIds;
  const saved = persistence.save(completedBeatIds, {
    muted: true,
    subtitles: false,
  });

  assert.deepEqual(Object.keys(saved).sort(), [
    "completedBeatIds",
    "lastPlayedAt",
    "preferences",
    "schemaVersion",
    "storyId",
    "storyVersion",
  ]);
  assert.equal(
    JSON.stringify(saved).includes("Phaser") ||
      JSON.stringify(saved).includes("timer"),
    false,
  );
  assert.deepEqual(persistence.load(), { status: "ready", save: saved });

});

test("completion writes the public completed progress namespace", () => {
  const storage = createStorage();
  const persistence = createStoryPersistence(storage, () => NOW);
  persistence.save(FINAL_SNAPSHOTS.b19.triggers.completedBeatIds, {
    muted: false,
    subtitles: true,
  });

  assert.deepEqual(JSON.parse(storage.getItem(STORY_PROGRESS_KEY)), {
    schemaVersion: 1,
    storyId: "john-9-man-born-blind",
    storyVersion: "0.1.0",
    status: "completed",
    lastPlayedAt: NOW.toISOString(),
  });
});

test("malformed and version-mismatched saves are visibly rejected and cleared", () => {
  for (const [serialized, expectedReason] of [
    ["{broken", "malformed"],
    [
      JSON.stringify({
        schemaVersion: 2,
        storyId: "john-9-man-born-blind",
        storyVersion: "0.1.0",
        completedBeatIds: ["b01"],
        preferences: { muted: false, subtitles: true },
        lastPlayedAt: NOW.toISOString(),
      }),
      "incompatible",
    ],
    [
      JSON.stringify({
        schemaVersion: 1,
        storyId: "john-9-man-born-blind",
        storyVersion: "9.9.9",
        completedBeatIds: ["b01"],
        preferences: { muted: false, subtitles: true },
        lastPlayedAt: NOW.toISOString(),
      }),
      "incompatible",
    ],
  ]) {
    const storage = createStorage([[STORY_SAVE_KEY, serialized]]);
    const result = createStoryPersistence(storage, () => NOW).load();
    assert.equal(result.status, "cleared");
    assert.equal(result.reason, expectedReason);
    assert.match(result.message, /已安全清除/);
    assert.equal(storage.getItem(STORY_SAVE_KEY), null);
    assert.equal(
      JSON.parse(storage.getItem(STORY_PROGRESS_KEY)).status,
      "not-started",
    );
  }
});

test("restart clears the save and publishes not-started progress", () => {
  const storage = createStorage();
  const persistence = createStoryPersistence(storage, () => NOW);
  persistence.save(["b01", "b02"], {
    muted: false,
    subtitles: true,
  });
  persistence.reset();

  assert.equal(storage.getItem(STORY_SAVE_KEY), null);
  assert.deepEqual(JSON.parse(storage.getItem(STORY_PROGRESS_KEY)), {
    schemaVersion: 1,
    storyId: "john-9-man-born-blind",
    storyVersion: "0.1.0",
    status: "not-started",
    lastPlayedAt: null,
  });
});

function createStorage(entries = []) {
  const values = new Map(entries);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
