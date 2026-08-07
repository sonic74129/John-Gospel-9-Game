import appConfig from "../../app.config.json" with { type: "json" };

import { STORY_BEATS } from "../adapters/story-contracts.ts";

export const STORY_SAVE_KEY =
  "bible-games:save:john-9-man-born-blind:v1";
export const STORY_PROGRESS_KEY =
  "bible-games:progress:john-9-man-born-blind:v1";

const STORAGE_SCHEMA_VERSION = 1;
const STORY_BEAT_IDS = Object.freeze(STORY_BEATS.map(({ id }) => id));

export interface StoryPreferences {
  readonly muted: boolean;
  readonly subtitles: boolean;
}

export interface StorySave {
  readonly schemaVersion: 1;
  readonly storyId: string;
  readonly storyVersion: string;
  readonly completedBeatIds: readonly string[];
  readonly preferences: StoryPreferences;
  readonly lastPlayedAt: string;
}

export interface PublicStoryProgress {
  readonly schemaVersion: 1;
  readonly storyId: string;
  readonly storyVersion: string;
  readonly status: "not-started" | "in-progress" | "completed";
  readonly lastPlayedAt: string | null;
}

export type StorySaveLoadResult =
  | Readonly<{ status: "none" }>
  | Readonly<{ status: "ready"; save: StorySave }>
  | Readonly<{
      status: "progress-error";
      save: StorySave;
      message: string;
    }>
  | Readonly<{
      status: "cleared";
      reason: "malformed" | "incompatible";
      message: string;
    }>;

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class StoryPersistenceError extends Error {
  readonly code = "STORY_PERSISTENCE_FAILED";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "StoryPersistenceError";
  }
}

export function createCommittedProgressTracker(
  initialCompletedBeatIds: readonly string[] = [],
) {
  if (!hasCanonicalProgression(initialCompletedBeatIds)) {
    throw new StoryPersistenceError("拒絕追蹤非正式順序的故事進度。");
  }
  let committedBeatIds = [...initialCompletedBeatIds];
  return Object.freeze({
    settle(completedBeatIds: readonly string[]): void {
      if (!hasCanonicalProgression(completedBeatIds)) {
        throw new StoryPersistenceError("拒絕提交非正式順序的故事進度。");
      }
      committedBeatIds = [...completedBeatIds];
    },
    snapshot(): readonly string[] {
      return [...committedBeatIds];
    },
  });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasCanonicalProgression(
  completedBeatIds: unknown,
): completedBeatIds is string[] {
  return (
    Array.isArray(completedBeatIds) &&
    completedBeatIds.length <= STORY_BEAT_IDS.length &&
    completedBeatIds.every(
      (beatId, index) =>
        typeof beatId === "string" && beatId === STORY_BEAT_IDS[index],
    )
  );
}

function isStoryPreferences(value: unknown): value is StoryPreferences {
  return (
    isRecord(value) &&
    typeof value.muted === "boolean" &&
    typeof value.subtitles === "boolean"
  );
}

function parseSave(
  value: unknown,
):
  | Readonly<{ status: "ready"; save: StorySave }>
  | Readonly<{ status: "malformed" | "incompatible" }> {
  if (
    !isRecord(value) ||
    typeof value.schemaVersion !== "number" ||
    typeof value.storyId !== "string" ||
    typeof value.storyVersion !== "string" ||
    !hasCanonicalProgression(value.completedBeatIds) ||
    !isStoryPreferences(value.preferences) ||
    typeof value.lastPlayedAt !== "string" ||
    Number.isNaN(Date.parse(value.lastPlayedAt))
  ) {
    return { status: "malformed" };
  }
  if (
    value.schemaVersion !== STORAGE_SCHEMA_VERSION ||
    value.storyId !== appConfig.id ||
    value.storyVersion !== appConfig.version
  ) {
    return { status: "incompatible" };
  }
  return {
    status: "ready",
    save: {
      schemaVersion: STORAGE_SCHEMA_VERSION,
      storyId: value.storyId,
      storyVersion: value.storyVersion,
      completedBeatIds: [...value.completedBeatIds],
      preferences: { ...value.preferences },
      lastPlayedAt: value.lastPlayedAt,
    },
  };
}

function progressFor(
  status: PublicStoryProgress["status"],
  lastPlayedAt: string | null,
): PublicStoryProgress {
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    storyId: appConfig.id,
    storyVersion: appConfig.version,
    status,
    lastPlayedAt,
  };
}

