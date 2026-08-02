import Phaser from "phaser";

import { GrayboxScene } from "./adapters/graybox-scene.ts";
import {
  createPlatformRuntime,
  type PlatformRuntime,
} from "./adapters/sdk-platform.ts";
import { UnsupportedStoryBeatError } from "./adapters/story-adapter.ts";
import { createWorldRuntime } from "./adapters/world-adapter.ts";
import { createAppShell } from "./platform/app-shell.ts";
import {
  createPageLifecycleController,
  disposeRuntimeBeforeGame,
} from "./platform/page-lifecycle.js";
import {
  createStoryPersistence,
  StoryPersistenceError,
  type StoryPreferences,
  type StorySaveLoadResult,
} from "./platform/story-persistence.ts";
import "./platform/styles.css";

const root = document.querySelector<HTMLElement>("#app");
if (root === null) {
  throw new Error("The application root is missing.");
}

let game: Phaser.Game | undefined;
let runtime: PlatformRuntime | undefined;
let starting = false;
let formalStoryStarted = false;

const persistence = createStoryPersistence(window.localStorage);
let initialSave: StorySaveLoadResult;
let initialPersistenceError: unknown;
try {
  initialSave = persistence.load();
} catch (error) {
  initialSave = { status: "none" };
  initialPersistenceError = error;
}
let preferences: StoryPreferences =
  initialSave.status === "ready"
    ? { ...initialSave.save.preferences }
    : { muted: false, subtitles: true };

const loadDeveloperFixture = async () => {
  if (!import.meta.env.DEV) {
    return null;
  }
  const fixtures = await import("./adapters/dev-b14-fixture.ts");
  return fixtures.resolveDeveloperFixture(window.location.search);
};

const reportError = (error: unknown): void => {
  console.error(error);
  shell.setStatus(
    error instanceof UnsupportedStoryBeatError
      ? "遇到正式 B01–B19 契約以外的故事節點，流程已安全停止。"
      : error instanceof StoryPersistenceError
        ? error.message
        : "平台運行失敗，請重新載入。",
    true,
  );
};

const shell = createAppShell(root, {
  onStart: (mode) => {
    if (starting) {
      return;
    }
    starting = true;
    try {
      const world = createWorldRuntime();
      const scene = new GrayboxScene(world, (readyScene) => {
        runtime = createPlatformRuntime(readyScene, shell, reportError, {
          onProgress: (completedBeatIds) => {
            if (!formalStoryStarted) {
              return;
            }
            try {
              persistence.save(completedBeatIds, preferences);
            } catch (error) {
              reportError(error);
            }
          },
        });
        const readyRuntime = runtime;
        Promise.all([readyRuntime.start(), loadDeveloperFixture()])
          .then(async ([, fixture]) => {
            await readyRuntime.unlockAudio();
            shell.setStarted();
            shell.setMuted(preferences.muted);
            shell.setSubtitles(preferences.subtitles);
            readyRuntime.setMuted(preferences.muted);
            shell.setDeveloperFixture(fixture?.id ?? null);
            if (fixture !== null) {
              await fixture.run(readyRuntime, shell);
              return;
            }
            if (mode === "continue" && initialSave.status === "ready") {
              await readyRuntime.restore(initialSave.save.completedBeatIds);
            } else {
              try {
                persistence.save([], preferences);
              } catch (error) {
                reportError(error);
              }
            }
            formalStoryStarted = true;
            readyRuntime.begin();
          })
          .catch(reportError);
      });
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: shell.gameContainer,
        width: 1280,
        height: 720,
        backgroundColor: "#83715d",
        scene,
        render: {
          antialias: true,
          pixelArt: false,
        },
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
      });
    } catch (error) {
      starting = false;
      reportError(error);
    }
  },
  onRestart: () => {
    try {
      runtime?.cancelCurrent();
      persistence.reset();
      window.location.reload();
    } catch (error) {
      reportError(error);
    }
  },
  onPauseChange: (paused) => {
    if (runtime === undefined) {
      return;
    }
    runtime.setPaused(paused);
    shell.setPaused(paused);
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
          runtime.story.snapshot().state.completedBeatIds,
          preferences,
        );
      } catch (error) {
        reportError(error);
      }
    }
  },
  onSubtitleChange: (subtitles) => {
    preferences = { ...preferences, subtitles };
    if (runtime !== undefined && formalStoryStarted) {
      try {
        persistence.save(
          runtime.story.snapshot().state.completedBeatIds,
          preferences,
        );
      } catch (error) {
        reportError(error);
      }
    }
  },
  onSkip: () => runtime?.skipCurrent(),
}, {
  hasSave: initialSave.status === "ready",
});

shell.setMuted(preferences.muted);
shell.setSubtitles(preferences.subtitles);
if (initialSave.status === "cleared") {
  shell.setStatus(initialSave.message, true);
} else if (initialPersistenceError !== undefined) {
  reportError(initialPersistenceError);
}

const pageLifecycle = createPageLifecycleController({
  suspend: () => runtime?.suspend("bfcache"),
  resume: () => runtime?.resume("bfcache"),
  dispose: async () => {
    const activeRuntime = runtime;
    const activeGame = game;
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
