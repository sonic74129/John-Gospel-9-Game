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

export const SLICE_BEAT_IDS = Object.freeze([
  "b01",
  "b02",
  "b03",
  "b04",
  "b05",
  "b06",
  "b07",
] as const);

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

export class UnsupportedSliceBeatError extends Error {
  readonly code = "STORY_BEAT_OUTSIDE_APPROVED_SLICE";
  readonly beatId: string;

  constructor(beatId: string) {
    super(
      `${beatId} is outside the approved B01-B07 production slice and remains unwired.`,
    );
    this.name = "UnsupportedSliceBeatError";
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

const SLICE_BEAT_ID_SET = new Set<string>(SLICE_BEAT_IDS);

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
  for (const beat of STORY_BEATS) {
    assertValid<StoryBeat>(beat, validateStoryBeat);
  }

  return new StoryEngine<SliceStoryState, SliceStoryEvent>({
    definition: {
      initialState: {
        completedBeatIds: [],
        lastEvent: null,
      },
      beats: STORY_BEATS,
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

  get sliceComplete(): boolean {
    return this.engine.snapshot().state.completedBeatIds.includes("b07");
  }

  snapshot(): StorySnapshot<SliceStoryState> {
    return this.engine.snapshot();
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

  async #dispatch(event: SliceStoryEvent): Promise<SliceDispatchResult> {
    const currentBeat = this.engine.currentBeat;
    if (
      currentBeat !== undefined &&
      !SLICE_BEAT_ID_SET.has(currentBeat.id) &&
      matchesStoryTrigger(currentBeat.trigger, event)
    ) {
      throw new UnsupportedSliceBeatError(currentBeat.id);
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
    if (!SLICE_BEAT_ID_SET.has(beat.id)) {
      this.engine.restore(before);
      throw new UnsupportedSliceBeatError(beat.id);
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
