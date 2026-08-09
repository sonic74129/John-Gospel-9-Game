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
const SAVE_KEY = "bible-games:save:john-9-man-born-blind:v1";
const STORY_ENTRY = "games/john-9-man-born-blind/";
const ALL_BEATS = Array.from(
  { length: 20 },
  (_, index) => `b${String(index + 1).padStart(2, "0")}`,
);

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

async function pressSpace(cdp, sessionId) {
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
  await click(cdp, sessionId, "[data-dialogue-close]");
  await waitFor(
    () => visible(cdp, sessionId, "[data-navigation-hint]"),
    "b05 escort navigation",
    30_000,
  );
  const escortStartShot = await screenshot(
    cdp,
    sessionId,
    "03-escort-start-desktop.png",
  );
  await pressSpace(cdp, sessionId);
  await delay(1_500);
  const escortMovingShot = await screenshot(
    cdp,
    sessionId,
    "04-escort-moving-desktop.png",
  );
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
      console.log("Starting fresh desktop start scenario");
      scenarios.push(await runFreshStartScenario(cdp, sessionId));

      console.log("Starting completed save resume scenario");
      scenarios.push(await runCompletedSaveResumeScenario(cdp, sessionId));

      console.log("Starting restart mobile scenario");
      scenarios.push(await runRestartScenario(cdp, sessionId));
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
