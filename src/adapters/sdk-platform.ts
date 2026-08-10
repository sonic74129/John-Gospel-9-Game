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
  AppliedStoryFinalState,
  StoryScene,
} from "./story-scene.ts";
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
import {
  describeWorldNavigationObjective,
  resolveWorldNavigationObjective,
  worldNavigationEvent,
  type PlayerTraversal,
} from "./world-navigation.ts";
export interface AppliedPlatformFinalState {
  readonly finalState: SliceFinalState;
  readonly scene: AppliedStoryFinalState;
  readonly ui: SliceFinalState;
  readonly controls: SliceFinalState["controls"] &
    Readonly<{ inputLocked: boolean }>;
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
  cancelAndSettleCurrent(): Promise<void>;
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

export function createPlatformRuntime(
  scene: StoryScene,
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
  let overlayBlocking = false;
  let sequenceNavigationHint: string | null = null;
  let convergenceRequested = false;
  let paused = false;
  let syncNavigationObjective = (): void => {};
  const playerHintForObjective = (): string | null => {
    const objective = resolveWorldNavigationObjective(
      story.engine.currentBeat?.trigger,
      scene,
    );
    if (objective === null) {
      scene.setNavigationObjective(null);
      return null;
    }
    scene.setNavigationObjective(objective);
    if (objective.kind !== "arrival") {
      return null;
    }
    return describeWorldNavigationObjective(
      objective,
      scene.playerPosition(),
    );
  };
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
      resolveFinalStateMode: () =>
        convergenceRequested ? "converge" : "normal",
      ui: {
        setOverlay: (visible, blocking) => {
          ui.setOverlay(visible, blocking);
          shell.setOverlay(visible, blocking);
          overlayBlocking = visible && blocking === true;
          syncNavigationObjective();
        },
        setNavigationHint: (message) => {
          sequenceNavigationHint = message;
          shell.setNavigationHint(message);
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
      try {
        await options.onProgress?.(completedBeatIds);
      } finally {
        if (beat.id === STORY_BEAT_IDS.at(-1)) {
          shell.setCompleted();
        }
      }
    },
  });

  const sceneSystem: EngineSystem = {
    pause: (reason) => {
      scenePauseReasons.add(reason);
      syncNavigationObjective();
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
      syncNavigationObjective();
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

  syncNavigationObjective = (): void => {
    if (story.running && sequenceNavigationHint !== null) {
      shell.setNavigationHint(sequenceNavigationHint);
      return;
    }
    if (
      disposed ||
      paused ||
      scenePauseReasons.size > 0 ||
      story.running ||
      story.storyComplete ||
      overlayBlocking
    ) {
      scene.setNavigationObjective(null);
      shell.setNavigationHint(null);
      return;
    }
    try {
      shell.setNavigationHint(playerHintForObjective());
    } catch (error) {
      scene.setNavigationObjective(null);
      shell.setNavigationHint(null);
      onError(error);
    }
  };

  const dispatchAndContinue = async (
    firstEvent: SliceStoryEvent,
  ): Promise<void> => {
    let event: SliceStoryEvent | undefined = firstEvent;
    try {
      while (event !== undefined && !disposed) {
        const operation = story.dispatch(event);
        syncNavigationObjective();
        const result = await operation;
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
    } finally {
      syncNavigationObjective();
    }
  };

  const dispatch = (event: SliceStoryEvent): void => {
    dispatchAndContinue(event).catch(onError);
  };

  const evaluateWorldTrigger = (traversal?: PlayerTraversal): void => {
    syncNavigationObjective();
    if (disposed || !begun || story.running || paused) {
      return;
    }
    try {
      const currentPosition = scene.playerPosition();
      const event = worldNavigationEvent(
        story.engine.currentBeat?.trigger,
        traversal ?? {
          previousPosition: currentPosition,
          currentPosition,
        },
        scene,
      );
      if (event !== null) {
        dispatch(event);
      }
    } catch (error) {
      onError(error);
    }
  };

  scene.setInteractionHandlers({
    onWorldUpdate: (reason, traversal) => {
      if (reason === "gameplay") {
        evaluateWorldTrigger(traversal);
      }
    },
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
        syncNavigationObjective();
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
        syncNavigationObjective();
        return;
      }
      scene.setNavigationObjective(null);
      shell.setNavigationHint(null);
      const finalState = FINAL_SNAPSHOTS[lastBeatId];
      if (finalState === undefined) {
        throw new RangeError(
          `No canonical final snapshot exists for ${lastBeatId}.`,
        );
      }
      convergenceRequested = true;
      let result: SequenceResult;
      try {
        result = await runSequence({
          id: `restore-${lastBeatId}`,
          steps: [],
          finalState,
        });
      } finally {
        convergenceRequested = false;
      }
      if (result.status === "cancelled") {
        throw new Error("Canonical save restoration was cancelled.");
      }
      if (story.storyComplete) {
        shell.setCompleted();
      }
      syncNavigationObjective();
    },
    unlockAudio: () => music.unlock(),
    setPaused: (value) => {
      paused = value;
      ui.setPaused(value);
      syncNavigationObjective();
    },
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
    cancelAndSettleCurrent: async () => {
      sequence.cancel();
      const sequenceResults = await Promise.allSettled([
        ...activeSequenceRuns,
      ]);
      const sequenceFailure = sequenceResults.find(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      )?.reason;
      await story.waitForIdle();
      if (sequenceFailure !== undefined) {
        throw sequenceFailure;
      }
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
      syncNavigationObjective();
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
