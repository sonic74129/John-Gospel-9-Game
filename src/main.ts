import Phaser from "phaser";

import { StoryScene } from "./adapters/story-scene.ts";
import {
  createPlatformRuntime,
  type PlatformRuntime,
} from "./adapters/sdk-platform.ts";
import {
  STORY_BEAT_IDS,
  UnsupportedStoryBeatError,
} from "./adapters/story-adapter.ts";
import { createWorldRuntime } from "./adapters/world-adapter.ts";
import { createAppShell } from "./platform/app-shell.ts";
import {
  createPageLifecycleController,
  disposeRuntimeBeforeGame,
} from "./platform/page-lifecycle.js";
import {
  createResponsiveGameSizeController,
  requireGameViewport,
  type ResponsiveGameSizeController,
} from "./platform/responsive-game-size.ts";
import {
  createCommittedProgressTracker,
  createStoryPersistence,
  StoryPersistenceError,
  type StoryPreferences,
  type StorySaveLoadResult,
} from "./platform/story-persistence.ts";
import "./platform/styles.css";

const playtestRequest = import.meta.env.DEV
  ? await import("./platform/dev-playtest.ts").then(
      ({ parseDevPlaytestRequest }) =>
        parseDevPlaytestRequest(window.location.search, STORY_BEAT_IDS),
    )
  : null;

const root = document.querySelector<HTMLElement>("#app");
if (root === null) {
  throw new Error("The application root is missing.");
}

let game: Phaser.Game | undefined;
let runtime: PlatformRuntime | undefined;
let gameScene: StoryScene | undefined;
let gameSizeController: ResponsiveGameSizeController | undefined;
let starting = false;
let formalStoryStarted = false;
const UI_PAUSE_REASON = "ui-pause";

const persistence = createStoryPersistence(window.localStorage);
let initialSave: StorySaveLoadResult;
let initialPersistenceError: unknown;
try {
  initialSave = persistence.load();
} catch (error) {
  initialSave = { status: "none" };
  initialPersistenceError = error;
}
const loadedSave =
  initialSave.status === "ready" || initialSave.status === "progress-error"
    ? initialSave.save
    : null;
const committedProgress = createCommittedProgressTracker(
  playtestRequest?.completedBeatIds ?? loadedSave?.completedBeatIds,
);
let preferences: StoryPreferences =
  loadedSave !== null
    ? { ...loadedSave.preferences }
    : { muted: false, subtitles: true };

const reportError = (error: unknown): void => {
  console.error(error);
  const message =
    error instanceof UnsupportedStoryBeatError
      ? "故事進度發生錯誤，流程已安全停止。"
      : error instanceof StoryPersistenceError
        ? error.message
        : "平台運行失敗，請重新載入。";
  if (error instanceof StoryPersistenceError) {
    shell.setPersistenceWarning(message);
  }
  shell.setStatus(message, true);
};

