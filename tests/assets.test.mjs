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

test("candidate packs are explicitly pinned and cannot be presented as release-ready", () => {
  assert.equal(lock.allowCandidateAssets, true);
  assert.deepEqual(
    lock.assetPacks.map(({ id, version }) => `${id}@${version}`).sort(),
    expectedPacks,
  );
  assert.ok(lock.assetPacks.every(({ status }) => status === "candidate"));
  assert.equal(evaluation.releaseEligible, false);
  assert.equal(evaluation.publicRedistributionApproved, false);
  assert.equal(evaluation.reviewStatus, "conditional-private-graybox-only");
  assert.ok(
    evaluation.packs.every(
      ({ status, decision }) =>
        status === "candidate" && decision === "conditional-accept",
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

test("candidate review records the required John 9-local gaps", () => {
  const gaps = new Set(
    evaluation.packs.flatMap(({ storyLocalGaps }) => storyLocalGaps),
  );
  for (const required of [
    "john9-continuous-world-map",
    "siloam-pool",
    "neutral-inquiry-courtyard",
    "john9-clay-action-pose",
    "john9-dialogue-portraits",
  ]) {
    assert.ok(gaps.has(required), required);
  }
  assert.ok(evaluation.globalReleaseBlockers.length >= 4);
});
