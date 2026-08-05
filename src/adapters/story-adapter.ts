import {
  assertValid,
  validateStoryBeat,
  type StoryBeat,
  type StoryTrigger,
} from "@sonic74129/content-schema";
import {
  StoryEngine,
  type StorySnapshot,
} from "@sonic74129/story-runtime";

import storyConfig from "../story/story.config.json" with { type: "json" };
import {
  STORY_BEATS,
  type CanonicalStoryBeat,
} from "./story-contracts.ts";

export const STORY_BEAT_IDS = Object.freeze(
  Array.from(
    { length: 19 },
    (_, index) => `b${String(index + 1).padStart(2, "0")}`,
  ),
);
export const SLICE_BEAT_IDS = Object.freeze(STORY_BEAT_IDS.slice(0, 7));

export const STORY_METADATA = Object.freeze({
  id: storyConfig.id,
  title: storyConfig.title,
  language: storyConfig.language,
  playerRole: Object.freeze({
    type: storyConfig.playerRole.type,
    hasDialogue: storyConfig.playerRole.hasDialogue,
    mayChangeScriptureOutcome:
      storyConfig.playerRole.mayChangeScriptureOutcome,
    mayControlJesus: storyConfig.playerRole.mayControlJesus,
    mayCauseMiracle: storyConfig.playerRole.mayCauseMiracle,
  }),
});

export interface SliceStoryState {
  readonly completedBeatIds: readonly string[];
  readonly lastEvent: string | null;
}

export type SliceStoryEvent =
  | Readonly<{ type: "event"; name: string }>
  | Readonly<{
      type: "proximity";
      actorId: string;
      targetId: string;
      distance: number;
    }>;

export class UnsupportedStoryBeatError extends Error {
  readonly code = "STORY_BEAT_OUTSIDE_CANONICAL_CONTRACT";
  readonly beatId: string;

  constructor(beatId: string) {
    super(`${beatId} is outside the canonical B01-B19 story contract.`);
    this.name = "UnsupportedStoryBeatError";
    this.beatId = beatId;
  }
}

export interface SliceBeatRunResult {
  readonly status: "completed" | "skipped" | "cancelled";
}

export interface SliceStoryControllerOptions {
  readonly engine?: StoryEngine<SliceStoryState, SliceStoryEvent>;
  readonly runBeat: (beat: CanonicalStoryBeat) => Promise<SliceBeatRunResult>;
  readonly onBeatSettled?: (
    beat: CanonicalStoryBeat,
    status: "completed" | "skipped",
  ) => void | Promise<void>;
}

export interface SliceDispatchResult {
  readonly advanced: boolean;
  readonly beatId?: string;
  readonly status?: SliceBeatRunResult["status"];
}

const STORY_BEAT_ID_SET = new Set<string>(STORY_BEAT_IDS);

function describeEvent(event: SliceStoryEvent): string {
  return event.type === "event"
    ? event.name
    : `proximity:${event.actorId}:${event.targetId}`;
}

export function matchesStoryTrigger(
  trigger: StoryTrigger | undefined,
  event: SliceStoryEvent,
): boolean {
  if (trigger?.type === "event") {
    return event.type === "event" && event.name === trigger.event;
  }
  if (trigger?.type === "proximity") {
    return (
      event.type === "proximity" &&
      event.actorId === trigger.actorId &&
      event.targetId === trigger.targetId &&
      event.distance <= trigger.radius
    );
  }
  return trigger?.type === "manual" && event.type === "event";
}

export function createStoryEngine(): StoryEngine<
  SliceStoryState,
  SliceStoryEvent
> {
  if (
    STORY_BEATS.length !== STORY_BEAT_IDS.length ||
    STORY_BEATS.some((beat, index) => beat.id !== STORY_BEAT_IDS[index])
  ) {
    throw new UnsupportedStoryBeatError(
      STORY_BEATS.find((beat, index) => beat.id !== STORY_BEAT_IDS[index])?.id ??
        `story-length:${STORY_BEATS.length}`,
    );
  }
  const runtimeBeats = STORY_BEATS.map(
    ({ id, verseIds, trigger, actions }) => ({
      id,
      verseIds,
      trigger,
      actions,
    }),
  );
  for (const beat of runtimeBeats) {
    assertValid<StoryBeat>(beat, validateStoryBeat);
  }

  return new StoryEngine<SliceStoryState, SliceStoryEvent>({
    definition: {
      initialState: {
        completedBeatIds: [],
        lastEvent: null,
      },
      beats: runtimeBeats,
    },
    matches: matchesStoryTrigger,
    reduce: (state, beat, event) => ({
      completedBeatIds: [...state.completedBeatIds, beat.id],
      lastEvent: describeEvent(event),
    }),
  });
}

