import { promises as fs } from "node:fs";
import path from "node:path";
import {
  assertLock,
  fetchJson,
  fetchRaw,
  generatedRoot,
  lockPath,
  readJson,
  root,
  safeTarget,
  sha256,
  vendorRoot,
  writeJson,
} from "./foundation-lib.mjs";

const lock = await readJson(lockPath);
assertLock(lock);

await fs.rm(generatedRoot, { recursive: true, force: true });
await fs.rm(vendorRoot, { recursive: true, force: true });
await fs.mkdir(generatedRoot, { recursive: true });
await fs.mkdir(vendorRoot, { recursive: true });

const syncedFiles = [];

async function saveFromFoundation(source, target) {
  const buffer = fetchRaw(lock.repository, lock.commit, source);
  const absolute = safeTarget(target);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, buffer);
  syncedFiles.push({
    source,
    target,
    bytes: buffer.length,
    sha256: sha256(buffer),
  });
  return buffer;
}

for (const item of lock.guidance) {
  await saveFromFoundation(item.source, item.target);
}

for (const requested of lock.assetPacks) {
  const metadata = fetchJson(
    lock.repository,
    lock.commit,
    requested.metadata,
  );
  const manifestBuffer = fetchRaw(
    lock.repository,
    lock.commit,
    requested.manifest,
  );
  const manifest = JSON.parse(manifestBuffer.toString("utf8"));
  const metadataBuffer = fetchRaw(
    lock.repository,
    lock.commit,
    requested.metadata,
  );

  for (const field of ["id", "version", "status"]) {
    if (
      requested[field] !== metadata[field] ||
      requested[field] !== manifest[field]
    ) {
      throw new Error(`${requested.id}: inconsistent ${field}.`);
    }
  }
  if (manifest.metadataSha256 !== sha256(metadataBuffer)) {
    throw new Error(`${requested.id}: pack metadata hash mismatch.`);
  }
  if (requested.status === "candidate" && !lock.allowCandidateAssets) {
    throw new Error(
      `${requested.id} is candidate-only. Re-run the add command with --allow-candidate.`,
    );
  }
  if (requested.status !== "stable" && requested.status !== "candidate") {
    throw new Error(`${requested.id}: unsupported pack status ${requested.status}.`);
  }

  const metadataTarget = `.foundation/assets/packs/${requested.id}/${requested.version}/pack.json`;
  const manifestTarget = `.foundation/assets/packs/${requested.id}/${requested.version}/manifest.json`;
  await fs.mkdir(path.dirname(safeTarget(metadataTarget)), { recursive: true });
  await fs.writeFile(safeTarget(metadataTarget), metadataBuffer);
  await fs.writeFile(safeTarget(manifestTarget), manifestBuffer);
  syncedFiles.push({
    source: requested.metadata,
    target: metadataTarget,
    bytes: metadataBuffer.length,
    sha256: sha256(metadataBuffer),
  });
  syncedFiles.push({
    source: requested.manifest,
    target: manifestTarget,
    bytes: manifestBuffer.length,
    sha256: sha256(manifestBuffer),
  });

  const packDirectory = path.posix.dirname(requested.manifest);
  for (const file of manifest.files.filter((entry) => entry.role === "runtime")) {
    const source = path.posix.join(packDirectory, file.path);
    const runtimeRelative = file.path.replace(/^runtime\//, "");
    const target = path.posix.join(
      "public/assets/vendor",
      requested.id,
      requested.version,
      runtimeRelative,
    );
    const buffer = await saveFromFoundation(source, target);
    if (buffer.length !== file.bytes || sha256(buffer) !== file.sha256) {
      throw new Error(`${requested.id}: runtime hash mismatch for ${file.path}.`);
    }
  }
}

syncedFiles.sort((left, right) => left.target.localeCompare(right.target));
await writeJson(path.join(generatedRoot, "sync-manifest.json"), {
  schemaVersion: "1.0.0",
  foundation: {
    repository: lock.repository,
    commit: lock.commit,
  },
  assetPacks: lock.assetPacks.map(({ id, version, status }) => ({
    id,
    version,
    status,
  })),
  files: syncedFiles,
});

const storyConfigPath = path.join(root, "src", "story", "story.config.json");
const gameManifestPath = path.join(root, "game.manifest.json");
const storyConfig = await readJson(storyConfigPath);
const gameManifest = await readJson(gameManifestPath);
storyConfig.foundationCommit = lock.commit;
gameManifest.foundationCommit = lock.commit;
gameManifest.assetPacks = Object.fromEntries(
  lock.assetPacks.map((pack) => [pack.id, pack.version]),
);
await writeJson(storyConfigPath, storyConfig);
await writeJson(gameManifestPath, gameManifest);

console.log(
  `Synced ${syncedFiles.length} files from ${lock.repository}@${lock.commit}.`,
);
