import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  copyFile,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const FOUNDATION_COMMIT = "6c836d55bfd786b8a55b4e0c7356bf8791505653";
const actorFootBaselines = Object.freeze({
  "observer.png": 99,
  "man-blind.png": 112,
  "man-clay.png": 114,
  "man-seeing.png": 112,
  "man-worship.png": 112,
  "jesus-idle.png": 112,
  "jesus-idle-look-right.png": 112,
  "jesus-clay-action.png": 104,
  "jesus-clay-action-look-right.png": 104,
  "jesus-found-man.png": 112,
  "jesus-directional.png": 193,
  "disciple-a.png": 118,
  "disciple-a-look-right.png": 118,
  "disciple-b.png": 118,
  "disciple-b-look-right.png": 118,
  "neighbor-a.png": 118,
  "neighbor-b.png": 118,
  "pharisee.png": 118,
  "judean-authority.png": 118,
  "father.png": 118,
  "mother.png": 118,
});

const reusedManifestPaths = [
  "public/assets/art/characters-core/character.observer/v3/run-001/runtime-manifest.json",
  "public/assets/art/characters-core/character.man-born-blind/v1/run-001/runtime-manifest.json",
  "public/assets/art/characters-core/character.jesus-john9/v1/run-001/runtime-manifest.json",
  "public/assets/art/characters-supporting/character.john9-supporting/v1/run-001/runtime-manifest.json",
];

const reusedTailManifestPaths = [
  "public/assets/art/environment-outdoor/environment.john9-zigzag-props/v2/run-001/runtime-manifest.json",
];

const derivedRuntimeOutputs = Object.freeze({
  "character.jesus-john9": [
    "jesus-idle-look-right.png",
    "jesus-clay-action-look-right.png",
  ],
  "character.john9-supporting": [
    "disciple-a-look-right.png",
    "disciple-b-look-right.png",
  ],
});

const pinnedJesusSheet = Object.freeze({
  source:
    "public/assets/vendor/identity-jesus-storybook/0.1.0/character-sheet.png",
  output:
    "public/assets/art/characters-core/character.jesus-john9/v1/run-001/jesus-directional.png",
  expectedSha256:
    "5e85b3f197ed29a1dd64082465c06c66cba24e1c9819a874da8ee2861d64c636",
  dimensions: Object.freeze({ width: 288, height: 800 }),
  frameWidth: 96,
  frameHeight: 200,
  footBaseline: 193,
});

const animationCoverage = Object.freeze({
  "character.observer": Object.freeze({
    directionalIdle: "complete",
    directionalWalk: "blocked-imagegen-built-in-unavailable",
    missing: Object.freeze([
      "walk.up.step-left",
      "walk.up.step-right",
      "walk.down.step-left",
      "walk.down.step-right",
      "walk.left.step-left",
      "walk.left.step-right",
      "walk.right.step-left",
      "walk.right.step-right",
    ]),
  }),
  "character.jesus-john9": Object.freeze({
    directionalIdle: "complete",
    directionalWalk: "complete",
    source: pinnedJesusSheet.source,
  }),
  "character.john9-supporting": Object.freeze({
    directionalIdle: "partial",
    directionalWalk: "not-required",
    missing: Object.freeze([
      "disciple-a.idle.up",
      "disciple-a.idle.down",
      "disciple-b.idle.up",
      "disciple-b.idle.down",
    ]),
  }),
  "character.man-born-blind": Object.freeze({
    directionalIdle: "blocked-imagegen-built-in-unavailable",
    directionalWalk: "blocked-imagegen-built-in-unavailable",
    missing: Object.freeze([
      "seated-blind",
      "clay-still",
      "pre-wash.idle.up",
      "pre-wash.idle.down",
      "pre-wash.idle.left",
      "pre-wash.idle.right",
      "pre-wash.walk.up.step-left",
      "pre-wash.walk.up.step-right",
      "pre-wash.walk.down.step-left",
      "pre-wash.walk.down.step-right",
      "pre-wash.walk.left.step-left",
      "pre-wash.walk.left.step-right",
      "pre-wash.walk.right.step-left",
      "pre-wash.walk.right.step-right",
      "washing",
      "washed.idle.up",
      "washed.idle.down",
      "washed.idle.left",
      "washed.idle.right",
    ]),
  }),
});

