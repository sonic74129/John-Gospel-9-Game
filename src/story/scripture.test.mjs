import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, test } from "node:test";
import {
  JOHN_9_VERSE_KEYS,
  loadScriptureContract,
  validateDevelopmentScripture,
  validateReleaseReadyScripture,
} from "./scripture.mjs";

const draft = await loadScriptureContract();
assert.equal(draft.ok, true);

function cloneDraft() {
  return structuredClone(draft);
}

function errorText(validation) {
  return validation.errors
    .map(({ field, message }) => `${field}: ${message}`)
    .join("\n");
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function makeReleaseCandidate() {
  const { scripture, rights } = cloneDraft();
  scripture.contractStatus = "release-ready";
  scripture.translation.editionStatus = "confirmed";

  for (const verse of scripture.verses) {
    verse.editionStatus = "confirmed";
    verse.textAvailability = "licensed";
    verse.exactText = `[synthetic fixture ${verse.key}]`;
    verse.display = {
      mode: "full",
      segments: [{ id: `${verse.key}-full`, text: verse.exactText }],
    };
    verse.review = {
      status: "approved",
      reviewer: "reviewer:text",
      reviewedAt: "2026-08-03",
    };
  }

  rights.provider = { status: "confirmed", name: "fixture-provider" };
  rights.artifact = {
    status: "available",
    id: "fixture-john9",
    locator: "licensed-artifacts/john9-fixture.json",
    sha256: null,
  };
  rights.edition = {
    status: "confirmed",
    id: scripture.translation.editionId,
    canonicalName: "Fixture Edition",
  };
  rights.divineNameVariant = {
    status: "confirmed",
    value: "神",
    allowedValues: ["神", "上帝"],
  };
  rights.territories = { status: "confirmed", values: ["fixture-territory"] };
  for (const permission of Object.values(rights.permissions)) {
    permission.status = "allowed";
    permission.evidenceSha256 = "a".repeat(64);
    permission.evidenceId = `urn:sha256:${permission.evidenceSha256}`;
  }
  rights.attribution = { status: "confirmed", text: "Fixture attribution" };
  rights.reviews = {
    text: {
      status: "approved",
      reviewer: "reviewer:text",
      reviewedAt: "2026-08-03",
    },
    edition: {
      status: "approved",
      reviewer: "reviewer:edition",
      reviewedAt: "2026-08-03",
    },
    rights: {
      status: "approved",
      reviewer: "reviewer:rights",
      reviewedAt: "2026-08-03",
    },
  };
  rights.release = { blocked: false, blockers: [] };

  const artifact = {
    schemaVersion: "1.0.0",
    id: rights.artifact.id,
    passage: structuredClone(scripture.passage),
    translation: {
      id: scripture.translation.id,
      editionId: scripture.translation.editionId,
      canonicalName: rights.edition.canonicalName,
      language: "zh-Hant",
      divineNameVariant: rights.divineNameVariant.value,
    },
    verses: scripture.verses.map(({ key, exactText }) => ({ key, exactText })),
  };
  const reviewers = {
    schemaVersion: "1.0.0",
    reviewers: [
      { id: "reviewer:text", roles: ["text"] },
      { id: "reviewer:edition", roles: ["edition"] },
      { id: "reviewer:rights", roles: ["rights"] },
    ],
  };
  return { scripture, rights, artifact, reviewers };
}

async function writeReleaseFixture(candidate = makeReleaseCandidate()) {
  const root = await mkdtemp(path.join(tmpdir(), "john9-scripture-"));
  const artifactDirectory = path.join(root, "licensed-artifacts");
  await mkdir(artifactDirectory);

  const artifactBytes = Buffer.from(
    `${JSON.stringify(candidate.artifact, null, 2)}\n`,
  );
  await writeFile(
    path.join(root, candidate.rights.artifact.locator),
    artifactBytes,
  );
  candidate.rights.artifact.sha256 = digest(artifactBytes);

  const reviewerBytes = Buffer.from(
    `${JSON.stringify(candidate.reviewers, null, 2)}\n`,
  );
  await writeFile(
    path.join(root, "scripture-trusted-reviewers.json"),
    reviewerBytes,
  );
  candidate.rights.reviewerTrust.sha256 = digest(reviewerBytes);

  return {
    ...candidate,
    rootUrl: pathToFileURL(`${root}${path.sep}`),
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

describe("John 9 scripture development contract", () => {
  test("covers exactly john9:1 through john9:41 in order", () => {
    const validation = validateDevelopmentScripture(
      draft.scripture,
      draft.rights,
    );

    assert.equal(validation.ok, true, errorText(validation));
    assert.equal(draft.scripture.verses.length, 41);
    assert.deepEqual(
      draft.scripture.verses.map(({ key }) => key),
      JOHN_9_VERSE_KEYS,
    );
  });

  test("rejects missing, duplicate, and out-of-order keys", () => {
    const missing = cloneDraft();
    missing.scripture.verses.splice(10, 1);
    assert.match(
      errorText(
        validateDevelopmentScripture(missing.scripture, missing.rights),
      ),
      /missing john9:11/,
    );

    const duplicate = cloneDraft();
    duplicate.scripture.verses[1] = structuredClone(
      duplicate.scripture.verses[0],
    );
    assert.match(
      errorText(
        validateDevelopmentScripture(duplicate.scripture, duplicate.rights),
      ),
      /duplicate key john9:1/,
    );

    const outOfOrder = cloneDraft();
    [outOfOrder.scripture.verses[0], outOfOrder.scripture.verses[1]] = [
      outOfOrder.scripture.verses[1],
      outOfOrder.scripture.verses[0],
    ];
    assert.match(
      errorText(
        validateDevelopmentScripture(
          outOfOrder.scripture,
          outOfOrder.rights,
        ),
      ),
      /preserve canonical order/,
    );
  });

  test("requires supported versions and exact non-empty translation and edition IDs", () => {
    const { scripture, rights } = cloneDraft();
    scripture.schemaVersion = "future";
    scripture.verses[0].schemaVersion = "";
    scripture.verses[1].translationId = "";
    scripture.verses[2].editionId = "other-edition";
    rights.schemaVersion = "future";
    rights.translationId = "other-translation";

    const errors = errorText(
      validateDevelopmentScripture(scripture, rights),
    );

    assert.match(errors, /schemaVersion: must equal supported version/);
    assert.match(errors, /verses\[0\]\.schemaVersion/);
    assert.match(errors, /verses\[1\]\.translationId: must be a non-empty/);
    assert.match(errors, /verses\[2\]\.editionId: must exactly equal/);
    assert.match(errors, /rights\.schemaVersion/);
    assert.match(errors, /rights\.translationId: must exactly equal/);
  });

  test("rejects forged immutable permission evidence", () => {
    const { scripture, rights } = cloneDraft();
    rights.permissions.redistribution = {
      status: "allowed",
      evidenceId: `urn:sha256:${"b".repeat(64)}`,
      evidenceSha256: "a".repeat(64),
    };

    const validation = validateDevelopmentScripture(scripture, rights);

    assert.equal(validation.ok, false);
    assert.match(errorText(validation), /must be the immutable urn:sha256 ID/);
  });

  test("rejects display segments that do not exactly reconstruct text", () => {
    const { scripture, rights } = cloneDraft();
    const verse = scripture.verses[0];
    verse.exactText = "[synthetic fixture]";
    verse.textAvailability = "licensed";
    verse.display = {
      mode: "segmented",
      segments: [{ id: "john9:1-a", text: "[mismatch]" }],
    };

    const validation = validateDevelopmentScripture(scripture, rights);

    assert.equal(validation.ok, false);
    assert.match(errorText(validation), /concatenate exactly to exactText/);
  });

  test("returns errors instead of throwing for malformed collections", () => {
    const { scripture, rights } = cloneDraft();
    scripture.verses = {};
    rights.divineNameVariant.allowedValues = {};
    rights.territories.values = {};
    rights.release.blockers = {};

    assert.doesNotThrow(() =>
      validateDevelopmentScripture(scripture, rights),
    );
    const errors = errorText(
      validateDevelopmentScripture(scripture, rights),
    );
    assert.match(errors, /verses: must be an array/);
    assert.match(errors, /allowedValues/);
    assert.match(errors, /territories\.values: must be an array/);
    assert.match(errors, /blockers array/);
  });
});

describe("release artifact and trust validation", () => {
  test("accepts a fully bound synthetic fixture", async (t) => {
    const fixture = await writeReleaseFixture();
    t.after(fixture.cleanup);

    const validation = await validateReleaseReadyScripture(
      fixture.scripture,
      fixture.rights,
      { artifactRoot: fixture.rootUrl, reviewerRoot: fixture.rootUrl },
    );

    assert.equal(validation.ok, true, errorText(validation));
  });

  test("rejects a forged artifact hash", async (t) => {
    const fixture = await writeReleaseFixture();
    t.after(fixture.cleanup);
    fixture.rights.artifact.sha256 = "0".repeat(64);

    const validation = await validateReleaseReadyScripture(
      fixture.scripture,
      fixture.rights,
      { artifactRoot: fixture.rootUrl, reviewerRoot: fixture.rootUrl },
    );

    assert.equal(validation.ok, false);
    assert.match(errorText(validation), /does not match the actual artifact bytes/);
  });

  test("returns structured errors for a hash-valid malformed artifact", async (t) => {
    const fixture = await writeReleaseFixture();
    t.after(fixture.cleanup);
    const malformed = Buffer.from("{");
    await writeFile(
      path.join(
        fileURLToPath(fixture.rootUrl),
        fixture.rights.artifact.locator,
      ),
      malformed,
    );
    fixture.rights.artifact.sha256 = digest(malformed);

    const validation = await validateReleaseReadyScripture(
      fixture.scripture,
      fixture.rights,
      { artifactRoot: fixture.rootUrl, reviewerRoot: fixture.rootUrl },
    );

    assert.equal(validation.ok, false);
    assert.match(errorText(validation), /rights\.artifact: contains malformed JSON/);
  });

  test("rejects unsafe artifact locators", async () => {
    const candidate = makeReleaseCandidate();
    candidate.rights.artifact.locator = "../forged.json";

    const validation = await validateReleaseReadyScripture(
      candidate.scripture,
      candidate.rights,
    );

    assert.equal(validation.ok, false);
    assert.match(errorText(validation), /safe licensed-artifacts/);
  });

  test("rejects artifact text and edition metadata that do not match the import", async (t) => {
    const candidate = makeReleaseCandidate();
    candidate.artifact.translation.editionId = "forged-edition";
    candidate.artifact.verses[0].exactText = "[forged fixture]";
    const fixture = await writeReleaseFixture(candidate);
    t.after(fixture.cleanup);

    const validation = await validateReleaseReadyScripture(
      fixture.scripture,
      fixture.rights,
      { artifactRoot: fixture.rootUrl, reviewerRoot: fixture.rootUrl },
    );

    assert.equal(validation.ok, false);
    assert.match(errorText(validation), /translation\.editionId/);
    assert.match(errorText(validation), /must exactly equal the imported contract/);
  });

  test("rejects 神 metadata with 上帝 artifact text", async (t) => {
    const candidate = makeReleaseCandidate();
    candidate.scripture.verses[0].exactText = "[synthetic 上帝 fixture]";
    candidate.scripture.verses[0].display.segments[0].text =
      candidate.scripture.verses[0].exactText;
    candidate.artifact.verses[0].exactText =
      candidate.scripture.verses[0].exactText;
    const fixture = await writeReleaseFixture(candidate);
    t.after(fixture.cleanup);

    const validation = await validateReleaseReadyScripture(
      fixture.scripture,
      fixture.rights,
      { artifactRoot: fixture.rootUrl, reviewerRoot: fixture.rootUrl },
    );

    assert.equal(validation.ok, false);
    assert.match(errorText(validation), /contains 上帝, conflicting/);
  });

  test("rejects 上帝 metadata with standalone 神 artifact text", async (t) => {
    const candidate = makeReleaseCandidate();
    candidate.rights.divineNameVariant.value = "上帝";
    candidate.artifact.translation.divineNameVariant = "上帝";
    candidate.scripture.verses[0].exactText = "[synthetic 神 fixture]";
    candidate.scripture.verses[0].display.segments[0].text =
      candidate.scripture.verses[0].exactText;
    candidate.artifact.verses[0].exactText =
      candidate.scripture.verses[0].exactText;
    const fixture = await writeReleaseFixture(candidate);
    t.after(fixture.cleanup);

    const validation = await validateReleaseReadyScripture(
      fixture.scripture,
      fixture.rights,
      { artifactRoot: fixture.rootUrl, reviewerRoot: fixture.rootUrl },
    );

    assert.equal(validation.ok, false);
    assert.match(errorText(validation), /contains 神, conflicting/);
  });

  test("does not mistake 神 inside the expected 上帝 token for a mismatch", async (t) => {
    const candidate = makeReleaseCandidate();
    candidate.rights.divineNameVariant.value = "上帝";
    candidate.artifact.translation.divineNameVariant = "上帝";
    candidate.scripture.verses[0].exactText = "[synthetic 上帝 fixture]";
    candidate.scripture.verses[0].display.segments[0].text =
      candidate.scripture.verses[0].exactText;
    candidate.artifact.verses[0].exactText =
      candidate.scripture.verses[0].exactText;
    const fixture = await writeReleaseFixture(candidate);
    t.after(fixture.cleanup);

    const validation = await validateReleaseReadyScripture(
      fixture.scripture,
      fixture.rights,
      { artifactRoot: fixture.rootUrl, reviewerRoot: fixture.rootUrl },
    );

    assert.equal(validation.ok, true, errorText(validation));
  });

  test("rejects reviewer IDs not present with the required trusted role", async (t) => {
    const candidate = makeReleaseCandidate();
    candidate.rights.reviews.rights.reviewer = "reviewer:forged";
    const fixture = await writeReleaseFixture(candidate);
    t.after(fixture.cleanup);

    const validation = await validateReleaseReadyScripture(
      fixture.scripture,
      fixture.rights,
      { artifactRoot: fixture.rootUrl, reviewerRoot: fixture.rootUrl },
    );

    assert.equal(validation.ok, false);
    assert.match(errorText(validation), /trusted reviewer ID with the rights role/);
  });

  test("rejects a forged trusted-reviewer configuration hash", async (t) => {
    const fixture = await writeReleaseFixture();
    t.after(fixture.cleanup);
    fixture.rights.reviewerTrust.sha256 = "0".repeat(64);

    const validation = await validateReleaseReadyScripture(
      fixture.scripture,
      fixture.rights,
      { artifactRoot: fixture.rootUrl, reviewerRoot: fixture.rootUrl },
    );

    assert.equal(validation.ok, false);
    assert.match(
      errorText(validation),
      /does not match the actual trusted reviewer configuration bytes/,
    );
  });
});

test("malformed JSON produces structured loader errors", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "john9-malformed-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const malformed = path.join(root, "malformed.json");
  await writeFile(malformed, "{");

  const loaded = await loadScriptureContract({
    scripture: malformed,
    rights: malformed,
    trustedReviewers: malformed,
  });

  assert.equal(loaded.ok, false);
  assert.equal(loaded.scripture, null);
  assert.ok(loaded.errors.every((error) => "field" in error && "message" in error));
  assert.match(errorText(loaded), /contains malformed JSON/);
});

test("checked-in draft remains explicitly release-blocked", async () => {
  const validation = await validateReleaseReadyScripture(
    draft.scripture,
    draft.rights,
  );
  const errors = errorText(validation);

  assert.equal(validation.ok, false);
  assert.match(errors, /contractStatus: must be release-ready/);
  assert.match(errors, /verses\[0\]\.exactText: is required for release/);
  assert.match(errors, /rights\.artifact: must be available/);
  assert.match(errors, /rights\.permissions\.redistribution/);
  assert.match(errors, /rights\.reviews\.rights/);
  assert.match(errors, /rights\.release: must be unblocked/);
});
