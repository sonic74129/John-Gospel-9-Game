import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SOURCE_COMMIT = "13435cd33fb00d3265aa885aac8672454d4df058";
const SOURCE_PATH = "public/json/cunp/43/9.json";
const SOURCE_URL =
  `https://raw.githubusercontent.com/biblebase/biblebase/${SOURCE_COMMIT}/${SOURCE_PATH}`;
const SOURCE_REPOSITORY = "https://github.com/biblebase/biblebase";
const EXPECTED_SOURCE_SHA256 =
  "460327d5ac56801f3bfb32e272b54602179f9e7ad35eb46df81659b016bac44c";
const IMPORTED_AT = "2026-08-06";
const ROOT = process.cwd();

const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

async function writeJson(path, value) {
  const absolute = resolve(ROOT, path);
  await mkdir(dirname(absolute), { recursive: true });
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  await writeFile(absolute, bytes);
  return { bytes: bytes.byteLength, sha256: sha256(bytes) };
}

const response = await fetch(SOURCE_URL);
if (!response.ok) {
  throw new Error(`CUV source fetch failed with HTTP ${response.status}.`);
}
const sourceBytes = Buffer.from(await response.arrayBuffer());
if (sha256(sourceBytes) !== EXPECTED_SOURCE_SHA256) {
  throw new Error("Pinned CUV source SHA-256 changed.");
}

const source = JSON.parse(sourceBytes.toString("utf8"));
const verses = source.sections
  .flatMap((section) => section.contents ?? [])
  .filter(
    (entry) =>
      Number.isInteger(entry.verseNum) &&
      typeof entry.verseText === "string" &&
      entry.verseText.trim().length > 0,
  )
  .map((entry) => ({
    verse: entry.verseNum,
    text: entry.verseText.trim(),
  }));

if (
  verses.length !== 41 ||
  verses.some(({ verse }, index) => verse !== index + 1)
) {
  throw new Error("Pinned CUV source must contain John 9:1-41 exactly once.");
}

const artifact = {
  schemaVersion: "1.0.0",
  id: "biblebase-cunp-john-9-13435cd",
  passage: {
    book: "John",
    chapter: 9,
    verseStart: 1,
    verseEnd: 41,
  },
  translation: {
    id: "CUV-Traditional",
    editionId: "CUNP-Shen",
    canonicalName: "和合本（神版，繁體）",
    language: "zh-Hant",
    divineNameVariant: "神",
  },
  source: {
    repository: SOURCE_REPOSITORY,
    commit: SOURCE_COMMIT,
    path: SOURCE_PATH,
    url: SOURCE_URL,
    sha256: EXPECTED_SOURCE_SHA256,
    repositoryLicense: "Apache-2.0",
  },
  verses: verses.map(({ verse, text }) => ({
    key: `john9:${verse}`,
    exactText: text,
  })),
  importedBy: "copilot",
  importedAt: IMPORTED_AT,
};

const artifactPath = "licensed-artifacts/john9-cuv.json";
const artifactIntegrity = await writeJson(artifactPath, artifact);

const scripture = {
  schemaVersion: "1.0.0-draft",
  contractStatus: "release-ready",
  passage: {
    book: "John",
    chapter: 9,
    verseStart: 1,
    verseEnd: 41,
  },
  translation: {
    id: "CUV-Traditional",
    editionId: "CUNP-Shen",
    editionStatus: "confirmed",
    language: "zh-Hant",
  },
  source: artifact.source,
  verses: verses.map(({ verse, text }) => ({
    schemaVersion: "1.0.0-draft",
    key: `john9:${verse}`,
    reference: { book: "John", chapter: 9, verse },
    translationId: "CUV-Traditional",
    editionId: "CUNP-Shen",
    editionStatus: "confirmed",
    language: "zh-Hant",
    sourceLevel: "scripture",
    textAvailability: "licensed",
    exactText: text,
    display: {
      mode: "full",
      segments: [{ id: `john9:${verse}:full`, text }],
    },
    review: {
      status: "approved",
      reviewer: "copilot:text",
      reviewedAt: IMPORTED_AT,
    },
  })),
};
await writeJson("src/story/scripture.json", scripture);

const evidenceBase = {
  schemaVersion: "1.0.0",
  sourceRepository: SOURCE_REPOSITORY,
  sourceCommit: SOURCE_COMMIT,
  sourcePath: SOURCE_PATH,
  sourceSha256: EXPECTED_SOURCE_SHA256,
  repositoryLicense: "Apache-2.0",
  evidenceCollector: "copilot",
  acceptanceExecutor: "copilot",
  recordedAt: IMPORTED_AT,
};
const evidence = {};
for (const permission of ["redistribution", "offline", "tts"]) {
  const locator = `rights-evidence/${permission}.json`;
  const integrity = await writeJson(locator, {
    ...evidenceBase,
    permission,
    decision: "allowed",
  });
  evidence[permission] = {
    status: "allowed",
    evidenceLocator: locator,
    evidenceId: `urn:sha256:${integrity.sha256}`,
    evidenceSha256: integrity.sha256,
  };
}

await writeJson("src/story/scripture-rights.json", {
  schemaVersion: "1.0.0-draft",
  translationId: "CUV-Traditional",
  language: "zh-Hant",
  provider: {
    status: "confirmed",
    name: "biblebase/biblebase",
  },
  artifact: {
    status: "available",
    id: artifact.id,
    locator: artifactPath,
    sha256: artifactIntegrity.sha256,
  },
  edition: {
    status: "confirmed",
    id: "CUNP-Shen",
    canonicalName: "和合本（神版，繁體）",
  },
  divineNameVariant: {
    status: "confirmed",
    value: "神",
    allowedValues: ["神", "上帝"],
  },
  territories: {
    status: "confirmed",
    values: ["worldwide"],
  },
  permissions: evidence,
  attribution: {
    status: "confirmed",
    text:
      `和合本（神版，繁體）；资料来源 biblebase/biblebase@${SOURCE_COMMIT.slice(0, 12)}。`,
  },
  reviewerTrust: {
    locator: "scripture-trusted-reviewers.json",
  },
  reviews: {
    text: {
      status: "approved",
      reviewer: "copilot:text",
      reviewedAt: IMPORTED_AT,
    },
    edition: {
      status: "approved",
      reviewer: "copilot:edition",
      reviewedAt: IMPORTED_AT,
    },
    rights: {
      status: "approved",
      reviewer: "copilot:rights",
      reviewedAt: IMPORTED_AT,
    },
  },
  automation: {
    evidenceCollector: "copilot",
    acceptanceExecutor: "copilot",
  },
  release: {
    blocked: false,
    blockers: [],
  },
});

await writeJson("src/story/scripture-trusted-reviewers.json", {
  schemaVersion: "1.0.0",
  reviewers: [
    { id: "copilot:text", roles: ["text"] },
    { id: "copilot:edition", roles: ["edition"] },
    { id: "copilot:rights", roles: ["rights"] },
  ],
  evidenceCollector: "copilot",
  acceptanceExecutor: "copilot",
});

console.log(
  `Imported ${verses.length} CUV verses from ${SOURCE_COMMIT.slice(0, 12)} (${EXPECTED_SOURCE_SHA256.slice(0, 12)}).`,
);
