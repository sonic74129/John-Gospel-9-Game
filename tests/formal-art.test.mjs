import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { basename } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { reconcileCandidateFiles } from "../scripts/art-generate.mjs";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = await readJson("public/assets/art/manifest.json");
const review = await readJson(
  "production/asset-reviews/story-local-art-review.json",
);
const worldSelection = await readJson(
  "production/art-source/environment-outdoor/environment.john9-zigzag-world/v2/run-001/selection.json",
);
const propsSelection = await readJson(
  "production/art-source/environment-outdoor/environment.john9-zigzag-props/v2/run-001/selection.json",
);
const adapterSource = await readFile(
  "src/adapters/art-asset-adapter.ts",
  "utf8",
);
const sceneSource = await readFile("src/adapters/graybox-scene.ts", "utf8");

function imageDimensions(bytes, path) {
  if (bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }

  if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    const chunk = bytes.toString("ascii", 12, 16);
    if (chunk === "VP8X") {
      return {
        width: bytes.readUIntLE(24, 3) + 1,
        height: bytes.readUIntLE(27, 3) + 1,
      };
    }
    if (chunk === "VP8 ") {
      return {
        width: bytes.readUInt16LE(26) & 0x3fff,
        height: bytes.readUInt16LE(28) & 0x3fff,
      };
    }
  }
  throw new Error(`Unsupported runtime image format: ${path}`);
}

function pngColorType(bytes, path) {
  if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error(`Expected PNG image: ${path}`);
  }
  return bytes.readUInt8(25);
}

test("formal art manifest pins the v2 zig-zag release contract", () => {
  assert.equal(manifest.reviewStatus, "copilot-accepted-runtime-ready");
  assert.equal(manifest.distributionScope, "private");
  assert.equal(manifest.evidenceCollector, "copilot");
  assert.equal(manifest.acceptanceExecutor, "copilot");
  assert.deepEqual(manifest.worldContract, {
    width: 2560,
    height: 1792,
    topology: "north-south-zig-zag",
  });
  assert.equal(review.runtimeInventory.files, 35);
  assert.deepEqual(review.runtimeInventory.worldDimensions, {
    width: 2560,
    height: 1792,
  });
  assert.ok(review.selectedAssets.some((id) => id.includes("zigzag-world@v2")));
  assert.ok(review.selectedAssets.every((id) => !id.includes("world-base@v1")));
});

test("formal environment review points to the exact processed selections", () => {
  for (const selection of [worldSelection, propsSelection]) {
    const selected = `${selection.assetId}@${selection.promptVersion}/${selection.run}/candidate-${String(selection.selectedCandidate).padStart(2, "0")}`;
    assert.ok(review.selectedAssets.includes(selected), selected);
    const runtime = manifest.assets.find(
      ({ assetId, promptVersion, run }) =>
        assetId === selection.assetId &&
        promptVersion === selection.promptVersion &&
        run === selection.run,
    );
    assert.equal(runtime?.selectedCandidate, selection.selectedCandidate, selected);
    assert.equal(runtime?.source.sha256, selection.source.sha256, selected);
  }
});

test("all 35 runtime outputs match recorded bytes, hashes, and dimensions", async () => {
  const outputs = manifest.assets.flatMap(({ outputs }) => outputs);
  assert.equal(outputs.length, 35);
  assert.equal(new Set(outputs.map(({ path }) => path)).size, outputs.length);
  for (const output of outputs) {
    const bytes = await readFile(output.path);
    assert.equal(bytes.byteLength, output.bytes, output.path);
    assert.equal(sha256(bytes), output.sha256, output.path);
    assert.deepEqual(imageDimensions(bytes, output.path), output.dimensions);
  }
});

