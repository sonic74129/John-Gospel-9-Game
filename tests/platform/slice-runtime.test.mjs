import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { NavigationGrid } from "@sonic74129/map-runtime";
import { MapSequence } from "@sonic74129/sequence-runtime";

import { applyCanonicalCameraFinalState } from "../../src/adapters/canonical-camera.ts";
import {
  buildBlockedCells,
  findWalkablePath,
  isWalkablePoint,
  isWalkableSegment,
} from "../../src/adapters/navigation-geometry.js";
import { createSliceSequenceAdapter } from "../../src/adapters/sequence-adapter.ts";
import { navigationHintNeedsUpdate } from "../../src/platform/app-shell.ts";
import {
  createResponsiveGameSizeController,
  requireGameViewport,
} from "../../src/platform/responsive-game-size.ts";
import { createViewportResizeTransaction } from "../../src/platform/viewport-resize-transaction.ts";
import {
  SliceStoryController,
  UnsupportedStoryBeatError,
} from "../../src/adapters/story-adapter.ts";
import { STORY_ACTOR_SPAWN_IDS } from "../../src/adapters/story-actor-mapping.ts";
import {
  ACTORS,
  DIALOGUE_BY_BEAT,
  FINAL_SNAPSHOTS,
  PROPS,
  STORY_BEATS,
} from "../../src/adapters/story-contracts.ts";
import {
  ARRIVAL_RADIUS_PIXELS,
  describeWorldNavigationObjective,
  resolveWorldNavigationObjective,
  segmentIntersectsArrivalRadius,
  worldNavigationEvent,
} from "../../src/adapters/world-navigation.ts";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const readText = (path) => readFile(path, "utf8");
const storyBeats = STORY_BEATS;
const [
  anchorContract,
  cameraContract,
  layoutContract,
  spawnContract,
  framingContract,
  collisionContract,
  navigationContract,
] =
  await Promise.all([
    readJson("src/world/anchors.json"),
    readJson("src/world/camera.json"),
    readJson("src/world/layout.json"),
    readJson("src/world/spawns.json"),
    readJson("src/world/framing.json"),
    readJson("src/world/collisions.json"),
    readJson("src/world/navigation.json"),
  ]);
const desktopFrameProfile = framingContract.profiles.find(
  ({ viewport }) => viewport.width === 1280,
);
const walkablePolygons = layoutContract.regions.map(
  ({ walkablePolygon }) => walkablePolygon,
);
const collisionPolygons = collisionContract.collisionPolygons.map(
  ({ polygon }) => polygon,
);
const playerRadius = navigationContract.agent.radius;
const isWorldWalkable = (point) =>
  isWalkablePoint(
    point,
    playerRadius,
    layoutContract.worldBounds,
    walkablePolygons,
    collisionPolygons,
  );
const blockedCells = buildBlockedCells({
  width: layoutContract.worldBounds.width,
  height: layoutContract.worldBounds.height,
  cellSize: navigationContract.grid.cellSize,
  radius: playerRadius,
  bounds: layoutContract.worldBounds,
  walkablePolygons,
  collisionPolygons,
});
const navigationGrid = new NavigationGrid({
  width: layoutContract.worldBounds.width,
  height: layoutContract.worldBounds.height,
  cellSize: navigationContract.grid.cellSize,
  blocked: blockedCells,
});

const progressionEvents = storyBeats.map(({ trigger }) =>
  trigger.type === "proximity"
    ? {
        type: "proximity",
        actorId: trigger.actorId,
        targetId: trigger.targetId,
        distance: trigger.radius,
      }
    : { type: "event", name: trigger.event ?? "manual" },
);

test("full B01-B20 normal, all-skip, and mixed playthroughs follow canonical order", async () => {
  for (const mode of ["normal", "all-skip", "mixed"]) {
    const executed = [];
    const statuses = [];
    const controller = new SliceStoryController({
      runBeat: async (beat) => {
        executed.push(beat.id);
        const status =
          mode === "all-skip" ||
          (mode === "mixed" && beat.order % 2 === 0)
            ? "skipped"
            : "completed";
        statuses.push(status);
        return { status };
      },
    });

    for (const [index, event] of progressionEvents.entries()) {
      assert.equal((await controller.dispatch(event)).advanced, true, mode);
      assert.equal(
        controller.storyComplete,
        index === progressionEvents.length - 1,
        mode,
      );
    }
    assert.deepEqual(
      executed,
      storyBeats.map(({ id }) => id),
      mode,
    );
    assert.equal(
      statuses.filter((status) => status === "skipped").length,
      mode === "normal" ? 0 : mode === "all-skip" ? 20 : 10,
      mode,
    );
    assert.deepEqual(controller.snapshot().state.completedBeatIds, executed);
    assert.equal(controller.storyComplete, true);
    assert.equal(controller.snapshot().completed, true);
    assert.equal(controller.engine.currentBeat, undefined);
  }
});

