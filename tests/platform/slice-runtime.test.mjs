import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { MapSequence } from "@sonic74129/sequence-runtime";

import {
  SliceStoryController,
  UnsupportedSliceBeatError,
} from "../../src/adapters/story-adapter.ts";
import { STORY_ACTOR_SPAWN_IDS } from "../../src/adapters/story-actor-mapping.ts";
import {
  ACTORS,
  DIALOGUE_BY_BEAT,
  FINAL_SNAPSHOTS,
  PROPS,
  RECALL_BY_AFTER_BEAT,
  STORY_BEATS,
  TESTIMONY,
} from "../../src/adapters/story-contracts.ts";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const readText = (path) => readFile(path, "utf8");
const sliceBeats = STORY_BEATS.slice(0, 7);

const progressionEvents = [
  { type: "event", name: "story:start" },
  {
    type: "proximity",
    actorId: "observer",
    targetId: "disciples",
    distance: 1,
  },
  { type: "event", name: "beat:b02:completed" },
  { type: "event", name: "beat:b03:completed" },
  { type: "event", name: "arrival:pool.wash-edge" },
  { type: "event", name: "arrival:neighbors.center" },
  {
    type: "proximity",
    actorId: "observer",
    targetId: "man-born-blind",
    distance: 1,
  },
];

test("StoryEngine advances B01-B07 in canonical trigger order", async () => {
  const executed = [];
  const controller = new SliceStoryController({
    runBeat: async (beat) => {
      executed.push(beat.id);
      return { status: "completed" };
    },
  });

  for (const event of progressionEvents) {
    assert.equal((await controller.dispatch(event)).advanced, true);
  }
  assert.deepEqual(executed, [
    "b01",
    "b02",
    "b03",
    "b04",
    "b05",
    "b06",
    "b07",
  ]);
  assert.deepEqual(controller.snapshot().state.completedBeatIds, executed);
  assert.equal(controller.sliceComplete, true);
  assert.equal(controller.snapshot().completed, false);
  assert.equal(controller.engine.currentBeat?.id, "b08");
});

test("each B01-B07 normal and skip run applies the same canonical final state", async () => {
  for (const beat of sliceBeats) {
    const completedHost = createSequenceHost("completed");
    const completedSequence = new MapSequence(completedHost.host);
    const completed = await completedSequence.run(beat.sequence);

    const skippedHost = createSequenceHost("skipped");
    const skippedSequence = new MapSequence(skippedHost.host);
    const skippedPromise = skippedSequence.run(beat.sequence);
    await Promise.resolve();
    skippedSequence.skip();
    const skipped = await skippedPromise;

    assert.equal(completed.status, "completed", beat.id);
    assert.equal(skipped.status, "skipped", beat.id);
    assert.deepEqual(completedHost.finalStates, [beat.finalState], beat.id);
    assert.deepEqual(skippedHost.finalStates, [beat.finalState], beat.id);
    assert.deepEqual(
      completedHost.finalStates,
      skippedHost.finalStates,
      beat.id,
    );
    assert.deepEqual(completedHost.handoffs, ["completed"], beat.id);
    assert.deepEqual(skippedHost.handoffs, ["skipped"], beat.id);
    assert.equal(completedHost.inputLocks, 0, beat.id);
    assert.equal(skippedHost.inputLocks, 0, beat.id);
  }
  assert.deepEqual(
    FINAL_SNAPSHOTS.b07,
    sliceBeats.at(-1).finalState,
  );
});

test("cancellation rolls back StoryEngine and prevents reentry or stale handoff", async () => {
  let settle;
  let nextStatus = "cancelled";
  const handoffs = [];
  const controller = new SliceStoryController({
    runBeat: () =>
      new Promise((resolve) => {
        settle = () => resolve({ status: nextStatus });
      }),
    onBeatSettled: (beat) => handoffs.push(beat.id),
  });

  const first = controller.dispatch({ type: "event", name: "story:start" });
  assert.equal(controller.running, true);
  assert.deepEqual(
    await controller.dispatch({ type: "event", name: "story:start" }),
    { advanced: false },
  );
  settle();
  assert.deepEqual(await first, {
    advanced: false,
    beatId: "b01",
    status: "cancelled",
  });
  assert.deepEqual(controller.snapshot().state.completedBeatIds, []);
  assert.deepEqual(handoffs, []);

  nextStatus = "completed";
  const retry = controller.dispatch({ type: "event", name: "story:start" });
  settle();
  assert.equal((await retry).advanced, true);
  assert.deepEqual(handoffs, ["b01"]);
});

