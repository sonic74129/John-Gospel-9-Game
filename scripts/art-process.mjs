import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const KEY = "colorkey=0xF7F0DE:0.24:0.08";

const specs = [
  {
    family: "environment-outdoor",
    assetId: "environment.john9-world-base",
    promptVersion: "v1",
    run: "run-001",
    outputs: [
      {
        file: "world-base.webp",
        processor: "pillow-webp",
        crop: [0, 61, 1152, 706],
        size: [3200, 1792],
        quality: 88,
      },
    ],
  },
  {
    family: "environment-outdoor",
    assetId: "environment.john9-foreground-props",
    promptVersion: "v1",
    run: "run-001",
    outputs: [
      {
        file: "olive-canopy.png",
        filter: `crop=384:384:0:0,${KEY},scale=-2:260:flags=lanczos,format=rgba`,
      },
      {
        file: "palm-frond.png",
        filter: `crop=384:384:384:0,${KEY},scale=-2:220:flags=lanczos,format=rgba`,
      },
      {
        file: "courtyard-gate.png",
        filter: `crop=384:384:768:0,${KEY},scale=-2:190:flags=lanczos,format=rgba`,
      },
      {
        file: "clay-vessel.png",
        filter: `crop=384:384:0:384,${KEY},scale=-2:72:flags=lanczos,format=rgba`,
      },
      {
        file: "pool-marker.png",
        filter: `crop=384:384:384:384,${KEY},scale=-2:96:flags=lanczos,format=rgba`,
      },
      {
        file: "waiting-stool.png",
        filter: `crop=384:384:768:384,${KEY},scale=-2:96:flags=lanczos,format=rgba`,
      },
    ],
  },
  {
    family: "characters-core",
    assetId: "character.observer",
    promptVersion: "v3",
    run: "run-001",
    outputs: [
      {
        file: "observer.png",
        filter: `crop=256:900:0:62,${KEY},scale=-2:128:flags=lanczos,format=rgba`,
      },
    ],
  },
  {
    family: "characters-core",
    assetId: "character.man-born-blind",
    promptVersion: "v1",
    run: "run-001",
    outputs: [
      {
        file: "man-blind.png",
        filter: `crop=256:900:0:62,${KEY},scale=-2:128:flags=lanczos,format=rgba`,
      },
      {
        file: "man-clay.png",
        filter: `crop=256:900:256:62,${KEY},scale=-2:128:flags=lanczos,format=rgba`,
      },
      {
        file: "man-seeing.png",
        filter: `crop=256:900:512:62,${KEY},scale=-2:128:flags=lanczos,format=rgba`,
      },
      {
        file: "man-worship.png",
        filter: `crop=256:900:768:62,${KEY},scale=-2:128:flags=lanczos,format=rgba`,
      },
    ],
  },
  {
    family: "characters-core",
    assetId: "character.jesus-john9",
    promptVersion: "v1",
    run: "run-001",
    outputs: [
      {
        file: "jesus-idle.png",
        filter: `crop=341:900:0:62,${KEY},scale=-2:132:flags=lanczos,format=rgba`,
      },
      {
        file: "jesus-clay-action.png",
        filter: `crop=341:900:341:62,${KEY},scale=-2:132:flags=lanczos,format=rgba`,
      },
      {
        file: "jesus-found-man.png",
        filter: `crop=342:900:682:62,${KEY},scale=-2:132:flags=lanczos,format=rgba`,
      },
    ],
  },
  {
    family: "characters-supporting",
    assetId: "character.john9-supporting",
    promptVersion: "v1",
    run: "run-001",
    outputs: [
      "disciple-a",
      "disciple-b",
      "neighbor-a",
      "neighbor-b",
      "pharisee",
      "judean-authority",
      "father",
      "mother",
    ].map((name, index) => ({
      file: `${name}.png`,
      filter:
        `crop=256:512:${(index % 4) * 256}:${Math.floor(index / 4) * 512},` +
        `${KEY},scale=-2:120:flags=lanczos,format=rgba`,
    })),
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
    foundationCommit: "ac54fcac41a7080dc032e0dc801c0d28bfa2edd6",
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
      throw new Error(
        "Runtime art manifest already exists; create a new versioned run instead of overwriting.",
      );
    })
    .catch((error) => {
      if (error.code !== "ENOENT") {
        throw error;
      }
    });
  const assets = [];
  for (const spec of specs) {
    assets.push(await processSpec(spec));
  }
  const manifest = {
    schemaVersion: "1.0.0",
    storyId: "john-9-man-born-blind",
    generatedBy: "scripts/art-process.mjs",
    assets,
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
    `Processed ${assets.reduce((sum, asset) => sum + asset.outputs.length, 0)} immutable runtime art files.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
