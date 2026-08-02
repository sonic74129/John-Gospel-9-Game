import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const readText = (path) => readFile(path, "utf8");

const packageJson = await readJson("package.json");
const manifest = await readJson("game.manifest.json");

const runtimePackages = [
  "@sonic74129/audio-runtime",
  "@sonic74129/content-schema",
  "@sonic74129/engine",
  "@sonic74129/map-runtime",
  "@sonic74129/sequence-runtime",
  "@sonic74129/story-runtime",
  "@sonic74129/ui",
];

test("platform dependencies are immutable registry versions", () => {
  for (const packageName of runtimePackages) {
    assert.equal(packageJson.dependencies[packageName], "0.1.0", packageName);
  }
  assert.equal(packageJson.dependencies.phaser, "3.90.0");
  assert.equal(packageJson.devDependencies["@sonic74129/test-kit"], "0.1.0");
  assert.equal(packageJson.devDependencies.typescript, "6.0.3");
  assert.equal(packageJson.devDependencies.vite, "7.2.4");
  assert.equal(packageJson.dependencies["@sonic74129/test-kit"], undefined);

  const allSources = Object.values({
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  });
  for (const source of allSources) {
    assert.match(source, /^\d+\.\d+\.\d+$/);
    assert.doesNotMatch(source, /(?:file:|git|github|https?:|latest|main)/i);
  }
});

test("npm authentication is scoped and token-free", async () => {
  assert.equal(
    await readText(".npmrc"),
    "@sonic74129:registry=https://npm.pkg.github.com\n" +
      "//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}\n",
  );
});

test("manifest and Vite retain the stable story route", async () => {
  assert.equal(manifest.sdkVersion, "0.1.0");
  assert.equal(manifest.entry, "/games/john-9-man-born-blind/");
  const viteConfig = await readText("vite.config.ts");
  assert.match(viteConfig, /base:\s*gameManifest\.entry/);
  const html = await readText("index.html");
  assert.match(html, /<main id="app"><\/main>/);
  assert.match(html, /src="\/src\/main\.ts"/);
});

test("story and world data enter the platform only through adapters", async () => {
  const storyAdapter = await readText("src/adapters/story-adapter.ts");
  const worldAdapter = await readText("src/adapters/world-adapter.ts");
  assert.match(storyAdapter, /from "\.\.\/story\/story\.config\.json"/);
  for (const contract of ["layout", "navigation", "spawns"]) {
    assert.match(worldAdapter, new RegExp(`world\\/${contract}\\.json`));
  }
  assert.doesNotMatch(storyAdapter, /position:\s*\{\s*x:\s*\d/);
  assert.doesNotMatch(worldAdapter, /position:\s*\{\s*x:\s*\d/);

  const storyFiles = (await readdir("src/story"))
    .filter((file) => file.endsWith(".ts"))
    .map((file) => `src/story/${file}`);
  for (const file of storyFiles) {
    const source = await readText(file);
    assert.doesNotMatch(source, /from ["'](?:phaser|@sonic74129\/)/, file);
  }
});

test("shell exposes responsive canvas and accessible control structure", async () => {
  const shell = await readText("src/platform/app-shell.ts");
  const styles = await readText("src/platform/styles.css");
  for (const marker of [
    "data-platform-shell",
    "data-game-container",
    "data-game-controls",
    "data-start-screen",
    "data-subtitle",
  ]) {
    assert.match(shell, new RegExp(marker));
  }
  assert.match(shell, /aria-pressed="false"/);
  assert.match(shell, /aria-pressed="true"/);
  assert.match(styles, /aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(styles, /@media\s*\(max-width:\s*640px\)/);
  assert.match(styles, /\.game-container canvas/);
  assert.match(styles, /touch-action:\s*none/);
});