test("dialogue portraits are transparent traceable derivatives, not newly generated imagery", async () => {
  const portraits = manifest.assets.filter(({ family }) => family === "dialogue-portraits");
  assert.equal(portraits.length, 3);
  assert.equal(portraits.flatMap(({ outputs }) => outputs).length, 7);
  for (const portrait of portraits) {
    assert.equal(portrait.derivation?.kind, "source-crop-keyed-upscale");
    assert.equal(portrait.derivation?.generatedNewImagery, false);
    assert.match(portrait.selectionReason, /no new image generation/i);
    for (const output of portrait.outputs) {
      const bytes = await readFile(output.path);
      assert.equal(pngColorType(bytes, output.path), 6, output.path);
      assert.equal(output.processing.alphaMode, "transparent-background-key");
      assert.match(output.processing.filter, /colorkey=.*format=rgba/);
    }
  }
});

test("every runtime output is wired once and obsolete world art is unwired", () => {
  const outputs = manifest.assets.flatMap(({ outputs }) => outputs);
  for (const { path } of outputs) {
    const fileName = basename(path);
    assert.equal(
      adapterSource.split(`runtimeAsset("${fileName}")`).length - 1,
      1,
      fileName,
    );
  }
  assert.doesNotMatch(adapterSource, /john9-world-base@v1|foreground-props@v1/);
});

test("actor foot baselines are complete and applied on spawn and pose changes", () => {
  const actorOutputs = manifest.assets
    .filter(({ family }) => family.startsWith("characters-"))
    .flatMap(({ outputs }) => outputs);
  assert.equal(actorOutputs.length, 19);
  assert.equal(Object.keys(manifest.actorFootBaselines).length, 19);
  for (const { path, dimensions } of actorOutputs) {
    const baseline = manifest.actorFootBaselines[basename(path)];
    assert.ok(Number.isInteger(baseline), path);
    assert.ok(baseline > 0 && baseline <= dimensions.height, path);
  }
  assert.match(sceneSource, /art\.footBaseline! \/ art\.height/g);
  assert.match(sceneSource, /#syncNarrativeTextures\(\)/);
  for (const direction of ["down", "up", "right", "left"]) {
    assert.ok(
      actorOutputs.some(({ path }) => path.endsWith(`/observer-${direction}.png`)),
      direction,
    );
  }
  assert.match(sceneSource, /#syncPlayerFacing\(direction\.x, direction\.y\)/);
  assert.match(sceneSource, /#syncPlayerFacing\(toNext\.x, toNext\.y\)/);
  const observer = manifest.assets.find(
    ({ assetId }) => assetId === "character.observer",
  );
  assert.equal(observer?.reuseStatus, undefined);
});

test("formal props, occluders, and development graybox remain runtime-wired", () => {
  for (const id of [
    "prop.pool-edge-marker",
    "prop.inquiry-gate-panel",
    "prop.waiting-stool",
    "occluder.roadside-canopy",
    "occluder.pool-south-frond",
    "occluder.neighbors-awning",
    "occluder.inquiry-gate-edge",
    "occluder.outside-branch",
  ]) {
    assert.ok(sceneSource.includes(`"${id}"`), id);
  }
  assert.match(sceneSource, /import\.meta\.env\.DEV/);
});

test("MAI generation refuses an unapproved token destination before Azure auth", () => {
  const result = spawnSync(
    process.execPath,
    [
      "scripts/art-generate.mjs",
      "--family",
      "environment-outdoor",
      "--asset",
      "environment.john9-zigzag-world",
      "--dry-run",
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        AZURE_MAI_ENDPOINT: "https://example.invalid/",
      },
    },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must use the approved origin/);
});

test("resume recovers an immutable candidate written before its manifest update", async () => {
  const directory = await mkdtemp(`${tmpdir()}/john9-art-resume-`);
  try {
    await copyFile(
      "production/art-pipeline/candidates/environment-outdoor/environment.john9-zigzag-world/v2/run-001/candidate-01.png",
      `${directory}/candidate-01.png`,
    );
    const candidates = await reconcileCandidateFiles(
      directory,
      {
        assetId: "environment.john9-zigzag-world",
        candidateCount: 2,
        machineAcceptance: {
          exactWidth: 1152,
          exactHeight: 768,
          maximumBytes: 20_000_000,
        },
      },
      [],
    );
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].path, "candidate-01.png");
    assert.equal(candidates[0].recoveredFromInterruptedWrite, true);
    assert.equal(candidates[0].machineAccepted, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
