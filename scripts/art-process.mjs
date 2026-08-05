import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const FOUNDATION_COMMIT = "6c836d55bfd786b8a55b4e0c7356bf8791505653";
const KEY = "colorkey=0xF7F0DE:0.24:0.08";
const actorFootBaselines = Object.freeze({
  "observer.png": 99,
  "man-blind.png": 112,
  "man-clay.png": 114,
  "man-seeing.png": 112,
  "man-worship.png": 112,
  "jesus-idle.png": 112,
  "jesus-clay-action.png": 104,
  "jesus-found-man.png": 115,
  "disciple-a.png": 118,
  "disciple-b.png": 118,
  "neighbor-a.png": 118,
  "neighbor-b.png": 117,
  "pharisee.png": 110,
  "judean-authority.png": 110,
  "father.png": 110,
  "mother.png": 109,
});

const reusedManifestPaths = [
  "public/assets/art/characters-core/character.observer/v3/run-001/runtime-manifest.json",
  "public/assets/art/characters-core/character.man-born-blind/v1/run-001/runtime-manifest.json",
  "public/assets/art/characters-core/character.jesus-john9/v1/run-001/runtime-manifest.json",
  "public/assets/art/characters-supporting/character.john9-supporting/v1/run-001/runtime-manifest.json",
];

const generatedSpecs = [
  {
    family: "environment-outdoor",
    assetId: "environment.john9-zigzag-world",
    promptVersion: "v2",
    run: "run-001",
    outputs: [
      {
        file: "world-base.webp",
        processor: "pillow-webp",
        crop: [27, 0, 1125, 768],
        size: [2560, 1792],
        quality: 90,
      },
    ],
  },
  {
    family: "environment-outdoor",
    assetId: "environment.john9-zigzag-props",
    promptVersion: "v2",
    run: "run-001",
    outputs: [
      {
        file: "roadside-canopy.png",
        filter: `crop=288:384:0:0,${KEY},scale=-2:240:flags=lanczos,format=rgba`,
      },
      {
        file: "pool-palm-frond.png",
        filter: `crop=288:384:288:0,${KEY},scale=-2:220:flags=lanczos,format=rgba`,
      },
      {
        file: "neighbors-awning.png",
        filter: `crop=288:384:576:0,${KEY},scale=-2:220:flags=lanczos,format=rgba`,
      },
      {
        file: "outer-olive-branch.png",
        filter: `crop=288:384:864:0,${KEY},scale=-2:200:flags=lanczos,format=rgba`,
      },
      {
        file: "courtyard-gate.png",
        filter: `crop=288:384:0:384,${KEY},scale=-2:220:flags=lanczos,format=rgba`,
      },
      {
        file: "clay-vessel.png",
        filter: `crop=288:384:288:384,${KEY},scale=-2:72:flags=lanczos,format=rgba`,
      },
      {
        file: "pool-marker.png",
        filter: `crop=288:384:576:384,${KEY},scale=-2:96:flags=lanczos,format=rgba`,
      },
      {
        file: "waiting-stool.png",
        filter: `crop=288:384:864:384,${KEY},scale=-2:96:flags=lanczos,format=rgba`,
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

async function verifyRuntimeManifest(path) {
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
  return { ...manifest, reuseStatus: "verified-geometry-independent" };
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
        "-n",
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
        resizeKernel: "lanczos",
        ...(output.processor === "pillow-webp"
          ? {
              crop: output.crop,
              outputSize: output.size,
              format: "webp",
              quality: output.quality,
            }
          : { filter: output.filter }),
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
    selectionReason: selection.reason,
    outputs,
    reviewStatus: "processed-for-polished-private-preview",
    releaseEligible: false,
    publicRedistributionApproved: false,
  };
  await writeFile(
    resolve(outputDirectory, "runtime-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { flag: "wx" },
  );
  return manifest;
}

async function main() {
  const globalManifestPath = resolve(ROOT, "public/assets/art/manifest.json");
  await stat(globalManifestPath)
    .then(() => {
      throw new Error("Runtime art manifest already exists; refuse overwrite.");
    })
    .catch((error) => {
      if (error.code !== "ENOENT") {
        throw error;
      }
    });
  const reused = [];
  for (const path of reusedManifestPaths) {
    reused.push(await verifyRuntimeManifest(path));
  }
  const generated = [];
  for (const spec of generatedSpecs) {
    generated.push(await processSpec(spec));
  }
  const manifest = {
    schemaVersion: "1.0.0",
    storyId: "john-9-man-born-blind",
    foundationCommit: FOUNDATION_COMMIT,
    generatedBy: "scripts/art-process.mjs",
    worldContract: {
      width: 2560,
      height: 1792,
      topology: "north-south-zig-zag",
    },
    actorFootBaselines,
    assets: [...reused, ...generated],
    reviewStatus: "polished-private-preview",
    releaseEligible: false,
    publicRedistributionApproved: false,
  };
  await mkdir(dirname(globalManifestPath), { recursive: true });
  await writeFile(
    globalManifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    { flag: "wx" },
  );
  console.log(
    `Verified/reused ${reused.length} assets and processed ${generated.reduce((sum, asset) => sum + asset.outputs.length, 0)} new runtime files.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
