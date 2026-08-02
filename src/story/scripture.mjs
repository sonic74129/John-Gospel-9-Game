import { readFile } from "node:fs/promises";

const scriptureUrl = new URL("./scripture.json", import.meta.url);
const rightsUrl = new URL("./scripture-rights.json", import.meta.url);
const permissionNames = ["redistribution", "offline", "tts"];
const reviewNames = ["text", "edition", "rights"];
const expectedPassage = {
  book: "John",
  chapter: 9,
  verseStart: 1,
  verseEnd: 41,
};

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

function addError(errors, path, message) {
  errors.push(`${path}: ${message}`);
}

function validateReview(review, path, errors) {
  if (!isRecord(review)) {
    addError(errors, path, "must be an object");
    return;
  }

  if (!["pending", "approved"].includes(review.status)) {
    addError(errors, `${path}.status`, "must be pending or approved");
    return;
  }

  if (review.status === "pending") {
    if (review.reviewer !== null || review.reviewedAt !== null) {
      addError(
        errors,
        path,
        "pending reviews must have null reviewer and reviewedAt",
      );
    }
    return;
  }

  if (!isNonEmptyString(review.reviewer)) {
    addError(errors, `${path}.reviewer`, "is required for an approved review");
  }
  if (!isReviewDate(review.reviewedAt)) {
    addError(
      errors,
      `${path}.reviewedAt`,
      "must be a valid YYYY-MM-DD date for an approved review",
    );
  }
}

function validatePassage(contract, errors) {
  if (!isRecord(contract.passage)) {
    addError(errors, "passage", "must be an object");
    return;
  }

  for (const [field, expected] of Object.entries(expectedPassage)) {
    if (contract.passage[field] !== expected) {
      addError(errors, `passage.${field}`, `must equal ${expected}`);
    }
  }
}

function validateDisplay(verse, path, errors) {
  if (!isRecord(verse.display)) {
    addError(errors, `${path}.display`, "must be an object");
    return;
  }

  const segments = verse.display.segments;
  if (!Array.isArray(segments)) {
    addError(errors, `${path}.display.segments`, "must be an array");
    return;
  }

  if (verse.exactText === null) {
    if (verse.textAvailability !== "unavailable-rights-pending") {
      addError(
        errors,
        `${path}.textAvailability`,
        "must explicitly identify rights-pending unavailability",
      );
    }
    if (verse.display.mode !== "unavailable" || segments.length !== 0) {
      addError(
        errors,
        `${path}.display`,
        "unavailable text must use unavailable mode with no segments",
      );
    }
    return;
  }

  if (!isNonEmptyString(verse.exactText)) {
    addError(errors, `${path}.exactText`, "must be null or a non-empty string");
    return;
  }
  if (verse.textAvailability !== "licensed") {
    addError(
      errors,
      `${path}.textAvailability`,
      "must be licensed when exactText is present",
    );
  }
  if (!["full", "segmented"].includes(verse.display.mode)) {
    addError(
      errors,
      `${path}.display.mode`,
      "must be full or segmented when exactText is present",
    );
  }
  if (segments.length === 0) {
    addError(
      errors,
      `${path}.display.segments`,
      "must contain display segments when exactText is present",
    );
    return;
  }

  const segmentIds = new Set();
  let concatenated = "";
  for (const [index, segment] of segments.entries()) {
    const segmentPath = `${path}.display.segments[${index}]`;
    if (!isRecord(segment)) {
      addError(errors, segmentPath, "must be an object");
      continue;
    }
    if (!isNonEmptyString(segment.id)) {
      addError(errors, `${segmentPath}.id`, "must be a non-empty string");
    } else if (segmentIds.has(segment.id)) {
      addError(errors, `${segmentPath}.id`, "must be unique within the verse");
    } else {
      segmentIds.add(segment.id);
    }
    if (typeof segment.text !== "string") {
      addError(errors, `${segmentPath}.text`, "must be a string");
    } else {
      concatenated += segment.text;
    }
  }

  if (concatenated !== verse.exactText) {
    addError(
      errors,
      `${path}.display.segments`,
      "must concatenate exactly to exactText",
    );
  }
}

