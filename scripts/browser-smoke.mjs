import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SCREENSHOTS = resolve(ROOT, "qa/review-screenshots");
const REPORT = resolve(ROOT, "qa/browser-smoke-report.json");
const PROFILE = resolve(ROOT, "qa/.chromium-smoke-profile");
const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
let baseUrl;
const SAVE_KEY = "bible-games:save:john-9-man-born-blind:v1";
const ALL_BEATS = Array.from(
  { length: 6 },
  (_, index) => `b${String(index + 1).padStart(2, "0")}`,
);

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

async function pressDirection(cdp, sessionId, hint) {
  const keys = [];
  if (hint.includes("北")) keys.push(["ArrowUp", "ArrowUp", 38]);
  if (hint.includes("南")) keys.push(["ArrowDown", "ArrowDown", 40]);
  if (hint.includes("西")) keys.push(["ArrowLeft", "ArrowLeft", 37]);
  if (hint.includes("東")) keys.push(["ArrowRight", "ArrowRight", 39]);
  if (keys.length === 0) {
    keys.push(["ArrowRight", "ArrowRight", 39]);
  }
  for (const [key, code, windowsVirtualKeyCode] of keys) {
    await cdp.send(
      "Input.dispatchKeyEvent",
      { type: "rawKeyDown", key, code, windowsVirtualKeyCode },
      sessionId,
    );
  }
  await delay(420);
  for (const [key, code, windowsVirtualKeyCode] of keys.reverse()) {
    await cdp.send(
      "Input.dispatchKeyEvent",
      { type: "keyUp", key, code, windowsVirtualKeyCode },
      sessionId,
    );
  }
  if (hint.includes("互動")) {
    await cdp.send(
      "Input.dispatchKeyEvent",
      {
        type: "keyDown",
        key: " ",
        code: "Space",
        windowsVirtualKeyCode: 32,
      },
      sessionId,
    );
    await cdp.send(
      "Input.dispatchKeyEvent",
      {
        type: "keyUp",
        key: " ",
        code: "Space",
        windowsVirtualKeyCode: 32,
      },
      sessionId,
    );
  }
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

async function playToCompletion({
  cdp,
  sessionId,
  mode,
  screenshots = new Map(),
  reenterAt = null,
}) {
  let reentered = false;
  let lastProgress = -1;
  const captured = [];
  const started = Date.now();

  while (Date.now() - started < 360_000) {
    if (await visible(cdp, sessionId, "[data-ending]")) {
      if (screenshots.has(ALL_BEATS.length)) {
        captured.push(
          await screenshot(cdp, sessionId, screenshots.get(ALL_BEATS.length)),
        );
        screenshots.delete(ALL_BEATS.length);
      }
      return { captured, reentered };
    }

    const currentSave = await save(cdp, sessionId);
    const progress = currentSave?.completedBeatIds.length ?? 0;
    if (progress !== lastProgress) {
      lastProgress = progress;
      console.log(`${mode}: completed ${progress}/${ALL_BEATS.length}`);
      if (screenshots.has(progress)) {
        await delay(300);
        captured.push(
          await screenshot(cdp, sessionId, screenshots.get(progress)),
        );
        screenshots.delete(progress);
      }
      if (reenterAt === progress && !reentered) {
        await cdp.send("Page.reload", {}, sessionId);
        await waitFor(
          () => visible(cdp, sessionId, "[data-continue]"),
          "continue after re-entry",
        );
        await click(cdp, sessionId, "[data-continue]");
        await waitFor(
          () => visible(cdp, sessionId, "canvas"),
          "canvas after re-entry",
        );
        reentered = true;
        continue;
      }
    }

    if (await visible(cdp, sessionId, "[data-recall]")) {
      await click(cdp, sessionId, "[data-recall-dismiss]");
    }

    const hint = await evaluate(
      cdp,
      sessionId,
      `(() => { const element = document.querySelector("[data-navigation-hint]");` +
        ' return element && !element.hidden ? element.textContent ?? "" : ""; })()',
    );
    if (hint !== "") {
      if (
        progress === 5 &&
        hint.includes("距離約 1 段路") &&
        screenshots.has("pool")
      ) {
        await delay(300);
        captured.push(await screenshot(cdp, sessionId, screenshots.get("pool")));
        screenshots.delete("pool");
      }
      await pressDirection(cdp, sessionId, hint);
      continue;
    }

    const currentBeat = progress + 1;
    const shouldSkip =
      mode === "all-skip" || (mode === "mixed-skip" && currentBeat % 2 === 0);
    if (shouldSkip) {
      await click(cdp, sessionId, "[data-skip]");
      await delay(120);
      continue;
    }

    if (await visible(cdp, sessionId, "[data-dialogue]")) {
      await click(cdp, sessionId, "[data-dialogue-next]");
      await delay(80);
      continue;
    }

    await delay(100);
  }
  throw new Error(`${mode} playthrough did not complete.`);
}

async function resetAndStart(cdp, sessionId, viewport) {
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
  await cdp.send("Page.navigate", { url: baseUrl }, sessionId);
  await waitFor(
    () =>
      evaluate(
        cdp,
        sessionId,
        "document.readyState === 'complete' && Boolean(document.querySelector('[data-start]'))",
      ),
    "start screen",
  );
  await evaluate(cdp, sessionId, "localStorage.clear(); location.reload();");
  await waitFor(
    () => visible(cdp, sessionId, "[data-start]"),
    "fresh start screen",
  );
  await click(cdp, sessionId, "[data-start]");
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

async function run() {
  await readFile(resolve(ROOT, "dist/index.html"));
  await mkdir(SCREENSHOTS, { recursive: true });
  await rm(PROFILE, { recursive: true, force: true });

  const server = spawn(
    process.execPath,
    [
      resolve(ROOT, "node_modules/vite/bin/vite.js"),
      "preview",
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
    baseUrl = `${serverMatch[1]}games/john-9-man-born-blind/`;
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
    console.log("Starting normal desktop playthrough");
    await resetAndStart(cdp, sessionId, { width: 1280, height: 720 });
    const normal = await playToCompletion({
      cdp,
      sessionId,
      mode: "normal",
      reenterAt: 3,
      screenshots: new Map([
        [0, "01-courtyard-opening-desktop.png"],
        ["pool", "02-siloam-pool-desktop.png"],
        [6, "03-ending-desktop.png"],
      ]),
    });
    const normalSave = await save(cdp, sessionId);
    assert.deepEqual(normalSave.completedBeatIds, ALL_BEATS);
    assert.equal(normal.reentered, true);
    scenarios.push({
      name: "normal-desktop-with-re-entry",
      viewport: "1280x720",
      completedBeatIds: normalSave.completedBeatIds,
      screenshots: normal.captured,
    });

    console.log("Starting all-skip mobile playthrough");
    await resetAndStart(cdp, sessionId, { width: 390, height: 844 });
    const mobileSkip = await playToCompletion({
      cdp,
      sessionId,
      mode: "all-skip",
      screenshots: new Map([
        [0, "04-courtyard-opening-mobile.png"],
        ["pool", "05-siloam-pool-mobile.png"],
      ]),
    });
    const skipSave = await save(cdp, sessionId);
    assert.deepEqual(skipSave.completedBeatIds, ALL_BEATS);
    scenarios.push({
      name: "all-skip-mobile",
      viewport: "390x844",
      completedBeatIds: skipSave.completedBeatIds,
      screenshots: mobileSkip.captured,
    });

    console.log("Starting mixed-skip desktop playthrough");
    await resetAndStart(cdp, sessionId, { width: 1280, height: 720 });
    await playToCompletion({ cdp, sessionId, mode: "mixed-skip" });
    const mixedSave = await save(cdp, sessionId);
    assert.deepEqual(mixedSave.completedBeatIds, ALL_BEATS);
    scenarios.push({
      name: "mixed-skip-desktop",
      viewport: "1280x720",
      completedBeatIds: mixedSave.completedBeatIds,
    });

    console.log("Starting restart mobile scenario");
    await resetAndStart(cdp, sessionId, { width: 390, height: 844 });
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
    scenarios.push({
      name: "restart-mobile",
      viewport: "390x844",
      cancelledProgressPreserved: beforeRestart.completedBeatIds,
      confirmedReset: true,
    });

    const productionResidue = await evaluate(
      cdp,
      sessionId,
      `(() => {
        const html = document.documentElement.outerHTML;
        const tokens = ["graybox", "debugOverlay", "dialogue-placeholder",
          "data-goal-id", "data-segment-id", "data-source-level"];
        return tokens.filter((token) => html.includes(token));
      })()`,
    );
    assert.deepEqual(productionResidue, []);
    assert.deepEqual(browserErrors, []);
    assert.deepEqual(networkFailures, []);

    const report = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      chromium: CHROME,
      baseUrl,
      scenarios,
      finalStateParity: {
        normal: normalSave.completedBeatIds,
        allSkip: skipSave.completedBeatIds,
        mixedSkip: mixedSave.completedBeatIds,
        equivalent: true,
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
