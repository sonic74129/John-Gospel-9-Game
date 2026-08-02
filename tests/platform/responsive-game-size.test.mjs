import assert from "node:assert/strict";
import test from "node:test";

import { createPageLifecycleController } from "../../src/platform/page-lifecycle.js";
import {
  createResponsiveGameSizeController,
  measureGameViewport,
  requireGameViewport,
} from "../../src/platform/responsive-game-size.ts";

test("production viewport measurement preserves desktop and portrait dimensions", () => {
  const desktop = createContainer(1280, 720);
  const mobile = createContainer(390, 844);
  assert.deepEqual(requireGameViewport(desktop), { width: 1280, height: 720 });
  assert.deepEqual(requireGameViewport(mobile), { width: 390, height: 844 });

  mobile.setSize(0, 0);
  assert.equal(measureGameViewport(mobile), null);
  assert.throws(
    () => requireGameViewport(mobile),
    /no measurable viewport/,
  );
});

test("resize observation coalesces orientation changes without feedback loops", () => {
  const harness = createResizeHarness({ width: 1280, height: 720 });
  harness.controller.start();
  assert.deepEqual(harness.resizeCalls, []);

  harness.resizeTo(390, 844);
  harness.notifyResize();
  harness.notifyResize();
  assert.equal(harness.pendingFrames(), 1);
  harness.flushFrames();
  assert.deepEqual(harness.resizeCalls, [{ width: 390, height: 844 }]);

  harness.notifyResize();
  harness.flushFrames();
  assert.equal(harness.resizeCalls.length, 1, "same-size feedback is ignored");

  harness.resizeTo(844, 390);
  harness.notifyViewportResize("orientationchange");
  harness.flushFrames();
  assert.deepEqual(harness.resizeCalls.at(-1), { width: 844, height: 390 });
});

test("intrinsic resize keeps pointer coordinates aligned with the game viewport", () => {
  const canvas = {
    width: 1280,
    height: 720,
    style: { width: "1280px", height: "720px" },
  };
  const harness = createResizeHarness(
    { width: 1280, height: 720 },
    ({ width, height }) => {
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    },
  );
  harness.controller.start();
  harness.resizeTo(390, 844);
  harness.notifyResize();
  harness.flushFrames();

  const canvasBounds = { left: 0, top: 0, width: 390, height: 844 };
  const pointer = { x: 273, y: 611 };
  const gamePoint = {
    x:
      (pointer.x - canvasBounds.left) *
      (canvas.width / canvasBounds.width),
    y:
      (pointer.y - canvasBounds.top) *
      (canvas.height / canvasBounds.height),
  };
  assert.deepEqual(gamePoint, pointer);
  assert.deepEqual(canvas.style, { width: "390px", height: "844px" });
});

test("bfcache suspension catches up once and teardown disconnects permanently", async () => {
  const harness = createResizeHarness({ width: 390, height: 844 });
  harness.controller.start();
  const lifecycle = createPageLifecycleController({
    suspend: () => harness.controller.suspend(),
    resume: () => harness.controller.resume(),
    dispose: () => harness.controller.dispose(),
  });

  await lifecycle.handlePageHide(true);
  harness.resizeTo(844, 390);
  harness.notifyResize();
  harness.flushFrames();
  assert.deepEqual(harness.resizeCalls, []);

  await lifecycle.handlePageShow(true);
  assert.deepEqual(harness.resizeCalls, [{ width: 844, height: 390 }]);

  harness.resizeTo(390, 844);
  harness.notifyResize();
  harness.flushFrames();
  assert.equal(harness.resizeCalls.length, 2, "UI pause does not disable resize");

  await lifecycle.handlePageHide(false);
  assert.equal(harness.disconnected(), true);
  harness.resizeTo(844, 390);
  harness.notifyResize();
  harness.flushFrames();
  assert.equal(harness.resizeCalls.length, 2);
});

function createContainer(width, height) {
  let size = { width, height };
  return {
    getBoundingClientRect: () => ({ ...size }),
    setSize: (nextWidth, nextHeight) => {
      size = { width: nextWidth, height: nextHeight };
    },
  };
}

function createResizeHarness(initialSize, onResize = () => {}) {
  const container = createContainer(initialSize.width, initialSize.height);
  const resizeCalls = [];
  const frames = new Map();
  let frameId = 0;
  let resizeListener = () => {};
  const viewportListeners = new Map();
  let observerDisconnected = false;
  const controller = createResponsiveGameSizeController({
    container,
    initialSize,
    resize: (size) => {
      resizeCalls.push({ ...size });
      onResize(size);
    },
    createObserver: (listener) => {
      resizeListener = listener;
      return {
        observe: () => {},
        disconnect: () => {
          observerDisconnected = true;
        },
      };
    },
    eventTarget: {
      addEventListener: (type, listener) => {
        viewportListeners.set(type, listener);
      },
      removeEventListener: (type) => {
        viewportListeners.delete(type);
      },
    },
    scheduleTask: (callback) => {
      frameId += 1;
      frames.set(frameId, callback);
      return frameId;
    },
    cancelTask: (handle) => {
      frames.delete(handle);
    },
  });
  return {
    controller,
    resizeCalls,
    resizeTo: (width, height) => container.setSize(width, height),
    notifyResize: () => resizeListener(),
    notifyViewportResize: (type = "resize") => viewportListeners.get(type)?.(),
    pendingFrames: () => frames.size,
    flushFrames: () => {
      const queued = [...frames.values()];
      frames.clear();
      for (const callback of queued) {
        callback();
      }
    },
    disconnected: () => observerDisconnected,
  };
}
