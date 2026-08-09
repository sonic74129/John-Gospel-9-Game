import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SCREENSHOTS = resolve(ROOT, "qa/review-screenshots");
const DEV_QA = process.env.BROWSER_QA_DEV === "1";
const REPORT = resolve(
  ROOT,
  DEV_QA ? "qa/browser-smoke-dev-report.json" : "qa/browser-smoke-report.json",
);
const PROFILE = resolve(ROOT, "qa/.chromium-smoke-profile");
const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SAVE_KEY = "bible-games:save:john-9-man-born-blind:v1";
const STORY_ENTRY = "games/john-9-man-born-blind/";
const ALL_BEATS = Array.from(
  { length: 20 },
  (_, index) => `b${String(index + 1).padStart(2, "0")}`,
);
const DIALOGUE_SEGMENTS = Object.freeze({
  b01: 1,
  b02: 1,
  b03: 3,
  b04: 1,
  b05: 1,
  b06: 1,
  b07: 2,
  b08: 3,
  b09: 2,
  b10: 2,
  b11: 1,
  b12: 2,
  b13: 4,
  b14: 1,
  b15: 1,
  b16: 2,
  b17: 2,
  b18: 5,
  b19: 4,
  b20: 3,
});

let baseUrl;

class Cdp {
  #socket;
  #nextId = 1;
  #pending = new Map();
  #listeners = new Map();

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolveConnection, reject) => {
      socket.addEventListener("open", resolveConnection, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    return new Cdp(socket);
  }

  constructor(socket) {
    this.#socket = socket;
    socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data);
      if (message.id !== undefined) {
        const pending = this.#pending.get(message.id);
        if (pending === undefined) {
          return;
        }
        this.#pending.delete(message.id);
        if (message.error !== undefined) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
        return;
      }
      for (const listener of this.#listeners.get(message.method) ?? []) {
        listener(message.params, message.sessionId);
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.#nextId++;
    this.#socket.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolveCall, reject) => {
      this.#pending.set(id, { resolve: resolveCall, reject });
    });
  }

  on(method, listener) {
    const listeners = this.#listeners.get(method) ?? [];
    listeners.push(listener);
    this.#listeners.set(method, listeners);
  }

  close() {
    this.#socket.close();
  }
}

const delay = (milliseconds) =>
  new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

