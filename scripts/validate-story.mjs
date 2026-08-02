import { promises as fs } from "node:fs";
import path from "node:path";
import {
  lockPath,
  readJson,
  root,
} from "./foundation-lib.mjs";

const story = await readJson(
  path.join(root, "src", "story", "story.config.json"),
);
const game = await readJson(path.join(root, "game.manifest.json"));
const lock = await readJson(lockPath);
const packageJson = await readJson(path.join(root, "package.json"));
const errors = [];

for (const field of ["id", "title", "foundationCommit"]) {
  if (story[field] !== game[field]) {
    errors.push(`story.config.json and game.manifest.json disagree on ${field}.`);
  }
}
if (story.foundationCommit !== lock.commit) {
  errors.push("Story foundationCommit does not match foundation.lock.json.");
}
if (JSON.stringify(story.passage) !== JSON.stringify(game.passage)) {
  errors.push("Story passage does not match game manifest passage.");
}
if (!game.languages.includes(story.language)) {
  errors.push("Game languages must include the story language.");
}
if (story.playerRole.mayChangeScriptureOutcome !== false) {
  errors.push("Player may not change the scripture outcome.");
}
if (story.playerRole.mayControlJesus !== false) {
  errors.push("Player may not control Jesus.");
}
if (story.playerRole.mayCauseMiracle !== false) {
  errors.push("Player may not cause a miracle.");
}
if (story.template !== game.template) {
  errors.push("Template state is inconsistent.");
}

if (!story.template) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(story.id)) {
    errors.push("Story id must be lowercase kebab-case.");
  }
  if (packageJson.name !== `@sonic74129/bible-story-${story.id}`) {
    errors.push("package.json name does not match the story id.");
  }
  if (game.entry !== `/games/${story.id}/`) {
    errors.push("Game entry does not match the story id.");
  }
} else if (story.id !== "replace-me") {
  errors.push("Template placeholder has been partially modified.");
}

const selectedPacks = Object.fromEntries(
  lock.assetPacks.map((pack) => [pack.id, pack.version]),
);
if (JSON.stringify(game.assetPacks) !== JSON.stringify(selectedPacks)) {
  errors.push(
    "game.manifest.json assetPacks must match foundation.lock.json selections.",
  );
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(
  story.template
    ? "Template story contract is ready for initialization."
    : `Story contract validated for ${story.id}.`,
);
