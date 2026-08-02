import Phaser from "phaser";

import { GrayboxScene } from "./adapters/graybox-scene.ts";
import {
  createPlatformRuntime,
  type PlatformRuntime,
} from "./adapters/sdk-platform.ts";
import { createWorldRuntime } from "./adapters/world-adapter.ts";
import { createAppShell } from "./platform/app-shell.ts";
import "./platform/styles.css";

const root = document.querySelector<HTMLElement>("#app");
if (root === null) {
  throw new Error("The application root is missing.");
}

let game: Phaser.Game | undefined;
let runtime: PlatformRuntime | undefined;

const reportError = (error: unknown): void => {
  console.error(error);
  shell.setStatus("平台啟動失敗，請重新載入。", true);
};

const shell = createAppShell(root, {
  onStart: () => {
    try {
      const world = createWorldRuntime();
      const scene = new GrayboxScene(world, (readyScene) => {
        runtime = createPlatformRuntime(readyScene, world, reportError);
        runtime
          .start()
          .then(() => runtime?.unlockAudio())
          .then(() => shell.setStarted())
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
});

window.addEventListener(
  "pagehide",
  () => {
    runtime?.dispose().catch(reportError);
    game?.destroy(true);
  },
  { once: true },
);
