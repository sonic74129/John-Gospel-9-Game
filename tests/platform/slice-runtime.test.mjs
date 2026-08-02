import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { MapSequence } from "@sonic74129/sequence-runtime";

import { applyCanonicalCameraFinalState } from "../../src/adapters/canonical-camera.ts";
import { createB14StressSequence } from "../../src/adapters/dev-b14-fixture.ts";
import { createSliceSequenceAdapter } from "../../src/adapters/sequence-adapter.ts";
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
const [anchorContract, cameraContract, layoutContract, spawnContract] =
  await Promise.all([
    readJson("src/world/anchors.json"),
    readJson("src/world/camera.json"),
    readJson("src/world/layout.json"),
    readJson("src/world/spawns.json"),
  ]);

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

test("real sequence adapter exposes deep-equal canonical and actual camera state", async () => {
  const definitions = [
    ...sliceBeats.map(({ sequence }) => sequence),
    createB14StressSequence(),
  ];
  for (const definition of definitions) {
    const completed = await runRealAdapter(definition, false);
    const skipped = await runRealAdapter(definition, true);
    assert.equal(completed.status, "completed", definition.id);
    assert.equal(skipped.status, "skipped", definition.id);
    assert.deepEqual(completed.applied, definition.finalState, definition.id);
    assert.deepEqual(skipped.applied, definition.finalState, definition.id);
    assert.deepEqual(completed.scene, skipped.scene, definition.id);
    assert.deepEqual(completed.ui, skipped.ui, definition.id);
    assert.deepEqual(completed.logical, skipped.logical, definition.id);
    assert.deepEqual(completed.scene, definition.finalState, definition.id);
    assert.deepEqual(completed.ui, definition.finalState, definition.id);
    assert.deepEqual(completed.logical, definition.finalState, definition.id);
    assert.deepEqual(completed.camera, skipped.camera, definition.id);
    assert.deepEqual(
      completed.camera.applied.canonical,
      definition.finalState.camera,
      definition.id,
    );
    assert.equal(
      completed.camera.applied.actual.mode,
      definition.finalState.camera.mode,
      definition.id,
    );
    assert.equal(
      completed.camera.applied.actual.followTargetActorId,
      definition.finalState.controls.playerActorId,
      definition.id,
    );
    const expectedCameraAnchor = anchorContract.anchors.find(
      ({ id }) => id === definition.finalState.camera.anchorId,
    );
    const expectedZone = cameraContract.cameraZones.find(
      ({ regionId }) => regionId === expectedCameraAnchor.regionId,
    );
    assert.deepEqual(
      completed.camera.applied.actual.focusPosition,
      expectedCameraAnchor.position,
      definition.id,
    );
    assert.equal(
      completed.camera.applied.actual.zoom,
      expectedZone.desktopZoom,
      definition.id,
    );
    assert.deepEqual(
      completed.camera.applied.actual.deadZone,
      expectedZone.deadZone,
      definition.id,
    );
    assert.equal(completed.camera.port.mode, "follow-observer", definition.id);
    assert.deepEqual(
      completed.camera.port.position,
      completed.camera.applied.actual.position,
      definition.id,
    );
    assert.deepEqual(
      completed.camera.port.followOffset,
      completed.camera.applied.actual.followOffset,
      definition.id,
    );
    assert.equal(
      completed.camera.port.zoom,
      expectedZone.desktopZoom,
      definition.id,
    );
    assert.deepEqual(
      completed.camera.port.deadZone,
      expectedZone.deadZone,
      definition.id,
    );
    assert.ok(completed.camera.port.followTarget, definition.id);
    if (definition.finalState.beatId === "b01") {
      assert.notDeepEqual(
        completed.camera.applied.actual.position,
        completed.camera.applied.actual.focusPosition,
        "B01 exposes bounded viewport position separately from canonical focus",
      );
    }
    assert.equal(completed.inputLocks, 0, definition.id);
    assert.equal(skipped.inputLocks, 0, definition.id);
  }
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

test("story disposal waits for an active cancelled beat to settle", async () => {
  let settle;
  const controller = new SliceStoryController({
    runBeat: () =>
      new Promise((resolve) => {
        settle = () => resolve({ status: "cancelled" });
      }),
  });
  const active = controller.dispatch({ type: "event", name: "story:start" });
  let disposed = false;
  const disposal = controller.dispose().then(() => {
    disposed = true;
  });
  await Promise.resolve();
  assert.equal(disposed, false);
  settle();
  await Promise.all([active, disposal]);
  assert.equal(disposed, true);
  assert.deepEqual(controller.snapshot().state.completedBeatIds, []);
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
  assert.match(
    scene,
    /restoreRuntimeState\(snapshot: GrayboxSceneSnapshot\)[\s\S]*if \(this\.#tearingDown\)/,
  );
  assert.match(scene, /this\.cameras\.main\.resetFX\(\)/);
  assert.match(
    platform,
    /scene\.beginTeardown\(\);\s*sequence\.cancel\(\);[\s\S]*await story\.dispose\(\);[\s\S]*Promise\.allSettled\(activeSequenceRuns\)/,
  );
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

test("B14 stress fixture is DEV-only, lazy, and absent from production paths", async () => {
  const [main, platform, sequence, shell, fixture, checker, framing] =
    await Promise.all([
    readText("src/main.ts"),
    readText("src/adapters/sdk-platform.ts"),
    readText("src/adapters/sequence-adapter.ts"),
    readText("src/platform/app-shell.ts"),
    readText("src/adapters/dev-b14-fixture.ts"),
    readText("scripts/check-production-bundle.mjs"),
    readJson("src/world/framing.json"),
  ]);
  assert.match(main, /if \(!import\.meta\.env\.DEV\)/);
  assert.match(main, /import\("\.\/adapters\/dev-b14-fixture\.ts"\)/);
  for (const productionSource of [platform, sequence, shell]) {
    assert.doesNotMatch(productionSource, /b14-stress|DEV_ONLY_B14/);
  }
  assert.match(fixture, /const FIXTURE_ID = "b14-stress"/);
  assert.match(fixture, /JOHN9_DEV_ONLY_B14_STRESS/);
  assert.match(fixture, /command: "present-scripture-segments"/);
  assert.match(fixture, /音樂狀態：silence/);
  assert.match(fixture, /對話模式：blocking/);
  assert.match(fixture, /正式故事進度未變/);
  assert.match(checker, /JOHN9_DEV_ONLY_B14_STRESS/);
  assert.match(checker, /b14-stress/);
  assert.match(
    platform,
    /skipCurrent:[\s\S]*for \(const listener of skipListeners\)/,
  );
  assert.deepEqual(
    framing.profiles.map(({ viewport }) => viewport),
    [
      { width: 1280, height: 720 },
      { width: 390, height: 844 },
    ],
  );
});

test("scene applies and exposes every canonical final-state surface", async () => {
  const [scene, camera, platform] = await Promise.all([
    readText("src/adapters/graybox-scene.ts"),
    readText("src/adapters/canonical-camera.ts"),
    readText("src/adapters/sdk-platform.ts"),
  ]);
  for (const field of [
    "actorState.collisionEnabled",
    "state.props.clay.anchorId",
    "state.props.clay.state",
    "state.props.clay.collisionEnabled",
    "state.controls.playerActorId",
  ]) {
    assert.match(scene, new RegExp(field.replaceAll(".", "\\.")), field);
  }
  assert.match(scene, /applyCanonicalCameraFinalState\(/);
  assert.doesNotMatch(scene, /cameraFollowPending/);
  assert.match(camera, /canonical\.mode === "follow-observer"/);
  assert.match(camera, /camera\.startFollow\(/);
  assert.match(
    camera,
    /x:\s*playerTarget\.x - anchorPosition\.x[\s\S]*y:\s*playerTarget\.y - anchorPosition\.y/,
  );
  assert.match(
    camera,
    /focusPosition = \{\s*x:\s*playerTarget\.x - followOffset\.x,\s*y:\s*playerTarget\.y - followOffset\.y/s,
  );
  assert.match(camera, /x:\s*camera\.scrollX \+ camera\.width \/ 2/);
  assert.match(scene, /#canonicalControls = structuredClone\(state\.controls\)/);
  assert.match(platform, /testimony:\s*structuredClone\(finalState\.testimony\)/);
  assert.match(platform, /triggers:\s*structuredClone\(finalState\.triggers\)/);
  assert.match(platform, /status:\s*state\.music\.playing[\s\S]*"silent-unavailable"/);
  assert.match(platform, /inputLocked:\s*input\.locked/);
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

async function runRealAdapter(definition, skip) {
  let inputLocks = 0;
  let sceneState = null;
  let uiState = null;
  let logicalState = null;
  let cameraState = null;
  const adapter = createSliceSequenceAdapter(
    {
      scene: {
        setMovementEnabled: () => {},
        focusAnchor: () => {},
        setActorPose: () => {},
        setActorVisible: () => {},
        followActorPath: async () => {},
        followCameraPath: async () => {},
        applyFinalState: async (state) => {
          const camera = createFaithfulCameraPort();
          const cameraAnchor = requireById(
            anchorContract.anchors,
            state.camera.anchorId,
          );
          const zone = cameraContract.cameraZones.find(
            ({ regionId }) => regionId === cameraAnchor.regionId,
          );
          assert.ok(zone);
          const playerActor = state.actors[state.controls.playerActorId];
          assert.ok(playerActor);
          const playerAnchor = requireById(
            anchorContract.anchors,
            playerActor.anchorId,
          );
          const playerSpawnId =
            STORY_ACTOR_SPAWN_IDS[state.controls.playerActorId]?.[0];
          const playerSpawn = spawnContract.actorSpawns.find(
            ({ actorId }) => actorId === playerSpawnId,
          );
          assert.ok(playerSpawn);
          const initialAnchor = requireById(
            anchorContract.anchors,
            playerSpawn.anchorId,
          );
          const playerTarget = {
            x:
              playerAnchor.position.x +
              playerSpawn.position.x -
              initialAnchor.position.x,
            y:
              playerAnchor.position.y +
              playerSpawn.position.y -
              initialAnchor.position.y,
          };
          const applied = applyCanonicalCameraFinalState({
            camera: camera.port,
            canonical: state.camera,
            zone,
            anchorPosition: cameraAnchor.position,
            playerActorId: state.controls.playerActorId,
            playerTarget,
            worldWidth: layoutContract.worldBounds.width,
            worldHeight: layoutContract.worldBounds.height,
            mobile: false,
          });
          sceneState = structuredClone(state);
          cameraState = {
            applied,
            port: camera.snapshot(),
          };
        },
      },
      ui: {
        setOverlay: () => {},
        presentDialogue: async () => {},
        applyFinalState: (state) => {
          uiState = structuredClone(state);
        },
        setHandoff: () => {},
      },
      applyLogicalFinalState: (state) => {
        logicalState = structuredClone(state);
      },
    },
    {
      subscribeSkip: () => () => {},
      acquireInputLock: () => {
        inputLocks += 1;
        return () => {
          inputLocks -= 1;
        };
      },
    },
  );
  const sequence = new MapSequence(adapter);
  const running = sequence.run(definition);
  if (skip) {
    sequence.skip();
  }
  const result = await running;
  return {
    status: result.status,
    applied: sceneState,
    scene: sceneState,
    ui: uiState,
    logical: logicalState,
    camera: cameraState,
    inputLocks,
  };
}

function requireById(values, id) {
  const value = values.find((entry) => entry.id === id);
  assert.ok(value, id);
  return value;
}

function createFaithfulCameraPort() {
  const viewport = { width: 1280, height: 720 };
  const state = {
    mode: "fixed",
    position: { x: 0, y: 0 },
    zoom: 1,
    deadZone: { width: 0, height: 0 },
    followTarget: null,
    followOffset: { x: 0, y: 0 },
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    scrollX: 0,
    scrollY: 0,
  };
  const clampScroll = (value, axis) => {
    const size = axis === "x" ? viewport.width : viewport.height;
    const zoomedSize = size / state.zoom;
    const start =
      state.bounds[axis] + (zoomedSize - size) / 2;
    const length = axis === "x" ? state.bounds.width : state.bounds.height;
    const end = Math.max(start, start + length - zoomedSize);
    return Math.min(Math.max(value, start), end);
  };
  const updatePosition = () => {
    state.position = {
      x: state.scrollX + viewport.width / 2,
      y: state.scrollY + viewport.height / 2,
    };
  };
  return {
    port: {
      get width() {
        return viewport.width;
      },
      get height() {
        return viewport.height;
      },
      get scrollX() {
        return state.scrollX;
      },
      get scrollY() {
        return state.scrollY;
      },
      resetFX: () => {},
      setBounds: (x, y, width, height) => {
        state.bounds = { x, y, width, height };
      },
      setZoom: (zoom) => {
        state.zoom = zoom;
      },
      setDeadzone: (width, height) => {
        state.deadZone = { width, height };
      },
      startFollow: (target, _round, _lerpX, _lerpY, offsetX, offsetY) => {
        state.mode = "follow-observer";
        state.followTarget = structuredClone(target);
        state.followOffset = { x: offsetX, y: offsetY };
        state.scrollX = clampScroll(
          target.x - offsetX - viewport.width / 2,
          "x",
        );
        state.scrollY = clampScroll(
          target.y - offsetY - viewport.height / 2,
          "y",
        );
        updatePosition();
      },
      stopFollow: () => {
        state.mode = "fixed";
        state.followTarget = null;
        state.followOffset = { x: 0, y: 0 };
      },
      centerOn: (x, y) => {
        state.scrollX = clampScroll(x - viewport.width / 2, "x");
        state.scrollY = clampScroll(y - viewport.height / 2, "y");
        updatePosition();
      },
    },
    snapshot: () => structuredClone(state),
  };
}
