import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const readText = (path) => readFile(path, "utf8");

const packageJson = await readJson("package.json");
const appConfig = await readJson("app.config.json");

const runtimePackages = [
  "@sonic74129/audio-runtime",
  "@sonic74129/content-schema",
  "@sonic74129/engine",
  "@sonic74129/map-runtime",
  "@sonic74129/sequence-runtime",
  "@sonic74129/story-runtime",
  "@sonic74129/ui",
];

test("platform dependencies are immutable hashed SDK 0.3.0 packages", async () => {
  const sdkManifest = await readJson("packages/sdk/manifest.json");
  const sdkPackages = new Map(
    sdkManifest.packages.map((entry) => [entry.name, entry]),
  );
  for (const packageName of runtimePackages) {
    const entry = sdkPackages.get(packageName);
    assert.equal(entry.version, "0.3.0", packageName);
    assert.equal(
      packageJson.dependencies[packageName],
      `file:packages/sdk/${entry.file}`,
      packageName,
    );
    assert.equal(
      createHash("sha256")
        .update(await readFile(`packages/sdk/${entry.file}`))
        .digest("hex"),
      entry.sha256,
      packageName,
    );
  }
  const testKit = sdkPackages.get("@sonic74129/test-kit");
  assert.equal(testKit.version, "0.3.0");
  assert.equal(
    packageJson.devDependencies["@sonic74129/test-kit"],
    `file:packages/sdk/${testKit.file}`,
  );
  assert.equal(
    createHash("sha256")
      .update(await readFile(`packages/sdk/${testKit.file}`))
      .digest("hex"),
    testKit.sha256,
  );
  assert.equal(packageJson.dependencies.phaser, "3.90.0");
  assert.equal(packageJson.devDependencies.typescript, "6.0.3");
  assert.equal(packageJson.devDependencies.vite, "7.2.4");
  assert.equal(packageJson.dependencies["@sonic74129/test-kit"], undefined);

  for (const source of [
    packageJson.dependencies.phaser,
    packageJson.devDependencies.typescript,
    packageJson.devDependencies.vite,
  ]) {
    assert.match(source, /^\d+\.\d+\.\d+$/);
  }
});

test("npm authentication is scoped and token-free", async () => {
  assert.equal(
    await readText(".npmrc"),
    "@sonic74129:registry=https://npm.pkg.github.com\n" +
      "//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}\n",
  );
});

test("story-local app config and Vite retain the stable story route", async () => {
  assert.equal(appConfig.authority, "story-local-playable-candidate");
  assert.equal(appConfig.promotionStatus, "not-promoted");
  assert.equal(appConfig.productionStage, "release-blocked");
  assert.equal(appConfig.deliveryPolicy.graybox, "development-only");
  assert.equal(appConfig.deliveryPolicy.allowPlaceholderFinal, false);
  assert.equal(appConfig.entry, "/games/john-9-man-born-blind/");
  const viteConfig = await readText("vite.config.ts");
  assert.match(viteConfig, /base:\s*appConfig\.entry/);
  const html = await readText("index.html");
  assert.match(html, /<main id="app"><\/main>/);
  assert.match(html, /src="\/src\/main\.ts"/);
});

