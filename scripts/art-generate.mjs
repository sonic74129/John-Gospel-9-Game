import { createHash } from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
import {
  constants,
  copyFile,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const ENDPOINT =
  process.env.AZURE_MAI_ENDPOINT ??
  "https://ai-johnrpg-sonic-74129.cognitiveservices.azure.com/";
const DEPLOYMENT = process.env.AZURE_MAI_DEPLOYMENT ?? "mai-image-2-5-pro";
const TOKEN_RESOURCE = "https://cognitiveservices.azure.com/";
const REGISTRY_FILES = [
  "masters.json",
  "environment-interior.json",
  "environment-outdoor.json",
  "characters-core.json",
  "characters-supporting.json",
  "portraits.json",
];
const MAX_ATTEMPTS = 4;
const BACKOFF_MS = [15000, 30000, 60000];

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument ${token}.`);
    }
    const name = token.slice(2);
    if (name === "dry-run") {
      options.dryRun = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Argument --${name} requires a value.`);
    }
    options[name.replaceAll("-", "_")] = value;
    index += 1;
  }
  return options;
}

async function loadRegistry() {
  const registries = await Promise.all(
    REGISTRY_FILES.map(async (file) =>
      JSON.parse(
        await readFile(resolve(ROOT, "art/prompts", file), "utf8"),
      ),
    ),
  );
  return registries.flatMap(({ family, entries }) =>
    entries.map((entry) => ({ ...entry, family })),
  );
}

function validateEntry(entry) {
  const requiredStrings = [
    "assetId",
    "family",
    "runtimeUse",
    "model",
    "modelName",
    "modelVersion",
    "promptVersion",
    "prompt",
  ];
  for (const key of requiredStrings) {
    if (typeof entry[key] !== "string" || entry[key].length === 0) {
      throw new Error(`Registry entry is missing ${key}.`);
    }
  }
  if (
    entry.candidateCount < 2 ||
    entry.candidateCount > 3 ||
    !Number.isInteger(entry.candidateCount)
  ) {
    throw new Error(`${entry.assetId} candidateCount must be 2 or 3.`);
  }
  if (
    !Number.isInteger(entry.dimensions?.width) ||
    !Number.isInteger(entry.dimensions?.height)
  ) {
    throw new Error(`${entry.assetId} dimensions are invalid.`);
  }
  for (const key of [
    "must",
    "avoid",
    "visualAcceptance",
    "dependencies",
  ]) {
    if (!Array.isArray(entry[key]) || entry[key].length === 0) {
      throw new Error(`${entry.assetId} requires a non-empty ${key} list.`);
    }
  }
  if (entry.model !== DEPLOYMENT || entry.modelVersion !== "2026-06-19") {
    throw new Error(`${entry.assetId} does not use the pinned deployment.`);
  }
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function pngDimensions(bytes) {
  const signature = bytes.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a" || bytes.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error("MAI output is not a valid PNG.");
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function runNumber(name) {
  const match = /^run-(\d{3})$/.exec(name);
  return match === null ? null : Number(match[1]);
}

async function existingRuns(directory) {
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map(({ name }) => ({ name, number: runNumber(name) }))
      .filter(({ number }) => number !== null)
      .sort((left, right) => left.number - right.number);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function candidateName(index) {
  return `candidate-${String(index).padStart(2, "0")}.png`;
}

function getToken() {
  const token = execFileSync(
    "az",
    [
      "account",
      "get-access-token",
      "--resource",
      TOKEN_RESOURCE,
      "--query",
      "accessToken",
      "-o",
      "tsv",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
  if (token.length < 100) {
    throw new Error("Azure CLI returned an invalid Entra access token.");
  }
  return token;
}

async function sleep(milliseconds) {
  await new Promise((resolvePromise) =>
    setTimeout(resolvePromise, milliseconds),
  );
}

async function requestCandidate(entry) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const token = getToken();
    const response = await fetch(
      new URL("mai/v1/images/generations", ENDPOINT),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: entry.model,
          prompt: entry.prompt,
          width: entry.dimensions.width,
          height: entry.dimensions.height,
        }),
      },
    );
    if (response.ok) {
      const payload = await response.json();
      const image = payload.data?.[0];
      if (typeof image?.b64_json === "string") {
        return Buffer.from(image.b64_json, "base64");
      }
      if (typeof image?.url === "string") {
        const imageResponse = await fetch(image.url);
        if (!imageResponse.ok) {
          throw new Error(
            `Generated image download failed with HTTP ${imageResponse.status}.`,
          );
        }
        return Buffer.from(await imageResponse.arrayBuffer());
      }
      throw new Error("MAI response did not include image bytes or a URL.");
    }
    const retryable = response.status === 429 || response.status === 503;
    const detail = (await response.text()).slice(0, 800);
    if (!retryable || attempt === MAX_ATTEMPTS) {
      throw new Error(
        `MAI generation failed with HTTP ${response.status}: ${detail}`,
      );
    }
    const retryAfter = Number(response.headers.get("retry-after"));
    const delay =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 120000)
        : BACKOFF_MS[attempt - 1];
    console.error(
      `MAI capacity response ${response.status}; retrying attempt ${attempt + 1}/${MAX_ATTEMPTS} after ${delay}ms.`,
    );
    await sleep(delay);
  }
  throw new Error("MAI generation exhausted finite retries.");
}

