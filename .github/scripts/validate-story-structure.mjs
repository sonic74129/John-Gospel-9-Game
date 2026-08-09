import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertContextContinuityPolicyParity,
  extractCanonicalContextContinuityBlockFromSkill,
  validateContextContinuityPolicy,
} from "./context-continuity-policy.mjs";

const FOUNDATION_REPOSITORY = "sonic74129/bible-game-foundation";
const FOUNDATION_COMMIT = "e870049d53bc8da09becd178fd30198b8480a0ca";
const SKILL_PATH = ".foundation/skills/bible-story-game-builder/SKILL.md";
const SKILL_SHA256 =
  "5fafeb54b571666fd228cd3926b3253cfce4f900e256ae2cb000827efbad8ffa";
const trustedRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

function parseStoryRoot(argv) {
  if (argv.length !== 2 || argv[0] !== "--story-root") {
    throw new Error("Usage: validate-story-structure.mjs --story-root <path>");
  }
  return path.resolve(argv[1]);
}

export async function validateStoryStructure(storyRoot) {
  const [lockContent, instructionsContent, skillContent, trustedSkillContent] =
    await Promise.all([
      fs.readFile(path.join(storyRoot, "foundation.lock.json"), "utf8"),
      fs.readFile(path.join(storyRoot, ".github", "copilot-instructions.md"), "utf8"),
      fs.readFile(path.join(storyRoot, SKILL_PATH), "utf8"),
      fs.readFile(path.join(trustedRoot, SKILL_PATH), "utf8"),
    ]);
  const lock = JSON.parse(lockContent);
  const skillEntry = lock.guidance?.find((entry) => entry.target === SKILL_PATH);
  if (
    lock.repository !== FOUNDATION_REPOSITORY ||
    lock.commit !== FOUNDATION_COMMIT ||
    skillEntry?.source !== "skills/bible-story-game-builder/SKILL.md" ||
    skillEntry.sha256 !== SKILL_SHA256
  ) {
    throw new Error("Foundation lock does not pin the canonical continuity source.");
  }
  const actualSkillHash = createHash("sha256").update(skillContent).digest("hex");
  if (actualSkillHash !== SKILL_SHA256) {
    throw new Error("Pinned Foundation skill hash does not match foundation.lock.json.");
  }
  const storyCanonicalBlock = validateContextContinuityPolicy({
    foundationSkillContent: skillContent,
    instructionsContent,
  });
  const trustedCanonicalBlock =
    extractCanonicalContextContinuityBlockFromSkill(trustedSkillContent);
  if (storyCanonicalBlock !== trustedCanonicalBlock) {
    throw new Error("Story Foundation continuity block differs from trusted base.");
  }
  assertContextContinuityPolicyParity({
    canonicalBlock: trustedCanonicalBlock,
    instructionsContent,
  });
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  await validateStoryStructure(parseStoryRoot(process.argv.slice(2)));
  console.log("Validated trusted-base continuity structure.");
}
