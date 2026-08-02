import { promises as fs } from "node:fs";
import path from "node:path";
import {
  lockPath,
  readJson,
  root,
  writeJson,
} from "./foundation-lib.mjs";

const raw = process.argv.slice(2);
const options = {};
for (let index = 0; index < raw.length; index += 2) {
  const flag = raw[index];
  const value = raw[index + 1];
  if (!flag?.startsWith("--") || value === undefined) {
    throw new Error(`Invalid argument near ${flag ?? "<end>"}.`);
  }
  options[flag.slice(2)] = value;
}

const required = [
  "id",
  "title",
  "book",
  "chapter",
  "verses",
  "translation",
  "period",
  "region",
];
const missing = required.filter((key) => !options[key]);
if (missing.length > 0) {
  throw new Error(`Missing required options: ${missing.join(", ")}`);
}
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(options.id)) {
  throw new Error("Story id must be a lowercase kebab-case slug.");
}
const chapter = Number.parseInt(options.chapter, 10);
if (!Number.isInteger(chapter) || chapter < 1) {
  throw new Error("Chapter must be a positive integer.");
}

const lock = await readJson(lockPath);
const storyConfigPath = path.join(root, "src", "story", "story.config.json");
const gameManifestPath = path.join(root, "game.manifest.json");
const packagePath = path.join(root, "package.json");
const packageLockPath = path.join(root, "package-lock.json");
const story = await readJson(storyConfigPath);
const game = await readJson(gameManifestPath);
const packageJson = await readJson(packagePath);
const packageLock = await readJson(packageLockPath);
const passage = {
  book: options.book,
  chapter,
  verses: options.verses,
  translation: options.translation,
};

Object.assign(story, {
  template: false,
  id: options.id,
  title: options.title,
  passage,
  setting: {
    period: options.period,
    region: options.region,
  },
  foundationCommit: lock.commit,
});

Object.assign(game, {
  template: false,
  id: options.id,
  title: options.title,
  passage,
  foundationCommit: lock.commit,
  entry: `/games/${options.id}/`,
});

const packageName = `@sonic74129/bible-story-${options.id}`;
packageJson.name = packageName;
packageJson.description = `${options.title}: independent Bible story exploration game.`;
packageLock.name = packageName;
if (packageLock.packages?.[""]) {
  packageLock.packages[""].name = packageName;
}

await writeJson(storyConfigPath, story);
await writeJson(gameManifestPath, game);
await writeJson(packagePath, packageJson);
await writeJson(packageLockPath, packageLock);

console.log(`Initialized ${options.title} (${options.id}).`);
console.log("Review scripture scope and player role before implementing gameplay.");
