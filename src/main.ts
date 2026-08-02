import Phaser from "phaser";

import { GrayboxScene } from "./adapters/graybox-scene.ts";
import {
  createPlatformRuntime,
  type PlatformRuntime,
} from "./adapters/sdk-platform.ts";
import { UnsupportedSliceBeatError } from "./adapters/story-adapter.ts";
import { createWorldRuntime } from "./adapters/world-adapter.ts";
import { createAppShell } from "./platform/app-shell.ts";
import {
  createPageLifecycleController,
  disposeRuntimeBeforeGame,
} from "./platform/page-lifecycle.js";
import "./platform/styles.css";

const root = document.querySelector<HTMLElement>("#app");
if (root === null) {
  throw new Error("The application root is missing.");
}

let game: Phaser.Game | undefined;
let runtime: PlatformRuntime | undefined;

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
    error instanceof UnsupportedSliceBeatError
      ? "B08–B19 尚未接線；B01–B07 切片已安全停止。"
      : "平台運行失敗，請重新載入。",
    true,
  );
};

const shell = createAppShell(root, {
  onStart: () => {
    try {
      const world = createWorldRuntime();
      const scene = new GrayboxScene(world, (readyScene) => {
        runtime = createPlatformRuntime(readyScene, shell, reportError);
        const readyRuntime = runtime;
        Promise.all([readyRuntime.start(), loadDeveloperFixture()])
          .then(async ([, fixture]) => {
            await readyRuntime.unlockAudio();
            shell.setStarted();
            shell.setDeveloperFixture(fixture?.id ?? null);
            if (fixture === null) {
              readyRuntime.begin();
            } else {
              await fixture.run(readyRuntime, shell);
            }
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
  },
  onSubtitleChange: () => {},
  onSkip: () => runtime?.skipCurrent(),
});

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
