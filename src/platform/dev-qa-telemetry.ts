import type { PlatformRuntime } from "../adapters/sdk-platform.ts";
import type { StoryScene } from "../adapters/story-scene.ts";

export function installDevQaTelemetry(
  scene: StoryScene,
  runtime: PlatformRuntime,
): void {
  Object.defineProperty(window, "__JOHN9_DEV_QA__", {
    configurable: true,
    value: Object.freeze({
      snapshot: () => ({
        player: scene.playerPosition(),
        currentBeatId: runtime.story.engine.currentBeat?.id ?? null,
        completedBeatIds: runtime.story.snapshot().state.completedBeatIds,
      }),
    }),
  });
}
