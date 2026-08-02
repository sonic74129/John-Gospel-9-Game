import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  assertLock,
  fetchJson,
  lockPath,
  readJson,
  root,
  writeJson,
} from "./foundation-lib.mjs";

const [command, packSpec, ...flags] = process.argv.slice(2);
const lock = await readJson(lockPath);
assertLock(lock);

function sync() {
  const result = spawnSync(
    process.execPath,
    ["scripts/sync-foundation.mjs"],
    {
      cwd: root,
      stdio: "inherit",
    },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const catalogItem = lock.guidance.find(
  (item) => item.source === "assets/catalog.json",
);
if (!catalogItem) throw new Error("Foundation catalog is not configured.");
const catalog = fetchJson(lock.repository, lock.commit, catalogItem.source);

if (command === "list") {
  for (const pack of catalog.packs) {
    console.log(`${pack.id}@${pack.version}\t${pack.status}`);
  }
  process.exit(0);
}

if (command === "add") {
  if (!packSpec || !packSpec.includes("@")) {
    throw new Error(
      "Usage: npm run foundation:use-pack -- <id>@<version> [--allow-candidate]",
    );
  }
  const splitAt = packSpec.lastIndexOf("@");
  const id = packSpec.slice(0, splitAt);
  const version = packSpec.slice(splitAt + 1);
  const pack = catalog.packs.find(
    (item) => item.id === id && item.version === version,
  );
  if (!pack) throw new Error(`Pack not found: ${packSpec}`);
  if (pack.status === "candidate" && !flags.includes("--allow-candidate")) {
    throw new Error(
      `${packSpec} is candidate-only. Add --allow-candidate to opt in explicitly.`,
    );
  }

  lock.assetPacks = [
    ...lock.assetPacks.filter((item) => item.id !== id),
    {
      id: pack.id,
      version: pack.version,
      status: pack.status,
      metadata: path.posix.join(
        path.posix.dirname(catalogItem.source),
        pack.metadata,
      ),
      manifest: path.posix.join(
        path.posix.dirname(catalogItem.source),
        pack.manifest,
      ),
    },
  ].sort((left, right) => left.id.localeCompare(right.id));
  if (pack.status === "candidate") lock.allowCandidateAssets = true;
  await writeJson(lockPath, lock);
  sync();
  process.exit(0);
}

if (command === "remove") {
  if (!packSpec) {
    throw new Error("Usage: npm run foundation:remove-pack -- <id>");
  }
  const before = lock.assetPacks.length;
  lock.assetPacks = lock.assetPacks.filter((item) => item.id !== packSpec);
  if (lock.assetPacks.length === before) {
    throw new Error(`Pack is not selected: ${packSpec}`);
  }
  lock.allowCandidateAssets = lock.assetPacks.some(
    (item) => item.status === "candidate",
  );
  await writeJson(lockPath, lock);
  sync();
  process.exit(0);
}

throw new Error(
  "Use foundation:list-packs, foundation:use-pack, or foundation:remove-pack.",
);