const generatedSpecs = [
  {
    family: "environment-outdoor",
    assetId: "environment.john9-zigzag-world",
    promptVersion: "v2",
    run: "run-001",
    runtimeSelectionReason:
      "Candidate 2 remains the pinned provenance source and is retained in full as the single continuous runtime map without crop compositing.",
    outputs: [
      {
        file: "world-base.webp",
        processor: "pillow-webp",
        crop: [0, 0, 1152, 768],
        size: [2688, 1792],
        quality: 90,
      },
    ],
  },
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function dimensions(path) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "csv=s=x:p=0",
    path,
  ]);
  const [width, height] = stdout.trim().split("x").map(Number);
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new Error(`Cannot read dimensions for ${path}.`);
  }
  return { width, height };
}

function directionalFrameMap() {
  const directions = ["down", "up", "right", "left"];
  return Object.fromEntries(
    directions.map((direction, row) => [
      direction,
      {
        idle: {
          x: 0,
          y: row * pinnedJesusSheet.frameHeight,
          width: pinnedJesusSheet.frameWidth,
          height: pinnedJesusSheet.frameHeight,
        },
        walk: [1, 2].map((column) => ({
          x: column * pinnedJesusSheet.frameWidth,
          y: row * pinnedJesusSheet.frameHeight,
          width: pinnedJesusSheet.frameWidth,
          height: pinnedJesusSheet.frameHeight,
        })),
      },
    ]),
  );
}

async function syncPinnedJesusSheet() {
  const sourceBytes = await readFile(pinnedJesusSheet.source);
  if (sha256(sourceBytes) !== pinnedJesusSheet.expectedSha256) {
    throw new Error("Pinned candidate Jesus sheet failed integrity.");
  }
  const observed = await dimensions(pinnedJesusSheet.source);
  if (
    observed.width !== pinnedJesusSheet.dimensions.width ||
    observed.height !== pinnedJesusSheet.dimensions.height
  ) {
    throw new Error("Pinned candidate Jesus sheet changed dimensions.");
  }
  await mkdir(dirname(resolve(ROOT, pinnedJesusSheet.output)), {
    recursive: true,
  });
  await copyFile(pinnedJesusSheet.source, pinnedJesusSheet.output);

  const manifestPath =
    "public/assets/art/characters-core/character.jesus-john9/v1/run-001/runtime-manifest.json";
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const directionalOutput = {
    path: pinnedJesusSheet.output,
    mediaType: "image/png",
    bytes: sourceBytes.byteLength,
    sha256: sha256(sourceBytes),
    dimensions: pinnedJesusSheet.dimensions,
    processing: {
      tool: "node:fs.copyFile",
      operation: "deterministic-byte-copy",
      source: pinnedJesusSheet.source,
      frameWidth: pinnedJesusSheet.frameWidth,
      frameHeight: pinnedJesusSheet.frameHeight,
      footBaseline: pinnedJesusSheet.footBaseline,
      directionalAnimation: directionalFrameMap(),
    },
  };
  const updated = {
    ...manifest,
    pinnedDirectionalSource: {
      assetPack: "identity-jesus-storybook@0.1.0",
      path: pinnedJesusSheet.source,
      bytes: sourceBytes.byteLength,
      sha256: sha256(sourceBytes),
      dimensions: pinnedJesusSheet.dimensions,
    },
    animationCoverage: animationCoverage["character.jesus-john9"],
    outputs: [
      ...manifest.outputs.filter(
        ({ path }) => path !== pinnedJesusSheet.output,
      ),
      directionalOutput,
    ],
  };
  await writeFile(manifestPath, `${JSON.stringify(updated, null, 2)}\n`);
}

async function verifyRuntimeManifest(path, includeReuseStatus = true) {
  const manifest = JSON.parse(await readFile(path, "utf8"));
  const existingOutputPaths = new Set(manifest.outputs.map(({ path }) => path));
  for (const output of manifest.outputs) {
    const bytes = await readFile(output.path);
    if (
      bytes.byteLength !== output.bytes ||
      sha256(bytes) !== output.sha256
    ) {
      throw new Error(`Reused runtime asset ${output.path} failed integrity.`);
    }
    const observed = await dimensions(output.path);
    if (
      observed.width !== output.dimensions.width ||
      observed.height !== output.dimensions.height
    ) {
      throw new Error(`Reused runtime asset ${output.path} changed dimensions.`);
    }
  }
  const outputDirectory = dirname(resolve(ROOT, path));
  const derivedOutputs = [];
  for (const file of derivedRuntimeOutputs[manifest.assetId] ?? []) {
    const outputPath = resolve(outputDirectory, file);
    const runtimePath = outputPath.slice(ROOT.length + 1);
    if (existingOutputPaths.has(runtimePath)) {
      continue;
    }
    const bytes = await readFile(outputPath);
    derivedOutputs.push({
      path: runtimePath,
      mediaType: "image/png",
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
      dimensions: await dimensions(outputPath),
      processing: {
        tool: "ffmpeg",
        filter: "hflip",
      },
    });
  }
  const verified = {
    ...manifest,
    ...(animationCoverage[manifest.assetId] === undefined
      ? {}
      : { animationCoverage: animationCoverage[manifest.assetId] }),
    outputs: [...manifest.outputs, ...derivedOutputs],
  };
  return includeReuseStatus
    ? { ...verified, reuseStatus: "verified-geometry-independent" }
    : verified;
}