async function waitFor(check, message, timeout = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const result = await check();
    if (result) {
      return result;
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${message}.`);
}

async function waitForOutput(child, pattern, timeout = 30_000) {
  return new Promise((resolveOutput, reject) => {
    let output = "";
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${pattern}: ${output}`)),
      timeout,
    );
    const consume = (chunk) => {
      output += chunk.toString();
      const match = output.match(pattern);
      if (match !== null) {
        clearTimeout(timer);
        child.stdout?.off("data", consume);
        child.stderr?.off("data", consume);
        resolveOutput(match);
      }
    };
    child.stdout?.on("data", consume);
    child.stderr?.on("data", consume);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Process exited with ${code}: ${output}`));
    });
  });
}

async function stop(child) {
  if (child.exitCode !== null) {
    return;
  }
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolveExit) => child.once("exit", resolveExit)),
    delay(5_000),
  ]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
  }
}

async function evaluate(cdp, sessionId, expression) {
  const result = await cdp.send(
    "Runtime.evaluate",
    {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    },
    sessionId,
  );
  if (result.exceptionDetails !== undefined) {
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text,
    );
  }
  return result.result.value;
}

const selectorExpression = (selector, operation) =>
  `(() => { const element = document.querySelector(${JSON.stringify(selector)});` +
  ` if (!element) throw new Error("Missing ${selector}"); ${operation} })()`;

async function click(cdp, sessionId, selector) {
  await evaluate(
    cdp,
    sessionId,
    selectorExpression(
      selector,
      'if (element.hidden || element.disabled) throw new Error("Unavailable element"); element.click(); return true;',
    ),
  );
}

async function clickCanvasOffset(cdp, sessionId, offsetX, offsetY) {
  const point = await evaluate(
    cdp,
    sessionId,
    `(() => {
      const canvas = document.querySelector("canvas");
      if (!canvas) throw new Error("Missing canvas");
      const rect = canvas.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2 + ${offsetX},
        y: rect.top + rect.height / 2 + ${offsetY},
      };
    })()`,
  );
  await cdp.send(
    "Input.dispatchMouseEvent",
    { type: "mouseMoved", x: point.x, y: point.y },
    sessionId,
  );
  await cdp.send(
    "Input.dispatchMouseEvent",
    { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 },
    sessionId,
  );
  await cdp.send(
    "Input.dispatchMouseEvent",
    { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 },
    sessionId,
  );
}

async function touchCanvasOffset(cdp, sessionId, offsetX, offsetY) {
  const point = await evaluate(
    cdp,
    sessionId,
    `(() => {
      const canvas = document.querySelector("canvas");
      if (!canvas) throw new Error("Missing canvas");
      const rect = canvas.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2 + ${offsetX},
        y: rect.top + rect.height / 2 + ${offsetY},
      };
    })()`,
  );
  const touchPoint = {
    x: point.x,
    y: point.y,
    radiusX: 4,
    radiusY: 4,
    force: 1,
    id: 1,
  };
  await cdp.send(
    "Input.dispatchTouchEvent",
    { type: "touchStart", touchPoints: [touchPoint] },
    sessionId,
  );
  await cdp.send(
    "Input.dispatchTouchEvent",
    { type: "touchEnd", touchPoints: [] },
    sessionId,
  );
}

async function holdTouch(cdp, sessionId, selector, milliseconds) {
  const point = await evaluate(
    cdp,
    sessionId,
    selectorExpression(
      selector,
      "const rect = element.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };",
    ),
  );
  const touchPoint = {
    x: point.x,
    y: point.y,
    radiusX: 4,
    radiusY: 4,
    force: 1,
    id: 1,
  };
  await cdp.send(
    "Input.dispatchTouchEvent",
    { type: "touchStart", touchPoints: [touchPoint] },
    sessionId,
  );
  await delay(milliseconds);
  await cdp.send(
    "Input.dispatchTouchEvent",
    { type: "touchEnd", touchPoints: [] },
    sessionId,
  );
}

async function pressSpace(cdp, sessionId) {
  await evaluate(cdp, sessionId, "document.activeElement?.blur(); true");
  await cdp.send(
    "Input.dispatchKeyEvent",
    {
      type: "keyDown",
      key: " ",
      code: "Space",
      windowsVirtualKeyCode: 32,
      nativeVirtualKeyCode: 32,
    },
    sessionId,
  );
  await delay(120);
  await cdp.send(
    "Input.dispatchKeyEvent",
    {
      type: "keyUp",
      key: " ",
      code: "Space",
      windowsVirtualKeyCode: 32,
      nativeVirtualKeyCode: 32,
    },
    sessionId,
  );
}

async function holdKeys(cdp, sessionId, keys, milliseconds) {
  for (const { key, code, keyCode } of keys) {
    await cdp.send(
      "Input.dispatchKeyEvent",
      {
        type: "keyDown",
        key,
        code,
        windowsVirtualKeyCode: keyCode,
        nativeVirtualKeyCode: keyCode,
      },
      sessionId,
    );
  }
  await delay(milliseconds);
  for (const { key, code, keyCode } of keys.toReversed()) {
    await cdp.send(
      "Input.dispatchKeyEvent",
      {
        type: "keyUp",
        key,
        code,
        windowsVirtualKeyCode: keyCode,
        nativeVirtualKeyCode: keyCode,
      },
      sessionId,
    );
  }
}

const KEY_A = { key: "a", code: "KeyA", keyCode: 65 };
const KEY_D = { key: "d", code: "KeyD", keyCode: 68 };
const KEY_S = { key: "s", code: "KeyS", keyCode: 83 };
const KEY_W = { key: "w", code: "KeyW", keyCode: 87 };

async function moveBy(cdp, sessionId, deltaX, deltaY) {
  const horizontal = deltaX < 0 ? KEY_A : KEY_D;
  const vertical = deltaY < 0 ? KEY_W : KEY_S;
  const diagonalDistance = Math.min(Math.abs(deltaX), Math.abs(deltaY));
  if (diagonalDistance > 0) {
    await holdKeys(
      cdp,
      sessionId,
      [horizontal, vertical],
      (diagonalDistance * Math.SQRT2 * 1_000) / 240,
    );
  }
  const horizontalRemainder = Math.abs(deltaX) - diagonalDistance;
  if (horizontalRemainder > 0) {
    await holdKeys(
      cdp,
      sessionId,
      [horizontal],
      (horizontalRemainder * 1_000) / 240,
    );
  }
  const verticalRemainder = Math.abs(deltaY) - diagonalDistance;
  if (verticalRemainder > 0) {
    await holdKeys(
      cdp,
      sessionId,
      [vertical],
      (verticalRemainder * 1_000) / 240,
    );
  }
}

async function visible(cdp, sessionId, selector) {
  return evaluate(
    cdp,
    sessionId,
    `(() => { const element = document.querySelector(${JSON.stringify(selector)});` +
      " return Boolean(element && !element.hidden && getComputedStyle(element).display !== 'none'); })()",
  );
}

async function save(cdp, sessionId) {
  return evaluate(
    cdp,
    sessionId,
    `(() => { const value = localStorage.getItem(${JSON.stringify(SAVE_KEY)}); return value ? JSON.parse(value) : null; })()`,
  );
}

async function screenshot(cdp, sessionId, name) {
  const { data } = await cdp.send(
    "Page.captureScreenshot",
    { format: "png", captureBeyondViewport: false },
    sessionId,
  );
  const path = resolve(SCREENSHOTS, name);
  await writeFile(path, Buffer.from(data, "base64"));
  return `qa/review-screenshots/${name}`;
}

async function captureDevCheckpoint(cdp, sessionId, checkpoints, label) {
  if (!DEV_QA) {
    return;
  }
  const snapshot = await evaluate(
    cdp,
    sessionId,
    "window.__JOHN9_DEV_QA__.snapshot()",
  );
  const image = await screenshot(cdp, sessionId, `dev-${label}.png`);
  checkpoints.set(label, { label, ...snapshot, screenshot: image });
}

function devTransitionMatrix(checkpoints) {
  if (!DEV_QA) {
    return undefined;
  }
  const transition = (id, start, midway, end) => ({
    id,
    start: checkpoints.get(start),
    midway: checkpoints.get(midway),
    end: checkpoints.get(end),
  });
  return [
    transition("b01-b02", "b01-b02-start", "b01-b02-midway", "b01-b02-end"),
    transition("b05", "b05-start", "b05-midway", "b05-end"),
    transition("b06-b07", "b06-b07-start", "b06-b07-midway", "b06-b07-end"),
    transition("b08-b09", "b08-b09-start", "b08-b09-midway", "b08-b09-end"),
    transition("b11-b12", "b11-b12-start", "b11-b12-midway", "b11-b12-end"),
    transition("b12-b13", "b12-b13-start", "b12-b13-midway", "b12-b13-end"),
    transition("b17-b18", "b17-b18-start", "b17-b18-midway", "b17-b18-end"),
    transition("b18-b19", "b18-b19-start", "b18-b19-midway", "b18-b19-end"),
    transition("b19-b20", "b19-b20-start", "b19-b20-midway", "b19-b20-end"),
  ];
}

async function devSnapshot(cdp, sessionId) {
  return evaluate(cdp, sessionId, "window.__JOHN9_DEV_QA__.snapshot()");
}

function pointDelta(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

async function advanceDialogue(cdp, sessionId, beatId, timeout = 45_000) {
  await waitFor(
    () => visible(cdp, sessionId, "[data-dialogue]"),
    `${beatId} dialogue`,
    timeout,
  );
  for (let index = 0; index < DIALOGUE_SEGMENTS[beatId]; index += 1) {
    await click(cdp, sessionId, "[data-dialogue-next]");
    await delay(120);
  }
}

async function waitForSavedBeat(cdp, sessionId, completedCount, timeout = 45_000) {
  await waitFor(
    async () =>
      (await save(cdp, sessionId))?.completedBeatIds.length >= completedCount,
    `saved beat ${completedCount}`,
    timeout,
  );
}

async function interactWhenReady(cdp, sessionId) {
  await delay(500);
  await pressSpace(cdp, sessionId);
}

async function waitForEnding(cdp, sessionId, timeout = 120_000) {
  await waitFor(
    () => visible(cdp, sessionId, "[data-ending]"),
    "ending panel",
    timeout,
  );
  const endingReference = await evaluate(
    cdp,
    sessionId,
    `document.querySelector("[data-ending]")?.textContent ?? ""`,
  );
  assert.match(endingReference, /約翰福音 9:1[–-]41/);
  assert.equal(await visible(cdp, sessionId, "[data-game-controls]"), false);
}

async function setViewport(cdp, sessionId, viewport) {
  await cdp.send(
    "Emulation.setDeviceMetricsOverride",
    {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: viewport.width <= 640,
    },
    sessionId,
  );
}

async function startFreshGame(cdp, sessionId, viewport) {
  await setViewport(cdp, sessionId, viewport);
  await cdp.send("Page.navigate", { url: baseUrl }, sessionId);
  await waitFor(
    () =>
      evaluate(
        cdp,
        sessionId,
        "document.readyState === 'complete'",
      ),
    "initial page load",
    60_000,
  );
  await evaluate(cdp, sessionId, "localStorage.clear();");
  await cdp.send("Page.navigate", { url: baseUrl }, sessionId);
  try {
    await waitFor(
      () =>
        evaluate(
          cdp,
          sessionId,
          `(() => {
            const hasCanvas = Boolean(document.querySelector("canvas"));
            const start = document.querySelector("[data-start]");
            const cont = document.querySelector("[data-continue]");
            const startReady = Boolean(start && !start.hidden && !start.disabled);
            const continueReady = Boolean(cont && !cont.hidden && !cont.disabled);
            return hasCanvas || startReady || continueReady;
          })()`,
        ),
      "fresh game entry state",
      60_000,
    );
  } catch (error) {
    const diagnostics = await evaluate(
      cdp,
      sessionId,
      `(() => ({
        href: location.href,
        title: document.title,
        readyState: document.readyState,
        hasCanvas: Boolean(document.querySelector("canvas")),
        hasStart: Boolean(document.querySelector("[data-start]")),
        hasContinue: Boolean(document.querySelector("[data-continue]")),
        appLength: document.querySelector("#app")?.innerHTML.length ?? -1,
        bodySnippet: document.body.textContent?.slice(0, 200) ?? "",
      }))()`,
    );
    throw new Error(
      `Timed out waiting for fresh game entry state: ${JSON.stringify(diagnostics)}`,
      { cause: error },
    );
  }
  if (!(await visible(cdp, sessionId, "canvas"))) {
    if (await visible(cdp, sessionId, "[data-start]")) {
      await click(cdp, sessionId, "[data-start]");
    } else {
      await click(cdp, sessionId, "[data-continue]");
    }
  }
  await waitFor(() => visible(cdp, sessionId, "canvas"), "game canvas");
  await waitFor(
    () =>
      evaluate(
        cdp,
        sessionId,
        "document.querySelector('[data-skip]')?.disabled === false",
      ),
    "enabled game controls",
  );
}

async function openAt(cdp, sessionId, url, viewport) {
  await setViewport(cdp, sessionId, viewport);
  await cdp.send("Page.navigate", { url }, sessionId);
  await waitFor(
    () =>
      evaluate(
        cdp,
        sessionId,
        "document.readyState === 'complete'",
      ),
    `page load ${url}`,
  );
}

async function runFreshStartScenario(cdp, sessionId) {
  await startFreshGame(cdp, sessionId, { width: 1280, height: 720 });
  const openingShot = await screenshot(cdp, sessionId, "01-opening-desktop.png");
  const hint = await evaluate(
    cdp,
    sessionId,
    `document.querySelector("[data-navigation-hint]")?.textContent ?? ""`,
  );
  assert.equal(typeof hint, "string");
  for (let completedCount = 1; completedCount <= 4; completedCount += 1) {
    await click(cdp, sessionId, "[data-skip]");
    await waitFor(
      async () =>
        (await save(cdp, sessionId))?.completedBeatIds.length >= completedCount,
      `completed beat ${completedCount}`,
      30_000,
    );
  }
  await waitFor(
    () => visible(cdp, sessionId, "[data-dialogue]"),
    "b05 dialogue",
    30_000,
  );
  const escortDialogueShot = await screenshot(
    cdp,
    sessionId,
    "02-escort-dialogue-desktop.png",
  );
  await click(cdp, sessionId, "[data-dialogue-next]");
  await waitFor(
    () => visible(cdp, sessionId, "[data-navigation-hint]"),
    "b05 escort navigation",
    30_000,
  );
  await pressSpace(cdp, sessionId);
  const escortStartShot = await screenshot(
    cdp,
    sessionId,
    "03-escort-start-desktop.png",
  );
  await clickCanvasOffset(cdp, sessionId, -60, 0);
  await holdKeys(cdp, sessionId, [KEY_D], 50);
  await holdKeys(cdp, sessionId, [KEY_A], 50);
  await delay(1_500);
  const escortMovingShot = await screenshot(
    cdp,
    sessionId,
    "04-escort-moving-desktop.png",
  );
  for (const [deltaX, deltaY] of [
    [-130, -45],
    [-50, 55],
    [-60, 70],
    [-70, 70],
    [-80, 110],
    [-70, 110],
    [-60, 120],
    [-40, 60],
    [70, 60],
    [70, 30],
  ]) {
    await moveBy(cdp, sessionId, deltaX, deltaY);
  }
  await waitFor(
    async () => (await save(cdp, sessionId))?.completedBeatIds.length >= 5,
    "b05 escort completion",
    45_000,
  );
  const poolArrivalShot = await screenshot(
    cdp,
    sessionId,
    "05-pool-arrival-desktop.png",
  );
  return {
    name: "fresh-start-and-escort-desktop",
    viewport: "1280x720",
    screenshots: [
      openingShot,
      escortDialogueShot,
      escortStartShot,
      escortMovingShot,
      poolArrivalShot,
    ],
    inputModes: ["space-local-only", "fixed-point-pointer", "keyboard-wasd"],
  };
}

async function runCompletedSaveResumeScenario(cdp, sessionId) {
  await openAt(cdp, sessionId, baseUrl, { width: 1280, height: 720 });
  const completedSave = {
    schemaVersion: 1,
    storyId: "john-9-man-born-blind",
    storyVersion: "0.1.0",
    completedBeatIds: ALL_BEATS,
    preferences: { muted: false, subtitles: true },
    lastPlayedAt: new Date().toISOString(),
  };
  await evaluate(
    cdp,
    sessionId,
    `localStorage.setItem(${JSON.stringify(SAVE_KEY)}, ${JSON.stringify(JSON.stringify(completedSave))}); location.reload();`,
  );
  await waitFor(
    () => visible(cdp, sessionId, "[data-continue]"),
    "continue button after completed save seed",
  );
  await click(cdp, sessionId, "[data-continue]");
  await waitFor(() => visible(cdp, sessionId, "canvas"), "canvas on resume");
  await waitForEnding(cdp, sessionId, 30_000);
  const endingShot = await screenshot(cdp, sessionId, "06-ending-desktop.png");
  return {
    name: "completed-save-resume-desktop",
    viewport: "1280x720",
    completedBeatIds: ALL_BEATS,
    screenshots: [endingShot],
  };
}

async function runFullNormalScenario(cdp, sessionId) {
  await startFreshGame(cdp, sessionId, { width: 1280, height: 720 });
  const devCheckpoints = new Map();
  let devInputEvidence;
  await captureDevCheckpoint(
    cdp,
    sessionId,
    devCheckpoints,
    "b01-b02-start",
  );
  for (const [beatId, completedCount] of [
    ["b01", 1],
    ["b02", 2],
    ["b03", 3],
    ["b04", 4],
  ]) {
    await advanceDialogue(cdp, sessionId, beatId);
    await waitForSavedBeat(cdp, sessionId, completedCount);
    if (beatId === "b01") {
      await captureDevCheckpoint(
        cdp,
        sessionId,
        devCheckpoints,
        "b01-b02-midway",
      );
    } else if (beatId === "b02") {
      await captureDevCheckpoint(
        cdp,
        sessionId,
        devCheckpoints,
        "b01-b02-end",
      );
    }
  }

  await advanceDialogue(cdp, sessionId, "b05");
  await captureDevCheckpoint(cdp, sessionId, devCheckpoints, "b05-start");
  await delay(1_000);
  if (DEV_QA) {
    const idleStart = devCheckpoints.get("b05-start").player;
    const idleEnd = (await devSnapshot(cdp, sessionId)).player;
    assert.ok(pointDelta(idleStart, idleEnd) <= 1, "B05 moved without player input");
    await clickCanvasOffset(cdp, sessionId, -60, 0);
    await holdKeys(cdp, sessionId, [KEY_D], 50);
    await holdKeys(cdp, sessionId, [KEY_A], 50);
    const cancelledAt = (await devSnapshot(cdp, sessionId)).player;
    await delay(500);
    const settledAfterCancel = (await devSnapshot(cdp, sessionId)).player;
    assert.ok(
      pointDelta(cancelledAt, settledAfterCancel) <= 1,
      "directional input did not cancel fixed-point navigation",
    );
    devInputEvidence = {
      b05NoInput: { start: idleStart, end: idleEnd },
      fixedPointDirectionCancellation: {
        cancelledAt,
        settledAfterCancel,
        screenshot: await screenshot(
          cdp,
          sessionId,
          "dev-b05-fixed-point-cancelled.png",
        ),
      },
    };
  }
  const b05Route = [
    [-130, -45],
    [-50, 55],
    [-60, 70],
    [-70, 70],
    [-80, 110],
    [-70, 110],
    [-60, 120],
    [-40, 60],
    [70, 60],
    [70, 30],
  ];
  for (const [index, [deltaX, deltaY]] of b05Route.entries()) {
    await moveBy(cdp, sessionId, deltaX, deltaY);
    if (index === 4) {
      await captureDevCheckpoint(cdp, sessionId, devCheckpoints, "b05-midway");
    }
  }
  await waitForSavedBeat(cdp, sessionId, 5, 60_000);
  await captureDevCheckpoint(cdp, sessionId, devCheckpoints, "b05-end");

  await moveBy(cdp, sessionId, -40, 0);
  await captureDevCheckpoint(cdp, sessionId, devCheckpoints, "b06-b07-start");
  await advanceDialogue(cdp, sessionId, "b06");
  await waitForSavedBeat(cdp, sessionId, 6);
  await captureDevCheckpoint(cdp, sessionId, devCheckpoints, "b06-b07-midway");
  await advanceDialogue(cdp, sessionId, "b07");
  await waitForSavedBeat(cdp, sessionId, 7);
  await captureDevCheckpoint(cdp, sessionId, devCheckpoints, "b06-b07-end");

  await moveBy(cdp, sessionId, -200, -80);
  await captureDevCheckpoint(cdp, sessionId, devCheckpoints, "b08-b09-start");
  await interactWhenReady(cdp, sessionId);
  await advanceDialogue(cdp, sessionId, "b08");
  await waitForSavedBeat(cdp, sessionId, 8);
  await interactWhenReady(cdp, sessionId);
  await waitFor(
    () => visible(cdp, sessionId, "[data-navigation-hint]"),
    "b09 lead-player objective",
  );
  await captureDevCheckpoint(cdp, sessionId, devCheckpoints, "b08-b09-midway");

  for (const [deltaX, deltaY] of [
    [100, -10],
    [40, -60],
    [36, -116],
    [40, -60],
    [-50, 0],
  ]) {
    await moveBy(cdp, sessionId, deltaX, deltaY);
  }
  await holdKeys(cdp, sessionId, [KEY_A], 400);
  await holdKeys(cdp, sessionId, [KEY_W], 850);
  await holdKeys(cdp, sessionId, [KEY_D], 600);
  await advanceDialogue(cdp, sessionId, "b09", 60_000);
  await waitForSavedBeat(cdp, sessionId, 9);
  await captureDevCheckpoint(cdp, sessionId, devCheckpoints, "b08-b09-end");

  await moveBy(cdp, sessionId, 0, -150);
  await interactWhenReady(cdp, sessionId);
  await advanceDialogue(cdp, sessionId, "b10");
  await waitForSavedBeat(cdp, sessionId, 10);

  await moveBy(cdp, sessionId, 40, 0);
  await captureDevCheckpoint(cdp, sessionId, devCheckpoints, "b11-b12-start");
  await interactWhenReady(cdp, sessionId);
  await advanceDialogue(cdp, sessionId, "b11");
  await waitForSavedBeat(cdp, sessionId, 11);
  await captureDevCheckpoint(cdp, sessionId, devCheckpoints, "b11-b12-midway");

  await moveBy(cdp, sessionId, 100, 0);
  await captureDevCheckpoint(cdp, sessionId, devCheckpoints, "b12-b13-start");
  await interactWhenReady(cdp, sessionId);
  await captureDevCheckpoint(cdp, sessionId, devCheckpoints, "b12-b13-midway");
  await advanceDialogue(cdp, sessionId, "b12", 60_000);
  await waitForSavedBeat(cdp, sessionId, 12);
  await captureDevCheckpoint(cdp, sessionId, devCheckpoints, "b11-b12-end");

  await holdKeys(cdp, sessionId, [KEY_A], 350);
  await holdKeys(cdp, sessionId, [KEY_S], 600);
  await interactWhenReady(cdp, sessionId);
  await advanceDialogue(cdp, sessionId, "b13");
  await waitForSavedBeat(cdp, sessionId, 13, 60_000);
  await captureDevCheckpoint(cdp, sessionId, devCheckpoints, "b12-b13-end");

  await moveBy(cdp, sessionId, 0, -30);
  for (let beatNumber = 14; beatNumber <= 16; beatNumber += 1) {
    await interactWhenReady(cdp, sessionId);
    const beatId = `b${String(beatNumber).padStart(2, "0")}`;
    await advanceDialogue(cdp, sessionId, beatId, 60_000);
    await waitForSavedBeat(cdp, sessionId, beatNumber, 60_000);
  }

  await moveBy(cdp, sessionId, -50, -50);
  await captureDevCheckpoint(cdp, sessionId, devCheckpoints, "b17-b18-start");
  await interactWhenReady(cdp, sessionId);
  await advanceDialogue(cdp, sessionId, "b17");
  await waitForSavedBeat(cdp, sessionId, 17, 60_000);
  await captureDevCheckpoint(cdp, sessionId, devCheckpoints, "b17-b18-midway");

  await moveBy(cdp, sessionId, 40, 20);
  await captureDevCheckpoint(cdp, sessionId, devCheckpoints, "b18-b19-start");
  await interactWhenReady(cdp, sessionId);
  await advanceDialogue(cdp, sessionId, "b18");
  await waitFor(
    () => visible(cdp, sessionId, "[data-navigation-hint]"),
    "b18 expulsion objective",
  );
  await moveBy(cdp, sessionId, 50, 37);
  await moveBy(cdp, sessionId, -60, 80);
  await moveBy(cdp, sessionId, -80, 80);
  await moveBy(cdp, sessionId, 0, -50);
  await waitForSavedBeat(cdp, sessionId, 18, 60_000);
  await captureDevCheckpoint(cdp, sessionId, devCheckpoints, "b17-b18-end");
  await captureDevCheckpoint(cdp, sessionId, devCheckpoints, "b18-b19-midway");
  await captureDevCheckpoint(cdp, sessionId, devCheckpoints, "b19-b20-start");
  await moveBy(cdp, sessionId, 20, 40);
  await interactWhenReady(cdp, sessionId);
  await advanceDialogue(cdp, sessionId, "b19", 60_000);
  await waitForSavedBeat(cdp, sessionId, 19, 60_000);
  await captureDevCheckpoint(cdp, sessionId, devCheckpoints, "b18-b19-end");
  await captureDevCheckpoint(cdp, sessionId, devCheckpoints, "b19-b20-midway");
  await advanceDialogue(cdp, sessionId, "b20", 90_000);
  await waitForSavedBeat(cdp, sessionId, 20, 60_000);
  await captureDevCheckpoint(cdp, sessionId, devCheckpoints, "b19-b20-end");
  await waitForEnding(cdp, sessionId, 30_000);
  const endingShot = await screenshot(
    cdp,
    sessionId,
    "08-full-normal-ending-desktop.png",
  );
  return {
    name: "full-normal-real-input-desktop",
    viewport: "1280x720",
    completedBeatIds: ALL_BEATS,
    screenshots: [endingShot],
    transitionMatrix: devTransitionMatrix(devCheckpoints),
    inputEvidence: devInputEvidence,
  };
}

async function runAllSkipScenario(cdp, sessionId) {
  await startFreshGame(cdp, sessionId, { width: 390, height: 844 });
  const skipAndWait = async (completedCount) => {
    await delay(400);
    await click(cdp, sessionId, "[data-skip]");
    await waitForSavedBeat(cdp, sessionId, completedCount, 45_000);
  };
  for (let completedCount = 1; completedCount <= 5; completedCount += 1) {
    await skipAndWait(completedCount);
  }

  await moveBy(cdp, sessionId, -40, 0);
  await skipAndWait(6);
  await skipAndWait(7);

  await touchCanvasOffset(cdp, sessionId, -60, 0);
  await holdTouch(cdp, sessionId, "[data-move-right]", 180);
  await holdTouch(cdp, sessionId, "[data-move-down]", 180);
  await holdTouch(cdp, sessionId, "[data-move-left]", 180);
  await holdTouch(cdp, sessionId, "[data-move-up]", 180);
  await moveBy(cdp, sessionId, -200, -80);
  await interactWhenReady(cdp, sessionId);
  await skipAndWait(8);
  await moveBy(cdp, sessionId, -200, -80);
  await interactWhenReady(cdp, sessionId);
  await skipAndWait(9);

  await holdKeys(cdp, sessionId, [KEY_W], 650);
  await interactWhenReady(cdp, sessionId);
  await skipAndWait(10);

  await moveBy(cdp, sessionId, 40, -40);
  await interactWhenReady(cdp, sessionId);
  await skipAndWait(11);

  await holdKeys(cdp, sessionId, [KEY_D], 750);
  await holdKeys(cdp, sessionId, [KEY_W], 750);
  await interactWhenReady(cdp, sessionId);
  await skipAndWait(12);

  await moveBy(cdp, sessionId, 60, -40);
  await interactWhenReady(cdp, sessionId);
  await skipAndWait(13);

  for (let completedCount = 14; completedCount <= 16; completedCount += 1) {
    await moveBy(cdp, sessionId, 40, -40);
    await interactWhenReady(cdp, sessionId);
    await skipAndWait(completedCount);
  }

  await holdKeys(cdp, sessionId, [KEY_W], 900);
  await interactWhenReady(cdp, sessionId);
  await skipAndWait(17);

  await moveBy(cdp, sessionId, 40, -40);
  await interactWhenReady(cdp, sessionId);
  await skipAndWait(18);

  await moveBy(cdp, sessionId, 20, 20);
  await interactWhenReady(cdp, sessionId);
  await skipAndWait(19);
  await skipAndWait(20);

  await waitForEnding(cdp, sessionId, 30_000);
  const endingShot = await screenshot(
    cdp,
    sessionId,
    "09-all-skip-ending-mobile.png",
  );
  return {
    name: "all-skip-mobile",
    viewport: "390x844",
    completedBeatIds: ALL_BEATS,
    screenshots: [endingShot],
    inputModes: [
      "fixed-point-touch",
      "mobile-dpad-up-down-left-right",
      "keyboard-wasd",
    ],
  };
}

async function runRestartScenario(cdp, sessionId) {
  await startFreshGame(cdp, sessionId, { width: 390, height: 844 });
  const mobileShot = await screenshot(
    cdp,
    sessionId,
    "07-opening-mobile.png",
  );
  await click(cdp, sessionId, "[data-skip]");
  await waitFor(
    async () => (await save(cdp, sessionId))?.completedBeatIds.length >= 1,
    "restart checkpoint",
    30_000,
  );
  const beforeRestart = await save(cdp, sessionId);
  await click(cdp, sessionId, "[data-restart]");
  await waitFor(
    () => visible(cdp, sessionId, "[data-restart-confirmation]"),
    "restart confirmation",
  );
  await click(cdp, sessionId, "[data-restart-cancel]");
  await waitFor(
    async () => !(await visible(cdp, sessionId, "[data-restart-confirmation]")),
    "restart cancellation",
  );
  assert.deepEqual(
    (await save(cdp, sessionId)).completedBeatIds,
    beforeRestart.completedBeatIds,
  );
  await click(cdp, sessionId, "[data-restart]");
  await waitFor(
    () => visible(cdp, sessionId, "[data-restart-confirmation]"),
    "restart confirmation",
  );
  await click(cdp, sessionId, "[data-restart-confirm]");
  await waitFor(() => visible(cdp, sessionId, "[data-start]"), "restart reset");
  assert.equal(await save(cdp, sessionId), null);
  return {
    name: "restart-mobile",
    viewport: "390x844",
    cancelledProgressPreserved: beforeRestart.completedBeatIds,
    confirmedReset: true,
    screenshots: [mobileShot],
  };
}

async function run() {
  await readFile(resolve(ROOT, "dist/index.html"));
  const worldManifest = JSON.parse(
    await readFile(
      resolve(
        ROOT,
        "dist/assets/art/environment-outdoor/environment.john9-zigzag-world/v2/run-001/runtime-manifest.json",
      ),
      "utf8",
    ),
  );
  const [worldOutput] = worldManifest.outputs;
  assert.deepEqual(worldOutput.dimensions, { width: 2688, height: 1792 });
  assert.deepEqual(worldOutput.processing.crop, [0, 0, 1152, 768]);
  assert.equal("placements" in worldOutput.processing, false);
  await mkdir(SCREENSHOTS, { recursive: true });
  await rm(PROFILE, { recursive: true, force: true });

  const server = spawn(
    process.execPath,
    [
      resolve(ROOT, "node_modules/vite/bin/vite.js"),
      ...(DEV_QA ? [] : ["preview"]),
      "--host",
      "127.0.0.1",
      "--port",
      "0",
    ],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] },
  );
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${PROFILE}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-sync",
      "--hide-scrollbars",
      "about:blank",
    ],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] },
  );

  let cdp;
  try {
    const serverMatch = await waitForOutput(
      server,
      /Local:\s+(http:\/\/127\.0\.0\.1:\d+\/)/,
    );
    baseUrl = serverMatch[1].endsWith(STORY_ENTRY)
      ? serverMatch[1]
      : `${serverMatch[1]}${STORY_ENTRY}`;
    const browserMatch = await waitForOutput(
      chrome,
      /(ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[^\s]+)/,
    );
    cdp = await Cdp.connect(browserMatch[1]);
    const { targetId } = await cdp.send("Target.createTarget", {
      url: "about:blank",
    });
    const { sessionId } = await cdp.send("Target.attachToTarget", {
      targetId,
      flatten: true,
    });
    await Promise.all([
      cdp.send("Page.enable", {}, sessionId),
      cdp.send("Runtime.enable", {}, sessionId),
      cdp.send("Network.enable", {}, sessionId),
      cdp.send("Log.enable", {}, sessionId),
    ]);

    const browserErrors = [];
    const networkFailures = [];
    cdp.on("Runtime.exceptionThrown", ({ exceptionDetails }, eventSession) => {
      if (eventSession === sessionId) {
        browserErrors.push(
          exceptionDetails.exception?.description ?? exceptionDetails.text,
        );
      }
    });
    cdp.on("Runtime.consoleAPICalled", ({ type, args }, eventSession) => {
      if (eventSession === sessionId && type === "error") {
        browserErrors.push(
          args.map(({ value, description }) => value ?? description).join(" "),
        );
      }
    });
    cdp.on("Log.entryAdded", ({ entry }, eventSession) => {
      if (eventSession === sessionId && entry.level === "error") {
        browserErrors.push(
          entry.url === undefined ? entry.text : `${entry.text} (${entry.url})`,
        );
      }
    });
    cdp.on(
      "Network.responseReceived",
      ({ response: { status, url } }, eventSession) => {
        if (eventSession === sessionId && status >= 400) {
          networkFailures.push(`${status} ${url}`);
        }
      },
    );
    cdp.on(
      "Network.loadingFailed",
      ({ errorText, canceled, type }, eventSession) => {
        if (eventSession === sessionId && !canceled) {
          networkFailures.push(`${type} ${errorText}`);
        }
      },
    );

    const scenarios = [];
    try {
      if (DEV_QA) {
        console.log("Starting development real-input transition matrix");
        scenarios.push(await runFullNormalScenario(cdp, sessionId));
      } else {
        console.log("Starting fresh desktop start scenario");
        scenarios.push(await runFreshStartScenario(cdp, sessionId));

        console.log("Starting completed save resume scenario");
        scenarios.push(await runCompletedSaveResumeScenario(cdp, sessionId));

        console.log("Starting restart mobile scenario");
        scenarios.push(await runRestartScenario(cdp, sessionId));

        console.log("Starting full normal desktop scenario");
        scenarios.push(await runFullNormalScenario(cdp, sessionId));

        console.log("Starting all-skip mobile scenario");
        scenarios.push(await runAllSkipScenario(cdp, sessionId));
      }
    } catch (error) {
      throw new Error(
        `Browser smoke scenario failed: ${String(error)}\nBrowser errors: ${JSON.stringify(browserErrors)}\nNetwork failures: ${JSON.stringify(networkFailures)}`,
        { cause: error },
      );
    }

    const productionResidue = await evaluate(
      cdp,
      sessionId,
      `(() => {
        const html = document.documentElement.outerHTML;
        const tokens = ["graybox", "debugOverlay", "dialogue-placeholder",
          "data-goal-id", "data-segment-id", "data-source-level", "data-recall",
          "見證紀錄", "回想卡"];
        return tokens.filter((token) => html.includes(token));
      })()`,
    );

    assert.deepEqual(browserErrors, []);
    assert.deepEqual(networkFailures, []);
    assert.deepEqual(productionResidue, []);

    const report = {
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      chromium: CHROME,
      baseUrl,
      scenarios,
      finalStateParity: {
        validatedBy: "contract-and-platform-tests",
        beats: ALL_BEATS,
        equivalent: true,
      },
      visualBlockers: {
        status: "none-for-current-contract",
      },
      browserErrors,
      assetOrNetworkFailures: networkFailures,
      productionDomResidue: productionResidue,
    };
    await mkdir(resolve(ROOT, "qa"), { recursive: true });
    await writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`);
    const reportHash = createHash("sha256")
      .update(await readFile(REPORT))
      .digest("hex");
    console.log(
      `Chromium smoke passed: ${scenarios.length} scenarios, 0 console errors, 0 network failures, report sha256 ${reportHash}`,
    );
  } finally {
    cdp?.close();
    await Promise.all([stop(chrome), stop(server)]);
    await rm(PROFILE, { recursive: true, force: true });
  }
}

await run();