const shell = createAppShell(root, {
  onStart: (mode) => {
    if (starting) {
      return;
    }
    starting = true;
    try {
      const world = createWorldRuntime();
      const scene = new StoryScene(world, (readyScene) => {
        readyScene.flushPendingViewportResize();
        runtime = createPlatformRuntime(readyScene, shell, reportError, {
          onProgress: (completedBeatIds) => {
            committedProgress.settle(completedBeatIds);
            if (!formalStoryStarted || playtestRequest !== null) {
              return;
            }
            try {
              persistence.save(completedBeatIds, preferences);
              shell.setPersistenceWarning(null);
            } catch (error) {
              reportError(error);
            }
          },
        });
        const readyRuntime = runtime;
        readyRuntime.start()
          .then(async () => {
            await readyRuntime.unlockAudio();
            shell.setStarted();
            shell.setMuted(preferences.muted);
            readyRuntime.setMuted(preferences.muted);
            if (playtestRequest !== null) {
              await readyRuntime.restore(playtestRequest.completedBeatIds);
            } else if (mode === "continue" && loadedSave !== null) {
              await readyRuntime.restore(loadedSave.completedBeatIds);
            } else {
              try {
                persistence.save([], preferences);
                shell.setPersistenceWarning(null);
              } catch (error) {
                reportError(error);
              }
            }
            formalStoryStarted = playtestRequest === null;
            readyRuntime.begin();
          })
          .catch(reportError);
      });
      gameScene = scene;
      const initialViewport = requireGameViewport(shell.gameContainer);
      const activeGame = new Phaser.Game({
        type: Phaser.AUTO,
        parent: shell.gameContainer,
        width: initialViewport.width,
        height: initialViewport.height,
        backgroundColor: "#ead9b7",
        scene,
        render: {
          antialias: true,
          pixelArt: false,
        },
        scale: {
          mode: Phaser.Scale.NONE,
        },
      });
      game = activeGame;
      gameSizeController = createResponsiveGameSizeController({
        container: shell.gameContainer,
        initialSize: initialViewport,
        resize: ({ width, height }) => {
          activeGame.scale.resize(width, height);
          scene.resizeViewport(width, height);
        },
      });
      gameSizeController.start();
    } catch (error) {
      gameSizeController?.dispose();
      gameSizeController = undefined;
      game?.destroy(true);
      game = undefined;
      gameScene = undefined;
      starting = false;
      reportError(error);
    }
  },
  onRestart: async () => {
    try {
      await runtime?.cancelAndSettleCurrent();
      persistence.reset();
      window.location.reload();
    } catch (error) {
      reportError(error);
      throw error;
    }
  },
  onPauseChange: async (paused) => {
    if (runtime === undefined) {
      return;
    }
    if (paused) {
      runtime.setPaused(true);
      shell.setPaused(true);
      try {
        await runtime.suspend(UI_PAUSE_REASON);
      } catch (error) {
        runtime.setPaused(false);
        shell.setPaused(false);
        reportError(error);
        throw error;
      }
      return;
    }
    try {
      await runtime.resume(UI_PAUSE_REASON);
      gameScene?.flushPendingViewportResize();
      runtime.setPaused(false);
      shell.setPaused(false);
    } catch (error) {
      reportError(error);
      throw error;
    }
  },
  onMuteChange: (muted) => {
    if (runtime === undefined) {
      return;
    }
    runtime.setMuted(muted);
    shell.setMuted(muted);
    preferences = { ...preferences, muted };
    if (formalStoryStarted) {
      try {
        persistence.save(
          committedProgress.snapshot(),
          preferences,
        );
        shell.setPersistenceWarning(null);
      } catch (error) {
        reportError(error);
      }
    }
  },
  onSkip: () => runtime?.skipCurrent(),
}, {
  hasSave: playtestRequest === null && loadedSave !== null,
});

shell.setMuted(preferences.muted);
if (initialSave.status === "cleared") {
  shell.setStatus(initialSave.message, true);
} else if (initialSave.status === "progress-error") {
  shell.setPersistenceWarning(initialSave.message);
  shell.setStatus(initialSave.message, true);
} else if (initialPersistenceError !== undefined) {
  reportError(initialPersistenceError);
}
if (playtestRequest !== null) {
  queueMicrotask(() => {
    root.querySelector<HTMLButtonElement>("[data-start]")?.click();
  });
}

const pageLifecycle = createPageLifecycleController({
  suspend: async () => {
    gameSizeController?.suspend();
    await runtime?.suspend("bfcache");
  },
  resume: async () => {
    await runtime?.resume("bfcache");
    gameSizeController?.resume();
    gameScene?.flushPendingViewportResize();
  },
  dispose: async () => {
    const activeRuntime = runtime;
    const activeGame = game;
    gameSizeController?.dispose();
    gameSizeController = undefined;
    gameScene = undefined;
    runtime = undefined;
    game = undefined;
    await disposeRuntimeBeforeGame(activeRuntime, activeGame);
  },
});

window.addEventListener("pagehide", (event) => {
  pageLifecycle.handlePageHide(event.persisted).catch(reportError);
});
window.addEventListener("pageshow", (event) => {
  pageLifecycle.handlePageShow(event.persisted).catch(reportError);
});
