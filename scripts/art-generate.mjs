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
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const APPROVED_ENDPOINT = new URL(
  "https://ai-johnrpg-sonic-74129.cognitiveservices.azure.com/",
);
const ENDPOINT = new URL(process.env.AZURE_MAI_ENDPOINT ?? APPROVED_ENDPOINT);
if (
  ENDPOINT.protocol !== "https:" ||
  ENDPOINT.origin !== APPROVED_ENDPOINT.origin ||
  ENDPOINT.pathname !== APPROVED_ENDPOINT.pathname ||
  ENDPOINT.username !== "" ||
  ENDPOINT.password !== ""
) {
  throw new Error(
    `AZURE_MAI_ENDPOINT must use the approved origin ${APPROVED_ENDPOINT.origin}.`,
  );
}
const DEPLOYMENT = process.env.AZURE_MAI_DEPLOYMENT ?? "mai-image-2-5-pro";
const TOKEN_RESOURCE = "https://cognitiveservices.azure.com/";
const FOUNDATION_COMMIT = "b534680100ce4006a7c0bf6a5b50923afaeb6266";
const EXPECTED_SUBSCRIPTION_ID = "550d1332-62fa-4132-8473-b6af0bc88dfd";
const EXPECTED_SUBSCRIPTION_NAME = "MCAPS-Hybrid-REQ-132159-2025-sonicchung";
const REGISTRY_FILES = [
  "masters.json",
  "environment-interior.json",
  "environment-outdoor.json",
  "characters-core.json",
  "characters-supporting.json",
  "portraits.json",
];
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
      JSON.parse(await readFile(resolve(ROOT, "art/prompts", file), "utf8")),
    ),
  );
  return registries.flatMap(({ family, entries }) =>
    entries.map((entry) => ({ ...entry, family })),
  );
}

