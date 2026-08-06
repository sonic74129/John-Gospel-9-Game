import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const SOURCE =
  "production/art-source/characters-core/character.observer/v3/run-001/selected-source.png";
const RUNTIME_DIRECTORY =
  "public/assets/art/characters-core/character.observer/v3/run-001";
const RUNTIME_MANIFEST = `${RUNTIME_DIRECTORY}/runtime-manifest.json`;
const GLOBAL_MANIFEST = "public/assets/art/manifest.json";
const EXPECTED_SOURCE_SHA256 =
  "a5475a9cd42605f03bd0bf864fa224cb15541282da45b3e4f4e77c1e2932a0e3";
const KEY = "colorkey=0xF7F0DE:0.24:0.08";
const directions = [
  { name: "down", x: 0 },
  { name: "up", x: 256 },
  { name: "right", x: 512 },
  { name: "left", x: 768 },
];

const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

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
  return { width, height };
}

async function footBaseline(path) {
  const { stdout } = await execFileAsync("python3", [
    "-c",
    [
      "from PIL import Image",
      "import sys",
      "box=Image.open(sys.argv[1]).convert('RGBA').getchannel('A').getbbox()",
      "print(box[3] if box else 0)",
    ].join(";"),
    path,
  ]);
  const baseline = Number(stdout.trim());
  if (!Number.isInteger(baseline) || baseline <= 0) {
    throw new Error(`Cannot determine foot baseline for ${path}.`);
  }
  return baseline;
}

const sourceBytes = await readFile(resolve(ROOT, SOURCE));
if (sha256(sourceBytes) !== EXPECTED_SOURCE_SHA256) {
  throw new Error("Observer v3 selected source SHA-256 changed.");
}

const outputs = [];
const baselines = {};
for (const direction of directions) {
  const file = `observer-${direction.name}.png`;
  const path = `${RUNTIME_DIRECTORY}/${file}`;
  const filter =
    `crop=256:900:${direction.x}:62,${KEY},scale=-2:128:flags=lanczos,format=rgba`;
  await execFileAsync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    resolve(ROOT, SOURCE),
    "-vf",
    filter,
    "-frames:v",
    "1",
    resolve(ROOT, path),
  ]);
  const bytes = await readFile(resolve(ROOT, path));
  const observedDimensions = await dimensions(resolve(ROOT, path));
  outputs.push({
    path,
    mediaType: "image/png",
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
    dimensions: observedDimensions,
    processing: {
      tool: "ffmpeg",
      resizeKernel: "lanczos",
      filter,
    },
  });
  baselines[file] = await footBaseline(resolve(ROOT, path));
}

const runtimeManifest = JSON.parse(
  await readFile(resolve(ROOT, RUNTIME_MANIFEST), "utf8"),
);
runtimeManifest.foundationCommit =
  "b534680100ce4006a7c0bf6a5b50923afaeb6266";
runtimeManifest.outputs = outputs;
runtimeManifest.reviewStatus = "copilot-accepted-runtime-ready";
runtimeManifest.distributionScope = "private";
runtimeManifest.evidenceCollector = "copilot";
runtimeManifest.acceptanceExecutor = "copilot";
delete runtimeManifest.releaseEligible;
delete runtimeManifest.publicRedistributionApproved;
await writeFile(
  resolve(ROOT, RUNTIME_MANIFEST),
  `${JSON.stringify(runtimeManifest, null, 2)}\n`,
);

const globalManifest = JSON.parse(
  await readFile(resolve(ROOT, GLOBAL_MANIFEST), "utf8"),
);
const observer = globalManifest.assets.find(
  ({ assetId }) => assetId === "character.observer",
);
if (observer === undefined) {
  throw new Error("Global art manifest has no observer asset.");
}
observer.foundationCommit =
  "b534680100ce4006a7c0bf6a5b50923afaeb6266";
observer.outputs = outputs;
observer.reviewStatus = runtimeManifest.reviewStatus;
observer.distributionScope = runtimeManifest.distributionScope;
observer.evidenceCollector = "copilot";
observer.acceptanceExecutor = "copilot";
delete observer.releaseEligible;
delete observer.publicRedistributionApproved;
delete observer.reuseStatus;
delete globalManifest.actorFootBaselines["observer.png"];
Object.assign(globalManifest.actorFootBaselines, baselines);
globalManifest.foundationCommit =
  "b534680100ce4006a7c0bf6a5b50923afaeb6266";
globalManifest.reviewStatus = "copilot-accepted-runtime-ready";
globalManifest.distributionScope = "private";
globalManifest.evidenceCollector = "copilot";
globalManifest.acceptanceExecutor = "copilot";
delete globalManifest.releaseEligible;
delete globalManifest.publicRedistributionApproved;

for (const asset of globalManifest.assets) {
  asset.foundationCommit =
    "b534680100ce4006a7c0bf6a5b50923afaeb6266";
  asset.reviewStatus = "copilot-accepted-runtime-ready";
  asset.distributionScope = "private";
  asset.evidenceCollector = "copilot";
  asset.acceptanceExecutor = "copilot";
  delete asset.releaseEligible;
  delete asset.publicRedistributionApproved;

  const firstOutput = asset.outputs[0];
  if (firstOutput === undefined) {
    throw new Error(`${asset.assetId} has no runtime output.`);
  }
  const runtimePath = resolve(
    ROOT,
    firstOutput.path.replace(/[^/]+$/, "runtime-manifest.json"),
  );
  const assetManifest = JSON.parse(await readFile(runtimePath, "utf8"));
  Object.assign(assetManifest, {
    foundationCommit:
      "b534680100ce4006a7c0bf6a5b50923afaeb6266",
    reviewStatus: "copilot-accepted-runtime-ready",
    distributionScope: "private",
    evidenceCollector: "copilot",
    acceptanceExecutor: "copilot",
  });
  if (asset.assetId === "character.observer") {
    assetManifest.outputs = outputs;
  }
  delete assetManifest.releaseEligible;
  delete assetManifest.publicRedistributionApproved;
  await writeFile(runtimePath, `${JSON.stringify(assetManifest, null, 2)}\n`);
}
await writeFile(
  resolve(ROOT, GLOBAL_MANIFEST),
  `${JSON.stringify(globalManifest, null, 2)}\n`,
);

console.log(
  `Processed ${outputs.length} observer directions: ${outputs.map(({ path }) => basename(path)).join(", ")}.`,
);