export function createStoryPersistence(
  storage: StoragePort,
  now: () => Date = () => new Date(),
) {
  const writeProgress = (progress: PublicStoryProgress): void => {
    storage.setItem(STORY_PROGRESS_KEY, JSON.stringify(progress));
  };

  const clearInvalidSave = (
    reason: "malformed" | "incompatible",
  ): StorySaveLoadResult => {
    storage.removeItem(STORY_SAVE_KEY);
    writeProgress(progressFor("not-started", null));
    return {
      status: "cleared",
      reason,
      message:
        reason === "incompatible"
          ? "舊存檔版本不相容，已安全清除；故事尚未開始。"
          : "存檔格式無效，已安全清除；故事尚未開始。",
    };
  };

  return Object.freeze({
    load(): StorySaveLoadResult {
      let serialized: string | null;
      try {
        serialized = storage.getItem(STORY_SAVE_KEY);
      } catch (error) {
        throw new StoryPersistenceError("無法讀取本機故事存檔。", {
          cause: error,
        });
      }
      if (serialized === null) {
        try {
          writeProgress(progressFor("not-started", null));
          return { status: "none" };
        } catch (error) {
          throw new StoryPersistenceError("無法初始化公開故事進度。", {
            cause: error,
          });
        }
      }
      let value: unknown;
      try {
        value = JSON.parse(serialized);
      } catch {
        try {
          return clearInvalidSave("malformed");
        } catch (error) {
          throw new StoryPersistenceError("無法清除損壞的本機故事存檔。", {
            cause: error,
          });
        }
      }
      const parsed = parseSave(value);
      if (parsed.status !== "ready") {
        try {
          return clearInvalidSave(parsed.status);
        } catch (error) {
          throw new StoryPersistenceError("無法清除不相容的本機故事存檔。", {
            cause: error,
          });
        }
      }
      const status =
        parsed.save.completedBeatIds.length === STORY_BEAT_IDS.length
          ? "completed"
          : "in-progress";
      try {
        writeProgress(progressFor(status, parsed.save.lastPlayedAt));
        return parsed;
      } catch {
        return {
          status: "progress-error",
          save: parsed.save,
          message:
            "本機故事存檔有效，但公開進度同步失敗；尚未宣告公開完成狀態。",
        };
      }
    },

    save(
      completedBeatIds: readonly string[],
      preferences: StoryPreferences,
    ): StorySave {
      if (!hasCanonicalProgression(completedBeatIds)) {
        throw new StoryPersistenceError("拒絕寫入非正式順序的故事進度。");
      }
      const lastPlayedAt = now().toISOString();
      const save: StorySave = {
        schemaVersion: STORAGE_SCHEMA_VERSION,
        storyId: appConfig.id,
        storyVersion: appConfig.version,
        completedBeatIds: [...completedBeatIds],
        preferences: { ...preferences },
        lastPlayedAt,
      };
      const status =
        completedBeatIds.length === STORY_BEAT_IDS.length
          ? "completed"
          : "in-progress";
      try {
        storage.setItem(STORY_SAVE_KEY, JSON.stringify(save));
        writeProgress(progressFor(status, lastPlayedAt));
      } catch (error) {
        throw new StoryPersistenceError("無法儲存本機故事進度。", {
          cause: error,
        });
      }
      return save;
    },

    reset(): void {
      try {
        storage.removeItem(STORY_SAVE_KEY);
        writeProgress(progressFor("not-started", null));
      } catch (error) {
        throw new StoryPersistenceError("無法重設本機故事進度。", {
          cause: error,
        });
      }
    },
  });
}
