import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const lockPath = path.join(root, "foundation.lock.json");
export const generatedRoot = path.join(root, ".foundation");
export const vendorRoot = path.join(root, "public", "assets", "vendor");

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

export async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function assertLock(lock) {
  if (lock.schemaVersion !== "1.0.0") {
    throw new Error("Unsupported foundation.lock.json schemaVersion.");
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(lock.repository)) {
    throw new Error("Foundation repository must use owner/repo format.");
  }
  if (!/^[a-f0-9]{40}$/.test(lock.commit)) {
    throw new Error("Foundation commit must be a full 40-character Git SHA.");
  }
  if (!Array.isArray(lock.guidance) || !Array.isArray(lock.assetPacks)) {
    throw new Error("Foundation guidance and assetPacks must be arrays.");
  }
}

export function safeTarget(relative) {
  if (path.isAbsolute(relative)) {
    throw new Error(`Absolute target is not allowed: ${relative}`);
  }
  const absolute = path.resolve(root, relative);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Target escapes repository: ${relative}`);
  }
  return absolute;
}

export function safeSource(relative) {
  const normalized = path.posix.normalize(relative);
  if (
    normalized.startsWith("../") ||
    normalized === ".." ||
    normalized.startsWith("/")
  ) {
    throw new Error(`Invalid Foundation source path: ${relative}`);
  }
  return normalized;
}

const treeCache = new Map();

function runGhApi(endpoint) {
  const result = spawnSync(
    "gh",
    ["api", endpoint],
    {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    },
  );

  if (result.error?.code === "ENOENT") {
    throw new Error(
      "GitHub CLI is required. Install gh, run gh auth login, then retry.",
    );
  }
  if (result.status !== 0) {
    const detail = result.stderr?.trim();
    throw new Error(`GitHub API failed for ${endpoint}: ${detail || "unknown error"}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`GitHub API returned invalid JSON for ${endpoint}: ${error.message}`);
  }
}

function getTree(repository, commit) {
  const key = `${repository}@${commit}`;
  if (!treeCache.has(key)) {
    const response = runGhApi(
      `repos/${repository}/git/trees/${commit}?recursive=1`,
    );
    if (response.truncated) {
      throw new Error(`Foundation Git tree is truncated for ${key}.`);
    }
    treeCache.set(
      key,
      new Map(
        response.tree
          .filter((entry) => entry.type === "blob")
          .map((entry) => [entry.path, entry]),
      ),
    );
  }
  return treeCache.get(key);
}

export function fetchRaw(repository, commit, source) {
  const cleanSource = safeSource(source);
  const entry = getTree(repository, commit).get(cleanSource);
  if (!entry) {
    throw new Error(`Foundation file does not exist at ${commit}: ${cleanSource}`);
  }
  const blob = runGhApi(`repos/${repository}/git/blobs/${entry.sha}`);
  if (blob.encoding !== "base64" || typeof blob.content !== "string") {
    throw new Error(`Unsupported Git blob encoding for ${cleanSource}.`);
  }
  const buffer = Buffer.from(blob.content.replace(/\s/g, ""), "base64");
  if (buffer.length !== entry.size) {
    throw new Error(`Git blob size mismatch for ${cleanSource}.`);
  }
  return buffer;
}

export function fetchJson(repository, commit, source) {
  const buffer = fetchRaw(repository, commit, source);
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch (error) {
    throw new Error(`Foundation JSON is invalid at ${source}: ${error.message}`);
  }
}
