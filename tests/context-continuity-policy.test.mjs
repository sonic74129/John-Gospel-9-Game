import assert from "node:assert/strict";
import test from "node:test";
import {
  assertContextContinuityPolicyParity,
  extractCanonicalContextContinuityBlockFromSkill,
} from "../.github/scripts/context-continuity-policy.mjs";

const canonicalBlock = `<!-- FOUNDATION_CONTEXT_CONTINUITY_V1_BEGIN -->
Policy version: 1.
<!-- FOUNDATION_CONTEXT_CONTINUITY_V1_END -->`;

test("extracts the canonical marked block", () => {
  assert.equal(
    extractCanonicalContextContinuityBlockFromSkill(
      `# Foundation skill\n\n${canonicalBlock}\n`,
    ),
    canonicalBlock,
  );
});

test("rejects changed and missing story instruction blocks", () => {
  assert.throws(
    () =>
      assertContextContinuityPolicyParity({
        canonicalBlock,
        instructionsContent: canonicalBlock.replace("version: 1", "version: 2"),
      }),
    /does not match Foundation canonical block/u,
  );
  assert.throws(
    () =>
      assertContextContinuityPolicyParity({
        canonicalBlock,
        instructionsContent: "# Instructions\n",
      }),
    /FOUNDATION_CONTEXT_CONTINUITY_V1_BEGIN/u,
  );
});
