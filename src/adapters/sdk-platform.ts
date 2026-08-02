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
import type { GrayboxScene } from "./graybox-scene.ts";
import { BrowserAudioFactory } from "./browser-audio.ts";
import {
  createSliceSequenceAdapter,
  type SliceFinalState,
} from "./sequence-adapter.ts";
import {
  SliceStoryController,
  createStoryEngine,
  type SliceStoryEvent,
  type SliceStoryState,
} from "./story-adapter.ts";
import { FINAL_SNAPSHOTS } from "./story-contracts.ts";

export type DeveloperFixtureMode = "b14-stress" | null;

export interface PlatformRuntime {
  readonly mode: "story-slice";
  readonly story: SliceStoryController;
  readonly fixtureMode: DeveloperFixtureMode;
  start(): Promise<void>;
  begin(): void;
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
  dispose(): Promise<void>;
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
  fixtureMode: DeveloperFixtureMode,
  onError: (error: unknown) => void,
): PlatformRuntime {
  const factory = new BrowserAudioFactory();
  const music = new MusicManager({ tracks: [], factory });
  const voice = new VoiceManager({ cues: [], factory });
  const input = new InputLock();
  const skipListeners = new Set<() => void>();
  const scenePauseReasons = new Set<string>();
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
    { scene, ui: {
      setOverlay: (visible, blocking) => {
        ui.setOverlay(visible, blocking);
        shell.setOverlay(visible, blocking);
      },
      presentDialogue: (...arguments_) =>
        shell.presentDialogue(...arguments_),
      presentStressFixture: (...arguments_) =>
        shell.presentStressFixture(...arguments_),
      applyFinalState: (...arguments_) =>
        shell.applyFinalState(...arguments_),
      setHandoff: (status) => shell.setHandoff(status),
    }, fixtureMode: fixtureMode === "b14-stress" },
    {
      subscribeSkip: (listener) => {
        skipListeners.add(listener);
        return () => skipListeners.delete(listener);
      },
      acquireInputLock: () => input.acquire(),
    },
  );
  const sequence = new MapSequence<SliceFinalState>(sequenceAdapter);
  const storyEngine = createStoryEngine();
  const story = new SliceStoryController({
    engine: storyEngine,
    runBeat: async (beat) => {
      const sceneBefore = scene.captureRuntimeState();
      try {
        const result = await sequence.run(
          beat.sequence as SequenceDefinition<SliceFinalState>,
        );
        if (result.status === "cancelled") {
          scene.restoreRuntimeState(sceneBefore);
        }
        return result;
      } catch (error) {
        scene.restoreRuntimeState(sceneBefore);
        throw error;
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

  let disposed = false;
  let begun = false;

  const dispatchAndContinue = async (
    firstEvent: SliceStoryEvent,
  ): Promise<void> => {
    let event: SliceStoryEvent | undefined = firstEvent;
    while (event !== undefined && !disposed) {
      const result = await story.dispatch(event);
      if (!result.advanced || result.beatId === undefined) {
        return;
      }
      if (result.beatId === "b07") {
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
    if (disposed || story.running || fixtureMode !== null) {
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

  const runStressFixture = async (): Promise<void> => {
    const finalState = FINAL_SNAPSHOTS.b14;
    if (finalState === undefined) {
      throw new Error("Canonical B14 final state is missing.");
    }
    const result = await sequence.run({
      id: "developer-b14-stress",
      steps: [
        {
          kind: "command",
          command: "present-b14-stress",
          payload: { fixtureId: "b14-stress" },
        },
      ],
      finalState,
    });
    shell.setStatus(
      `DEV B14 壓力測試已${result.status === "skipped" ? "跳過" : "完成"}；正式故事進度未變`,
    );
  };

  return {
    mode: "story-slice",
    story,
    fixtureMode,
    start: () => composition.lifecycle.start(),
    begin: () => {
      if (begun || disposed) {
        return;
      }
      begun = true;
      if (fixtureMode === "b14-stress") {
        runStressFixture().catch(onError);
      } else {
        dispatch({ type: "event", name: "story:start" });
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
    runSequence: (definition) => sequence.run(definition),
    dispose: async () => {
      if (disposed) {
        return;
      }
      disposed = true;
      story.dispose();
      await composition.dispose();
    },
  };
}
