import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const lock = await readJson("foundation.lock.json");
const sync = await readJson(".foundation/sync-manifest.json");
const evaluation = await readJson(
  "production/asset-reviews/candidate-pack-evaluation.json",
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

test("candidate review covers every locked pack exactly", () => {
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

test("candidate review records resolved John 9-local art without relaxing release gates", () => {
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
  assert.ok(evaluation.globalReleaseBlockers.length >= 4);
});

test("John 9:8-41 formal actor files retain exact approved hashes and private-preview gates", () => {
  const outputs = runtimeArt.assets.flatMap(({ outputs }) => outputs);
  const hashesByFileName = Object.fromEntries(
    outputs.map(({ path, sha256 }) => [path.split("/").at(-1), sha256]),
  );
  assert.deepEqual(
    Object.fromEntries(
      [
        "jesus-found-man.png",
        "man-worship.png",
        "neighbor-a.png",
        "neighbor-b.png",
        "pharisee.png",
        "judean-authority.png",
        "father.png",
        "mother.png",
      ].map((fileName) => [fileName, hashesByFileName[fileName]]),
    ),
    {
      "jesus-found-man.png":
        "3078de8d8b06e8b8df2dfb50c04fb923560ca7f67d079ae7e612d4c6861c11f0",
      "man-worship.png":
        "8bab033f9f34f9b36076c4c410fd1c08170c1b9a056ba24cbdf195d7340cec0d",
      "neighbor-a.png":
        "823d62884434f150fcb37e7264a8a21c3d892276d4db007632ddc7d7b518bc08",
      "neighbor-b.png":
        "1cd8aa4c1de1bafeed2e82fe379802615728dfeba196b53f90e8e20e3070f5cf",
      "pharisee.png":
        "083ac76e3fb2bad982b17b4e38668c417acdb7010d9a81f3a20297ce2aa2a109",
      "judean-authority.png":
        "1e9f56416bb324c24aed5102c5564e3a530b036e39119b5d65e6c7276173f0fb",
      "father.png":
        "d8fe8f549233a17aefd2bc52c9a3f35699c9fe2c6b4ad2c2d74ec90c01463c1f",
      "mother.png":
        "bdbe60e8eb9ed130c7fa1553e152ba4aebfe889f04b21165a6a0ff35af2d233b",
    },
  );
  for (const preserved of [
    "jesus-directional.png",
    "jesus-idle-look-right.png",
    "jesus-clay-action-look-right.png",
    "disciple-a-look-right.png",
    "disciple-b-look-right.png",
  ]) {
    assert.ok(hashesByFileName[preserved], preserved);
  }
  assert.equal(runtimeArt.releaseEligible, false);
  assert.equal(runtimeArt.publicRedistributionApproved, false);
});
