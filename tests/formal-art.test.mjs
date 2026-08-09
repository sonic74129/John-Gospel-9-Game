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
const observerManifest = await readJson(
  "public/assets/art/characters-core/character.observer/v3/run-001/runtime-manifest.json",
);
const manManifest = await readJson(
  "public/assets/art/characters-core/character.man-born-blind/v1/run-001/runtime-manifest.json",
);
const jesusManifest = await readJson(
  "public/assets/art/characters-core/character.jesus-john9/v1/run-001/runtime-manifest.json",
);
const supportingManifest = await readJson(
  "public/assets/art/characters-supporting/character.john9-supporting/v1/run-001/runtime-manifest.json",
);
const portraitManifest = await readJson(
  "public/assets/art/dialogue-portraits/john9-derived/v1/run-001/runtime-manifest.json",
);
const adapterSource = await readFile(
  "src/adapters/art-asset-adapter.ts",
  "utf8",
);
const actorMappingSource = await readFile(
  "src/adapters/story-actor-mapping.ts",
  "utf8",
);
const sceneSource = await readFile("src/adapters/story-scene.ts", "utf8");

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
    if (chunk === "VP8L" && bytes[20] === 0x2f) {
      const bits = bytes.readUInt32LE(21);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
      };
    }
  }
  throw new Error(`Unsupported runtime image format: ${path}`);
}

test("formal art manifest pins the complete single-source private-preview contract", () => {
  assert.equal(manifest.reviewStatus, "polished-private-preview");
  assert.equal(manifest.releaseEligible, false);
  assert.equal(manifest.publicRedistributionApproved, false);
  assert.deepEqual(manifest.worldContract, {
    width: 2688,
    height: 1792,
    topology: "complete-single-source",
    sourceWidth: 1152,
    sourceHeight: 768,
    retainedSourceBounds: {
      left: 0,
      top: 0,
      right: 1152,
      bottom: 768,
    },
  });
  assert.equal(review.runtimeInventory.files, 30);
  assert.deepEqual(review.runtimeInventory.worldDimensions, {
    width: 2688,
    height: 1792,
  });
  assert.ok(review.selectedAssets.some((id) => id.includes("zigzag-world@v2")));
  assert.ok(review.selectedAssets.every((id) => !id.includes("world-base@v1")));
});

test("world processing proportionally resizes the complete selected source once", () => {
  const world = manifest.assets.find(
    ({ assetId }) => assetId === "environment.john9-zigzag-world",
  );
  assert.ok(world);
  const [output] = world.outputs;
  assert.deepEqual(output.dimensions, { width: 2688, height: 1792 });
  assert.deepEqual(output.processing, {
    tool: "Pillow",
    resizeKernel: "lanczos",
    crop: [0, 0, 1152, 768],
    outputSize: [2688, 1792],
    format: "webp",
    quality: 90,
  });
});

