import { MusicManager, VoiceManager } from "@sonic74129/audio-runtime";
import {
  EngineComposition,
  InputLock,
  type EngineSystem,
} from "@sonic74129/engine";
import {
  MapSequence,
  type SequenceDefinition,
  type SequenceResult,
} from "@sonic74129/sequence-runtime";
import { GameUIShell } from "@sonic74129/ui";

import type { AppShell } from "../platform/app-shell.ts";
import type {
  AppliedGrayboxFinalState,
  GrayboxScene,
} from "./graybox-scene.ts";
import { BrowserAudioFactory } from "./browser-audio.ts";
import {
  createSliceSequenceAdapter,
  type SliceFinalState,
} from "./sequence-adapter.ts";
import {
  SliceStoryController,
  STORY_BEAT_IDS,
  createStoryEngine,
  type SliceStoryEvent,
  type SliceStoryState,
} from "./story-adapter.ts";
import { FINAL_SNAPSHOTS } from "./story-contracts.ts";
export interface AppliedPlatformFinalState {
  readonly finalState: SliceFinalState;
  readonly scene: AppliedGrayboxFinalState;
  readonly ui: SliceFinalState;
  readonly controls: SliceFinalState["controls"] &
    Readonly<{ inputLocked: boolean }>;
  readonly testimony: SliceFinalState["testimony"];
  readonly triggers: SliceFinalState["triggers"];
  readonly music: Readonly<{
    requested: SliceFinalState["music"];
    actual: Readonly<{
      cueId: string | null;
      playing: boolean;
      ducked: boolean;
      status: "stopped" | "silent-unavailable";
    }>;
  }>;
  readonly sequenceStatus: "completed" | "skipped";
}

export interface PlatformRuntime {
  readonly mode: "story";
  readonly story: SliceStoryController;
  start(): Promise<void>;
  begin(): void;
  restore(completedBeatIds: readonly string[]): Promise<void>;
  unlockAudio(): Promise<void>;
  setPaused(paused: boolean): void;
  setMuted(muted: boolean): void;
  suspend(reason: string): Promise<void>;
  resume(reason: string): Promise<void>;
  skipCurrent(): void;
  cancelCurrent(): void;
  runSequence(
    definition: SequenceDefinition<SliceFinalState>,
  ): Promise<SequenceResult>;
  snapshotAppliedFinalState(): AppliedPlatformFinalState | null;
  dispose(): Promise<void>;
}

export interface PlatformRuntimeOptions {
  readonly onProgress?: (
    completedBeatIds: readonly string[],
  ) => void | Promise<void>;
}

const STORY_DISTANCE_UNIT_PIXELS = 96;
const ARRIVAL_RADIUS_PIXELS = 72;

function distance(
  left: Readonly<{ x: number; y: number }>,
  right: Readonly<{ x: number; y: number }>,
): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