async function writeManifest(path, manifest) {
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, {
    flag: "wx",
  });
}

async function createContactSheet(runDirectory, candidates, reviewDirectory) {
  const output = join(reviewDirectory, "contact-sheet.jpg");
  await mkdir(reviewDirectory, { recursive: true });
  const inputs = candidates.flatMap(({ path }) => ["-i", join(runDirectory, path)]);
  const scale = candidates
    .map(
      (_, index) =>
        `[${index}:v]scale=${Math.floor(1560 / candidates.length)}:-2:flags=lanczos[v${index}]`,
    )
    .join(";");
  const stackInputs = candidates.map((_, index) => `[v${index}]`).join("");
  await execFileAsync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    ...inputs,
    "-filter_complex",
    `${scale};${stackInputs}hstack=inputs=${candidates.length},scale=1600:-2:flags=lanczos`,
    "-frames:v",
    "1",
    "-q:v",
    "6",
    output,
  ]);
  const sheet = await stat(output);
  if (sheet.size > 900000) {
    throw new Error(`Contact sheet exceeds 900 KB: ${sheet.size} bytes.`);
  }
  return {
    path: basename(output),
    bytes: sheet.size,
    sha256: sha256(await readFile(output)),
  };
}

async function selectCandidate(entry, runName, index, reason) {
  if (!Number.isInteger(index) || index < 1 || index > entry.candidateCount) {
    throw new Error(`Selection must be between 1 and ${entry.candidateCount}.`);
  }
  if (typeof reason !== "string" || reason.trim().length < 20) {
    throw new Error("Selection requires a specific review reason.");
  }
  const base = resolve(
    ROOT,
    "production/art-pipeline/candidates",
    entry.family,
    entry.assetId,
    entry.promptVersion,
  );
  const runDirectory = join(base, runName);
  const manifest = JSON.parse(
    await readFile(join(runDirectory, "manifest.json"), "utf8"),
  );
  if (manifest.status !== "complete") {
    throw new Error(`Cannot select from incomplete ${runName}.`);
  }
  const candidate = manifest.candidates.find(({ index: value }) => value === index);
  if (candidate === undefined) {
    throw new Error(`Candidate ${index} is not present in ${runName}.`);
  }
  const sourceDirectory = resolve(
    ROOT,
    "production/art-source",
    entry.family,
    entry.assetId,
    entry.promptVersion,
    runName,
  );
  const reviewDirectory = resolve(
    ROOT,
    "production/art-pipeline/review",
    entry.family,
    entry.assetId,
    entry.promptVersion,
    runName,
  );
  await mkdir(sourceDirectory, { recursive: true });
  await mkdir(reviewDirectory, { recursive: true });
  const sourceName = "selected-source.png";
  await copyFile(
    join(runDirectory, candidate.path),
    join(sourceDirectory, sourceName),
    constants.COPYFILE_EXCL,
  );
  const selection = {
    schemaVersion: "1.0.0",
    storyId: "john-9-man-born-blind",
    assetId: entry.assetId,
    family: entry.family,
    promptVersion: entry.promptVersion,
    run: runName,
    selectedCandidate: index,
    reason: reason.trim(),
    visualAcceptance: entry.visualAcceptance,
    source: {
      path: `production/art-source/${entry.family}/${entry.assetId}/${entry.promptVersion}/${runName}/${sourceName}`,
      bytes: candidate.bytes,
      sha256: candidate.sha256,
    },
    reviewStatus: "selected-for-private-preview-processing",
    releaseEligible: false,
    publicRedistributionApproved: false,
    selectedAt: new Date().toISOString(),
  };
  await writeManifest(join(sourceDirectory, "selection.json"), selection);
  await writeManifest(join(reviewDirectory, "selection.json"), selection);
  console.log(
    `Selected ${entry.assetId} ${runName} candidate ${index}; source preserved immutably.`,
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const registry = await loadRegistry();
  const entry = registry.find(
    ({ family, assetId }) =>
      family === options.family && assetId === options.asset,
  );
  if (entry === undefined) {
    throw new Error(
      `Unknown registry asset ${options.family ?? "<missing>"}/${options.asset ?? "<missing>"}.`,
    );
  }
  validateEntry(entry);
  const base = resolve(
    ROOT,
    "production/art-pipeline/candidates",
    entry.family,
    entry.assetId,
    entry.promptVersion,
  );
  const runs = await existingRuns(base);
  const requestedRun =
    options.run === undefined
      ? runs.at(-1)?.name
      : `run-${String(Number(options.run)).padStart(3, "0")}`;

  if (options.select !== undefined) {
    if (requestedRun === undefined) {
      throw new Error("No candidate run exists to select.");
    }
    await selectCandidate(
      entry,
      requestedRun,
      Number(options.select),
      options.reason,
    );
    return;
  }

  const plan = {
    family: entry.family,
    assetId: entry.assetId,
    promptVersion: entry.promptVersion,
    model: `${entry.modelName}@${entry.modelVersion}`,
    deployment: entry.model,
    dimensions: entry.dimensions,
    candidateCount: entry.candidateCount,
    endpoint: new URL("mai/v1/images/generations", ENDPOINT).toString(),
  };
  if (options.dryRun) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  const mode = options.mode ?? "start";
  if (!["start", "resume", "regenerate"].includes(mode)) {
    throw new Error(`Unsupported mode ${mode}.`);
  }
  if (mode === "start" && runs.length > 0) {
    throw new Error(`${entry.assetId} already has a run; use resume or regenerate.`);
  }
  if (mode === "resume" && runs.length === 0) {
    throw new Error(`${entry.assetId} has no run to resume.`);
  }
  const run =
    mode === "regenerate" || runs.length === 0
      ? (runs.at(-1)?.number ?? 0) + 1
      : runs.at(-1).number;
  const runName = `run-${String(run).padStart(3, "0")}`;
  const runDirectory = join(base, runName);
  const centralManifestDirectory = resolve(
    ROOT,
    "production/art-pipeline/manifests",
    entry.family,
    entry.assetId,
    entry.promptVersion,
  );
  const reviewDirectory = resolve(
    ROOT,
    "production/art-pipeline/review",
    entry.family,
    entry.assetId,
    entry.promptVersion,
    runName,
  );
  await mkdir(base, { recursive: true });
  if (mode === "resume") {
    await stat(runDirectory);
  } else {
    await mkdir(runDirectory);
  }
  await mkdir(centralManifestDirectory, { recursive: true });

  let candidates = [];
  const runManifestPath = join(runDirectory, "manifest.json");
  if (mode === "resume") {
    const prior = JSON.parse(await readFile(runManifestPath, "utf8"));
    candidates = prior.candidates;
    if (prior.status === "complete") {
      throw new Error(`${entry.assetId} ${runName} is already complete.`);
    }
  }

  const manifestBase = {
    schemaVersion: "1.0.0",
    storyId: "john-9-man-born-blind",
    foundationCommit: "ac54fcac41a7080dc032e0dc801c0d28bfa2edd6",
    ...plan,
    prompt: entry.prompt,
    must: entry.must,
    avoid: entry.avoid,
    machineAcceptance: entry.machineAcceptance,
    visualAcceptance: entry.visualAcceptance,
    dependencies: entry.dependencies,
    run: runName,
    provider: "Azure AI Services",
    authentication: "Azure CLI / Entra ID",
    startedAt: new Date().toISOString(),
    status: "in-progress",
    candidates,
  };
  if (mode !== "resume") {
    await writeFile(
      runManifestPath,
      `${JSON.stringify(manifestBase, null, 2)}\n`,
      { flag: "wx" },
    );
  }

  for (let index = candidates.length + 1; index <= entry.candidateCount; index += 1) {
    console.log(
      `Generating ${entry.assetId} ${runName} candidate ${index}/${entry.candidateCount} serially.`,
    );
    const bytes = await requestCandidate(entry);
    const path = candidateName(index);
    const observedDimensions = pngDimensions(bytes);
    const machineAccepted =
      observedDimensions.width === entry.machineAcceptance.exactWidth &&
      observedDimensions.height === entry.machineAcceptance.exactHeight &&
      bytes.byteLength <= entry.machineAcceptance.maximumBytes;
    await writeFile(join(runDirectory, path), bytes, { flag: "wx" });
    candidates.push({
      index,
      path,
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
      observedDimensions,
      machineAccepted,
      generatedAt: new Date().toISOString(),
    });
    await writeFile(
      runManifestPath,
      `${JSON.stringify({ ...manifestBase, candidates }, null, 2)}\n`,
    );
  }

  const contactSheet = await createContactSheet(
    runDirectory,
    candidates,
    reviewDirectory,
  );
  const complete = {
    ...manifestBase,
    completedAt: new Date().toISOString(),
    status: candidates.every(({ machineAccepted }) => machineAccepted)
      ? "complete"
      : "machine-rejected",
    candidates,
    reviewArtifact: {
      path: `production/art-pipeline/review/${entry.family}/${entry.assetId}/${entry.promptVersion}/${runName}/${contactSheet.path}`,
      bytes: contactSheet.bytes,
      sha256: contactSheet.sha256,
      maximumLongEdge: 1600,
    },
  };
  await writeFile(runManifestPath, `${JSON.stringify(complete, null, 2)}\n`);
  await writeManifest(
    join(centralManifestDirectory, `${runName}.json`),
    complete,
  );
  console.log(
    `Completed ${entry.assetId} ${runName}; inspect ${complete.reviewArtifact.path} before selection.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