test("complete single-source world rebuild is deterministic", async () => {
  const worldPath =
    "public/assets/art/environment-outdoor/environment.john9-zigzag-world/v2/run-001/world-base.webp";
  const before = await readFile(worldPath);
  const rebuild = spawnSync(process.execPath, ["scripts/art-process.mjs"], {
    encoding: "utf8",
  });
  assert.equal(rebuild.status, 0, rebuild.stderr);
  assert.deepEqual(await readFile(worldPath), before);

  const directory = await mkdtemp(`${tmpdir()}/john9-world-source-test-`);
  try {
    const expectedPath = `${directory}/world-base.webp`;
    const expected = spawnSync(
      "python3",
      [
      "scripts/art-process-image.py",
      "--input",
      worldSelection.source.path,
      "--output",
      expectedPath,
      "--crop",
      "0,0,1152,768",
      "--size",
      "2688x1792",
      "--quality",
      "90",
      ],
      {
      encoding: "utf8",
      },
    );
    assert.equal(expected.status, 0, expected.stderr);
    assert.deepEqual(await readFile(worldPath), await readFile(expectedPath));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
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

test("all 30 runtime outputs match recorded bytes, hashes, and dimensions", async () => {
  const outputs = manifest.assets.flatMap(({ outputs }) => outputs);
  assert.equal(outputs.length, 30);
  assert.equal(new Set(outputs.map(({ path }) => path)).size, outputs.length);
  for (const output of outputs) {
    const bytes = await readFile(output.path);
    assert.equal(bytes.byteLength, output.bytes, output.path);
    assert.equal(sha256(bytes), output.sha256, output.path);
    assert.deepEqual(imageDimensions(bytes, output.path), output.dimensions);
  }
});

test("dialogue portrait slots reject map sprites and preserve role identity provenance", async () => {
  assert.equal(portraitManifest.family, "dialogue-portraits");
  assert.equal(portraitManifest.runtimeRole, "dialogue-portrait");
  assert.equal(portraitManifest.sourceCommit, "b53f197");
  assert.ok(portraitManifest.identityVersion);
  assert.ok(portraitManifest.outputs.length >= 7);
  for (const output of portraitManifest.outputs) {
    assert.equal(output.runtimeRole, "dialogue-portrait", output.path);
    assert.notDeepEqual(output.dimensions, { width: 36, height: 128 }, output.path);
    assert.ok(output.dimensions.width >= 240, output.path);
    assert.ok(output.dimensions.height >= 240, output.path);
    const bytes = await readFile(output.path);
    assert.equal(bytes.byteLength, output.bytes, output.path);
    assert.equal(sha256(bytes), output.sha256, output.path);
  }
});

test("Jesus directional runtime sheet is a deterministic vendor extraction", async () => {
  const output = jesusManifest.outputs.find(({ path }) =>
    path.endsWith("/jesus-directional.png"),
  );
  assert.ok(output);
  assert.equal(output.processing.tool, "node:fs.copyFile");
  assert.equal(output.processing.operation, "deterministic-byte-copy");
  assert.deepEqual(output.dimensions, { width: 288, height: 800 });
  assert.equal(output.processing.frameWidth, 96);
  assert.equal(output.processing.frameHeight, 200);
  assert.equal(output.processing.footBaseline, 193);
  assert.deepEqual(
    await readFile(output.path),
    await readFile(
      "public/assets/vendor/identity-jesus-storybook/0.1.0/character-sheet.png",
    ),
  );
  for (const direction of ["down", "up", "right", "left"]) {
    const frames = output.processing.directionalAnimation[direction];
    assert.deepEqual(
      [frames.idle, ...frames.walk].map(({ width, height }) => ({
        width,
        height,
      })),
      Array.from({ length: 3 }, () => ({ width: 96, height: 200 })),
    );
  }
});

test("per-actor manifests record complete and blocked animation coverage", () => {
  assert.equal(observerManifest.animationCoverage.directionalIdle, "complete");
  assert.equal(
    observerManifest.animationCoverage.directionalWalk,
    "blocked-imagegen-built-in-unavailable",
  );
  assert.deepEqual(jesusManifest.animationCoverage, {
    directionalIdle: "complete",
    directionalWalk: "complete",
    source:
      "public/assets/vendor/identity-jesus-storybook/0.1.0/character-sheet.png",
  });
  assert.deepEqual(supportingManifest.animationCoverage.missing, [
    "disciple-a.idle.up",
    "disciple-a.idle.down",
    "disciple-b.idle.up",
    "disciple-b.idle.down",
  ]);
  assert.ok(manManifest.animationCoverage.missing.includes("seated-blind"));
  assert.ok(manManifest.animationCoverage.missing.includes("washing"));
  assert.ok(manManifest.animationCoverage.missing.includes("washed.idle.up"));
});

test("per-actor manifests mirror aggregate formal actor metadata", () => {
  for (const actorManifest of [
    manManifest,
    jesusManifest,
    supportingManifest,
  ]) {
    const aggregate = manifest.assets.find(
      ({ assetId }) => assetId === actorManifest.assetId,
    );
    assert.ok(aggregate, actorManifest.assetId);
    assert.deepEqual(actorManifest.outputs, aggregate.outputs);
    assert.equal(actorManifest.releaseEligible, false);
    assert.equal(actorManifest.publicRedistributionApproved, false);
  }
  assert.equal(manManifest.outputs.length, 4);
  assert.equal(jesusManifest.outputs.length, 6);
  assert.equal(supportingManifest.outputs.length, 10);
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
  assert.equal(actorOutputs.length, 21);
  assert.equal(Object.keys(manifest.actorFootBaselines).length, 21);
  for (const { path, dimensions } of actorOutputs) {
    const baseline = manifest.actorFootBaselines[basename(path)];
    assert.ok(Number.isInteger(baseline), path);
    assert.ok(baseline > 0 && baseline <= dimensions.height, path);
  }
  assert.match(sceneSource, /art\.footBaseline! \/ art\.frameHeight/g);
  assert.match(sceneSource, /#syncNarrativeTextures\(\)/);
});

test("formal actor wiring is restored without old environment props", () => {
  assert.match(adapterSource, /runtimeAsset\("clay-vessel\.png"\)/);
  assert.match(sceneSource, /STORY_ART\.props\.clayVessel/);
  for (const fileName of [
    "man-worship.png",
    "jesus-found-man.png",
    "neighbor-a.png",
    "neighbor-b.png",
    "pharisee.png",
    "judean-authority.png",
    "father.png",
    "mother.png",
  ]) {
    assert.match(adapterSource, new RegExp(`runtimeAsset\\("${fileName}"\\)`));
  }
  for (const spawnId of [
    "neighbor-left",
    "neighbor-right",
    "pharisee-left",
    "pharisee-right",
    "parent-left",
    "parent-right",
  ]) {
    assert.match(adapterSource, new RegExp(`"${spawnId}"`));
    assert.match(actorMappingSource, new RegExp(`"${spawnId}"`));
  }
  assert.doesNotMatch(
    adapterSource,
    /roadside-canopy|pool-palm-frond|neighbors-awning|outer-olive-branch|courtyard-gate|pool-marker|waiting-stool/,
  );
});

test("central actor render profiles normalize native frames to adult display scale", () => {
  assert.match(adapterSource, /export const STORY_ACTOR_RENDER_PROFILES/);
  assert.match(adapterSource, /const ADULT_BASELINE_HEIGHT = 132/);
  assert.match(adapterSource, /export function actorRenderProfileForSpawn/);
  assert.match(
    adapterSource,
    /jesus: Object\.freeze\(\{ targetDisplayHeight: ADULT_BASELINE_HEIGHT \}\)/,
  );
  assert.match(
    adapterSource,
    /supportingAdult: Object\.freeze\(\{ targetDisplayHeight: ADULT_BASELINE_HEIGHT \}\)/,
  );
  assert.equal(
    jesusManifest.outputs.find(({ path }) =>
      path.endsWith("/jesus-directional.png"),
    ).processing.frameHeight,
    200,
  );
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
