import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const GLOBAL_MANIFEST = "public/assets/art/manifest.json";
const REVIEW = "production/asset-reviews/story-local-art-review.json";
const RUNTIME_DIRECTORY =
  "public/assets/art/dialogue-portraits/john9-derived/v1/run-001";
const KEY = "colorkey=0xF7F0DE:0.14:0.06";

const sources = Object.freeze({
  jesus: Object.freeze({
    path: "production/art-source/characters-core/character.jesus-john9/v1/run-001/selected-source.png",
    sha256: "3337747836af6ac2b7b90f52a11b2cb1a90f3fe8eeaa3751e42a130743fed31e",
  }),
  man: Object.freeze({
    path: "production/art-source/characters-core/character.man-born-blind/v1/run-001/selected-source.png",
    sha256: "27357a83812983ad91dfa52bed6b22c437f13068d7d6ca18b0826958bc39b765",
  }),
  supporting: Object.freeze({
    path: "production/art-source/characters-supporting/character.john9-supporting/v1/run-001/selected-source.png",
    sha256: "b90e107d951c5165a8b8ee1da5ee650ce730eec71773a93e8a3b0cd5a03cf8ce",
  }),
});

const portraits = Object.freeze([
  {
    assetId: "portrait.john9-dialogue-jesus",
    source: "jesus",
    file: "portrait-jesus.png",
    filter: `crop=342:360:682:180,${KEY},scale=420:-2:flags=lanczos,format=rgba`,
  },
  {
    assetId: "portrait.john9-dialogue-man",
    source: "man",
    file: "portrait-man-blind.png",
    filter: `crop=280:330:0:340,${KEY},scale=400:-2:flags=lanczos,format=rgba`,
  },
  {
    assetId: "portrait.john9-dialogue-man",
    source: "man",
    file: "portrait-man-seeing.png",
    filter: `crop=300:360:500:220,${KEY},scale=400:-2:flags=lanczos,format=rgba`,
  },
  {
    assetId: "portrait.john9-dialogue-supporting",
    source: "supporting",
    file: "portrait-disciples.png",
    filter: `crop=256:300:256:0,${KEY},scale=400:-2:flags=lanczos,format=rgba`,
  },
  {
    assetId: "portrait.john9-dialogue-supporting",
    source: "supporting",
    file: "portrait-neighbors.png",
    filter: `crop=256:300:512:0,${KEY},scale=400:-2:flags=lanczos,format=rgba`,
  },
  {
    assetId: "portrait.john9-dialogue-supporting",
    source: "supporting",
    file: "portrait-authorities.png",
    filter: `crop=256:300:0:0,${KEY},scale=400:-2:flags=lanczos,format=rgba`,
  },
  {
    assetId: "portrait.john9-dialogue-supporting",
    source: "supporting",
    file: "portrait-parents.png",
    filter: `crop=256:300:768:0,${KEY},scale=400:-2:flags=lanczos,format=rgba`,
  },
]);

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

for (const source of Object.values(sources)) {
  const bytes = await readFile(resolve(ROOT, source.path));
  if (sha256(bytes) !== source.sha256) {
    throw new Error(`Dialogue portrait source changed: ${source.path}`);
  }
}

const outputsByAssetId = new Map();
for (const portrait of portraits) {
  const source = sources[portrait.source];
  const path = `${RUNTIME_DIRECTORY}/${portrait.file}`;
  await execFileAsync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    resolve(ROOT, source.path),
    "-vf",
    portrait.filter,
    "-frames:v",
    "1",
    resolve(ROOT, path),
  ]);
  const bytes = await readFile(resolve(ROOT, path));
  const output = {
    path,
    mediaType: "image/png",
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
    dimensions: await dimensions(resolve(ROOT, path)),
    processing: {
      tool: "ffmpeg",
      resizeKernel: "lanczos",
      filter: portrait.filter,
      alphaMode: "transparent-background-key",
    },
  };
  outputsByAssetId.set(portrait.assetId, [
    ...(outputsByAssetId.get(portrait.assetId) ?? []),
    output,
  ]);
}

const manifest = JSON.parse(
  await readFile(resolve(ROOT, GLOBAL_MANIFEST), "utf8"),
);
for (const [assetId, outputs] of outputsByAssetId) {
  const asset = manifest.assets.find((candidate) => candidate.assetId === assetId);
  if (asset === undefined) {
    throw new Error(`Dialogue portrait manifest entry is missing: ${assetId}`);
  }
  asset.outputs = outputs;
  asset.derivation.kind = "source-crop-keyed-upscale";
  asset.selectionReason =
    "Derived non-destructively from selected source art with a transparent keyed background for the dialogue portrait overlay; no new image generation or photorealistic claim.";
}
await writeFile(
  resolve(ROOT, GLOBAL_MANIFEST),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

const review = JSON.parse(await readFile(resolve(ROOT, REVIEW), "utf8"));
review.visualAcceptance.dialoguePortraits =
  "transparent source-art crop portraits accepted for non-blocking RPG dialogue staging; no new photorealistic artwork was generated";
review.limitations = review.limitations.map((limitation) =>
  limitation.startsWith("Dialogue portraits are")
    ? "Dialogue portraits are transparent non-destructive crops/upscales of selected source art, not newly generated or photorealistic portraits."
    : limitation,
);
await writeFile(resolve(ROOT, REVIEW), `${JSON.stringify(review, null, 2)}\n`);