test("each B01-B20 normal and skip run applies the same canonical final state", async () => {
  for (const beat of storyBeats) {
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
    FINAL_SNAPSHOTS.b20,
    storyBeats.at(-1).finalState,
  );
});

test("real sequence adapter exposes deep-equal canonical and actual camera state", async () => {
  const definitions = storyBeats.map(({ sequence }) => sequence);
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
    assert.equal(completed.inputLocks, 0, definition.id);
    assert.equal(skipped.inputLocks, 0, definition.id);
  }
});

test("actual final-state camera framing keeps every visible collider safe on desktop and mobile", async () => {
  for (const profile of framingContract.profiles) {
    for (const beat of storyBeats) {
      for (const skip of [false, true]) {
        const result = await runRealAdapter(beat.sequence, skip, profile);
        const visibleActors = resolveVisibleActorColliders(
          beat.finalState,
        );
        const cameraPosition = result.camera.applied.actual.position;
        const zoom = result.camera.applied.actual.zoom;
        for (const actor of visibleActors) {
          assertActorInsideSafeFrame({
            actor,
            cameraPosition,
            profile,
            zoom,
            label: `${beat.id}/${skip ? "skip" : "normal"}/${profile.id}/${actor.spawnId}`,
          });
        }

        const player = visibleActors.find(
          ({ storyActorId }) =>
            storyActorId === beat.finalState.controls.playerActorId,
        );
        assert.ok(player, `${beat.id}/${profile.id} player`);
      }
    }
  }
});

test("orientation resize reapplies every settled canonical frame without changing story state", async () => {
  const mobileProfile = framingContract.profiles.find(
    ({ viewport }) => viewport.width === 390,
  );
  assert.ok(mobileProfile);
  const landscapeProfile = {
    id: "frame.mobile-844x390",
    viewport: { width: 844, height: 390 },
    gameplaySafeRect: { x: 20, y: 20, width: 804, height: 350 },
  };

  for (const beat of storyBeats) {
    for (const skip of [false, true]) {
      const result = await runRealAdapter(beat.sequence, skip, mobileProfile);
      const settledState = structuredClone(result.scene);
      const simulation = createFinalStateCameraSimulation(
        result.scene,
        mobileProfile,
      );
      simulation.resizeTo(landscapeProfile.viewport);
      const landscapeCamera = simulation.camera.snapshot();
      assert.deepEqual(
        landscapeCamera.viewport,
        landscapeProfile.viewport,
        `${beat.id}/${skip ? "skip" : "normal"}/landscape viewport`,
      );
      assertActorInsideSafeFrame({
        actor: simulation.player,
        cameraPosition: landscapeCamera.position,
        profile: landscapeProfile,
        zoom: landscapeCamera.zoom,
        label: `${beat.id}/${skip ? "skip" : "normal"}/landscape player`,
      });

      simulation.resizeTo(mobileProfile.viewport);
      assertPlayerInsideSimulationSafeFrame(
        simulation,
        `${beat.id}/${skip ? "skip" : "normal"}/portrait-restored`,
      );
      assert.deepEqual(result.scene, settledState);
    }
  }
});

test("paused resize coalesces the latest safe camera transaction without story advancement", async () => {
  const mobileProfile = framingContract.profiles.find(
    ({ viewport }) => viewport.width === 390,
  );
  assert.ok(mobileProfile);
  const landscapeProfile = {
    id: "frame.mobile-844x390",
    viewport: { width: 844, height: 390 },
    gameplaySafeRect: { x: 20, y: 20, width: 804, height: 350 },
  };

  for (const beat of storyBeats) {
    for (const skip of [false, true]) {
      const result = await runRealAdapter(beat.sequence, skip, mobileProfile);
      const settledState = structuredClone(result.scene);
      const simulation = createFinalStateCameraSimulation(
        result.scene,
        mobileProfile,
      );
      const beforePause = simulation.camera.snapshot();
      let sceneActive = false;
      let worldUpdates = 0;
      const resize = createViewportResizeTransaction({
        isReady: () => sceneActive,
        apply: (viewport) => {
          simulation.resizeTo(viewport);
          worldUpdates += 1;
        },
      });

      resize.queue({ width: 800, height: 420 });
      resize.queue(landscapeProfile.viewport);
      assert.deepEqual(simulation.camera.snapshot(), beforePause);
      assert.deepEqual(resize.pending, landscapeProfile.viewport);
      assert.equal(worldUpdates, 0);

      sceneActive = true;
      assert.equal(resize.flush(), true);
      assert.equal(worldUpdates, 1);
      const resumedCamera = simulation.camera.snapshot();
      assert.deepEqual(resumedCamera.viewport, landscapeProfile.viewport);
      assertActorInsideSafeFrame({
        actor: simulation.player,
        cameraPosition: resumedCamera.position,
        profile: landscapeProfile,
        zoom: resumedCamera.zoom,
        label: `${beat.id}/${skip ? "skip" : "normal"}/paused-resume`,
      });
      const pointer = worldToViewportPoint(
        simulation.focusPosition,
        resumedCamera,
      );
      assert.ok(
        distanceBetween(
          viewportToWorldPoint(pointer, resumedCamera),
          simulation.focusPosition,
        ) < 1e-8,
      );
      assert.deepEqual(result.scene, settledState);
      assert.equal(resize.flush(), false);
    }
  }
});

