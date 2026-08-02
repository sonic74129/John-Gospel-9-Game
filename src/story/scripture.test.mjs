import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  JOHN_9_VERSE_KEYS,
  loadScriptureContract,
  validateDevelopmentScripture,
  validateReleaseReadyScripture,
} from "./scripture.mjs";

const draft = await loadScriptureContract();

function cloneDraft() {
  return structuredClone(draft);
}

function errorText(validation) {
  return validation.errors.join("\n");
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

  test("rejects a missing verse key", () => {
    const { scripture, rights } = cloneDraft();
    scripture.verses.splice(10, 1);

    const validation = validateDevelopmentScripture(scripture, rights);

    assert.equal(validation.ok, false);
    assert.match(errorText(validation), /exactly 41 entries/);
    assert.match(errorText(validation), /missing john9:11/);
  });

  test("rejects a duplicate verse key", () => {
    const { scripture, rights } = cloneDraft();
    scripture.verses[1] = structuredClone(scripture.verses[0]);

    const validation = validateDevelopmentScripture(scripture, rights);

    assert.equal(validation.ok, false);
    assert.match(errorText(validation), /duplicate key john9:1/);
  });

  test("rejects out-of-order verse keys", () => {
    const { scripture, rights } = cloneDraft();
    [scripture.verses[0], scripture.verses[1]] = [
      scripture.verses[1],
      scripture.verses[0],
    ];

    const validation = validateDevelopmentScripture(scripture, rights);

    assert.equal(validation.ok, false);
    assert.match(errorText(validation), /preserve canonical order/);
  });

  test("rejects mixed translation IDs", () => {
    const { scripture, rights } = cloneDraft();
    scripture.verses[20].translationId = "unapproved-test-edition";

    const validation = validateDevelopmentScripture(scripture, rights);

    assert.equal(validation.ok, false);
    assert.match(errorText(validation), /must not mix translation IDs/);
  });

  test("rejects rights claims without evidence and approval", () => {
    const { scripture, rights } = cloneDraft();
    rights.permissions.redistribution.status = "allowed";

    const validation = validateDevelopmentScripture(scripture, rights);

    assert.equal(validation.ok, false);
    assert.match(
      errorText(validation),
      /claimed permissions require non-empty basis and evidence/,
    );
    assert.match(
      errorText(validation),
      /claimed permissions require an approved rights review/,
    );
  });

  test("rejects display segments that do not exactly reconstruct text", () => {
    const { scripture, rights } = cloneDraft();
    const verse = scripture.verses[0];
    verse.exactText = "[licensed test fixture]";
    verse.textAvailability = "licensed";
    verse.display = {
      mode: "segmented",
      segments: [{ id: "john9:1-a", text: "[mismatch]" }],
    };

    const validation = validateDevelopmentScripture(scripture, rights);

    assert.equal(validation.ok, false);
    assert.match(errorText(validation), /concatenate exactly to exactText/);
  });
});

test("release validation remains blocked by every unresolved requirement", () => {
  const validation = validateReleaseReadyScripture(
    draft.scripture,
    draft.rights,
  );
  const errors = errorText(validation);

  assert.equal(validation.ok, false);
  assert.match(errors, /contractStatus: must be release-ready/);
  assert.match(errors, /verses\[0\]\.exactText: is required for release/);
  assert.match(errors, /rights\.artifact: must be available/);
  assert.match(
    errors,
    /rights\.permissions\.redistribution: must be allowed for release/,
  );
  assert.match(errors, /rights\.reviews\.rights: must be approved for release/);
  assert.match(errors, /rights\.release: must be unblocked/);
});