export class SliceStoryController {
  readonly engine: StoryEngine<SliceStoryState, SliceStoryEvent>;
  readonly #runBeat: SliceStoryControllerOptions["runBeat"];
  readonly #onBeatSettled: SliceStoryControllerOptions["onBeatSettled"];
  #active:
    | Promise<SliceDispatchResult>
    | undefined;
  #disposed = false;

  constructor(options: SliceStoryControllerOptions) {
    this.engine = options.engine ?? createStoryEngine();
    this.#runBeat = options.runBeat;
    this.#onBeatSettled = options.onBeatSettled;
  }

  get running(): boolean {
    return this.#active !== undefined;
  }

  get storyComplete(): boolean {
    return this.engine.snapshot().completed;
  }

  get sliceComplete(): boolean {
    return this.engine.snapshot().state.completedBeatIds.includes("b07");
  }

  snapshot(): StorySnapshot<SliceStoryState> {
    return this.engine.snapshot();
  }

  restoreCompletedBeatIds(completedBeatIds: readonly string[]): void {
    if (this.#disposed) {
      throw new Error("Cannot restore a disposed story.");
    }
    if (this.#active !== undefined) {
      throw new Error("Cannot restore while a story beat is running.");
    }
    if (
      completedBeatIds.length > STORY_BEAT_IDS.length ||
      completedBeatIds.some((beatId, index) => beatId !== STORY_BEAT_IDS[index])
    ) {
      const unsupportedBeatId =
        completedBeatIds.find(
          (beatId, index) => beatId !== STORY_BEAT_IDS[index],
        ) ?? `story-length:${completedBeatIds.length}`;
      throw new UnsupportedStoryBeatError(unsupportedBeatId);
    }
    this.engine.restore({
      state: {
        completedBeatIds: [...completedBeatIds],
        lastEvent:
          completedBeatIds.length === 0
            ? null
            : `restore:${completedBeatIds.at(-1)}`,
      },
      nextBeatIndex: completedBeatIds.length,
      completed: completedBeatIds.length === STORY_BEAT_IDS.length,
      revision: completedBeatIds.length,
    });
  }

  dispatch(event: SliceStoryEvent): Promise<SliceDispatchResult> {
    if (this.#disposed) {
      return Promise.reject(new Error("Cannot advance a disposed story."));
    }
    if (this.#active !== undefined) {
      return Promise.resolve({ advanced: false });
    }

    const operation = this.#dispatch(event);
    this.#active = operation;
    return operation.finally(() => {
      if (this.#active === operation) {
        this.#active = undefined;
      }
    });
  }

  async dispose(): Promise<void> {
    this.#disposed = true;
    await this.#active;
  }

  async waitForIdle(): Promise<void> {
    await this.#active;
  }

  async #dispatch(event: SliceStoryEvent): Promise<SliceDispatchResult> {
    const currentBeat = this.engine.currentBeat;
    if (
      currentBeat !== undefined &&
      !STORY_BEAT_ID_SET.has(currentBeat.id) &&
      matchesStoryTrigger(currentBeat.trigger, event)
    ) {
      throw new UnsupportedStoryBeatError(currentBeat.id);
    }

    const before = this.engine.snapshot();
    const result = this.engine.advance(event);
    if (!result.advanced || result.beat === undefined) {
      return { advanced: false };
    }

    const beat = STORY_BEATS[result.snapshot.nextBeatIndex - 1];
    if (beat === undefined || beat.id !== result.beat.id) {
      this.engine.restore(before);
      throw new Error(`Canonical beat lookup failed for ${result.beat.id}.`);
    }
    if (!STORY_BEAT_ID_SET.has(beat.id)) {
      this.engine.restore(before);
      throw new UnsupportedStoryBeatError(beat.id);
    }

    let sequenceResult: SliceBeatRunResult;
    try {
      sequenceResult = await this.#runBeat(beat);
    } catch (error) {
      this.engine.restore(before);
      throw error;
    }
    if (sequenceResult.status === "cancelled") {
      this.engine.restore(before);
      return {
        advanced: false,
        beatId: beat.id,
        status: "cancelled",
      };
    }

    await this.#onBeatSettled?.(beat, sequenceResult.status);
    return {
      advanced: true,
      beatId: beat.id,
      status: sequenceResult.status,
    };
  }
}
