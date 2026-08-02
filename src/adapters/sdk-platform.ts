import { MusicManager, VoiceManager } from "@sonic74129/audio-runtime";
import {
  EngineLifecycle,
  type EngineSystem,
} from "@sonic74129/engine";
import {
  MapSequence,
  type SequenceDefinition,
  type SequenceResult,
} from "@sonic74129/sequence-runtime";
import { GameUIShell } from "@sonic74129/ui";

import type { GrayboxScene } from "./graybox-scene.ts";
import { BrowserAudioFactory } from "./browser-audio.ts";
import { GRAYBOX_SHELL_MODE } from "./runtime-mode.js";
import { createGrayboxSequenceAdapter } from "./sequence-adapter.ts";
import {
  createGrayboxStoryRuntime,
  type GrayboxStoryRuntime,
} from "./story-adapter.ts";

type GrayboxFinalState = Readonly<Record<string, unknown>>;

export interface PlatformRuntime {
  readonly mode: typeof GRAYBOX_SHELL_MODE;
  readonly story: GrayboxStoryRuntime;
  start(): Promise<void>;
  unlockAudio(): Promise<void>;
  setPaused(paused: boolean): void;
  setMuted(muted: boolean): void;
  suspend(reason: string): Promise<void>;
  resume(reason: string): Promise<void>;
  runSequence(
    definition: SequenceDefinition<GrayboxFinalState>,
  ): Promise<SequenceResult>;
  dispose(): Promise<void>;
}

export function createPlatformRuntime(
  scene: GrayboxScene,
  onError: (error: unknown) => void,
): PlatformRuntime {
  const factory = new BrowserAudioFactory();
  const music = new MusicManager({ tracks: [], factory });
  const voice = new VoiceManager({ cues: [], factory });
  const story = createGrayboxStoryRuntime();
  const skipListeners = new Set<() => void>();
  const scenePauseReasons = new Set<string>();
  let lifecycle: EngineLifecycle | undefined;

  const ui = new GameUIShell({
    labels: {
      pause: "暫停",
      resume: "繼續",
      mute: "靜音",
      unmute: "取消靜音",
      skip: "跳過",
    },
    onPauseChange: (paused) => {
      const operation = paused
        ? lifecycle?.pause("user")
        : lifecycle?.resume("user");
      operation?.catch(onError);
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

  const sequenceAdapter = createGrayboxSequenceAdapter<
    Readonly<{ scene: GrayboxScene }>,
    GrayboxFinalState
  >(
    { scene },
    {
      setInputEnabled: (enabled, { scene: targetScene }) => {
        targetScene.input.enabled = enabled;
      },
      subscribeSkip: (listener) => {
        skipListeners.add(listener);
        return () => skipListeners.delete(listener);
      },
      isUiBlocking: () => ui.snapshot().interactionBlocked,
    },
  );
  const sequence = new MapSequence<GrayboxFinalState>(sequenceAdapter);

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
    dispose: () => {
      sequence.dispose();
      music.dispose();
      voice.dispose();
    },
  };
  lifecycle = new EngineLifecycle([sceneSystem]);

  return {
    mode: GRAYBOX_SHELL_MODE,
    story,
    start: () => lifecycle!.start(),
    unlockAudio: () => music.unlock(),
    setPaused: (paused) => ui.setPaused(paused),
    setMuted: (muted) => ui.setMuted(muted),
    suspend: (reason) => lifecycle!.pause(reason),
    resume: (reason) => lifecycle!.resume(reason),
    runSequence: (definition) => sequence.run(definition),
    dispose: () => lifecycle!.dispose(),
  };
}
