import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const storyRootUrl = new URL("./", import.meta.url);
const scriptureUrl = new URL("./scripture.json", import.meta.url);
const rightsUrl = new URL("./scripture-rights.json", import.meta.url);
const reviewersUrl = new URL("./scripture-trusted-reviewers.json", import.meta.url);

const supportedVersions = Object.freeze({
  scripture: "1.0.0-draft",
  rights: "1.0.0-draft",
  artifact: "1.0.0",
  reviewers: "1.0.0",
});
const permissionNames = Object.freeze(["redistribution", "offline", "tts"]);
const reviewNames = Object.freeze(["text", "edition", "rights"]);
const expectedPassage = Object.freeze({
  book: "John",
  chapter: 9,
  verseStart: 1,
  verseEnd: 41,
});
const sha256Pattern = /^[a-f0-9]{64}$/;
const artifactLocatorPattern =
  /^licensed-artifacts\/[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?\.json$/;
const evidenceLocatorPattern =
  /^rights-evidence\/[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?\.[A-Za-z0-9]{1,8}$/;

export const JOHN_9_VERSE_KEYS = Object.freeze(
  Array.from({ length: 41 }, (_, index) => `john9:${index + 1}`),
);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isReviewDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function addError(errors, field, message) {
  errors.push({ field, message });
}

function result(errors) {
  return { ok: errors.length === 0, errors };
}

function validateVersion(value, expected, field, errors) {
  if (value !== expected) {
    addError(errors, field, `must equal supported version ${expected}`);
  }
}

function validatePassage(passage, field, errors) {
  if (!isRecord(passage)) {
    addError(errors, field, "must be an object");
    return;
  }

  for (const [name, expected] of Object.entries(expectedPassage)) {
    if (passage[name] !== expected) {
      addError(errors, `${field}.${name}`, `must equal ${expected}`);
    }
  }
}

function validateReview(review, field, errors) {
  if (!isRecord(review)) {
    addError(errors, field, "must be an object");
    return;
  }
  if (!["pending", "approved"].includes(review.status)) {
    addError(errors, `${field}.status`, "must be pending or approved");
    return;
  }

  if (review.status === "pending") {
    if (review.reviewer !== null || review.reviewedAt !== null) {
      addError(
        errors,
        field,
        "pending reviews must have null reviewer and reviewedAt",
      );
    }
    return;
  }

  if (!isNonEmptyString(review.reviewer)) {
    addError(errors, `${field}.reviewer`, "must be a reviewer ID");
  }
  if (!isReviewDate(review.reviewedAt)) {
    addError(
      errors,
      `${field}.reviewedAt`,
      "must be a valid YYYY-MM-DD date",
    );
  }
}

function validateDisplay(verse, field, errors) {
  if (!isRecord(verse.display)) {
    addError(errors, `${field}.display`, "must be an object");
    return;
  }
  if (!Array.isArray(verse.display.segments)) {
    addError(errors, `${field}.display.segments`, "must be an array");
    return;
  }

  const segments = verse.display.segments;
  if (verse.exactText === null) {
    if (verse.textAvailability !== "unavailable-rights-pending") {
      addError(
        errors,
        `${field}.textAvailability`,
        "must explicitly identify rights-pending unavailability",
      );
    }
    if (verse.display.mode !== "unavailable" || segments.length !== 0) {
      addError(
        errors,
        `${field}.display`,
        "unavailable text must use unavailable mode with no segments",
      );
    }
    return;
  }

  if (!isNonEmptyString(verse.exactText)) {
    addError(errors, `${field}.exactText`, "must be null or non-empty text");
    return;
  }
  if (verse.textAvailability !== "licensed") {
    addError(
      errors,
      `${field}.textAvailability`,
      "must be licensed when exactText is present",
    );
  }
  if (!["full", "segmented"].includes(verse.display.mode)) {
    addError(
      errors,
      `${field}.display.mode`,
      "must be full or segmented when exactText is present",
    );
  }
  if (segments.length === 0) {
    addError(
      errors,
      `${field}.display.segments`,
      "must not be empty when exactText is present",
    );
    return;
  }

  const ids = new Set();
  let concatenated = "";
  for (const [index, segment] of segments.entries()) {
    const segmentField = `${field}.display.segments[${index}]`;
    if (!isRecord(segment)) {
      addError(errors, segmentField, "must be an object");
      continue;
    }
    if (!isNonEmptyString(segment.id)) {
      addError(errors, `${segmentField}.id`, "must be non-empty");
    } else if (ids.has(segment.id)) {
      addError(errors, `${segmentField}.id`, "must be unique within the verse");
    } else {
      ids.add(segment.id);
    }
    if (typeof segment.text !== "string") {
      addError(errors, `${segmentField}.text`, "must be a string");
    } else {
      concatenated += segment.text;
    }
  }
  if (concatenated !== verse.exactText) {
    addError(
      errors,
      `${field}.display.segments`,
      "must concatenate exactly to exactText",
    );
  }
}

function validateIdentifiers(contract, rights, verses, errors) {
  const translationId = contract.translation?.id;
  const editionId = contract.translation?.editionId;

  if (!isNonEmptyString(translationId)) {
    addError(errors, "translation.id", "must be a non-empty string");
  }
  if (!isNonEmptyString(editionId)) {
    addError(errors, "translation.editionId", "must be a non-empty string");
  }
  if (!isNonEmptyString(rights.translationId)) {
    addError(errors, "rights.translationId", "must be a non-empty string");
  }
  if (!isNonEmptyString(rights.edition?.id)) {
    addError(errors, "rights.edition.id", "must be a non-empty string");
  }

  for (const [index, verse] of verses.entries()) {
    if (!isRecord(verse)) {
      continue;
    }
    if (!isNonEmptyString(verse.translationId)) {
      addError(
        errors,
        `verses[${index}].translationId`,
        "must be a non-empty string",
      );
    } else if (verse.translationId !== translationId) {
      addError(
        errors,
        `verses[${index}].translationId`,
        "must exactly equal translation.id",
      );
    }
    if (!isNonEmptyString(verse.editionId)) {
      addError(
        errors,
        `verses[${index}].editionId`,
        "must be a non-empty string",
      );
    } else if (verse.editionId !== editionId) {
      addError(
        errors,
        `verses[${index}].editionId`,
        "must exactly equal translation.editionId",
      );
    }
  }

  if (isNonEmptyString(translationId) && rights.translationId !== translationId) {
    addError(
      errors,
      "rights.translationId",
      "must exactly equal translation.id",
    );
  }
  if (isNonEmptyString(editionId) && rights.edition?.id !== editionId) {
    addError(
      errors,
      "rights.edition.id",
      "must exactly equal translation.editionId",
    );
  }
}

function validateVerses(contract, rights, errors) {
  if (!Array.isArray(contract.verses)) {
    addError(errors, "verses", "must be an array");
    return [];
  }

  const verses = contract.verses;
  const keys = verses.map((verse) => (isRecord(verse) ? verse.key : undefined));
  const keyCounts = new Map();
  for (const key of keys) {
    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
  }

  if (verses.length !== JOHN_9_VERSE_KEYS.length) {
    addError(errors, "verses", "must contain exactly 41 entries");
  }
  for (const key of JOHN_9_VERSE_KEYS) {
    if (!keyCounts.has(key)) {
      addError(errors, "verses", `is missing ${key}`);
    }
  }
  for (const [key, count] of keyCounts.entries()) {
    if (key !== undefined && count > 1) {
      addError(errors, "verses", `contains duplicate key ${key}`);
    }
  }

  for (const [index, expectedKey] of JOHN_9_VERSE_KEYS.entries()) {
    if (keys[index] !== undefined && keys[index] !== expectedKey) {
      addError(
        errors,
        `verses[${index}].key`,
        `must be ${expectedKey} to preserve canonical order`,
      );
    }
  }

  for (const [index, verse] of verses.entries()) {
    const field = `verses[${index}]`;
    if (!isRecord(verse)) {
      addError(errors, field, "must be an object");
      continue;
    }
    validateVersion(
      verse.schemaVersion,
      supportedVersions.scripture,
      `${field}.schemaVersion`,
      errors,
    );
    const expectedVerse = index + 1;
    if (
      !isRecord(verse.reference) ||
      verse.reference.book !== "John" ||
      verse.reference.chapter !== 9 ||
      verse.reference.verse !== expectedVerse
    ) {
      addError(
        errors,
        `${field}.reference`,
        `must identify John 9:${expectedVerse}`,
      );
    }
    if (verse.language !== "zh-Hant") {
      addError(errors, `${field}.language`, "must be zh-Hant");
    }
    if (!["unresolved", "confirmed"].includes(verse.editionStatus)) {
      addError(
        errors,
        `${field}.editionStatus`,
        "must be unresolved or confirmed",
      );
    }
    if (verse.sourceLevel !== "scripture") {
      addError(errors, `${field}.sourceLevel`, "must be scripture");
    }
    validateDisplay(verse, field, errors);
    validateReview(verse.review, `${field}.review`, errors);
  }

  validateIdentifiers(contract, rights, verses, errors);
  return verses;
}

function validatePermission(permission, field, errors) {
  if (!isRecord(permission)) {
    addError(errors, field, "must be an object");
    return;
  }
  if (!["unknown", "allowed", "denied"].includes(permission.status)) {
    addError(errors, `${field}.status`, "must be unknown, allowed, or denied");
    return;
  }

  if (permission.status === "unknown") {
    if (
      permission.evidenceLocator !== null ||
      permission.evidenceId !== null ||
      permission.evidenceSha256 !== null
    ) {
      addError(
        errors,
        field,
        "unknown permissions must have null immutable evidence fields",
      );
    }
    return;
  }

  if (!evidenceLocatorPattern.test(permission.evidenceLocator ?? "")) {
    addError(
      errors,
      `${field}.evidenceLocator`,
      "must be a safe rights-evidence/* relative locator",
    );
  }
  if (!sha256Pattern.test(permission.evidenceSha256 ?? "")) {
    addError(
      errors,
      `${field}.evidenceSha256`,
      "must be a lowercase SHA-256",
    );
  }
  if (
    permission.evidenceId !==
    `urn:sha256:${permission.evidenceSha256 ?? ""}`
  ) {
    addError(
      errors,
      `${field}.evidenceId`,
      "must be the immutable urn:sha256 ID for evidenceSha256",
    );
  }
}

function validateRights(rights, errors) {
  validateVersion(
    rights.schemaVersion,
    supportedVersions.rights,
    "rights.schemaVersion",
    errors,
  );
  if (rights.language !== "zh-Hant") {
    addError(errors, "rights.language", "must be zh-Hant");
  }

  if (!isRecord(rights.provider)) {
    addError(errors, "rights.provider", "must be an object");
  } else if (!["unknown", "confirmed"].includes(rights.provider.status)) {
    addError(errors, "rights.provider.status", "must be unknown or confirmed");
  } else if (rights.provider.status === "unknown") {
    if (rights.provider.name !== null) {
      addError(errors, "rights.provider.name", "must be null while unknown");
    }
  } else if (!isNonEmptyString(rights.provider.name)) {
    addError(errors, "rights.provider.name", "is required when confirmed");
  }

  if (!isRecord(rights.artifact)) {
    addError(errors, "rights.artifact", "must be an object");
  } else if (!["unavailable", "available"].includes(rights.artifact.status)) {
    addError(
      errors,
      "rights.artifact.status",
      "must be unavailable or available",
    );
  } else if (rights.artifact.status === "unavailable") {
    if (
      rights.artifact.id !== null ||
      rights.artifact.locator !== null ||
      rights.artifact.sha256 !== null
    ) {
      addError(
        errors,
        "rights.artifact",
        "unavailable artifacts must have null id, locator, and sha256",
      );
    }
  } else {
    if (!isNonEmptyString(rights.artifact.id)) {
      addError(errors, "rights.artifact.id", "is required when available");
    }
    if (!artifactLocatorPattern.test(rights.artifact.locator ?? "")) {
      addError(
        errors,
        "rights.artifact.locator",
        "must be a safe licensed-artifacts/*.json relative locator",
      );
    }
    if (!sha256Pattern.test(rights.artifact.sha256 ?? "")) {
      addError(
        errors,
        "rights.artifact.sha256",
        "must be a lowercase SHA-256",
      );
    }
  }

  if (!isRecord(rights.edition)) {
    addError(errors, "rights.edition", "must be an object");
  } else if (!["unresolved", "confirmed"].includes(rights.edition.status)) {
    addError(
      errors,
      "rights.edition.status",
      "must be unresolved or confirmed",
    );
  } else if (rights.edition.status === "unresolved") {
    if (rights.edition.canonicalName !== null) {
      addError(
        errors,
        "rights.edition.canonicalName",
        "must be null while unresolved",
      );
    }
  } else if (!isNonEmptyString(rights.edition.canonicalName)) {
    addError(
      errors,
      "rights.edition.canonicalName",
      "is required when confirmed",
    );
  }

  if (!isRecord(rights.divineNameVariant)) {
    addError(errors, "rights.divineNameVariant", "must be an object");
  } else {
    const variant = rights.divineNameVariant;
    const allowedValues = Array.isArray(variant.allowedValues)
      ? variant.allowedValues
      : null;
    if (!["unresolved", "confirmed"].includes(variant.status)) {
      addError(
        errors,
        "rights.divineNameVariant.status",
        "must be unresolved or confirmed",
      );
    }
    if (
      allowedValues === null ||
      !allowedValues.includes("神") ||
      !allowedValues.includes("上帝")
    ) {
      addError(
        errors,
        "rights.divineNameVariant.allowedValues",
        "must explicitly list 神 and 上帝",
      );
    }
    if (variant.status === "unresolved" && variant.value !== null) {
      addError(
        errors,
        "rights.divineNameVariant.value",
        "must be null while unresolved",
      );
    } else if (
      variant.status === "confirmed" &&
      (allowedValues === null || !allowedValues.includes(variant.value))
    ) {
      addError(
        errors,
        "rights.divineNameVariant.value",
        "must be a declared allowed value when confirmed",
      );
    }
  }

  if (!isRecord(rights.territories)) {
    addError(errors, "rights.territories", "must be an object");
  } else if (!["unknown", "confirmed"].includes(rights.territories.status)) {
    addError(
      errors,
      "rights.territories.status",
      "must be unknown or confirmed",
    );
  } else if (!Array.isArray(rights.territories.values)) {
    addError(errors, "rights.territories.values", "must be an array");
  } else if (
    rights.territories.status === "unknown" &&
    rights.territories.values.length !== 0
  ) {
    addError(
      errors,
      "rights.territories.values",
      "must be empty while unknown",
    );
  } else if (
    rights.territories.status === "confirmed" &&
    (rights.territories.values.length === 0 ||
      rights.territories.values.some((value) => !isNonEmptyString(value)))
  ) {
    addError(
      errors,
      "rights.territories.values",
      "must list non-empty territories when confirmed",
    );
  }

  if (!isRecord(rights.permissions)) {
    addError(errors, "rights.permissions", "must be an object");
  } else {
    for (const name of permissionNames) {
      validatePermission(
        rights.permissions[name],
        `rights.permissions.${name}`,
        errors,
      );
    }
  }

  if (!isRecord(rights.attribution)) {
    addError(errors, "rights.attribution", "must be an object");
  } else if (!["unknown", "confirmed"].includes(rights.attribution.status)) {
    addError(
      errors,
      "rights.attribution.status",
      "must be unknown or confirmed",
    );
  } else if (
    rights.attribution.status === "unknown" &&
    rights.attribution.text !== null
  ) {
    addError(errors, "rights.attribution.text", "must be null while unknown");
  } else if (
    rights.attribution.status === "confirmed" &&
    !isNonEmptyString(rights.attribution.text)
  ) {
    addError(
      errors,
      "rights.attribution.text",
      "is required when confirmed",
    );
  }

  if (!isRecord(rights.reviewerTrust)) {
    addError(errors, "rights.reviewerTrust", "must be an object");
  } else {
    if (rights.reviewerTrust.locator !== "scripture-trusted-reviewers.json") {
      addError(
        errors,
        "rights.reviewerTrust.locator",
        "must use the pinned story reviewer configuration",
      );
    }
    if (Object.hasOwn(rights.reviewerTrust, "sha256")) {
      addError(
        errors,
        "rights.reviewerTrust.sha256",
        "must not be story-supplied; the caller must provide the trust anchor",
      );
    }
  }

  if (!isRecord(rights.reviews)) {
    addError(errors, "rights.reviews", "must be an object");
  } else {
    for (const name of reviewNames) {
      validateReview(rights.reviews[name], `rights.reviews.${name}`, errors);
    }
  }

  if (!isRecord(rights.release)) {
    addError(errors, "rights.release", "must be an object");
  } else if (
    typeof rights.release.blocked !== "boolean" ||
    !Array.isArray(rights.release.blockers)
  ) {
    addError(
      errors,
      "rights.release",
      "must contain boolean blocked and a blockers array",
    );
  }
}

function validateLicensedTextSource(verses, rights, errors) {
  if (!verses.some((verse) => isNonEmptyString(verse?.exactText))) {
    return;
  }
  if (rights.provider?.status !== "confirmed") {
    addError(
      errors,
      "rights.provider",
      "must be confirmed before exactText may be stored",
    );
  }
  if (rights.artifact?.status !== "available") {
    addError(
      errors,
      "rights.artifact",
      "must be available before exactText may be stored",
    );
  }
  for (const name of ["redistribution", "offline"]) {
    if (rights.permissions?.[name]?.status !== "allowed") {
      addError(
        errors,
        `rights.permissions.${name}`,
        "must be allowed before exactText may be stored",
      );
    }
  }
}

export function validateDevelopmentScripture(contract, rights) {
  const errors = [];
  if (!isRecord(contract)) {
    return result([{ field: "scripture", message: "must be an object" }]);
  }
  if (!isRecord(rights)) {
    return result([{ field: "rights", message: "must be an object" }]);
  }

  validateVersion(
    contract.schemaVersion,
    supportedVersions.scripture,
    "schemaVersion",
    errors,
  );
  validatePassage(contract.passage, "passage", errors);
  if (!isRecord(contract.translation)) {
    addError(errors, "translation", "must be an object");
  } else {
    if (contract.translation.language !== "zh-Hant") {
      addError(errors, "translation.language", "must be zh-Hant");
    }
    if (
      !["unresolved", "confirmed"].includes(
        contract.translation.editionStatus,
      )
    ) {
      addError(
        errors,
        "translation.editionStatus",
        "must be unresolved or confirmed",
      );
    }
  }

  validateRights(rights, errors);
  const verses = validateVerses(contract, rights, errors);
  validateLicensedTextSource(verses, rights, errors);

  const hasUnknowns =
    rights.provider?.status !== "confirmed" ||
    rights.artifact?.status !== "available" ||
    rights.edition?.status !== "confirmed" ||
    rights.divineNameVariant?.status !== "confirmed" ||
    rights.territories?.status !== "confirmed" ||
    permissionNames.some(
      (name) => rights.permissions?.[name]?.status !== "allowed",
    ) ||
    rights.attribution?.status !== "confirmed" ||
    reviewNames.some((name) => rights.reviews?.[name]?.status !== "approved") ||
    verses.some(
      (verse) =>
        verse?.exactText === null || verse?.review?.status !== "approved",
    );
  if (hasUnknowns) {
    if (contract.contractStatus !== "blocked-rights-unresolved") {
      addError(
        errors,
        "contractStatus",
        "must explicitly block release while requirements are unresolved",
      );
    }
    if (
      rights.release?.blocked !== true ||
      !Array.isArray(rights.release?.blockers) ||
      rights.release.blockers.length === 0
    ) {
      addError(
        errors,
        "rights.release",
        "must explicitly block release and list blockers",
      );
    }
  }

  return result(errors);
}

async function readPinnedFile(rootUrl, locator, field, errors) {
  if (!(rootUrl instanceof URL) || rootUrl.protocol !== "file:") {
    addError(errors, field, "root must be a local file URL");
    return null;
  }

  const rootPath = path.resolve(fileURLToPath(rootUrl));
  const candidatePath = path.resolve(rootPath, locator);
  if (
    candidatePath === rootPath ||
    !candidatePath.startsWith(`${rootPath}${path.sep}`)
  ) {
    addError(errors, field, "must remain inside the configured local root");
    return null;
  }

  try {
    const [resolvedRoot, resolvedCandidate] = await Promise.all([
      realpath(rootPath),
      realpath(candidatePath),
    ]);
    if (!resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`)) {
      addError(errors, field, "must not escape the local root through a link");
      return null;
    }
    return await readFile(resolvedCandidate);
  } catch (error) {
    addError(
      errors,
      field,
      `could not read pinned file (${error.code ?? "READ_FAILED"})`,
    );
    return null;
  }
}

function validateTrustedReviewers(config, rights, verses, errors) {
  const trusted = new Map();
  if (!isRecord(config)) {
    addError(errors, "trustedReviewers", "must be a JSON object");
    return trusted;
  }
  validateVersion(
    config.schemaVersion,
    supportedVersions.reviewers,
    "trustedReviewers.schemaVersion",
    errors,
  );
  if (!Array.isArray(config.reviewers)) {
    addError(errors, "trustedReviewers.reviewers", "must be an array");
    return trusted;
  }

  for (const [index, reviewer] of config.reviewers.entries()) {
    const field = `trustedReviewers.reviewers[${index}]`;
    if (!isRecord(reviewer)) {
      addError(errors, field, "must be an object");
      continue;
    }
    if (!isNonEmptyString(reviewer.id)) {
      addError(errors, `${field}.id`, "must be a non-empty reviewer ID");
      continue;
    }
    if (trusted.has(reviewer.id)) {
      addError(errors, `${field}.id`, "must be unique");
      continue;
    }
    if (
      !Array.isArray(reviewer.roles) ||
      reviewer.roles.length === 0 ||
      reviewer.roles.some((role) => !reviewNames.includes(role))
    ) {
      addError(
        errors,
        `${field}.roles`,
        "must contain supported text, edition, or rights roles",
      );
      continue;
    }
    trusted.set(reviewer.id, new Set(reviewer.roles));
  }

  const checks = [];
  if (isRecord(rights.reviews)) {
    for (const role of reviewNames) {
      checks.push([rights.reviews[role], role, `rights.reviews.${role}`]);
    }
  }
  if (Array.isArray(verses)) {
    for (const [index, verse] of verses.entries()) {
      checks.push([verse?.review, "text", `verses[${index}].review`]);
    }
  }
  for (const [review, role, field] of checks) {
    if (review?.status !== "approved") {
      continue;
    }
    if (!trusted.get(review.reviewer)?.has(role)) {
      addError(
        errors,
        `${field}.reviewer`,
        `must be a trusted reviewer ID with the ${role} role`,
      );
    }
  }
  return trusted;
}

function validateArtifactJson(artifact, contract, rights, errors) {
  if (!isRecord(artifact)) {
    addError(errors, "rights.artifact", "must contain a JSON object");
    return;
  }
  validateVersion(
    artifact.schemaVersion,
    supportedVersions.artifact,
    "rights.artifact.schemaVersion",
    errors,
  );
  if (artifact.id !== rights.artifact.id) {
    addError(errors, "rights.artifact.id", "must equal the imported artifact ID");
  }
  validatePassage(artifact.passage, "rights.artifact.passage", errors);

  if (!isRecord(artifact.translation)) {
    addError(errors, "rights.artifact.translation", "must be an object");
  } else {
    const comparisons = [
      ["id", contract.translation?.id],
      ["editionId", contract.translation?.editionId],
      ["canonicalName", rights.edition?.canonicalName],
      ["language", "zh-Hant"],
      ["divineNameVariant", rights.divineNameVariant?.value],
    ];
    for (const [name, expected] of comparisons) {
      if (!isNonEmptyString(artifact.translation[name])) {
        addError(
          errors,
          `rights.artifact.translation.${name}`,
          "must be a non-empty string",
        );
      } else if (artifact.translation[name] !== expected) {
        addError(
          errors,
          `rights.artifact.translation.${name}`,
          "must exactly equal the verified contract and rights metadata",
        );
      }
    }
  }

  if (!Array.isArray(artifact.verses)) {
    addError(errors, "rights.artifact.verses", "must be an array");
    return;
  }
  if (artifact.verses.length !== JOHN_9_VERSE_KEYS.length) {
    addError(
      errors,
      "rights.artifact.verses",
      "must contain exactly 41 entries",
    );
  }

  for (const [index, expectedKey] of JOHN_9_VERSE_KEYS.entries()) {
    const imported = artifact.verses[index];
    const verse = Array.isArray(contract.verses)
      ? contract.verses[index]
      : undefined;
    const field = `rights.artifact.verses[${index}]`;
    if (!isRecord(imported)) {
      addError(errors, field, "must be an object");
      continue;
    }
    if (imported.key !== expectedKey) {
      addError(errors, `${field}.key`, `must be ${expectedKey}`);
    }
    if (!isNonEmptyString(imported.exactText)) {
      addError(errors, `${field}.exactText`, "must be non-empty");
      continue;
    }
    if (imported.exactText !== verse?.exactText) {
      addError(
        errors,
        `${field}.exactText`,
        "must exactly equal the imported contract verse text",
      );
    }
  }
}

async function verifyReviewerTrust(
  contract,
  rights,
  rootUrl,
  trustedReviewerConfigSha256,
  errors,
) {
  if (!sha256Pattern.test(trustedReviewerConfigSha256 ?? "")) {
    addError(
      errors,
      "trustedReviewerConfigSha256",
      "must be supplied externally as a lowercase SHA-256",
    );
    return;
  }
  const locator = rights.reviewerTrust?.locator;
  if (locator !== "scripture-trusted-reviewers.json") {
    return;
  }
  const bytes = await readPinnedFile(
    rootUrl,
    locator,
    "rights.reviewerTrust.locator",
    errors,
  );
  if (bytes === null) {
    return;
  }
  if (sha256(bytes) !== trustedReviewerConfigSha256) {
    addError(
      errors,
      "trustedReviewerConfigSha256",
      "does not match the actual trusted reviewer configuration bytes",
    );
    return;
  }

  let config;
  try {
    config = JSON.parse(bytes.toString("utf8"));
  } catch {
    addError(
      errors,
      "trustedReviewers",
      "contains malformed JSON",
    );
    return;
  }
  validateTrustedReviewers(config, rights, contract.verses, errors);
}

async function verifyPermissionEvidence(rights, rootUrl, errors) {
  if (!isRecord(rights.permissions)) {
    return;
  }
  await Promise.all(
    permissionNames.map(async (name) => {
      const permission = rights.permissions[name];
      if (
        !isRecord(permission) ||
        permission.status === "unknown" ||
        !evidenceLocatorPattern.test(permission.evidenceLocator ?? "")
      ) {
        return;
      }
      const field = `rights.permissions.${name}`;
      const bytes = await readPinnedFile(
        rootUrl,
        permission.evidenceLocator,
        `${field}.evidenceLocator`,
        errors,
      );
      if (bytes === null) {
        return;
      }
      const actualSha256 = sha256(bytes);
      if (actualSha256 !== permission.evidenceSha256) {
        addError(
          errors,
          `${field}.evidenceSha256`,
          "does not match the actual permission evidence bytes",
        );
      }
      if (permission.evidenceId !== `urn:sha256:${actualSha256}`) {
        addError(
          errors,
          `${field}.evidenceId`,
          "does not identify the actual permission evidence bytes",
        );
      }
    }),
  );
}

async function verifyArtifact(contract, rights, rootUrl, errors) {
  if (
    rights.artifact?.status !== "available" ||
    !artifactLocatorPattern.test(rights.artifact.locator ?? "")
  ) {
    return;
  }
  const bytes = await readPinnedFile(
    rootUrl,
    rights.artifact.locator,
    "rights.artifact.locator",
    errors,
  );
  if (bytes === null) {
    return;
  }
  if (sha256(bytes) !== rights.artifact.sha256) {
    addError(
      errors,
      "rights.artifact.sha256",
      "does not match the actual artifact bytes",
    );
    return;
  }

  let artifact;
  try {
    artifact = JSON.parse(bytes.toString("utf8"));
  } catch {
    addError(errors, "rights.artifact", "contains malformed JSON");
    return;
  }
  validateArtifactJson(artifact, contract, rights, errors);
}

export async function validateReleaseReadyScripture(
  contract,
  rights,
  {
    artifactRoot = storyRootUrl,
    evidenceRoot = storyRootUrl,
    reviewerRoot = storyRootUrl,
    trustedReviewerConfigSha256,
  } = {},
) {
  const errors = [...validateDevelopmentScripture(contract, rights).errors];
  if (!isRecord(contract) || !isRecord(rights)) {
    return result(errors);
  }

  if (contract.contractStatus !== "release-ready") {
    addError(errors, "contractStatus", "must be release-ready");
  }
  if (contract.translation?.editionStatus !== "confirmed") {
    addError(errors, "translation.editionStatus", "must be confirmed");
  }

  const verses = Array.isArray(contract.verses) ? contract.verses : [];
  for (const [index, verse] of verses.entries()) {
    if (!isNonEmptyString(verse?.exactText)) {
      addError(errors, `verses[${index}].exactText`, "is required for release");
    }
    if (verse?.editionStatus !== "confirmed") {
      addError(errors, `verses[${index}].editionStatus`, "must be confirmed");
    }
    if (verse?.review?.status !== "approved") {
      addError(errors, `verses[${index}].review`, "must be approved");
    }
  }

  for (const [field, status, expected] of [
    ["rights.provider", rights.provider?.status, "confirmed"],
    ["rights.artifact", rights.artifact?.status, "available"],
    ["rights.edition", rights.edition?.status, "confirmed"],
    ["rights.divineNameVariant", rights.divineNameVariant?.status, "confirmed"],
    ["rights.territories", rights.territories?.status, "confirmed"],
    ["rights.attribution", rights.attribution?.status, "confirmed"],
  ]) {
    if (status !== expected) {
      addError(errors, field, `must be ${expected}`);
    }
  }
  for (const name of permissionNames) {
    if (rights.permissions?.[name]?.status !== "allowed") {
      addError(
        errors,
        `rights.permissions.${name}`,
        "must be allowed for release",
      );
    }
  }
  for (const name of reviewNames) {
    if (rights.reviews?.[name]?.status !== "approved") {
      addError(
        errors,
        `rights.reviews.${name}`,
        "must be approved for release",
      );
    }
  }
  if (
    rights.release?.blocked !== false ||
    !Array.isArray(rights.release?.blockers) ||
    rights.release.blockers.length !== 0
  ) {
    addError(
      errors,
      "rights.release",
      "must be unblocked with no blockers for release",
    );
  }

  await Promise.all([
    verifyArtifact(contract, rights, artifactRoot, errors),
    verifyPermissionEvidence(rights, evidenceRoot, errors),
    verifyReviewerTrust(
      contract,
      rights,
      reviewerRoot,
      trustedReviewerConfigSha256,
      errors,
    ),
  ]);
  return result(errors);
}

async function readJsonInput(name, location, errors) {
  let bytes;
  try {
    bytes = await readFile(location);
  } catch (error) {
    errors.push({
      field: name,
      code: error.code ?? "READ_FAILED",
      message: "could not read JSON input",
    });
    return null;
  }
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    errors.push({
      field: name,
      code: "INVALID_JSON",
      message: "contains malformed JSON",
    });
    return null;
  }
}

export async function loadScriptureContract({
  scripture = scriptureUrl,
  rights = rightsUrl,
  trustedReviewers = reviewersUrl,
} = {}) {
  const errors = [];
  const [scriptureValue, rightsValue, trustedReviewersValue] = await Promise.all(
    [
      readJsonInput("scripture", scripture, errors),
      readJsonInput("rights", rights, errors),
      readJsonInput("trustedReviewers", trustedReviewers, errors),
    ],
  );
  return {
    ok: errors.length === 0,
    errors,
    scripture: scriptureValue,
    rights: rightsValue,
    trustedReviewers: trustedReviewersValue,
  };
}