test("Phaser follow delay keeps valid keyboard and pointer movement inside every safe frame", async () => {
  const frameRates = [
    { id: "60fps", deltaMs: 1000 / 60, frames: 60 },
    { id: "30fps", deltaMs: 1000 / 30, frames: 30 },
  ];
  const directions = [
    { id: "left", x: -1, y: 0 },
    { id: "right", x: 1, y: 0 },
    { id: "up", x: 0, y: -1 },
    { id: "down", x: 0, y: 1 },
  ];

  for (const profile of framingContract.profiles) {
    for (const beat of storyBeats) {
      for (const skip of [false, true]) {
        const mode = skip ? "skip" : "normal";
        const result = await runRealAdapter(beat.sequence, skip, profile);
        assert.equal(result.status, skip ? "skipped" : "completed");
        const finalState = result.scene;
        for (const frameRate of frameRates) {
          if (
            !finalState.controls.movementEnabled ||
            finalState.controls.locked
          ) {
            continue;
          }
          for (const direction of directions) {
            const simulation = createFinalStateCameraSimulation(
              finalState,
              profile,
            );
            let validFrames = 0;
            for (let frame = 0; frame < frameRate.frames; frame += 1) {
              const distance = (240 * frameRate.deltaMs) / 1000;
              const nextPosition = {
                x: simulation.player.position.x + direction.x * distance,
                y: simulation.player.position.y + direction.y * distance,
              };
              if (
                !isValidPlayerMove(
                  simulation.player.position,
                  nextPosition,
                  simulation.blockingActors,
                )
              ) {
                break;
              }
              simulation.player.position = nextPosition;
              simulation.camera.advanceFollow(nextPosition);
              assertPlayerInsideSimulationSafeFrame(
                simulation,
                `${beat.id}/${mode}/${profile.id}/${frameRate.id}/${direction.id}/frame-${frame}`,
              );
              validFrames += 1;
            }
            assert.ok(
              validFrames > 0,
              `${beat.id}/${mode}/${profile.id}/${frameRate.id}/${direction.id} has valid movement`,
            );
          }

          const simulation = createFinalStateCameraSimulation(
            finalState,
            profile,
          );
          const cameraState = simulation.camera.snapshot();
          const pointerPosition = worldToViewportPoint(
            simulation.focusPosition,
            cameraState,
          );
          const pointerTarget = viewportToWorldPoint(
            pointerPosition,
            cameraState,
          );
          assert.ok(
            distanceBetween(pointerTarget, simulation.focusPosition) < 1e-8,
            `${beat.id}/${mode}/${profile.id}/${frameRate.id} pointer alignment`,
          );
          const pointerPath = findWalkablePath(
            navigationGrid,
            simulation.player.position,
            pointerTarget,
            isWorldWalkable,
          );
          assert.ok(
            pointerPath.length > 1,
            `${beat.id}/${mode}/${profile.id}/${frameRate.id} pointer route`,
          );
          let pointerFrames = 0;
          let pointerBlocked = false;
          for (const waypoint of pointerPath.slice(1)) {
            while (
              distanceBetween(simulation.player.position, waypoint) > 0.001
            ) {
              const remaining = distanceBetween(
                simulation.player.position,
                waypoint,
              );
              const distance = Math.min(
                (240 * frameRate.deltaMs) / 1000,
                remaining,
              );
              const nextPosition = {
                x:
                  simulation.player.position.x +
                  ((waypoint.x - simulation.player.position.x) / remaining) *
                    distance,
                y:
                  simulation.player.position.y +
                  ((waypoint.y - simulation.player.position.y) / remaining) *
                    distance,
              };
              if (
                !isValidPlayerMove(
                  simulation.player.position,
                  nextPosition,
                  simulation.blockingActors,
                )
              ) {
                pointerBlocked = true;
                break;
              }
              simulation.player.position = nextPosition;
              simulation.camera.advanceFollow(nextPosition);
              assertPlayerInsideSimulationSafeFrame(
                simulation,
                `${beat.id}/${mode}/${profile.id}/${frameRate.id}/pointer/frame-${pointerFrames}`,
              );
              pointerFrames += 1;
            }
            if (pointerBlocked) {
              break;
            }
          }
          assert.ok(
            pointerFrames > 0,
            `${beat.id}/${mode}/${profile.id}/${frameRate.id} has valid pointer movement`,
          );
        }
      }
    }
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
    readText("src/adapters/story-scene.ts"),
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
  assert.match(scene, /restoreRuntimeState\(snapshot: StorySceneSnapshot\)/);
  assert.match(
    scene,
    /restoreRuntimeState\(snapshot: StorySceneSnapshot\)[\s\S]*if \(this\.#tearingDown\)/,
  );
  assert.match(scene, /this\.cameras\.main\.resetFX\(\)/);
  assert.match(scene, /this\.time\.delayedCall\(250/);
  assert.doesNotMatch(
    scene,
    /followCameraPath[\s\S]*window\.setTimeout/,
  );
  assert.match(
    platform,
    /scene\.beginTeardown\(\);\s*sequence\.cancel\(\);[\s\S]*await story\.dispose\(\);[\s\S]*Promise\.allSettled\(activeSequenceRuns\)/,
  );
  assert.match(platform, /if \(ui\.snapshot\(\)\.paused\)/);
  assert.match(shell, /dialogueNext\.disabled = value/);
  assert.match(shell, /skipButton\.disabled = value/);
});

test("B06 fires exactly once when one movement segment sweeps across pool.wash-edge", async () => {
  const washEdge = anchorContract.anchors.find(
    ({ id }) => id === "pool.wash-edge",
  ).position;
  const traversal = {
    previousPosition: {
      x: washEdge.x - ARRIVAL_RADIUS_PIXELS - 58,
      y: washEdge.y,
    },
    currentPosition: {
      x: washEdge.x + ARRIVAL_RADIUS_PIXELS + 48,
      y: washEdge.y,
    },
  };
  assert.equal(
    Math.hypot(
      traversal.previousPosition.x - washEdge.x,
      traversal.previousPosition.y - washEdge.y,
    ) > ARRIVAL_RADIUS_PIXELS,
    true,
  );
  assert.equal(
    Math.hypot(
      traversal.currentPosition.x - washEdge.x,
      traversal.currentPosition.y - washEdge.y,
    ) > ARRIVAL_RADIUS_PIXELS,
    true,
  );
  assert.equal(
    segmentIntersectsArrivalRadius(
      traversal.previousPosition,
      traversal.currentPosition,
      washEdge,
    ),
    true,
  );
  assert.equal(
    segmentIntersectsArrivalRadius(
      { ...traversal.previousPosition, y: washEdge.y + 73 },
      { ...traversal.currentPosition, y: washEdge.y + 73 },
      washEdge,
    ),
    false,
  );

  const resolver = {
    anchorPosition: (anchorId) =>
      anchorContract.anchors.find(({ id }) => id === anchorId).position,
    storyActorPosition: () => {
      throw new Error("B06 arrival must not resolve an actor position.");
    },
  };
  const event = worldNavigationEvent(
    STORY_BEATS[5].trigger,
    traversal,
    resolver,
  );
  assert.deepEqual(event, {
    type: "event",
    name: "arrival:pool.wash-edge",
  });

  const executed = [];
  const controller = new SliceStoryController({
    runBeat: async (beat) => {
      executed.push(beat.id);
      return { status: "completed" };
    },
  });
  controller.restoreCompletedBeatIds(["b01", "b02", "b03", "b04", "b05"]);
  assert.equal((await controller.dispatch(event)).advanced, true);
  assert.equal((await controller.dispatch(event)).advanced, false);
  assert.deepEqual(executed, ["b06"]);
  assert.equal(controller.storyComplete, false);
  assert.equal(controller.engine.currentBeat?.id, "b07");
});

test("objective waypoint lifecycle is accessible, pointer-driven, and mobile-safe", async () => {
  const [platform, scene, shell, styles] = await Promise.all([
    readText("src/adapters/sdk-platform.ts"),
    readText("src/adapters/story-scene.ts"),
    readText("src/platform/app-shell.ts"),
    readText("src/platform/styles.css"),
  ]);
  const positions = {
    "pool.wash-edge": { x: 1280, y: 1360 },
  };
  const resolver = {
    anchorPosition: (anchorId) => positions[anchorId],
    storyActorPosition: () => {
      throw new Error("The B06 objective must resolve the pool anchor.");
    },
    storyActorLabel: () => {
      throw new Error("The B06 objective must not expose an actor label.");
    },
  };
  const playerPosition = { x: 1080, y: 1260 };
  const arrival = resolveWorldNavigationObjective(
    STORY_BEATS[5].trigger,
    resolver,
  );
  assert.deepEqual(arrival, {
    kind: "arrival",
    targetId: "pool.wash-edge",
    label: "目標地點",
    position: positions["pool.wash-edge"],
  });
  const arrivalHint = describeWorldNavigationObjective(
    arrival,
    playerPosition,
  );
  assert.match(
    arrivalHint,
    /前往目標地點.*距離約.*點按標記移動/,
  );
  for (const playerHint of [arrivalHint]) {
    assert.doesNotMatch(
      playerHint,
      /pool\.wash-edge|地圖單位|DEV|debug|灰盒/i,
    );
  }
  const unchangedHint = describeWorldNavigationObjective(arrival, {
    x: playerPosition.x + 8,
    y: playerPosition.y,
  });
  const closerHint = describeWorldNavigationObjective(arrival, {
    x: 1160,
    y: 1080,
  });
  const redirectedHint = describeWorldNavigationObjective(arrival, {
    x: 900,
    y: 1360,
  });
  assert.equal(unchangedHint, arrivalHint);
  assert.equal(navigationHintNeedsUpdate(arrivalHint, unchangedHint), false);
  assert.equal(navigationHintNeedsUpdate(arrivalHint, closerHint), true);
  assert.equal(navigationHintNeedsUpdate(closerHint, redirectedHint), true);
  assert.equal(navigationHintNeedsUpdate(redirectedHint, null), true);

  assert.match(
    platform,
    /disposed \|\|[\s\S]*paused \|\|[\s\S]*scenePauseReasons\.size > 0 \|\|[\s\S]*story\.running \|\|[\s\S]*story\.storyComplete \|\|[\s\S]*overlayBlocking/,
  );
  assert.match(
    platform,
    /finally \{\s*syncNavigationObjective\(\);\s*\}/,
  );
  assert.match(
    platform,
    /restore:[\s\S]*setNavigationObjective\(null\)[\s\S]*syncNavigationObjective\(\)/,
  );
  assert.match(
    platform,
    /setPaused:[\s\S]*syncNavigationObjective\(\)/,
  );
  assert.match(
    scene,
    /#navigationObjective !== null[\s\S]*#activateNavigationObjective\(\)/,
  );
  assert.match(
    scene,
    /#activateNavigationObjective[\s\S]*this\.#world\.findPath\(/,
  );
  assert.match(
    scene,
    /beginTeardown[\s\S]*setNavigationObjective\(null\)/,
  );
  assert.match(shell, /data-navigation-hint role="status" aria-live="polite"/);
  assert.match(
    shell,
    /if \(!navigationHintNeedsUpdate\(navigationHintMessage, message\)\) \{\s*return;/,
  );
  assert.match(shell, /setCompleted:[\s\S]*setNavigationHint\(null\)/);
  assert.match(
    styles,
    /@media \(max-width: 640px\)[\s\S]*\.navigation-hint \{[\s\S]*top: 5\.5rem[\s\S]*max-width: calc\(100% - 1rem\)/,
  );
});

test("MapSequence cancellation releases input and never finalizes or hands off", async () => {
  const fixture = createSequenceHost("cancelled");
  const sequence = new MapSequence(fixture.host);
  const running = sequence.run(storyBeats[0].sequence);
  await Promise.resolve();
  assert.equal(fixture.inputLocks, 1);
  sequence.cancel();
  assert.deepEqual(await running, { status: "cancelled" });
  assert.equal(fixture.inputLocks, 0);
  assert.deepEqual(fixture.finalStates, []);
  assert.deepEqual(fixture.handoffs, []);
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

  for (const beat of storyBeats) {
    assert.equal(
      DIALOGUE_BY_BEAT[beat.id] !== undefined,
      true,
    );
    for (const step of beat.sequence.steps) {
      if (step.kind !== "command") continue;
      const payload = step.payload ?? {};
      if ("anchorId" in payload) assert.equal(anchorIds.has(payload.anchorId), true);
      if ("actorId" in payload) assert.equal(actorIds.has(payload.actorId), true);
      if (typeof payload.primaryActorId === "string") {
        assert.equal(actorIds.has(payload.primaryActorId), true);
      }
      if (Array.isArray(payload.participantActorIds)) {
        for (const actorId of payload.participantActorIds) {
          assert.equal(actorIds.has(actorId), true);
        }
      }
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

test("licensed scripture is displayed in a simple card without QA metadata", async () => {
  const [shell, scripture] = await Promise.all([
    readText("src/platform/app-shell.ts"),
    readJson("src/story/licensed-artifacts/scrollmapper-chiun-john9.json"),
  ]);
  assert.match(
    shell,
    /dialogueText\.textContent = line\.exactText/,
  );
  assert.match(
    shell,
    /dialogueReference\.textContent = `\$\{formatVerseReference\(line\.verseKey\)\} · \$\{line\.sourceLabel\}`/,
  );
  assert.doesNotMatch(
    shell,
    /Text SHA-256|dialogue-metadata|sourceLevel|speakerId|segmentId/,
  );
  assert.doesNotMatch(shell, /此段經文內容暫不顯示/);
  assert.equal(scripture.verses.length, 41);
  for (const verse of scripture.verses) {
    assert.equal(typeof verse.exactText, "string");
    assert.ok(verse.exactText.length > 0);
  }
});

test("production bundle gate covers Foundation player-version QA residue", async () => {
  const [checker, scene, shell, overlay] = await Promise.all([
    readText("scripts/check-production-bundle.mjs"),
    readText("src/adapters/story-scene.ts"),
    readText("src/platform/app-shell.ts"),
    readText("src/adapters/dev-graybox-overlay.ts"),
  ]);
  for (const residue of [
    "DEV FIXTURE",
    "developer-fixture",
    "data-developer-fixture",
    "QA 灰盒",
    "私人灰盒",
    "候選身分灰盒",
    "經文待授權／審核",
    "段落識別：",
    "Speaker",
    "Verse key",
    "Segment ID",
    "S2 · 遊戲提示 · 不計分",
    "Duplicate playtest query parameters are not supported.",
    "playtest beat ID must not be empty.",
    "is not a supported playtest beat.",
    "契約以外的故事節點",
    "從 B01 開始",
    "已套用確定最終狀態",
    "sdkOverlayVisible",
    "sdkInteractionBlocked",
    "lastHandoff",
    "john-9-graybox",
    "graybox-shell",
    "fixed-graybox-mass",
    "dev-graybox-overlay",
    "dialogue-placeholder",
    "debugOverlay",
    "見證紀錄",
    "回想已揭示",
    "個人使用候選版",
    "data-testimony",
    "data-recall",
    "data-study-questions",
  ]) {
    assert.match(checker, new RegExp(residue));
  }
  assert.match(
    overlay,
    /\.text\(x \+ 24, y \+ 20, `\$\{id\} · walkable`,/,
  );
  assert.doesNotMatch(scene, /AREA_COLORS|fixed-graybox-mass/);
  assert.doesNotMatch(scene, /isCandidateJesus|候選身分灰盒/);
  assert.match(scene, /actorArtForSpawn\(actor\.definition\.id\)/);
  assert.match(
    scene,
    /import\.meta\.env\.DEV[\s\S]*runtimeActor\.state\.label/,
  );
  assert.doesNotMatch(
    shell,
    /data-testimony|data-recall|data-study-questions|sourceLevel|speakerId|segmentId/,
  );
});

test("development graybox baseline stays explicit and production-gated", async () => {
  const [scene, overlay] = await Promise.all([
    readText("src/adapters/story-scene.ts"),
    readText("src/adapters/dev-graybox-overlay.ts"),
  ]);
  assert.match(
    scene,
    /if \(import\.meta\.env\.DEV\)[\s\S]*import\("\.\/dev-graybox-overlay\.ts"\)/,
  );
  assert.match(overlay, /worldId: "john-9-jerusalem-story-world"/);
  assert.match(overlay, /width: 1280, height: 720/);
  assert.match(overlay, /width: 2688/);
  assert.match(overlay, /height: 1792/);
  assert.match(overlay, /width: 390, height: 844/);
  assert.match(overlay, /Development graybox baseline/);
});

test("unsupported story progress errors use generic player-facing copy", async () => {
  const [main, checker] = await Promise.all([
    readText("src/main.ts"),
    readText("scripts/check-production-bundle.mjs"),
  ]);
  assert.match(
    main,
    /error instanceof UnsupportedStoryBeatError[\s\S]*故事進度發生錯誤，流程已安全停止。/,
  );
  assert.doesNotMatch(main, /B0[7-9]|B1[0-9]|契約以外的故事節點/);
  assert.doesNotMatch(checker, /"B07"|"B19"/);
  assert.match(checker, /playtest beat ID must not be empty/);
});

test("scene applies and exposes every canonical final-state surface", async () => {
  const [scene, camera, platform] = await Promise.all([
    readText("src/adapters/story-scene.ts"),
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
  assert.match(platform, /triggers:\s*structuredClone\(finalState\.triggers\)/);
  assert.match(platform, /status:\s*state\.music\.playing[\s\S]*"silent-unavailable"/);
  assert.match(platform, /inputLocked:\s*input\.locked/);
});

test("candidate Jesus pack stays pinned for evidence but formal art owns runtime actors", async () => {
  const [adapter, scene, pack, manifest] = await Promise.all([
    readText("src/adapters/candidate-asset-adapter.ts"),
    readText("src/adapters/story-scene.ts"),
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
  assert.match(scene, /art-asset-adapter\.ts/);
  assert.doesNotMatch(
    scene,
    /candidate-asset-adapter|候選身分灰盒|household-props-atlas|world-ground-atlas/,
  );
});

test("out-of-order restored progress fails explicitly outside the canonical contract", () => {
  const controller = new SliceStoryController({
    runBeat: async () => ({ status: "completed" }),
  });
  assert.throws(
    () => controller.restoreCompletedBeatIds(["b01", "b03"]),
    (error) =>
      error instanceof UnsupportedStoryBeatError &&
      error.code === "STORY_BEAT_OUTSIDE_CANONICAL_CONTRACT" &&
      error.beatId === "b03",
  );
  assert.equal(controller.snapshot().completed, false);
  assert.equal(controller.engine.currentBeat?.id, "b01");
});

test("saved B01-B20 progress restores deterministically to the next beat or completion", () => {
  const controller = new SliceStoryController({
    runBeat: async () => ({ status: "completed" }),
  });
  controller.restoreCompletedBeatIds(
    FINAL_SNAPSHOTS.b03.triggers.completedBeatIds,
  );
  assert.deepEqual(
    controller.snapshot().state.completedBeatIds,
    FINAL_SNAPSHOTS.b03.triggers.completedBeatIds,
  );
  assert.equal(controller.engine.currentBeat?.id, "b04");
  assert.equal(controller.storyComplete, false);

  controller.restoreCompletedBeatIds(
    FINAL_SNAPSHOTS.b20.triggers.completedBeatIds,
  );
  assert.equal(controller.storyComplete, true);
  assert.equal(controller.engine.currentBeat, undefined);
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

async function runRealAdapter(
  definition,
  skip,
  profile = desktopFrameProfile,
) {
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
        escortActorToAnchor: async () => {},
        leadActorsAlongPath: async () => {},
        waitForPlayerAtAnchor: async () => {},
        followCameraPath: async () => {},
        applyFinalState: async (state) => {
          const viewport = resolveInitialProductionViewport(profile.viewport);
          const camera = createFaithfulCameraPort(viewport);
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
            mobile: Math.min(viewport.width, viewport.height) <= 640,
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
        setNavigationHint: () => {},
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

function resolveVisibleActorColliders(finalState) {
  const resolved = [];
  for (const [storyActorId, actorState] of Object.entries(finalState.actors)) {
    if (!actorState.visible || !actorState.collisionEnabled) {
      continue;
    }
    const targetAnchor = requireById(
      anchorContract.anchors,
      actorState.anchorId,
    );
    for (const spawnId of STORY_ACTOR_SPAWN_IDS[storyActorId]) {
      const spawn = requireById(spawnContract.actorSpawns, `spawn.${spawnId}`);
      const initialAnchor = requireById(
        anchorContract.anchors,
        spawn.anchorId,
      );
      resolved.push({
        storyActorId,
        spawnId,
        collisionRadius: spawn.collisionRadius,
        position: {
          x:
            targetAnchor.position.x +
            spawn.position.x -
            initialAnchor.position.x,
          y:
            targetAnchor.position.y +
            spawn.position.y -
            initialAnchor.position.y,
        },
      });
    }
  }
  return resolved;
}

function createFinalStateCameraSimulation(finalState, profile) {
  const visibleActors = resolveVisibleActorColliders(finalState);
  const player = visibleActors.find(
    ({ storyActorId }) => storyActorId === finalState.controls.playerActorId,
  );
  assert.ok(player, `${finalState.beatId}/${profile.id} player`);
  const cameraAnchor = requireById(
    anchorContract.anchors,
    finalState.camera.anchorId,
  );
  const zone = cameraContract.cameraZones.find(
    ({ regionId }) => regionId === cameraAnchor.regionId,
  );
  assert.ok(zone, `${finalState.beatId}/${profile.id} camera zone`);
  const viewport = { width: 1280, height: 720 };
  const camera = createFaithfulCameraPort(viewport);
  const applyCamera = () =>
    applyCanonicalCameraFinalState({
      camera: camera.port,
      canonical: finalState.camera,
      zone,
      anchorPosition: cameraAnchor.position,
      playerActorId: finalState.controls.playerActorId,
      playerTarget: player.position,
      worldWidth: layoutContract.worldBounds.width,
      worldHeight: layoutContract.worldBounds.height,
      mobile: Math.min(viewport.width, viewport.height) <= 640,
    });
  applyCamera();
  const resizeTo = (nextViewport) =>
    driveProductionResize(viewport, nextViewport, ({ width, height }) => {
      camera.resizeViewport(width, height);
      applyCamera();
    });
  resizeTo(profile.viewport);
  return {
    camera,
    focusPosition: cameraAnchor.position,
    player: structuredClone(player),
    blockingActors: visibleActors.filter(
      ({ storyActorId }) => storyActorId !== finalState.controls.playerActorId,
    ),
    profile,
    resizeTo,
  };
}

function isValidPlayerMove(start, target, blockingActors) {
  return (
    isWalkableSegment(
      start,
      target,
      playerRadius,
      isWorldWalkable,
    ) &&
    blockingActors.every(
      (actor) =>
        distanceBetween(target, actor.position) >=
        playerRadius + actor.collisionRadius,
    )
  );
}

function assertPlayerInsideSimulationSafeFrame(simulation, label) {
  const cameraState = simulation.camera.snapshot();
  assertActorInsideSafeFrame({
    actor: simulation.player,
    cameraPosition: cameraState.position,
    profile: simulation.profile,
    zoom: cameraState.zoom,
    label,
  });
}

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function worldToViewportPoint(point, camera) {
  return {
    x: camera.viewport.width / 2 + (point.x - camera.position.x) * camera.zoom,
    y: camera.viewport.height / 2 + (point.y - camera.position.y) * camera.zoom,
  };
}

function viewportToWorldPoint(point, camera) {
  return {
    x:
      camera.position.x +
      (point.x - camera.viewport.width / 2) / camera.zoom,
    y:
      camera.position.y +
      (point.y - camera.viewport.height / 2) / camera.zoom,
  };
}

function resolveInitialProductionViewport(viewport) {
  return requireGameViewport({
    getBoundingClientRect: () => ({ ...viewport }),
  });
}

function driveProductionResize(initialSize, nextSize, onResize) {
  let bounds = { ...initialSize };
  let notifyResize = () => {};
  let queuedFrame = null;
  const controller = createResponsiveGameSizeController({
    container: {
      getBoundingClientRect: () => ({ ...bounds }),
    },
    initialSize,
    resize: onResize,
    createObserver: (listener) => {
      notifyResize = listener;
      return {
        observe: () => {},
        disconnect: () => {},
      };
    },
    eventTarget: {
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    scheduleTask: (callback) => {
      queuedFrame = callback;
      return 1;
    },
    cancelTask: () => {
      queuedFrame = null;
    },
  });
  controller.start();
  bounds = { ...nextSize };
  notifyResize();
  queuedFrame?.();
  controller.dispose();
}

function assertActorInsideSafeFrame({
  actor,
  cameraPosition,
  profile,
  zoom,
  label,
}) {
  const screen = {
    x:
      profile.viewport.width / 2 +
      (actor.position.x - cameraPosition.x) * zoom,
    y:
      profile.viewport.height / 2 +
      (actor.position.y - cameraPosition.y) * zoom,
  };
  const radius = actor.collisionRadius * zoom;
  const safe = profile.gameplaySafeRect;
  assert.ok(screen.x - radius >= safe.x - 1e-8, `${label} left`);
  assert.ok(
    screen.x + radius <= safe.x + safe.width + 1e-8,
    `${label} right`,
  );
  assert.ok(screen.y - radius >= safe.y - 1e-8, `${label} top`);
  assert.ok(
    screen.y + radius <= safe.y + safe.height + 1e-8,
    `${label} bottom`,
  );
}

function createFaithfulCameraPort(viewport = { width: 1280, height: 720 }) {
  const state = {
    mode: "fixed",
    position: { x: 0, y: 0 },
    zoom: 1,
    deadZone: { width: 0, height: 0 },
    followTarget: null,
    followOffset: { x: 0, y: 0 },
    lerp: { x: 1, y: 1 },
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    viewport: { ...viewport },
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
      startFollow: (target, _round, lerpX, lerpY, offsetX, offsetY) => {
        state.mode = "follow-observer";
        state.followTarget = structuredClone(target);
        state.followOffset = { x: offsetX, y: offsetY };
        state.lerp = { x: lerpX, y: lerpY };
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
    resizeViewport: (width, height) => {
      viewport.width = width;
      viewport.height = height;
      state.viewport = { width, height };
      updatePosition();
    },
    advanceFollow: (target) => {
      assert.equal(state.mode, "follow-observer");
      state.followTarget = structuredClone(target);
      const adjustedTarget = {
        x: target.x - state.followOffset.x,
        y: target.y - state.followOffset.y,
      };
      const deadZone = {
        left:
          state.scrollX + viewport.width / 2 - state.deadZone.width / 2,
        right:
          state.scrollX + viewport.width / 2 + state.deadZone.width / 2,
        top:
          state.scrollY + viewport.height / 2 - state.deadZone.height / 2,
        bottom:
          state.scrollY + viewport.height / 2 + state.deadZone.height / 2,
      };
      let targetScrollX = state.scrollX;
      let targetScrollY = state.scrollY;
      if (adjustedTarget.x < deadZone.left) {
        targetScrollX = adjustedTarget.x - deadZone.left + state.scrollX;
      } else if (adjustedTarget.x > deadZone.right) {
        targetScrollX = adjustedTarget.x - deadZone.right + state.scrollX;
      }
      if (adjustedTarget.y < deadZone.top) {
        targetScrollY = adjustedTarget.y - deadZone.top + state.scrollY;
      } else if (adjustedTarget.y > deadZone.bottom) {
        targetScrollY = adjustedTarget.y - deadZone.bottom + state.scrollY;
      }
      state.scrollX = clampScroll(
        Math.floor(
          state.scrollX +
            (targetScrollX - state.scrollX) * state.lerp.x,
        ),
        "x",
      );
      state.scrollY = clampScroll(
        Math.floor(
          state.scrollY +
            (targetScrollY - state.scrollY) * state.lerp.y,
        ),
        "y",
      );
      updatePosition();
    },
    snapshot: () => structuredClone(state),
  };
}