function validateVerses(contract, rights, errors) {
  if (!Array.isArray(contract.verses)) {
    addError(errors, "verses", "must be an array");
    return [];
  }

  const verses = contract.verses;
  const keys = verses.map((verse) => verse?.key);
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
  for (const [key, count] of keyCounts) {
    if (count > 1) {
      addError(errors, "verses", `contains duplicate key ${String(key)}`);
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

  const translationIds = new Set();
  for (const [index, verse] of verses.entries()) {
    const path = `verses[${index}]`;
    if (!isRecord(verse)) {
      addError(errors, path, "must be an object");
      continue;
    }

    translationIds.add(verse.translationId);
    const expectedVerse = index + 1;
    if (
      !isRecord(verse.reference) ||
      verse.reference.book !== "John" ||
      verse.reference.chapter !== 9 ||
      verse.reference.verse !== expectedVerse
    ) {
      addError(
        errors,
        `${path}.reference`,
        `must identify John 9:${expectedVerse}`,
      );
    }
    if (verse.language !== "zh-Hant") {
      addError(errors, `${path}.language`, "must be zh-Hant");
    }
    if (!["unresolved", "confirmed"].includes(verse.editionStatus)) {
      addError(
        errors,
        `${path}.editionStatus`,
        "must be unresolved or confirmed",
      );
    }
    if (verse.sourceLevel !== "scripture") {
      addError(errors, `${path}.sourceLevel`, "must be scripture");
    }

    validateDisplay(verse, path, errors);
    validateReview(verse.review, `${path}.review`, errors);
  }

  if (translationIds.size > 1) {
    addError(errors, "verses", "must not mix translation IDs");
  }

  const declaredTranslationId = contract.translation?.id;
  const verseTranslationId = [...translationIds][0];
  if (
    verseTranslationId !== undefined &&
    verseTranslationId !== declaredTranslationId
  ) {
    addError(
      errors,
      "translation.id",
      "must match every verse translationId",
    );
  }
  if (
    rights.translationId !== declaredTranslationId ||
    rights.edition?.id !== declaredTranslationId
  ) {
    addError(
      errors,
      "rights.translationId",
      "must match the scripture translation and edition IDs",
    );
  }

  return verses;
}

function validatePermission(permission, path, rightsReview, errors) {
  if (!isRecord(permission)) {
    addError(errors, path, "must be an object");
    return;
  }
  if (!["unknown", "allowed", "denied"].includes(permission.status)) {
    addError(errors, `${path}.status`, "must be unknown, allowed, or denied");
    return;
  }

  if (permission.status === "unknown") {
    if (permission.basis !== null || permission.evidence !== null) {
      addError(
        errors,
        path,
        "unknown permissions must have null basis and evidence",
      );
    }
    return;
  }

  if (
    !isNonEmptyString(permission.basis) ||
    !isNonEmptyString(permission.evidence)
  ) {
    addError(
      errors,
      path,
      "claimed permissions require non-empty basis and evidence",
    );
  }
  if (rightsReview?.status !== "approved") {
    addError(
      errors,
      path,
      "claimed permissions require an approved rights review",
    );
  }
}

function validateRights(rights, errors) {
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
    if (rights.artifact.id !== null || rights.artifact.sha256 !== null) {
      addError(
        errors,
        "rights.artifact",
        "unavailable artifacts must have null id and sha256",
      );
    }
  } else {
    if (!isNonEmptyString(rights.artifact.id)) {
      addError(errors, "rights.artifact.id", "is required when available");
    }
    if (!/^[a-f0-9]{64}$/.test(rights.artifact.sha256 ?? "")) {
      addError(
        errors,
        "rights.artifact.sha256",
        "must be a lowercase SHA-256 when available",
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
    if (!["unresolved", "confirmed"].includes(variant.status)) {
      addError(
        errors,
        "rights.divineNameVariant.status",
        "must be unresolved or confirmed",
      );
    }
    if (
      !Array.isArray(variant.allowedValues) ||
      !variant.allowedValues.includes("神") ||
      !variant.allowedValues.includes("上帝")
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
      !variant.allowedValues?.includes(variant.value)
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
  } else if (
    rights.territories.status === "unknown" &&
    (!Array.isArray(rights.territories.values) ||
      rights.territories.values.length !== 0)
  ) {
    addError(
      errors,
      "rights.territories.values",
      "must be empty while unknown",
    );
  } else if (
    rights.territories.status === "confirmed" &&
    (!Array.isArray(rights.territories.values) ||
      rights.territories.values.length === 0 ||
      rights.territories.values.some((value) => !isNonEmptyString(value)))
  ) {
    addError(
      errors,
      "rights.territories.values",
      "must list at least one territory when confirmed",
    );
  }

  if (!isRecord(rights.reviews)) {
    addError(errors, "rights.reviews", "must be an object");
  } else {
    for (const name of reviewNames) {
      validateReview(
        rights.reviews[name],
        `rights.reviews.${name}`,
        errors,
      );
    }
  }

  if (!isRecord(rights.permissions)) {
    addError(errors, "rights.permissions", "must be an object");
  } else {
    for (const name of permissionNames) {
      validatePermission(
        rights.permissions[name],
        `rights.permissions.${name}`,
        rights.reviews?.rights,
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

  if (!isRecord(rights.release)) {
    addError(errors, "rights.release", "must be an object");
  } else if (
    typeof rights.release.blocked !== "boolean" ||
    !Array.isArray(rights.release.blockers)
  ) {
    addError(
      errors,
      "rights.release",
      "must contain boolean blocked and an array of blockers",
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

function result(errors) {
  return { ok: errors.length === 0, errors };
}

export function validateDevelopmentScripture(contract, rights) {
  const errors = [];
  if (!isRecord(contract)) {
    return result(["scripture: must be an object"]);
  }
  if (!isRecord(rights)) {
    return result(["rights: must be an object"]);
  }

  validatePassage(contract, errors);
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
      rights.release?.blockers?.length === 0
    ) {
      addError(
        errors,
        "rights.release",
        "must explicitly block release and list blockers while requirements are unresolved",
      );
    }
  }

  return result(errors);
}

export function validateReleaseReadyScripture(contract, rights) {
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

  for (const [index, verse] of (contract.verses ?? []).entries()) {
    const path = `verses[${index}]`;
    if (!isNonEmptyString(verse?.exactText)) {
      addError(errors, `${path}.exactText`, "is required for release");
    }
    if (verse?.editionStatus !== "confirmed") {
      addError(errors, `${path}.editionStatus`, "must be confirmed");
    }
    if (verse?.review?.status !== "approved") {
      addError(errors, `${path}.review`, "must be approved");
    }
  }

  for (const [path, status] of [
    ["rights.provider", rights.provider?.status],
    ["rights.artifact", rights.artifact?.status],
    ["rights.edition", rights.edition?.status],
    ["rights.divineNameVariant", rights.divineNameVariant?.status],
    ["rights.territories", rights.territories?.status],
    ["rights.attribution", rights.attribution?.status],
  ]) {
    const expected = path === "rights.artifact" ? "available" : "confirmed";
    if (status !== expected) {
      addError(errors, path, `must be ${expected}`);
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
    rights.release?.blockers?.length !== 0
  ) {
    addError(
      errors,
      "rights.release",
      "must be unblocked with no blockers for release",
    );
  }

  return result(errors);
}

export async function loadScriptureContract({
  scripture = scriptureUrl,
  rights = rightsUrl,
} = {}) {
  const [scriptureJson, rightsJson] = await Promise.all([
    readFile(scripture, "utf8"),
    readFile(rights, "utf8"),
  ]);

  return {
    scripture: JSON.parse(scriptureJson),
    rights: JSON.parse(rightsJson),
  };
}
