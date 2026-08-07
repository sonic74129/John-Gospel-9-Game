import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { MusicManager, VoiceManager } from "@sonic74129/audio-runtime";
import {
  assertValid,
  validateStoryBeat,
  validateWorldDefinition,
} from "@sonic74129/content-schema";
import {
  EngineComposition,
  InputLock,
  PHASER_PEER_VERSION,
} from "@sonic74129/engine";
import { NavigationGrid } from "@sonic74129/map-runtime";
import {
  MapSequence,
  PhaserSequenceAdapter,
} from "@sonic74129/sequence-runtime";
import { StoryEngine } from "@sonic74129/story-runtime";
import {
  FakeAudioFactory,
  FakeSequenceHost,
  assertGraphReachability,
} from "@sonic74129/test-kit";
import { GameUIShell } from "@sonic74129/ui";

import {
  UnsupportedPlatformOperationError,
  failUnsupportedOperation,
} from "../../src/adapters/operation-errors.js";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

test("story-owned world contracts validate through the published schema", async () => {
  const [layout, navigation, spawns] = await Promise.all([
    readJson("src/world/layout.json"),
    readJson("src/world/navigation.json"),
    readJson("src/world/spawns.json"),
  ]);
  const world = {
    id: layout.worldId,
    width: layout.worldBounds.width,
    height: layout.worldBounds.height,
    tileSize: navigation.grid.cellSize,
    actors: spawns.actorSpawns.map((spawn) => ({
      id: spawn.actorId,
      label: spawn.actorId,
      position: spawn.position,
      metadata: {
        anchorId: spawn.anchorId,
        regionId: spawn.regionId,
        sourceLevel: spawn.sourceLevel,
      },
    })),
    areas: layout.regions.map(({ id, bounds }) => ({ id, ...bounds })),
  };
  assertValid(world, validateWorldDefinition);
});

test("unsupported platform operations still fail explicitly", async () => {
  assert.throws(
    () => failUnsupportedOperation("story.advance"),
    (error) =>
      error instanceof UnsupportedPlatformOperationError &&
      error.code === "PLATFORM_OPERATION_UNSUPPORTED" &&
      error.operation === "story.advance",
  );

  const adapter = new PhaserSequenceAdapter({
    context: undefined,
    executeCommand: (command) =>
      failUnsupportedOperation(`sequence.command:${command}`),
    applyFinalState: () => failUnsupportedOperation("sequence.final-state"),
  });
  await assert.rejects(
    new MapSequence(adapter).run({
      id: "unwired-command",
      steps: [{ kind: "command", command: "dialogue" }],
      finalState: { ready: true },
    }),
    (error) =>
      error instanceof UnsupportedPlatformOperationError &&
      error.operation === "sequence.command:dialogue",
  );
  await assert.rejects(
    new MapSequence(adapter).run({
      id: "unwired-final-state",
      steps: [],
      finalState: { ready: true },
    }),
    (error) =>
      error instanceof UnsupportedPlatformOperationError &&
      error.operation === "sequence.final-state",
  );
});

test("published SDK services compose without local compatibility copies", async () => {
  const beat = { id: "platform-smoke", actions: [{ type: "observe" }] };
  const world = {
    id: "platform-story-world",
    width: 320,
    height: 192,
    tileSize: 32,
    actors: [
      {
        id: "observer",
        label: "Observer",
        position: { x: 16, y: 16 },
      },
    ],
  };
  assertValid(beat, validateStoryBeat);
  assertValid(world, validateWorldDefinition);
  assert.equal(PHASER_PEER_VERSION, "3.90.0");

  const story = new StoryEngine({
    definition: { initialState: { completed: [] }, beats: [beat] },
    reduce: (state, currentBeat) => ({
      completed: [...state.completed, currentBeat.id],
    }),
  });
  assert.equal(story.advance({ type: "manual" }).advanced, true);

  const navigation = new NavigationGrid({
    width: world.width,
    height: world.height,
    cellSize: world.tileSize,
  });
  assert.ok(
    navigation.findPath({ x: 16, y: 16 }, { x: 176, y: 80 }).length > 1,
  );

  const sequenceHost = new FakeSequenceHost();
  const sequence = new MapSequence(sequenceHost);
  const result = await sequence.run({
    id: "platform-sequence",
    steps: [{ kind: "command", command: "show-shell" }],
    finalState: { ready: true },
  });
  assert.equal(result.status, "completed");
  assert.deepEqual(sequenceHost.finalState, { ready: true });

  const factory = new FakeAudioFactory();
  const music = new MusicManager({ tracks: [], factory });
  const voice = new VoiceManager({ cues: [], factory });
  const ui = new GameUIShell({
    labels: {
      pause: "Pause",
      resume: "Resume",
      mute: "Mute",
      unmute: "Unmute",
      skip: "Skip",
    },
  });
  ui.setMuted(true);
  assert.equal(ui.snapshot().muted, true);

  const composition = new EngineComposition({
    services: {
      story,
      navigation,
      sequence,
      music,
      voice,
      ui,
      input: new InputLock(),
    },
  });
  await composition.lifecycle.start();
  assert.equal(composition.lifecycle.state, "running");
  assertGraphReachability({ start: ["shell"], shell: [] }, "start", ["shell"]);
  await composition.dispose();
});