function validateEntry(entry) {
  for (const key of [
    "assetId",
    "family",
    "runtimeUse",
    "model",
    "modelName",
    "modelVersion",
    "promptVersion",
    "prompt",
  ]) {
    if (typeof entry[key] !== "string" || entry[key].length === 0) {
      throw new Error(`Registry entry is missing ${key}.`);
    }
  }
  if (
    !Number.isInteger(entry.candidateCount) ||
    entry.candidateCount < 2 ||
    entry.candidateCount > 3
  ) {
    throw new Error(`${entry.assetId} candidateCount must be 2 or 3.`);
  }
  for (const key of ["must", "avoid", "visualAcceptance", "dependencies"]) {
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
  if (
    bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
    bytes.toString("ascii", 12, 16) !== "IHDR"
  ) {
    throw new Error("MAI output is not a valid PNG.");
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
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

function verifyAzureSubscription() {
  const account = JSON.parse(
    execFileSync("az", ["account", "show", "--output", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
  if (
    account.id !== EXPECTED_SUBSCRIPTION_ID ||
    account.name !== EXPECTED_SUBSCRIPTION_NAME ||
    account.state !== "Enabled"
  ) {
    throw new Error("Azure CLI is not using the pinned enabled subscription.");
  }
}

async function requestCandidate(entry) {
  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt += 1) {
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
          throw new Error(`Generated image download failed: ${imageResponse.status}.`);
        }
        return Buffer.from(await imageResponse.arrayBuffer());
      }
      throw new Error("MAI response did not include image bytes or a URL.");
    }
    const detail = (await response.text()).slice(0, 800);
    if (
      ![429, 503].includes(response.status) ||
      attempt === BACKOFF_MS.length
    ) {
      throw new Error(`MAI generation failed with HTTP ${response.status}: ${detail}`);
    }
    const retryAfter = Number(response.headers.get("retry-after"));
    const delay =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 120000)
        : BACKOFF_MS[attempt];
    console.error(
      `MAI capacity response ${response.status}; retrying serially after ${delay}ms.`,
    );
    await new Promise((resolvePromise) => setTimeout(resolvePromise, delay));
  }
  throw new Error("MAI generation exhausted finite retries.");
}

function candidateRecord(entry, index, path, bytes, generatedAt, recovered = false) {
  const observedDimensions = pngDimensions(bytes);
  return {
    index,
    path,
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
    observedDimensions,
    machineAccepted:
      observedDimensions.width === entry.machineAcceptance.exactWidth &&
      observedDimensions.height === entry.machineAcceptance.exactHeight &&
      bytes.byteLength <= entry.machineAcceptance.maximumBytes,
    generatedAt,
    ...(recovered ? { recoveredFromInterruptedWrite: true } : {}),
  };
}

export async function reconcileCandidateFiles(runDirectory, entry, candidates) {
  const candidateFiles = (await readdir(runDirectory))
    .map((name) => {
      const match = /^candidate-(\d{2})\.png$/.exec(name);
      return match === null ? null : { name, index: Number(match[1]) };
    })
    .filter((candidate) => candidate !== null)
    .sort((left, right) => left.index - right.index);

  for (let offset = 0; offset < candidateFiles.length; offset += 1) {
    const file = candidateFiles[offset];
    const expectedIndex = offset + 1;
    if (file.index !== expectedIndex || file.index > entry.candidateCount) {
      throw new Error(
        `${entry.assetId} has a non-sequential or excess candidate file ${file.name}.`,
      );
    }
    const bytes = await readFile(join(runDirectory, file.name));
    const existing = candidates[file.index - 1];
    if (existing !== undefined) {
      if (
        existing.index !== file.index ||
        existing.path !== file.name ||
        existing.bytes !== bytes.byteLength ||
        existing.sha256 !== sha256(bytes)
      ) {
        throw new Error(`${entry.assetId} ${file.name} failed resume integrity.`);
      }
      const observed = pngDimensions(bytes);
      if (
        existing.observedDimensions?.width !== observed.width ||
        existing.observedDimensions?.height !== observed.height
      ) {
        throw new Error(`${entry.assetId} ${file.name} changed dimensions.`);
      }
      continue;
    }
    if (file.index !== candidates.length + 1) {
      throw new Error(`${entry.assetId} cannot recover a candidate manifest gap.`);
    }
    const metadata = await stat(join(runDirectory, file.name));
    candidates.push(
      candidateRecord(
        entry,
        file.index,
        file.name,
        bytes,
        metadata.mtime.toISOString(),
        true,
      ),
    );
  }
  return candidates;
}

async function existingRuns(directory) {
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && /^run-\d{3}$/.test(entry.name))
      .map(({ name }) => ({ name, number: Number(name.slice(4)) }))
      .sort((left, right) => left.number - right.number);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeImmutable(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
}

async function createContactSheet(runDirectory, candidates, reviewDirectory) {
  await mkdir(reviewDirectory, { recursive: true });
  const output = join(reviewDirectory, "contact-sheet.jpg");
  const inputs = candidates.flatMap(({ path }) => ["-i", join(runDirectory, path)]);
  const width = Math.floor(1560 / candidates.length);
  const scales = candidates
    .map((_, index) => `[${index}:v]scale=${width}:-2:flags=lanczos[v${index}]`)
    .join(";");
  const stack = candidates.map((_, index) => `[v${index}]`).join("");
  await execFileAsync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    ...inputs,
    "-filter_complex",
    `${scales};${stack}hstack=inputs=${candidates.length},scale=1600:-2:flags=lanczos`,
    "-frames:v",
    "1",
    "-q:v",
    "6",
    output,
  ]);
  const info = await stat(output);
  return {
    path: basename(output),
    bytes: info.size,
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
  const runDirectory = resolve(
    ROOT,
    "production/art-pipeline/candidates",
    entry.family,
    entry.assetId,
    entry.promptVersion,
    runName,
  );
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
  await copyFile(
    join(runDirectory, candidate.path),
    join(sourceDirectory, "selected-source.png"),
    constants.COPYFILE_EXCL,
  );
  const selection = {
    schemaVersion: "1.0.0",
    storyId: "john-9-man-born-blind",
    foundationCommit: FOUNDATION_COMMIT,
    assetId: entry.assetId,
    family: entry.family,
    promptVersion: entry.promptVersion,
    run: runName,
    selectedCandidate: index,
    reason: reason.trim(),
    visualAcceptance: entry.visualAcceptance,
    source: {
      path: `production/art-source/${entry.family}/${entry.assetId}/${entry.promptVersion}/${runName}/selected-source.png`,
      bytes: candidate.bytes,
      sha256: candidate.sha256,
    },
    reviewStatus: "copilot-selected-for-runtime-processing",
    distributionScope: "private",
    evidenceCollector: "copilot",
    acceptanceExecutor: "copilot",
    selectedAt: new Date().toISOString(),
  };
  await writeImmutable(join(sourceDirectory, "selection.json"), selection);
  await writeImmutable(join(reviewDirectory, "selection.json"), selection);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const registry = await loadRegistry();
  const entry = registry.find(
    ({ family, assetId }) =>
      family === options.family && assetId === options.asset,
  );
  if (entry === undefined) {
    throw new Error(`Unknown registry asset ${options.family}/${options.asset}.`);
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
    await selectCandidate(entry, requestedRun, Number(options.select), options.reason);
    console.log(`Selected ${entry.assetId} ${requestedRun} candidate ${options.select}.`);
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
  verifyAzureSubscription();
  const mode = options.mode ?? "start";
  if (!["start", "resume", "regenerate"].includes(mode)) {
    throw new Error(`Unsupported mode ${mode}.`);
  }
  if (mode === "start" && runs.length > 0) {
    throw new Error(`${entry.assetId} already has a run.`);
  }
  if (mode === "resume" && runs.length === 0) {
    throw new Error(`${entry.assetId} has no run to resume.`);
  }
  const runNumber =
    mode === "regenerate" || runs.length === 0
      ? (runs.at(-1)?.number ?? 0) + 1
      : runs.at(-1).number;
  const runName = `run-${String(runNumber).padStart(3, "0")}`;
  const runDirectory = join(base, runName);
  const centralDirectory = resolve(
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
  await mkdir(centralDirectory, { recursive: true });
  if (mode === "resume") {
    await stat(runDirectory);
  } else {
    await mkdir(runDirectory);
  }
  const runManifestPath = join(runDirectory, "manifest.json");
  let candidates = [];
  if (mode === "resume") {
    const prior = JSON.parse(await readFile(runManifestPath, "utf8"));
    if (prior.status === "complete") {
      throw new Error(`${entry.assetId} ${runName} is already complete.`);
    }
    candidates = await reconcileCandidateFiles(
      runDirectory,
      entry,
      [...prior.candidates],
    );
  }
  const manifestBase = {
    schemaVersion: "1.0.0",
    storyId: "john-9-man-born-blind",
    foundationCommit: FOUNDATION_COMMIT,
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
    azureResource: {
      subscriptionName: EXPECTED_SUBSCRIPTION_NAME,
      subscriptionId: EXPECTED_SUBSCRIPTION_ID,
      resourceGroup: "rg-sonicchung-7894_ai",
      account: "ai-johnrpg-sonic-74129",
      deployment: DEPLOYMENT,
      capacity: 1,
      generationMode: "serial",
    },
    startedAt: new Date().toISOString(),
    status: "in-progress",
  };
  if (mode !== "resume") {
    await writeImmutable(runManifestPath, { ...manifestBase, candidates });
  } else {
    await writeFile(
      runManifestPath,
      `${JSON.stringify({ ...manifestBase, candidates }, null, 2)}\n`,
    );
  }
  for (let index = candidates.length + 1; index <= entry.candidateCount; index += 1) {
    console.log(
      `Generating ${entry.assetId} ${runName} candidate ${index}/${entry.candidateCount} serially.`,
    );
    const bytes = await requestCandidate(entry);
    const path = `candidate-${String(index).padStart(2, "0")}.png`;
    await writeFile(join(runDirectory, path), bytes, { flag: "wx" });
    candidates.push(
      candidateRecord(entry, index, path, bytes, new Date().toISOString()),
    );
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
      ...contactSheet,
      path: `production/art-pipeline/review/${entry.family}/${entry.assetId}/${entry.promptVersion}/${runName}/${contactSheet.path}`,
      maximumLongEdge: 1600,
    },
  };
  await writeFile(runManifestPath, `${JSON.stringify(complete, null, 2)}\n`);
  await writeImmutable(join(centralDirectory, `${runName}.json`), complete);
  console.log(`Completed ${entry.assetId} ${runName}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
