import assert from "node:assert/strict";
import test from "node:test";

import { createPageLifecycleController } from "../../src/platform/page-lifecycle.js";

test("persisted pagehide suspends and pageshow restores without disposal", async () => {
  const calls = [];
  const lifecycle = createPageLifecycleController({
    suspend: () => calls.push("suspend"),
    resume: () => calls.push("resume"),
    dispose: () => calls.push("dispose"),
  });

  await lifecycle.handlePageHide(true);
  assert.equal(lifecycle.cacheSuspended, true);
  assert.equal(lifecycle.disposed, false);
  assert.deepEqual(calls, ["suspend"]);

  await lifecycle.handlePageShow(true);
  assert.equal(lifecycle.cacheSuspended, false);
  assert.equal(lifecycle.disposed, false);
  assert.deepEqual(calls, ["suspend", "resume"]);
});

test("normal pagehide disposes permanently and cannot restore", async () => {
  const calls = [];
  const lifecycle = createPageLifecycleController({
    suspend: () => calls.push("suspend"),
    resume: () => calls.push("resume"),
    dispose: () => calls.push("dispose"),
  });

  await lifecycle.handlePageHide(false);
  await lifecycle.handlePageShow(true);
  await lifecycle.handlePageHide(false);
  assert.equal(lifecycle.disposed, true);
  assert.deepEqual(calls, ["dispose"]);
});

test("repeated bfcache events are idempotent before normal unload", async () => {
  const calls = [];
  const lifecycle = createPageLifecycleController({
    suspend: () => calls.push("suspend"),
    resume: () => calls.push("resume"),
    dispose: () => calls.push("dispose"),
  });

  await lifecycle.handlePageHide(true);
  await lifecycle.handlePageHide(true);
  await lifecycle.handlePageShow(true);
  await lifecycle.handlePageShow(true);
  await lifecycle.handlePageHide(false);
  assert.deepEqual(calls, ["suspend", "resume", "dispose"]);
});