test("browser cancellation restores scene state and pause gates DOM progression", async () => {
  const [platform, scene, shell] = await Promise.all([
    readText("src/adapters/sdk-platform.ts"),
    readText("src/adapters/graybox-scene.ts"),
    readText("src/platform/app-shell.ts"),
  ]);
  assert.match(platform, /const sceneBefore = scene\.captureRuntimeState\(\)/);
  assert.match(
    platform,
    /result\.status === "cancelled"[\s\S]*scene\.restoreRuntimeState\(sceneBefore\)/,
  );
  assert.match(
    platform,
    /catch \(error\)[\s\S]*scene\.restoreRuntimeState\(sceneBefore\)/,
  );
  assert.match(scene, /restoreRuntimeState\(snapshot: GrayboxSceneSnapshot\)/);
  assert.match(scene, /this\.cameras\.main\.resetFX\(\)/);
  assert.match(platform, /if \(ui\.snapshot\(\)\.paused\)/);
  assert.match(shell, /dialogueNext\.disabled = value/);
  assert.match(shell, /skipButton\.disabled = value/);
});

test("MapSequence cancellation releases input and never finalizes or hands off", async () => {
  const fixture = createSequenceHost("cancelled");
  const sequence = new MapSequence(fixture.host);
  const running = sequence.run(sliceBeats[0].sequence);
  await Promise.resolve();
  assert.equal(fixture.inputLocks, 1);
  sequence.cancel();
  assert.deepEqual(await running, { status: "cancelled" });
  assert.equal(fixture.inputLocks, 0);
  assert.deepEqual(fixture.finalStates, []);
  assert.deepEqual(fixture.handoffs, []);
});

test("B07 recall is non-blocking, scoreless, and testimony-only", () => {
  const recall = RECALL_BY_AFTER_BEAT.b07;
  assert.ok(recall);
  assert.equal(recall.blocking, false);
  assert.equal(recall.requiredForProgress, false);
  assert.equal(recall.score, null);
  assert.deepEqual(recall.focusTestimonyIds, [
    "testimony-man-first-account",
    "testimony-man-whereabouts-unknown",
  ]);
  const b07TestimonyIds = TESTIMONY.filter(({ beatId }) => beatId === "b07").map(
    ({ id }) => id,
  );
  assert.deepEqual(recall.focusTestimonyIds, b07TestimonyIds);
  assert.deepEqual(FINAL_SNAPSHOTS.b07.triggers.optionalRecallIds, [
    "recall-after-b07",
  ]);
});

test("all adapter IDs resolve to canonical story and world contracts", async () => {
  const [anchors, paths, spawns] = await Promise.all([
    readJson("src/world/anchors.json"),
    readJson("src/world/paths.json"),
    readJson("src/world/spawns.json"),
  ]);
  const actorIds = new Set(ACTORS.map(({ id }) => id));
  const propIds = new Set(PROPS.map(({ id }) => id));
  const anchorIds = new Set(anchors.anchors.map(({ id }) => id));
  const pathIds = new Set(paths.sequencePaths.map(({ id }) => id));
  const spawnIds = new Set(spawns.actorSpawns.map(({ actorId }) => actorId));

  for (const [actorId, mappedSpawnIds] of Object.entries(
    STORY_ACTOR_SPAWN_IDS,
  )) {
    assert.equal(actorIds.has(actorId), true, actorId);
    for (const spawnId of mappedSpawnIds) {
      assert.equal(spawnIds.has(spawnId), true, spawnId);
    }
  }
  assert.deepEqual(
    new Set(Object.values(STORY_ACTOR_SPAWN_IDS).flat()),
    spawnIds,
  );

  for (const beat of sliceBeats) {
    assert.equal(DIALOGUE_BY_BEAT[beat.id] !== undefined || beat.id === "b01" || beat.id === "b05", true);
    for (const step of beat.sequence.steps) {
      if (step.kind !== "command") continue;
      const payload = step.payload ?? {};
      if ("anchorId" in payload) assert.equal(anchorIds.has(payload.anchorId), true);
      if ("actorId" in payload) assert.equal(actorIds.has(payload.actorId), true);
      if ("primaryActorId" in payload) assert.equal(actorIds.has(payload.primaryActorId), true);
      if ("pathId" in payload) assert.equal(pathIds.has(payload.pathId), true);
      if ("beatId" in payload) assert.equal(payload.beatId, beat.id);
    }
    for (const [actorId, state] of Object.entries(beat.finalState.actors)) {
      assert.equal(actorIds.has(actorId), true, actorId);
      assert.equal(anchorIds.has(state.anchorId), true, state.anchorId);
    }
    for (const propId of Object.keys(beat.finalState.props)) {
      assert.equal(propIds.has(propId), true, propId);
    }
  }
});

