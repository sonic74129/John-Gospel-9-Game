import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const structuralValidator = path.join(
  root,
  ".github",
  "scripts",
  "validate-story-structure.mjs",
);

test("PR validation executes the trusted base checker against PR data", async () => {
  const workflow = await readFile(
    path.join(root, ".github", "workflows", "validate.yml"),
    "utf8",
  );
  assert.match(workflow, /^\s{2}pull_request_target:/mu);
  assert.match(workflow, /^permissions: \{\}$/mu);
  assert.match(
    workflow,
    /node trusted-base\/\.github\/scripts\/validate-story-structure\.mjs \\\n\s+--story-root story-data/u,
  );
  assert.doesNotMatch(workflow, /\bnpm\b[\s\S]*story-data/u);
  for (const match of workflow.matchAll(/^\s+uses:\s+([^\s]+)$/gmu)) {
    assert.match(match[1], /^[^@\s]+@[0-9a-f]{40}$/u);
  }
});

test("trusted base rejects a PR that changes both policy copies", async (t) => {
  const storyRoot = await mkdtemp(path.join(tmpdir(), "john9-policy-"));
  t.after(() => rm(storyRoot, { recursive: true, force: true }));
  await Promise.all([
    cp(
      path.join(root, ".foundation"),
      path.join(storyRoot, ".foundation"),
      { recursive: true },
    ),
    cp(
      path.join(root, ".github", "copilot-instructions.md"),
      path.join(storyRoot, ".github", "copilot-instructions.md"),
      { recursive: true },
    ),
    cp(
      path.join(root, "foundation.lock.json"),
      path.join(storyRoot, "foundation.lock.json"),
    ),
  ]);
  const valid = spawnSync(
    process.execPath,
    [structuralValidator, "--story-root", storyRoot],
    { encoding: "utf8" },
  );
  assert.equal(valid.status, 0, valid.stderr);

  for (const relativePath of [
    ".foundation/skills/bible-story-game-builder/SKILL.md",
    ".github/copilot-instructions.md",
  ]) {
    const target = path.join(storyRoot, relativePath);
    const content = await readFile(target, "utf8");
    await writeFile(target, content.replace("Policy version: 1.", "Policy version: 2."));
  }
  const changed = spawnSync(
    process.execPath,
    [structuralValidator, "--story-root", storyRoot],
    { encoding: "utf8" },
  );
  assert.notEqual(changed.status, 0);
});
