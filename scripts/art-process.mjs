import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
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
  "jesus-idle.png": 112,
  "jesus-idle-look-right.png": 112,
  "jesus-clay-action.png": 104,
  "jesus-clay-action-look-right.png": 104,
  "disciple-a.png": 118,
  "disciple-a-look-right.png": 118,
  "disciple-b.png": 118,
  "disciple-b-look-right.png": 118,
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

const generatedSpecs = [
  {
    family: "environment-outdoor",
    assetId: "environment.john9-zigzag-world",
    promptVersion: "v2",
    run: "run-001",
    runtimeSelectionReason:
      "Candidate 2 is retained as immutable provenance for the audited courtyard and Siloam source crops; no other painted region is copied into the runtime world.",
    outputs: [
      {
        file: "world-base.webp",
        processor: "ffmpeg-world-composite",
        canonicalSource: {
          crop: [27, 0, 1125, 768],
          size: [2560, 1792],
          quality: 90,
        },
        canvas: {
          size: [1248, 1280],
          color: "#ead9b7",
        },
        placements: [
          {
            sourceCrop: [840, 240, 1800, 1140],
            destination: [264, 16],
          },
          {
            sourceCrop: [600, 1020, 1220, 1480],
            destination: [24, 796],
          },
        ],
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

async function verifyRuntimeManifest(path, includeReuseStatus = true) {
  const manifest = JSON.parse(await readFile(path, "utf8"));
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
    const bytes = await readFile(outputPath);
    derivedOutputs.push({
      path: outputPath.slice(ROOT.length + 1),
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
    if (output.processor === "ffmpeg-world-composite") {
      const temporaryDirectory = await mkdtemp(`${tmpdir()}/john9-world-composite-`);
      const canonicalSourcePath = resolve(temporaryDirectory, "canonical-world.webp");
      const canonicalRasterPath = resolve(temporaryDirectory, "canonical-world.png");
      const courtyardPath = resolve(temporaryDirectory, "courtyard.png");
      const poolPath = resolve(temporaryDirectory, "pool.png");
      const encodedPath = resolve(temporaryDirectory, "world-base.webp");
      try {
        await execFileAsync("python3", [
          resolve(ROOT, "scripts/art-process-image.py"),
          "--input",
          sourcePath,
          "--output",
          canonicalSourcePath,
          "--crop",
          output.canonicalSource.crop.join(","),
          "--size",
          output.canonicalSource.size.join("x"),
          "--quality",
          String(output.canonicalSource.quality),
        ]);
        await execFileAsync("ffmpeg", [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-i",
          canonicalSourcePath,
          "-frames:v",
          "1",
          canonicalRasterPath,
        ]);
        const [canvasWidth, canvasHeight] = output.canvas.size;
        const [courtyard, pool] = output.placements;
        for (const [placement, cropPath] of [
          [courtyard, courtyardPath],
          [pool, poolPath],
        ]) {
          const [left, top, right, bottom] = placement.sourceCrop;
          await execFileAsync("ffmpeg", [
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            canonicalRasterPath,
            "-vf",
            `crop=${right - left}:${bottom - top}:${left}:${top}`,
            "-frames:v",
            "1",
            cropPath,
          ]);
        }
        await execFileAsync("python3", [
          resolve(ROOT, "scripts/art-compose-image.py"),
          "--output",
          encodedPath,
          "--size",
          `${canvasWidth}x${canvasHeight}`,
          "--color",
          output.canvas.color,
          "--paste",
          `${courtyardPath}@${courtyard.destination.join(",")}`,
          "--paste",
          `${poolPath}@${pool.destination.join(",")}`,
        ]);
        await writeFile(outputPath, await readFile(encodedPath));
      } finally {
        await rm(temporaryDirectory, { recursive: true, force: true });
      }
    } else if (output.processor === "pillow-webp") {
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
        ...(output.processor === "ffmpeg-world-composite"
          ? {
              canonicalSource: {
                tool: "Pillow",
                crop: output.canonicalSource.crop,
                outputSize: output.canonicalSource.size,
                format: "webp",
                quality: output.canonicalSource.quality,
              },
              canonicalRasterization: {
                tool: "ffmpeg",
                format: "png",
              },
              canvas: {
                width: output.canvas.size[0],
                height: output.canvas.size[1],
                color: output.canvas.color,
              },
              placements: output.placements.map(({ sourceCrop, destination }) => ({
                sourceCrop,
                destination,
                scale: "none",
                blend: "none",
              })),
              format: "webp",
              lossless: true,
              compositor: "Pillow direct paste without mask",
            }
          : output.processor === "pillow-webp"
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
      width: 1248,
      height: 1280,
      topology: "courtyard-to-siloam-crop",
      sourceWidth: 2560,
      sourceHeight: 1792,
      retainedSourceBounds: {
        left: 576,
        top: 224,
        right: 1824,
        bottom: 1504,
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