test("safe UI exposes only segment metadata and the licensing notice", async () => {
  const [shell, scripture] = await Promise.all([
    readText("src/platform/app-shell.ts"),
    readJson("src/story/scripture.json"),
  ]);
  assert.match(shell, /經文待授權／審核/);
  assert.match(shell, /line\.segmentId/);
  assert.match(shell, /line\.verseKey/);
  assert.match(shell, /line\.speakerId/);
  assert.match(shell, /line\.sourceLevel/);
  assert.doesNotMatch(shell, /line\.(?:text|exactText)/);
  for (const verse of scripture.verses) {
    assert.equal(verse.exactText, null);
  }
});

test("B14 stress fixture is explicit, isolated, and responsive", async () => {
  const [platform, shell, styles, framing] = await Promise.all([
    readText("src/adapters/sdk-platform.ts"),
    readText("src/platform/app-shell.ts"),
    readText("src/platform/styles.css"),
    readJson("src/world/framing.json"),
  ]);
  assert.match(platform, /fixtureMode === "b14-stress"/);
  assert.match(platform, /id: "developer-b14-stress"/);
  assert.match(platform, /present-b14-stress/);
  assert.match(platform, /正式故事進度未變/);
  assert.match(
    platform,
    /skipCurrent:[\s\S]*for \(const listener of skipListeners\)/,
  );
  assert.match(shell, /音樂狀態：silence/);
  assert.match(shell, /對話模式：blocking/);
  assert.match(shell, /data-stress-testimony/);
  assert.match(styles, /max-height:\s*calc\(100% - 5\.5rem\)/);
  assert.deepEqual(
    framing.profiles.map(({ viewport }) => viewport),
    [
      { width: 1280, height: 720 },
      { width: 390, height: 844 },
    ],
  );
});

test("candidate Jesus graybox uses the pinned sheet mapping and no candidate props", async () => {
  const [adapter, scene, pack, manifest] = await Promise.all([
    readText("src/adapters/candidate-asset-adapter.ts"),
    readText("src/adapters/graybox-scene.ts"),
    readJson(
      ".foundation/assets/packs/identity-jesus-storybook/0.1.0/pack.json",
    ),
    readJson(
      ".foundation/assets/packs/identity-jesus-storybook/0.1.0/manifest.json",
    ),
  ]);
  const sheet = pack.assets.find(({ id }) => id === "character-sheet");
  const runtime = manifest.files.find(({ path }) => path === sheet.runtime);
  assert.equal(pack.status, "candidate");
  assert.equal(pack.releaseEligible, false);
  assert.equal(runtime.width, sheet.runtimeMapping.sheetWidth);
  assert.equal(runtime.height, sheet.runtimeMapping.sheetHeight);
  assert.match(adapter, /characterSheet\.runtimeMapping\.cellWidth/);
  assert.match(adapter, /characterSheet\.runtimeMapping\.cellHeight/);
  assert.match(scene, /候選身分灰盒/);
  assert.doesNotMatch(scene, /household-props-atlas|world-ground-atlas/);
});

test("B08 production trigger fails clearly after the slice boundary", async () => {
  const controller = new SliceStoryController({
    runBeat: async () => ({ status: "completed" }),
  });
  for (const event of progressionEvents) {
    await controller.dispatch(event);
  }
  await assert.rejects(
    controller.dispatch({ type: "event", name: "interact:neighbors" }),
    (error) =>
      error instanceof UnsupportedSliceBeatError &&
      error.code === "STORY_BEAT_OUTSIDE_APPROVED_SLICE" &&
      error.beatId === "b08",
  );
  assert.equal(controller.snapshot().completed, false);
  assert.equal(controller.engine.currentBeat?.id, "b08");
});

function createSequenceHost(mode) {
  const fixture = {
    inputLocks: 0,
    finalStates: [],
    handoffs: [],
  };
  fixture.host = {
    execute: (_step, signal) => {
      if (mode === "completed") return Promise.resolve();
      return new Promise((resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          },
          { once: true },
        );
      });
    },
    applyFinalState: (state) => {
      fixture.finalStates.push(state);
    },
    handoff: (status) => {
      fixture.handoffs.push(status);
    },
    acquireInputLock: () => {
      fixture.inputLocks += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        fixture.inputLocks -= 1;
      };
    },
  };
  return fixture;
}