async function processSpec(spec) {
  const sourceDirectory = resolve(
    ROOT,
    "production/art-source",
    spec.family,
    spec.assetId,
    spec.promptVersion,
    spec.run,
  );
  const selection = JSON.parse(
    await readFile(resolve(sourceDirectory, "selection.json"), "utf8"),
  );
  const sourcePath = resolve(sourceDirectory, "selected-source.png");
  const sourceBytes = await readFile(sourcePath);
  if (sha256(sourceBytes) !== selection.source.sha256) {
    throw new Error(`${spec.assetId} selected source hash does not match.`);
  }
  const outputDirectory = resolve(
    ROOT,
    "public/assets/art",
    spec.family,
    spec.assetId,
    spec.promptVersion,
    spec.run,
  );
  await mkdir(outputDirectory, { recursive: true });
  const outputs = [];
  for (const output of spec.outputs) {
    const outputPath = resolve(outputDirectory, output.file);
    if (output.processor === "pillow-webp") {
      await rm(outputPath, { force: true });
      await execFileAsync("python3", [
        resolve(ROOT, "scripts/art-process-image.py"),
        "--input",
        sourcePath,
        "--output",
        outputPath,
        "--crop",
        output.crop.join(","),
        "--size",
        output.size.join("x"),
        "--quality",
        String(output.quality),
      ]);
    } else {
      await execFileAsync("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        sourcePath,
        "-vf",
        output.filter,
        "-frames:v",
        "1",
        outputPath,
      ]);
    }
    const bytes = await readFile(outputPath);
    outputs.push({
      path: outputPath.slice(ROOT.length + 1),
      mediaType: output.file.endsWith(".webp") ? "image/webp" : "image/png",
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
      dimensions: await dimensions(outputPath),
      processing: {
        tool: output.processor === "pillow-webp" ? "Pillow" : "ffmpeg",
        ...(output.processor === "pillow-webp"
          ? {
              resizeKernel: "lanczos",
              crop: output.crop,
              outputSize: output.size,
              format: "webp",
              quality: output.quality,
            }
          : { resizeKernel: "lanczos", filter: output.filter }),
      },
    });
  }
  const manifest = {
    schemaVersion: "1.0.0",
    storyId: "john-9-man-born-blind",
    foundationCommit: FOUNDATION_COMMIT,
    assetId: spec.assetId,
    family: spec.family,
    promptVersion: spec.promptVersion,
    run: spec.run,
    source: selection.source,
    selectedCandidate: selection.selectedCandidate,
    selectionReason: spec.runtimeSelectionReason ?? selection.reason,
    outputs,
    reviewStatus: "processed-for-polished-private-preview",
    releaseEligible: false,
    publicRedistributionApproved: false,
  };
  await writeFile(
    resolve(outputDirectory, "runtime-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    {},
  );
  return manifest;
}

async function main() {
  const globalManifestPath = resolve(ROOT, "public/assets/art/manifest.json");
  await syncPinnedJesusSheet();
  const reused = [];
  for (const path of reusedManifestPaths) {
    reused.push(await verifyRuntimeManifest(path));
  }
  const generated = [];
  for (const spec of generatedSpecs) {
    generated.push(await processSpec(spec));
  }
  const reusedTail = [];
  for (const path of reusedTailManifestPaths) {
    reusedTail.push(await verifyRuntimeManifest(path, false));
  }
  const manifest = {
    schemaVersion: "1.0.0",
    storyId: "john-9-man-born-blind",
    foundationCommit: FOUNDATION_COMMIT,
    generatedBy: "scripts/art-process.mjs",
    worldContract: {
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
    },
    actorFootBaselines,
    assets: [...reused, ...generated, ...reusedTail],
    reviewStatus: "polished-private-preview",
    releaseEligible: false,
    publicRedistributionApproved: false,
  };
  await mkdir(dirname(globalManifestPath), { recursive: true });
  await writeFile(
    globalManifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    {},
  );
  console.log(
    `Verified/reused ${reused.length + reusedTail.length} assets and processed ${generated.reduce((sum, asset) => sum + asset.outputs.length, 0)} new runtime files.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