test("story and world data enter the platform only through adapters", async () => {
  const storyAdapter = await readText("src/adapters/story-adapter.ts");
  const storyContracts = await readText("src/adapters/story-contracts.ts");
  const sequenceAdapter = await readText("src/adapters/sequence-adapter.ts");
  const sdkPlatform = await readText("src/adapters/sdk-platform.ts");
  const worldAdapter = await readText("src/adapters/world-adapter.ts");
  assert.match(storyAdapter, /from "\.\.\/story\/story\.config\.json"/);
  for (const contract of ["collisions", "layout", "navigation", "spawns"]) {
    assert.match(worldAdapter, new RegExp(`world\\/${contract}\\.json`));
  }
  assert.match(worldAdapter, /blocked:\s*blockedCells/);
  assert.match(storyContracts, /import\(`\.\.\/story\/\$\{name\}\.ts`\)/);
  assert.match(storyAdapter, /new StoryEngine/);
  assert.match(storyAdapter, /STORY_BEAT_OUTSIDE_CANONICAL_CONTRACT/);
  assert.match(sequenceAdapter, /applyFinalState:\s*async/);
  assert.doesNotMatch(
    storyAdapter,
    /failUnsupportedOperation\("story\.advance"\)/,
  );
  assert.doesNotMatch(sequenceAdapter, /sequence\.final-state/);
  assert.doesNotMatch(sdkPlatform, /executeCommand:\s*async\s*\(\)\s*=>\s*\{\}/);
  assert.doesNotMatch(sdkPlatform, /applyFinalState:\s*\(\)\s*=>\s*\{\}/);
  assert.doesNotMatch(storyAdapter, /position:\s*\{\s*x:\s*\d/);
  assert.doesNotMatch(worldAdapter, /position:\s*\{\s*x:\s*\d/);
  assert.doesNotMatch(sequenceAdapter, /position:\s*\{\s*x:\s*\d/);

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
  const scene = await readText("src/adapters/story-scene.ts");
  const sdkPlatform = await readText("src/adapters/sdk-platform.ts");
  const main = await readText("src/main.ts");
  for (const marker of [
    "data-platform-shell",
    "data-game-container",
    "data-game-controls",
    "data-start-screen",
    "data-restart",
    "data-ending",
    "data-dialogue-reference",
    "data-dialogue-portrait",
  ]) {
    assert.match(shell, new RegExp(marker));
  }
  assert.match(shell, /window\.addEventListener\("keydown", onKeydown\)/);
  assert.match(shell, /event\.key !== " " && event\.key !== "Spacebar" && event\.key !== "Enter"/);
  assert.match(shell, /dialoguePortraitFor\(line\)/);
  assert.match(shell, /dialogue\.dataset\.portraitless = String\(portrait === null\)/);
  assert.doesNotMatch(
    shell,
    /characters-core\/character\.man-born-blind[\s\S]*man-blind\.png/,
  );
  assert.match(styles, /\.dialogue-panel\s*\{[^}]*max-height:\s*30%/s);
  assert.match(styles, /max-height:\s*48%/);
  assert.match(styles, /\.dialogue-panel\[data-portraitless="true"\]/);
  assert.match(shell, /aria-pressed="false"/);
  assert.match(styles, /aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(styles, /@media\s*\(max-width:\s*640px\)/);
  assert.match(styles, /height:\s*100dvh/);
  assert.match(styles, /\.game-controls\s*\{[^}]*position:\s*fixed/s);
  assert.match(styles, /\.game-container canvas/);
  assert.match(styles, /\.game-container\s*\{[^}]*align-items:\s*center/s);
  assert.match(styles, /\.game-container\s*\{[^}]*justify-content:\s*center/s);
  assert.match(styles, /touch-action:\s*none/);
  assert.doesNotMatch(styles, /!important/);
  assert.doesNotMatch(
    styles,
    /\.game-container canvas\s*\{[^}]*\b(?:width|height):\s*100%/s,
  );
  assert.match(scene, /this\.#world\.findPath/);
  assert.doesNotMatch(scene, /\.findPath\([\s\S]{0,180}\)\s*\.slice\(1\)/);
  assert.match(main, /handlePageHide\(event\.persisted\)/);
  assert.match(main, /handlePageShow\(event\.persisted\)/);
  assert.match(main, /createResponsiveGameSizeController/);
  assert.match(main, /mode:\s*Phaser\.Scale\.NONE/);
  assert.doesNotMatch(main, /Phaser\.Scale\.FIT/);
  assert.match(main, /scene\.resizeViewport\(width,\s*height\)/);
  assert.match(
    main,
    /await runtime\.resume\(UI_PAUSE_REASON\);\s*gameScene\?\.flushPendingViewportResize\(\)/,
  );
  assert.match(
    main,
    /await runtime\?\.resume\("bfcache"\);\s*gameSizeController\?\.resume\(\);\s*gameScene\?\.flushPendingViewportResize\(\)/,
  );
  assert.match(scene, /Math\.min\(camera\.width,\s*camera\.height\)\s*<=\s*640/);
  assert.match(scene, /if \(visual\.storyActorId === "observer"\) \{\s*continue;\s*\}/);
  assert.match(scene, /#playerMovedSinceLastFinalState = false/);
  assert.match(scene, /preservePlayerPosition[\s\S]*this\.#playerMovedSinceLastFinalState/);
  assert.match(scene, /onWorldUpdate\("viewport"\)/);
  assert.match(
    scene,
    /#applyViewportResize\(width: number, height: number\)[\s\S]*#applyTransientCameraFocus\(this\.#transientCameraFocus\)[\s\S]*else \{\s*this\.#applyInitialCourtyardCamera\(\)/,
  );
  assert.match(
    scene,
    /const viewportChanged =\s*this\.cameras\.main\.width !== snapshot\.camera\.width[\s\S]*#applyTransientCameraFocus\(this\.#transientCameraFocus\)[\s\S]*this\.#applyInitialCourtyardCamera\(\)/,
  );
  assert.match(scene, /this\.#transientCameraFocus = \{\s*position:/);
  assert.match(scene, /#regionIdForPoint\(point: Point\)/);
  assert.match(
    sdkPlatform,
    /onWorldUpdate:\s*\(reason,\s*traversal\)\s*=>\s*\{\s*if\s*\(reason\s*===\s*"gameplay"\)\s*\{\s*evaluateWorldTrigger\(traversal\)/,
  );
  assert.match(main, /readyRuntime\.restore\(loadedSave\.completedBeatIds\)/);
  assert.match(main, /persistence\.reset\(\)/);
});

test("persistence and ending expose only stable progress and a concise opening summary", async () => {
  const [persistence, shell, styles, main, platform] = await Promise.all([
    readText("src/platform/story-persistence.ts"),
    readText("src/platform/app-shell.ts"),
    readText("src/platform/styles.css"),
    readText("src/main.ts"),
    readText("src/adapters/sdk-platform.ts"),
  ]);
  assert.match(
    persistence,
    /bible-games:save:john-9-man-born-blind:v1/,
  );
  assert.match(
    persistence,
    /bible-games:progress:john-9-man-born-blind:v1/,
  );
  assert.match(persistence, /"not-started" \| "in-progress" \| "completed"/);
  assert.doesNotMatch(persistence, /Phaser|setTimeout|Timer/);
  assert.match(shell, /約翰福音 9:1–41/);
  assert.match(shell, /再次遇見耶穌/);
  assert.match(shell, /移動、靠近人物、留心聆聽/);
  for (const removedUi of [
    "見證紀錄",
    "data-testimony",
    "data-recall",
    "data-study-questions",
    "review-warning",
    "runtime-badge",
    "sourceLevel",
    "speakerId",
    "segmentId",
  ]) {
    assert.doesNotMatch(shell, new RegExp(removedUi));
  }
  assert.doesNotMatch(styles, /url\(|testimony|recall|review-warning|runtime-badge/);
  assert.match(main, /createCommittedProgressTracker/);
  assert.match(main, /committedProgress\.settle\(completedBeatIds\)/);
  assert.match(main, /committedProgress\.snapshot\(\)/);
  assert.doesNotMatch(
    main,
    /runtime\.story\.snapshot\(\)\.state\.completedBeatIds/,
  );
  assert.match(
    persistence,
    /writeProgress\(progressFor\(status, parsed\.save\.lastPlayedAt\)\)/,
  );
  assert.match(persistence, /status: "progress-error"/);
  assert.match(shell, /region\.inert = blocking/);
  assert.match(shell, /handlers\.onPauseChange\(true\)/);
  assert.match(shell, /handlers\.onPauseChange\(false\)/);
  assert.match(main, /await runtime\.suspend\(UI_PAUSE_REASON\)/);
  assert.match(main, /await runtime\.resume\(UI_PAUSE_REASON\)/);
  assert.match(main, /await runtime\?\.cancelAndSettleCurrent\(\)/);
  assert.match(platform, /await story\.waitForIdle\(\)/);
  assert.doesNotMatch(shell, /公開進度已標記完成/);
  assert.match(shell, /data-persistence-warning role="alert" hidden/);
  assert.match(shell, /setPersistenceWarning: \(message\)/);
  assert.match(shell, /無法儲存進度：\$\{message\}/);
  assert.match(
    main,
    /error instanceof StoryPersistenceError[\s\S]*shell\.setPersistenceWarning\(message\)/,
  );
  assert.match(
    main,
    /persistence\.save\(completedBeatIds, preferences\);\s*shell\.setPersistenceWarning\(null\)/,
  );
  const completionBlock = shell.match(
    /setCompleted: \(\) => \{[\s\S]*?\n    \},\n    setStatus:/,
  );
  assert.notEqual(completionBlock, null);
  assert.doesNotMatch(completionBlock[0], /setPersistenceWarning/);
});
