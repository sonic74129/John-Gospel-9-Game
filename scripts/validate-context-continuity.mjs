import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateContextContinuityPolicy } from "../.github/scripts/context-continuity-policy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [instructionsContent, foundationSkillContent] = await Promise.all([
  fs.readFile(path.join(root, ".github", "copilot-instructions.md"), "utf8"),
  fs.readFile(
    path.join(root, ".foundation", "skills", "bible-story-game-builder", "SKILL.md"),
    "utf8",
  ),
]);

validateContextContinuityPolicy({ foundationSkillContent, instructionsContent });
console.log("Context continuity policy matches the pinned Foundation skill.");
