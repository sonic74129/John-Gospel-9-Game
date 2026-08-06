import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const lock = await readJson("foundation.lock.json");
const game = await readJson("game.manifest.json");
const sync = await readJson(".foundation/sync-manifest.json");
const evaluation = await readJson(
  "production/asset-reviews/candidate-pack-evaluation.json",
);

const expectedPacks = [
  "identity-jesus-storybook@0.1.0",
  "nt-judea-first-century@0.1.0",
];

test("candidate packs are pinned as evidence while story-local art is release-ready", () => {
  assert.equal(lock.allowCandidateAssets, true);
  assert.deepEqual(
    lock.assetPacks.map(({ id, version }) => `${id}@${version}`).sort(),
    expectedPacks,
  );
  assert.ok(lock.assetPacks.every(({ status }) => status === "candidate"));
  assert.equal(evaluation.distributionScope, "private");
  assert.equal(evaluation.evidenceCollector, "copilot");
  assert.equal(evaluation.acceptanceExecutor, "copilot");
  assert.equal(
    evaluation.reviewStatus,
    "copilot-accepted-story-local-replacement",
  );
  assert.ok(
    evaluation.packs.every(
      ({ status, decision }) =>
        status === "candidate" &&
        decision === "evidence-only-story-local-replacement",
    ),
  );
});

test("game manifest and candidate review cover every locked pack exactly", () => {
  assert.deepEqual(
    Object.entries(game.assetPacks)
      .map(([id, version]) => `${id}@${version}`)
      .sort(),
    expectedPacks,
  );
  assert.deepEqual(
    evaluation.packs.map(({ id, version }) => `${id}@${version}`).sort(),
    expectedPacks,
  );
});

test("synced runtime assets match their recorded bytes and SHA-256", async () => {
  const runtimeFiles = sync.files.filter(({ target }) =>
    target.startsWith("public/assets/vendor/"),
  );
  assert.equal(runtimeFiles.length, 3);

  for (const file of runtimeFiles) {
    const bytes = await readFile(file.target);
    assert.equal(bytes.byteLength, file.bytes, file.target);
    assert.equal(sha256(bytes), file.sha256, file.target);
  }
});

test("John 11-specific source cells never enter the John 9 runtime", () => {
  const targets = sync.files.map(({ target }) => target.toLowerCase());
  for (const forbidden of ["martha", "tomb", "lazarus", "bethany"]) {
    assert.ok(
      targets.every((target) => !target.includes(forbidden)),
      forbidden,
    );
  }

  const judea = evaluation.packs.find(
    ({ id }) => id === "nt-judea-first-century",
  );
  assert.deepEqual(judea.excludedSourceCells.sort(), [
    "martha-house-base",
    "martha-house-roof",
    "tomb-entrance",
  ]);
});

test("candidate review records complete John 9-local replacements", () => {
  assert.ok(
    evaluation.packs.every(({ storyLocalGaps }) => storyLocalGaps.length === 0),
  );
  const resolutions = new Set(
    evaluation.packs.flatMap(({ storyLocalResolution }) => storyLocalResolution),
  );
  for (const required of [
    "character.jesus-john9@v1",
    "character.man-born-blind@v1",
    "environment.john9-zigzag-world@v2",
    "environment.john9-zigzag-props@v2",
  ]) {
    assert.ok(resolutions.has(required), required);
  }
  assert.equal(evaluation.distributionNotes.length, 3);
});