export function createPlatformRuntime(
  scene: GrayboxScene,
  shell: AppShell,
  onError: (error: unknown) => void,
  options: PlatformRuntimeOptions = {},
): PlatformRuntime {
  const factory = new BrowserAudioFactory();
  const music = new MusicManager({ tracks: [], factory });
  const voice = new VoiceManager({ cues: [], factory });
  const input = new InputLock();
  const skipListeners = new Set<() => void>();
  const scenePauseReasons = new Set<string>();
  let logicalMusicState: AppliedPlatformFinalState["music"] = {
    requested: {
      cueId: "",
      playing: false,
      ducked: false,
    },
    actual: {
      cueId: null,
      playing: false,
      ducked: false,
      status: "stopped",
    },
  };
  const ui = new GameUIShell({
    labels: {
      pause: "暫停",
      resume: "繼續",
      mute: "靜音",
      unmute: "取消靜音",
      skip: "跳過目前演出",
    },
    onPauseChange: (paused) => {
      const operation = paused
        ? composition.lifecycle.pause("user")
        : composition.lifecycle.resume("user");
      operation.catch(onError);
    },
    onMuteChange: (muted) => {
      music.setMuted(muted);
      voice.setMuted(muted);
    },
    onSkip: () => {
      for (const listener of skipListeners) {
        listener();
      }
    },
  });

  const sequenceAdapter = createSliceSequenceAdapter(
    {
      scene,
      ui: {
        setOverlay: (visible, blocking) => {
          ui.setOverlay(visible, blocking);
          shell.setOverlay(visible, blocking);
        },
        presentDialogue: (...arguments_) =>
          shell.presentDialogue(...arguments_),
        applyFinalState: (...arguments_) =>
          shell.applyFinalState(...arguments_),
        setHandoff: (status) => shell.setHandoff(status),
      },
      applyLogicalFinalState: (state) => {
        music.setDuckMultiplier(state.music.ducked ? 0.35 : 1);
        if (!state.music.playing) {
          music.stop();
        }
        logicalMusicState = {
          requested: structuredClone(state.music),
          actual: {
            cueId: null,
            playing: false,
            ducked: false,
            status: state.music.playing
              ? "silent-unavailable"
              : "stopped",
          },
        };
      },
    },
    {
      subscribeSkip: (listener) => {
        skipListeners.add(listener);
        return () => skipListeners.delete(listener);
      },
      acquireInputLock: () => input.acquire(),
    },
  );
  const sequence = new MapSequence<SliceFinalState>(sequenceAdapter);
  const activeSequenceRuns = new Set<Promise<SequenceResult>>();
  let appliedFinalState: AppliedPlatformFinalState | null = null;
  let disposed = false;
  let begun = false;

  const captureAppliedFinalState = (
    finalState: SliceFinalState,
    status: "completed" | "skipped",
  ): void => {
    const sceneState = scene.snapshotAppliedFinalState();
    const uiState = shell.snapshotAppliedState();
    if (sceneState === null || uiState === null) {
      throw new Error("Canonical final state was not applied by every adapter.");
    }
    appliedFinalState = {
      finalState: structuredClone(finalState),
      scene: sceneState,
      ui: uiState,
      controls: {
        ...structuredClone(finalState.controls),
        inputLocked: input.locked,
      },
      testimony: structuredClone(finalState.testimony),
      triggers: structuredClone(finalState.triggers),
      music: structuredClone(logicalMusicState),
      sequenceStatus: status,
    };
  };

  const runSequence = (
    definition: SequenceDefinition<SliceFinalState>,
  ): Promise<SequenceResult> => {
    if (disposed) {
      return Promise.reject(new Error("Cannot run a disposed sequence runtime."));
    }
    const operation = sequence.run(definition);
    const trackedOperation = operation
      .then((result) => {
        if (result.status !== "cancelled") {
          captureAppliedFinalState(definition.finalState, result.status);
        }
        return result;
      })
      .finally(() => {
        activeSequenceRuns.delete(trackedOperation);
      });
    activeSequenceRuns.add(trackedOperation);
    return trackedOperation;
  };
  const storyEngine = createStoryEngine();
  const story = new SliceStoryController({
    engine: storyEngine,
    runBeat: async (beat) => {
      const sceneBefore = scene.captureRuntimeState();
      try {
        const result = await runSequence(
          beat.sequence as SequenceDefinition<SliceFinalState>,
        );
        if (result.status === "cancelled" && !scene.tearingDown) {
          scene.restoreRuntimeState(sceneBefore);
        }
        return result;
      } catch (error) {
        if (!scene.tearingDown) {
          scene.restoreRuntimeState(sceneBefore);
        }
        throw error;
      }
    },
    onBeatSettled: async (beat) => {
      const completedBeatIds = beat.finalState.triggers.completedBeatIds;
      await options.onProgress?.(completedBeatIds);
      if (beat.id === STORY_BEAT_IDS.at(-1)) {
        shell.setCompleted();
      }
    },
  });

  const sceneSystem: EngineSystem = {
    pause: (reason) => {
      scenePauseReasons.add(reason);
      if (scenePauseReasons.size === 1) {
        scene.game.scene.pause(scene.scene.key);
      }
      music.addPauseReason(reason);
      voice.addPauseReason(reason);
    },
    resume: async (reason) => {
      await Promise.all([
        music.removePauseReason(reason),
        voice.removePauseReason(reason),
      ]);
      scenePauseReasons.delete(reason);
      if (scenePauseReasons.size === 0) {
        scene.game.scene.resume(scene.scene.key);
      }
    },
  };
  const composition = new EngineComposition<
    SliceStoryState,
    SliceStoryEvent,
    SliceFinalState
  >({
    services: {
      story: storyEngine,
      navigation: scene.navigation,
      sequence,
      music,
      voice,
      ui,
      input,
    },
    systems: [sceneSystem],
  });

  const dispatchAndContinue = async (
    firstEvent: SliceStoryEvent,
  ): Promise<void> => {
    let event: SliceStoryEvent | undefined = firstEvent;
    while (event !== undefined && !disposed) {
      const result = await story.dispatch(event);
      if (!result.advanced || result.beatId === undefined) {
        return;
      }
      const nextBeat = story.engine.currentBeat;
      const expectedEvent = `beat:${result.beatId}:completed`;
      event =
        nextBeat?.trigger?.type === "event" &&
        nextBeat.trigger.event === expectedEvent
          ? { type: "event", name: expectedEvent }
          : undefined;
    }
  };

  const dispatch = (event: SliceStoryEvent): void => {
    dispatchAndContinue(event).catch(onError);
  };

  const evaluateWorldTrigger = (): void => {
    if (disposed || story.running) {
      return;
    }
    const trigger = story.engine.currentBeat?.trigger;
    if (trigger?.type === "proximity") {
      try {
        const actor =
          trigger.actorId === "observer"
            ? scene.playerPosition()
            : scene.storyActorPosition(trigger.actorId);
        const target = scene.storyActorPosition(trigger.targetId);
        dispatch({
          type: "proximity",
          actorId: trigger.actorId,
          targetId: trigger.targetId,
          distance: distance(actor, target) / STORY_DISTANCE_UNIT_PIXELS,
        });
      } catch (error) {
        onError(error);
      }
      return;
    }
    if (trigger?.type === "event" && trigger.event.startsWith("arrival:")) {
      const anchorId = trigger.event.slice("arrival:".length);
      try {
        if (
          distance(scene.playerPosition(), scene.anchorPosition(anchorId)) <=
          ARRIVAL_RADIUS_PIXELS
        ) {
          dispatch({ type: "event", name: trigger.event });
        }
      } catch (error) {
        onError(error);
      }
    }
  };

  scene.setInteractionHandlers({
    onWorldUpdate: evaluateWorldTrigger,
    onInteract: (storyActorId) => {
      dispatch({ type: "event", name: `interact:${storyActorId}` });
    },
  });

  return {
    mode: "story",
    story,
    start: () => composition.lifecycle.start(),
    begin: () => {
      if (begun || disposed) {
        return;
      }
      begun = true;
      const snapshot = story.snapshot();
      const completedBeatId = snapshot.state.completedBeatIds.at(-1);
      if (snapshot.completed) {
        shell.setCompleted();
        return;
      }
      if (completedBeatId === undefined) {
        dispatch({ type: "event", name: "story:start" });
        return;
      }
      const expectedEvent = `beat:${completedBeatId}:completed`;
      const nextBeat = story.engine.currentBeat;
      if (
        nextBeat?.trigger?.type === "event" &&
        nextBeat.trigger.event === expectedEvent
      ) {
        dispatch({ type: "event", name: expectedEvent });
        return;
      }
      evaluateWorldTrigger();
    },
    restore: async (completedBeatIds) => {
      if (disposed || begun) {
        throw new Error("Cannot restore after story progression has begun.");
      }
      story.restoreCompletedBeatIds(completedBeatIds);
      const lastBeatId = completedBeatIds.at(-1);
      if (lastBeatId === undefined) {
        return;
      }
      const finalState = FINAL_SNAPSHOTS[lastBeatId];
      if (finalState === undefined) {
        throw new RangeError(
          `No canonical final snapshot exists for ${lastBeatId}.`,
        );
      }
      const result = await runSequence({
        id: `restore-${lastBeatId}`,
        steps: [],
        finalState,
      });
      if (result.status === "cancelled") {
        throw new Error("Canonical save restoration was cancelled.");
      }
      if (story.storyComplete) {
        shell.setCompleted();
      }
    },
    unlockAudio: () => music.unlock(),
    setPaused: (paused) => ui.setPaused(paused),
    setMuted: (muted) => ui.setMuted(muted),
    suspend: (reason) => composition.lifecycle.pause(reason),
    resume: (reason) => composition.lifecycle.resume(reason),
    skipCurrent: () => {
      if (ui.snapshot().paused) {
        return;
      }
      for (const listener of skipListeners) {
        listener();
      }
    },
    cancelCurrent: () => {
      sequence.cancel();
    },
    runSequence,
    snapshotAppliedFinalState: () =>
      appliedFinalState === null
        ? null
        : structuredClone(appliedFinalState),
    dispose: async () => {
      if (disposed) {
        return;
      }
      disposed = true;
      scene.beginTeardown();
      sequence.cancel();
      let activeFailure: unknown;
      try {
        await story.dispose();
      } catch (error) {
        activeFailure = error;
      }
      const sequenceResults = await Promise.allSettled(activeSequenceRuns);
      activeFailure ??= sequenceResults.find(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      )?.reason;
      await composition.dispose();
      if (activeFailure !== undefined) {
        throw activeFailure;
      }
    },
  };
}
