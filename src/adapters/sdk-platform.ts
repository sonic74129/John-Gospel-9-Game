import { MusicManager, VoiceManager } from "@sonic74129/audio-runtime";
import {
  EngineComposition,
  InputLock,
  type EngineSystem,
} from "@sonic74129/engine";
import {
  MapSequence,
  PhaserSequenceAdapter,
} from "@sonic74129/sequence-runtime";
import { GameUIShell } from "@sonic74129/ui";

import type { GrayboxScene } from "./graybox-scene.ts";
import { BrowserAudioFactory } from "./browser-audio.ts";
import {
  createStoryRuntime,
  type PlatformStoryEvent,
  type PlatformStoryState,
} from "./story-adapter.ts";
import type { WorldRuntime } from "./world-adapter.ts";

type GrayboxFinalState = Readonly<Record<string, unknown>>;

export interface PlatformRuntime {
  start(): Promise<void>;
  unlockAudio(): Promise<void>;
  setPaused(paused: boolean): void;
  setMuted(muted: boolean): void;
  requestSkip(): boolean;
  dispose(): Promise<void>;
}

export function createPlatformRuntime(
  scene: GrayboxScene,
  world: WorldRuntime,
  onError: (error: unknown) => void,
): PlatformRuntime {
  const factory = new BrowserAudioFactory();
  const music = new MusicManager({ tracks: [], factory });
  const voice = new VoiceManager({ cues: [], factory });
  const input = new InputLock();
  const skipListeners = new Set<() => void>();
  let composition:
    | EngineComposition<
        PlatformStoryState,
        PlatformStoryEvent,
        GrayboxFinalState
      >
    | undefined;
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
        ? composition?.lifecycle.pause("user")
        : composition?.lifecycle.resume("user");
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
  const sequenceAdapter = new PhaserSequenceAdapter<
    Readonly<{ scene: GrayboxScene }>,
    GrayboxFinalState
  >({
    context: { scene },
    executeCommand: async () => {},
    applyFinalState: () => {},
    setInputEnabled: (enabled, { scene: targetScene }) => {
      targetScene.input.enabled = enabled;
    },
    subscribeSkip: (listener) => {
      skipListeners.add(listener);
      return () => skipListeners.delete(listener);
    },
    isUiBlocking: () => ui.snapshot().interactionBlocked,
  });
  const sequence = new MapSequence<GrayboxFinalState>(sequenceAdapter);

  const sceneSystem: EngineSystem = {
    pause: (reason) => {
      scene.game.scene.pause(scene.scene.key);
      music.addPauseReason(reason);
      voice.addPauseReason(reason);
    },
    resume: async (reason) => {
      scene.game.scene.resume(scene.scene.key);
      await Promise.all([
        music.removePauseReason(reason),
        voice.removePauseReason(reason),
      ]);
    },
    dispose: () => {
      sequence.dispose();
      music.dispose();
      voice.dispose();
    },
  };

  composition = new EngineComposition({
    services: {
      story: createStoryRuntime(),
      navigation: world.navigation,
      sequence,
      music,
      voice,
      ui,
      input,
    },
    systems: [sceneSystem],
  });

  return {
    start: () => composition!.lifecycle.start(),
    unlockAudio: () => music.unlock(),
    setPaused: (paused) => ui.setPaused(paused),
    setMuted: (muted) => ui.setMuted(muted),
    requestSkip: () => ui.requestSkip(),
    dispose: () => composition!.dispose(),
  };
}
