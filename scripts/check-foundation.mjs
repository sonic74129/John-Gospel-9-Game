import { promises as fs } from "node:fs";
import path from "node:path";
import {
  assertLock,
  generatedRoot,
  lockPath,
  readJson,
  root,
  safeTarget,
  sha256,
} from "./foundation-lib.mjs";

const lock = await readJson(lockPath);
assertLock(lock);

const manifestPath = path.join(generatedRoot, "sync-manifest.json");
const manifest = await readJson(manifestPath);
const errors = [];

if (
  manifest.foundation.repository !== lock.repository ||
  manifest.foundation.commit !== lock.commit
) {
  errors.push("Foundation sync manifest does not match foundation.lock.json.");
}

const manifestPacks = JSON.stringify(manifest.assetPacks);
const lockPacks = JSON.stringify(
  lock.assetPacks.map(({ id, version, status }) => ({ id, version, status })),
);
if (manifestPacks !== lockPacks) {
  errors.push("Synced asset packs do not match foundation.lock.json.");
}

const declaredTargets = new Set();
for (const file of manifest.files) {
  if (declaredTargets.has(file.target)) {
    errors.push(`Duplicate synced target: ${file.target}`);
    continue;
  }
  declaredTargets.add(file.target);
  try {
    const buffer = await fs.readFile(safeTarget(file.target));
    if (buffer.length !== file.bytes) {
      errors.push(`${file.target}: byte count mismatch`);
    }
    if (sha256(buffer) !== file.sha256) {
      errors.push(`${file.target}: SHA-256 mismatch`);
    }
  } catch (error) {
    errors.push(`${file.target}: ${error.message}`);
  }
}

const expectedGuidance = new Set(lock.guidance.map((item) => item.target));
for (const target of expectedGuidance) {
  if (!declaredTargets.has(target)) {
    errors.push(`Missing synced guidance: ${target}`);
  }
}

for (const relative of [
  ".foundation/docs/FOUNDATION_CHARTER.zh-CN.md",
  ".foundation/docs/BIBLE_STORY_GAME_PLAYBOOK.zh-CN.md",
  ".foundation/docs/MULTI_REPO_ARCHITECTURE.zh-CN.md",
]) {
  try {
    const text = await fs.readFile(path.join(root, relative), "utf8");
    if (text.length < 100) errors.push(`${relative}: guidance is unexpectedly short`);
  } catch (error) {
    errors.push(`${relative}: ${error.message}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  console.error("Run npm run foundation:sync after intentional lock changes.");
  process.exit(1);
}

console.log(
  `Foundation lock verified at ${lock.commit.slice(0, 12)} (${manifest.files.length} files).`,
);
