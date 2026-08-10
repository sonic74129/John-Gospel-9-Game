const BEGIN_MARKER = "<!-- FOUNDATION_CONTEXT_CONTINUITY_V1_BEGIN -->";
const END_MARKER = "<!-- FOUNDATION_CONTEXT_CONTINUITY_V1_END -->";

function extractMarkedBlock(content, sourceLabel) {
  const normalized = content.replace(/\r\n/g, "\n");
  const start = normalized.indexOf(BEGIN_MARKER);
  if (start === -1) {
    throw new Error(`${sourceLabel} is missing ${BEGIN_MARKER}.`);
  }
  if (normalized.indexOf(BEGIN_MARKER, start + BEGIN_MARKER.length) !== -1) {
    throw new Error(`${sourceLabel} must contain ${BEGIN_MARKER} exactly once.`);
  }
  const end = normalized.indexOf(END_MARKER, start);
  if (end === -1) {
    throw new Error(`${sourceLabel} is missing ${END_MARKER}.`);
  }
  if (normalized.indexOf(END_MARKER, end + END_MARKER.length) !== -1) {
    throw new Error(`${sourceLabel} must contain ${END_MARKER} exactly once.`);
  }
  return normalized.slice(start, end + END_MARKER.length);
}

export function extractCanonicalContextContinuityBlockFromSkill(content) {
  return extractMarkedBlock(
    content,
    ".foundation/skills/bible-story-game-builder/SKILL.md",
  );
}

export function extractContextContinuityBlockFromInstructions(content) {
  return extractMarkedBlock(content, ".github/copilot-instructions.md");
}

export function assertContextContinuityPolicyParity({
  canonicalBlock,
  instructionsContent,
}) {
  const storyBlock =
    extractContextContinuityBlockFromInstructions(instructionsContent);
  if (storyBlock !== canonicalBlock) {
    throw new Error(
      "Story instructions continuity policy block does not match Foundation canonical block.",
    );
  }
}

export function validateContextContinuityPolicy({
  foundationSkillContent,
  instructionsContent,
}) {
  const canonicalBlock =
    extractCanonicalContextContinuityBlockFromSkill(foundationSkillContent);
  assertContextContinuityPolicyParity({ canonicalBlock, instructionsContent });
  return canonicalBlock;
}
