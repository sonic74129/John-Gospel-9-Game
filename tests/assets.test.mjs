import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const lock = await readJson("foundation.lock.json");
const game = await readJson("game.manifest.json");
const sync = await readJson(".foundation/sync-manifest.json");
const evaluation = await readJson(
  "production/asset-reviews/candidate-pack-evaluation.json",
);
const artReview = await readJson(
  "production/asset-reviews/story-local-art-review.json",
);
const runtimeArt = await readJson("public/assets/art/manifest.json");

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
  assert.equal(
    evaluation.reviewStatus,
    "polished-private-preview-with-candidate-rights",
  );
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

test("candidate review records completed story-local art without overstating rights", () => {
  assert.ok(evaluation.packs.every(({ storyLocalGaps }) => storyLocalGaps.length === 0));
  assert.equal(artReview.reviewStatus, "polished-private-preview");
  assert.equal(artReview.releaseEligible, false);
  assert.equal(artReview.publicRedistributionApproved, false);
  assert.equal(artReview.runtimeInventory.files, 23);
  assert.ok(artReview.limitations.length >= 4);
  assert.ok(evaluation.globalReleaseBlockers.length >= 3);
});

const imageDimensions = (bytes) => {
  if (bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP" &&
    bytes.toString("ascii", 12, 16) === "VP8 "
  ) {
    assert.equal(bytes.subarray(23, 26).toString("hex"), "9d012a");
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff,
    };
  }
  throw new Error("Unsupported runtime image format.");
};

test("story-local runtime assets match recorded hashes, dimensions and provenance", async () => {
  const outputs = runtimeArt.assets.flatMap(({ outputs }) => outputs);
  assert.equal(outputs.length, 23);
  assert.equal(runtimeArt.reviewStatus, "polished-private-preview");
  assert.equal(runtimeArt.releaseEligible, false);
  assert.equal(runtimeArt.publicRedistributionApproved, false);
  for (const asset of runtimeArt.assets) {
    assert.match(asset.source.path, /^production\/art-source\//);
    assert.equal(asset.releaseEligible, false);
    assert.equal(asset.publicRedistributionApproved, false);
    for (const output of asset.outputs) {
      const bytes = await readFile(output.path);
      assert.equal(bytes.byteLength, output.bytes, output.path);
      assert.equal(sha256(bytes), output.sha256, output.path);
      assert.deepEqual(imageDimensions(bytes), output.dimensions, output.path);
      assert.equal(output.processing.resizeKernel, "lanczos");
    }
  }
});

test("prompt registry is complete, pinned and revision-safe", async () => {
  const files = [
    "masters.json",
    "environment-interior.json",
    "environment-outdoor.json",
    "characters-core.json",
    "characters-supporting.json",
    "portraits.json",
  ];
  const entries = (
    await Promise.all(files.map((file) => readJson(`art/prompts/${file}`)))
  ).flatMap(({ entries }) => entries);
  assert.equal(entries.length, 7);
  for (const entry of entries) {
    assert.equal(entry.model, "mai-image-2-5-pro");
    assert.equal(entry.modelVersion, "2026-06-19");
    assert.ok(entry.candidateCount >= 2 && entry.candidateCount <= 3);
    assert.ok(entry.prompt.length > 500);
    for (const key of [
      "must",
      "avoid",
      "machineAcceptance",
      "visualAcceptance",
      "dependencies",
    ]) {
      assert.ok(entry[key], `${entry.assetId}.${key}`);
    }
    const version = Number(entry.promptVersion.slice(1));
    if (version >= 2) {
      assert.ok(entry.revision, `${entry.assetId}.revision`);
    }
  }
});

test("raw candidates and review artifacts cannot enter the public runtime tree", async () => {
  for (const asset of runtimeArt.assets) {
    for (const output of asset.outputs) {
      assert.match(output.path, /^public\/assets\/art\//);
      assert.doesNotMatch(output.path, /candidate|contact-sheet|review/i);
      await access(output.path);
    }
  }
  const adapter = await readFile("src/adapters/art-asset-adapter.ts", "utf8");
  assert.doesNotMatch(adapter, /production\/art-(?:pipeline|source)/);
});

test("John 11-specific cells never enter story-local runtime art", () => {
  const paths = runtimeArt.assets.flatMap(({ outputs }) =>
    outputs.map(({ path }) => path.toLowerCase()),
  );
  for (const forbidden of ["martha", "tomb", "lazarus", "bethany"]) {
    assert.ok(paths.every((path) => !path.includes(forbidden)), forbidden);
  }
});
