import type {
  SliceDialogueLine,
  SliceFinalState,
  SliceSequenceUi,
} from "../adapters/sequence-adapter.ts";

export interface AppShellHandlers {
  readonly onStart: (mode: "new" | "continue") => void;
  readonly onRestart: () => Promise<void>;
  readonly onPauseChange: (paused: boolean) => Promise<void>;
  readonly onMuteChange: (muted: boolean) => void;
  readonly onSkip: () => void;
}

export interface AppShell extends SliceSequenceUi {
  readonly gameContainer: HTMLElement;
  setStarted(): void;
  setPaused(paused: boolean): void;
  setMuted(muted: boolean): void;
  setCompleted(): void;
  setNavigationHint(message: string | null): void;
  setStatus(message: string, isError?: boolean): void;
  setPersistenceWarning(message: string | null): void;
  snapshotAppliedState(): SliceFinalState | null;
}

function abortError(): Error {
  const error = new Error("Sequence operation aborted");
  error.name = "AbortError";
  return error;
}

export function navigationHintNeedsUpdate(
  currentMessage: string | null,
  nextMessage: string | null,
): boolean {
  return currentMessage !== nextMessage;
}

export function createAppShell(
  root: HTMLElement,
  handlers: AppShellHandlers,
  options: Readonly<{ hasSave: boolean }> = { hasSave: false },
): AppShell {
  root.innerHTML = `
    <article class="platform-shell" data-platform-shell>
      <header class="platform-header">
        <div>
          <p class="eyebrow">約翰福音 9:1–7</p>
          <h1>生來瞎眼的人</h1>
        </div>
        <div class="status-stack">
          <p class="platform-status" data-status role="status" hidden></p>
          <p class="persistence-warning" data-persistence-warning role="alert" hidden></p>
        </div>
      </header>
      <section class="game-frame" aria-label="遊戲區域">
        <div class="game-container" data-game-container></div>
        <div class="slice-hud" data-slice-hud>
          <p class="stage-goal" data-stage-goal>留心四周</p>
        </div>
        <p class="navigation-hint" data-navigation-hint role="status" aria-live="polite" hidden></p>
        <div class="start-screen" data-start-screen>
          <p class="start-kicker">約翰福音 9:1–7</p>
          <h2>進入故事</h2>
          <p>移動、靠近人物、留心聆聽。</p>
          <button class="primary-action" type="button" data-continue ${options.hasSave ? "" : "hidden"}>繼續故事</button>
          <button class="primary-action" type="button" data-start ${options.hasSave ? "hidden" : ""}>開始</button>
          <button type="button" data-start-restart ${options.hasSave ? "" : "hidden"}>重新開始</button>
        </div>
        <section class="dialogue-panel" data-dialogue hidden aria-modal="true" role="dialog" aria-labelledby="dialogue-title">
          <header>
            <h2 id="dialogue-title">經文</h2>
          </header>
          <div class="dialogue-text" data-dialogue-text></div>
          <p class="dialogue-reference" data-dialogue-reference></p>
          <footer>
            <button type="button" data-dialogue-next>繼續</button>
            <button type="button" data-dialogue-close>關閉</button>
          </footer>
        </section>
        <section class="ending-panel" data-ending hidden aria-modal="true" role="dialog" aria-labelledby="ending-title">
          <h2 id="ending-title">約翰福音 9:1–7</h2>
          <p>耶穌看見生來瞎眼的人，顯明神的作為；那人照吩咐往西羅亞池洗，回頭就看見了。</p>
          <button type="button" data-ending-restart>重新開始</button>
        </section>
        <section class="restart-confirmation" data-restart-confirmation hidden aria-modal="true" role="dialog" aria-labelledby="restart-title">
          <h2 id="restart-title">確定重新開始？</h2>
          <p>這會清除本故事的進度與存檔，然後從故事開頭開始。</p>
          <div>
            <button type="button" data-restart-cancel>保留進度</button>
            <button type="button" data-restart-confirm>清除並重新開始</button>
          </div>
        </section>
      </section>
      <nav class="game-controls" data-game-controls aria-label="遊戲控制">
        <button type="button" data-pause aria-pressed="false" disabled>暫停</button>
        <button type="button" data-mute aria-pressed="false" disabled>靜音</button>
        <button type="button" data-skip disabled>跳過目前演出</button>
        <button type="button" data-restart disabled>重新開始</button>
      </nav>
    </article>
  `;

  const gameContainer = requireElement<HTMLElement>(
    root,
    "[data-game-container]",
  );
  const gameControls = requireElement<HTMLElement>(
    root,
    "[data-game-controls]",
  );
  const startScreen = requireElement<HTMLElement>(root, "[data-start-screen]");
  const startButton = requireElement<HTMLButtonElement>(root, "[data-start]");
  const continueButton = requireElement<HTMLButtonElement>(
    root,
    "[data-continue]",
  );
  const startRestartButton = requireElement<HTMLButtonElement>(
    root,
    "[data-start-restart]",
  );
  const pauseButton = requireElement<HTMLButtonElement>(root, "[data-pause]");
  const muteButton = requireElement<HTMLButtonElement>(root, "[data-mute]");
  const skipButton = requireElement<HTMLButtonElement>(root, "[data-skip]");
  const restartButton = requireElement<HTMLButtonElement>(
    root,
    "[data-restart]",
  );
  const status = requireElement<HTMLElement>(root, "[data-status]");
  const persistenceWarning = requireElement<HTMLElement>(
    root,
    "[data-persistence-warning]",
  );
  const goal = requireElement<HTMLElement>(root, "[data-stage-goal]");
  const navigationHint = requireElement<HTMLElement>(
    root,
    "[data-navigation-hint]",
  );
  const dialogue = requireElement<HTMLElement>(root, "[data-dialogue]");
  const dialogueText = requireElement<HTMLElement>(
    root,
    "[data-dialogue-text]",
  );
  const dialogueReference = requireElement<HTMLElement>(
    root,
    "[data-dialogue-reference]",
  );
  const dialogueNext = requireElement<HTMLButtonElement>(
    root,
    "[data-dialogue-next]",
  );
  const dialogueClose = requireElement<HTMLButtonElement>(
    root,
    "[data-dialogue-close]",
  );
  const ending = requireElement<HTMLElement>(root, "[data-ending]");
  const endingRestart = requireElement<HTMLButtonElement>(
    root,
    "[data-ending-restart]",
  );
  const restartConfirmation = requireElement<HTMLElement>(
    root,
    "[data-restart-confirmation]",
  );
  const restartCancel = requireElement<HTMLButtonElement>(
    root,
    "[data-restart-cancel]",
  );
  const restartConfirm = requireElement<HTMLButtonElement>(
    root,
    "[data-restart-confirm]",
  );

  let paused = false;
  let muted = false;
  let appliedState: SliceFinalState | null = null;
  let completed = false;
  let navigationHintMessage: string | null = null;
  let started = false;
  let resumeAfterRestartCancel = false;
  let restartButtonStates = new Map<HTMLButtonElement, boolean>();

  const restartOutsideRegions = [
    gameContainer,
    startScreen,
    dialogue,
    ending,
    gameControls,
  ];
  const restartOutsideButtons = [
    startButton,
    continueButton,
    startRestartButton,
    pauseButton,
    muteButton,
    skipButton,
    restartButton,
    dialogueNext,
    dialogueClose,
    endingRestart,
  ];

  const setRestartModalBlocking = (blocking: boolean): void => {
    root.dataset.restartModalOpen = String(blocking);
    for (const region of restartOutsideRegions) {
      region.inert = blocking;
    }
    if (blocking) {
      restartButtonStates = new Map(
        restartOutsideButtons.map((button) => [button, button.disabled]),
      );
      for (const button of restartOutsideButtons) {
        button.disabled = true;
      }
      return;
    }
    for (const [button, disabled] of restartButtonStates) {
      button.disabled = disabled;
    }
    restartButtonStates.clear();
  };

  const showRestartConfirmation = async (): Promise<void> => {
    if (!restartConfirmation.hidden) {
      return;
    }
    resumeAfterRestartCancel = started && !paused && !completed;
    setRestartModalBlocking(true);
    restartConfirmation.hidden = false;
    restartConfirm.focus();
    if (!resumeAfterRestartCancel) {
      return;
    }
    restartConfirm.disabled = true;
    restartCancel.disabled = true;
    try {
      await handlers.onPauseChange(true);
    } catch {
      restartConfirmation.hidden = true;
      setRestartModalBlocking(false);
      resumeAfterRestartCancel = false;
    } finally {
      restartConfirm.disabled = false;
      restartCancel.disabled = false;
    }
  };

  const closeRestartConfirmation = async (): Promise<void> => {
    restartConfirm.disabled = true;
    restartCancel.disabled = true;
    try {
      if (resumeAfterRestartCancel) {
        await handlers.onPauseChange(false);
      }
      restartConfirmation.hidden = true;
      setRestartModalBlocking(false);
      resumeAfterRestartCancel = false;
    } catch {
      restartConfirm.disabled = false;
      restartCancel.disabled = false;
    }
  };

  const presentLines = (
    lines: readonly SliceDialogueLine[],
    signal: AbortSignal,
  ): Promise<void> => {
    if (signal.aborted) {
      return Promise.reject(abortError());
    }
    dialogue.hidden = false;
    dialogue.dataset.blocking = "true";
    let index = 0;

    const renderLine = (): void => {
      const line = lines[index];
      if (line === undefined) {
        return;
      }
      dialogueText.textContent = line.exactText;
      dialogueReference.textContent = `${formatVerseReference(line.verseKey)} · ${line.sourceLabel}`;
      dialogueNext.disabled = paused;
      dialogueClose.disabled = paused;
    };
    renderLine();

    return new Promise<void>((resolve, reject) => {
      const cleanup = (): void => {
        dialogueNext.removeEventListener("click", onNext);
        dialogueClose.removeEventListener("click", onClose);
        signal.removeEventListener("abort", onAbort);
        dialogue.hidden = true;
        delete dialogue.dataset.blocking;
      };
      const onNext = (): void => {
        if (paused) {
          return;
        }
        if (index < lines.length - 1) {
          index += 1;
          renderLine();
          return;
        }
        cleanup();
        resolve();
      };
      const onAbort = (): void => {
        cleanup();
        reject(abortError());
      };
      const onClose = (): void => {
        if (paused) {
          return;
        }
        cleanup();
        resolve();
      };
      dialogueNext.addEventListener("click", onNext);
      dialogueClose.addEventListener("click", onClose);
      signal.addEventListener("abort", onAbort, { once: true });
    });
  };

  const shell: AppShell = {
    gameContainer,
    setStarted: () => {
      started = true;
      startScreen.hidden = true;
      for (const button of [
        pauseButton,
        muteButton,
        skipButton,
        restartButton,
      ]) {
        button.disabled = false;
      }
      shell.setStatus("故事進行中");
    },
    setPaused: (value) => {
      paused = value;
      pauseButton.setAttribute("aria-pressed", String(value));
      pauseButton.textContent = value ? "繼續" : "暫停";
      dialogueNext.disabled = value;
      dialogueClose.disabled = value;
      skipButton.disabled = value;
      shell.setStatus(
        value ? "遊戲已暫停" : completed ? "故事已完成" : "故事進行中",
      );
    },
    setMuted: (value) => {
      muted = value;
      muteButton.setAttribute("aria-pressed", String(value));
      muteButton.textContent = value ? "取消靜音" : "靜音";
    },
    setCompleted: () => {
      completed = true;
      paused = false;
      dialogue.hidden = true;
      ending.hidden = false;
      ending.dataset.blocking = "true";
      pauseButton.disabled = true;
      skipButton.disabled = true;
      restartButton.disabled = false;
      shell.setNavigationHint(null);
    },
    setNavigationHint: (message) => {
      if (!navigationHintNeedsUpdate(navigationHintMessage, message)) {
        return;
      }
      navigationHintMessage = message;
      navigationHint.hidden = message === null;
      navigationHint.textContent = message ?? "";
    },
    setStatus: (message, isError = false) => {
      status.textContent = message;
      status.dataset.error = String(isError);
      status.hidden = !isError;
    },
    setPersistenceWarning: (message) => {
      persistenceWarning.hidden = message === null;
      persistenceWarning.textContent =
        message === null ? "" : `無法儲存進度：${message}`;
    },
    snapshotAppliedState: () =>
      appliedState === null ? null : structuredClone(appliedState),
    setOverlay: () => {},
    presentDialogue: (_beatId, lines, signal) => presentLines(lines, signal),
    applyFinalState: (state, stageGoal) => {
      appliedState = structuredClone(state);
      goal.textContent = stageGoal.description;
    },
    setHandoff: () => {},
  };

  startButton.addEventListener("click", () => handlers.onStart("new"), {
    once: true,
  });
  continueButton.addEventListener(
    "click",
    () => handlers.onStart("continue"),
    { once: true },
  );
  startRestartButton.addEventListener("click", () => {
    void showRestartConfirmation();
  });
  pauseButton.addEventListener("click", async () => {
    pauseButton.disabled = true;
    try {
      await handlers.onPauseChange(!paused);
    } catch {
      // The handler reports lifecycle failures in the visible status region.
    } finally {
      if (!completed && restartConfirmation.hidden) {
        pauseButton.disabled = false;
      }
    }
  });
  muteButton.addEventListener("click", () => {
    handlers.onMuteChange(!muted);
  });
  skipButton.addEventListener("click", handlers.onSkip);
  restartButton.addEventListener("click", () => {
    void showRestartConfirmation();
  });
  endingRestart.addEventListener("click", () => {
    void showRestartConfirmation();
  });
  restartCancel.addEventListener("click", () => {
    void closeRestartConfirmation();
  });
  restartConfirm.addEventListener("click", async () => {
    restartConfirm.disabled = true;
    restartCancel.disabled = true;
    try {
      await handlers.onRestart();
    } catch {
      restartConfirm.disabled = false;
      restartCancel.disabled = false;
    }
  });
  return shell;
}

function formatVerseReference(verseKey: string): string {
  const match = /^john9:(\d+)$/.exec(verseKey);
  return match === null ? verseKey : `約翰福音 9:${match[1]}`;
}

function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Platform shell is missing ${selector}.`);
  }
  return element;
}
