import type {
  SliceDialogueLine,
  SliceFinalState,
  SliceSequenceUi,
} from "../adapters/sequence-adapter.ts";
import { APPROVED_STUDY_QUESTIONS } from "./ending-study.ts";

export interface AppShellHandlers {
  readonly onStart: (mode: "new" | "continue") => void;
  readonly onRestart: () => Promise<void>;
  readonly onPauseChange: (paused: boolean) => Promise<void>;
  readonly onMuteChange: (muted: boolean) => void;
  readonly onSubtitleChange: (visible: boolean) => void;
  readonly onSkip: () => void;
}

export interface AppShell extends SliceSequenceUi {
  readonly gameContainer: HTMLElement;
  setStarted(): void;
  setPaused(paused: boolean): void;
  setMuted(muted: boolean): void;
  setSubtitles(visible: boolean): void;
  setCompleted(): void;
  setNavigationHint(message: string | null): void;
  setStatus(message: string, isError?: boolean): void;
  setPersistenceWarning(message: string | null): void;
  setDeveloperFixture(fixtureId: string | null): void;
  snapshotAppliedState(): SliceFinalState | null;
}

function abortError(): Error {
  const error = new Error("Sequence operation aborted");
  error.name = "AbortError";
  return error;
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
          <p class="eyebrow">約翰福音 9:1–41</p>
          <h1>生來瞎眼的人</h1>
        </div>
        <div class="status-stack">
          <p class="platform-status" data-status role="status">準備開始</p>
          <p class="persistence-warning" data-persistence-warning role="alert" hidden></p>
          <p class="developer-fixture" data-developer-fixture hidden></p>
        </div>
      </header>
      <section class="game-frame" aria-label="遊戲區域">
        <div class="game-container" data-game-container></div>
        <div class="slice-hud" data-slice-hud>
          <p class="license-notice" data-license-notice>經文待授權／審核</p>
          <p class="stage-goal" data-stage-goal>目標：留心路旁</p>
        </div>
        <p class="navigation-hint" data-navigation-hint role="status" aria-live="polite" hidden></p>
        <div class="start-screen" data-start-screen>
          <p class="start-kicker">約翰福音第九章 · 完整故事</p>
          <h2>以觀察者的身分進入故事</h2>
          <p>使用方向鍵、WASD，或點按地面移動；Space 或點按人物互動。</p>
          <p class="review-warning">本故事不顯示未授權逐字經文，只呈現安全的段落識別與審核狀態。</p>
          <button class="primary-action" type="button" data-continue ${options.hasSave ? "" : "hidden"}>繼續故事</button>
          <button class="primary-action" type="button" data-start ${options.hasSave ? "hidden" : ""}>開始</button>
          <button type="button" data-start-restart ${options.hasSave ? "" : "hidden"}>重新開始</button>
        </div>
        <section class="dialogue-panel" data-dialogue hidden aria-modal="true" role="dialog" aria-labelledby="dialogue-speaker">
          <header>
            <div>
              <p class="dialogue-source" data-dialogue-source></p>
              <h2 id="dialogue-speaker" data-dialogue-speaker></h2>
            </div>
            <p class="dialogue-progress" data-dialogue-progress></p>
          </header>
          <div class="dialogue-placeholder" data-dialogue-placeholder></div>
          <dl class="dialogue-metadata" data-dialogue-metadata></dl>
          <footer>
            <span class="license-notice">經文待授權／審核</span>
            <button type="button" data-dialogue-next>下一段</button>
          </footer>
        </section>
        <aside class="testimony-journal" data-testimony-journal aria-label="見證紀錄">
          <h2>見證紀錄</h2>
          <div data-testimony-list><p>尚未記錄</p></div>
        </aside>
        <section class="recall-card" data-recall hidden aria-live="polite">
          <div>
            <p class="dialogue-source">S2 · 遊戲提示 · 不計分</p>
            <h2>回想已揭示的見證</h2>
            <p data-recall-ids></p>
          </div>
          <button type="button" data-recall-dismiss>關閉</button>
        </section>
        <div class="subtitle-panel" data-subtitle aria-live="polite">
          私人灰盒：只顯示段落識別，不顯示未授權經文文字。
        </div>
        <section class="ending-panel" data-ending hidden aria-modal="true" role="dialog" aria-labelledby="ending-title">
          <p class="dialogue-source">故事完成 · 約翰福音 9:1–41</p>
          <h2 id="ending-title">已完成生來瞎眼的人的故事</h2>
          <p>以下問題是可選查考，不計分、不影響完成狀態，也不提供遊戲編寫的神學答案。</p>
          <div class="study-questions" data-study-questions></div>
          <p class="license-notice">經文待授權／審核</p>
          <button type="button" data-ending-restart>重新開始</button>
        </section>
        <section class="restart-confirmation" data-restart-confirmation hidden aria-modal="true" role="dialog" aria-labelledby="restart-title">
          <h2 id="restart-title">確定重新開始？</h2>
          <p>這會清除本故事的正式進度與存檔，然後從 B01 開始。</p>
          <div>
            <button type="button" data-restart-cancel>保留進度</button>
            <button type="button" data-restart-confirm>清除並重新開始</button>
          </div>
        </section>
      </section>
      <nav class="game-controls" data-game-controls aria-label="遊戲控制">
        <button type="button" data-pause aria-pressed="false" disabled>暫停</button>
        <button type="button" data-mute aria-pressed="false" disabled>靜音</button>
        <button type="button" data-subtitles aria-pressed="true" disabled>字幕：開</button>
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
  const subtitleButton = requireElement<HTMLButtonElement>(
    root,
    "[data-subtitles]",
  );
  const skipButton = requireElement<HTMLButtonElement>(root, "[data-skip]");
  const restartButton = requireElement<HTMLButtonElement>(
    root,
    "[data-restart]",
  );
  const subtitlePanel = requireElement<HTMLElement>(root, "[data-subtitle]");
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
  const fixture = requireElement<HTMLElement>(root, "[data-developer-fixture]");
  const dialogue = requireElement<HTMLElement>(root, "[data-dialogue]");
  const dialogueSpeaker = requireElement<HTMLElement>(
    root,
    "[data-dialogue-speaker]",
  );
  const dialogueSource = requireElement<HTMLElement>(
    root,
    "[data-dialogue-source]",
  );
  const dialogueProgress = requireElement<HTMLElement>(
    root,
    "[data-dialogue-progress]",
  );
  const dialoguePlaceholder = requireElement<HTMLElement>(
    root,
    "[data-dialogue-placeholder]",
  );
  const dialogueMetadata = requireElement<HTMLElement>(
    root,
    "[data-dialogue-metadata]",
  );
  const dialogueNext = requireElement<HTMLButtonElement>(
    root,
    "[data-dialogue-next]",
  );
  const testimonyList = requireElement<HTMLElement>(
    root,
    "[data-testimony-list]",
  );
  const recall = requireElement<HTMLElement>(root, "[data-recall]");
  const recallIds = requireElement<HTMLElement>(root, "[data-recall-ids]");
  const recallDismiss = requireElement<HTMLButtonElement>(
    root,
    "[data-recall-dismiss]",
  );
  const ending = requireElement<HTMLElement>(root, "[data-ending]");
  const endingRestart = requireElement<HTMLButtonElement>(
    root,
    "[data-ending-restart]",
  );
  const studyQuestions = requireElement<HTMLElement>(
    root,
    "[data-study-questions]",
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
  let subtitles = true;
  let appliedState: SliceFinalState | null = null;
  let completed = false;
  let started = false;
  let resumeAfterRestartCancel = false;
  let restartButtonStates = new Map<HTMLButtonElement, boolean>();

  studyQuestions.replaceChildren(
    ...APPROVED_STUDY_QUESTIONS.map((question) => {
      const article = document.createElement("article");
      article.dataset.studyQuestionId = question.id;
      article.dataset.optional = String(question.optional);
      const prompt = document.createElement("h3");
      prompt.textContent = question.prompt;
      const references = document.createElement("p");
      references.className = "study-verse-keys";
      references.textContent = question.verseKeys.join(" · ");
      for (const verseKey of question.verseKeys) {
        article.dataset.verseKeys = [
          article.dataset.verseKeys,
          verseKey,
        ]
          .filter(Boolean)
          .join(" ");
      }
      article.append(prompt, references);
      return article;
    }),
  );

  const restartOutsideRegions = [
    gameContainer,
    startScreen,
    dialogue,
    recall,
    ending,
    gameControls,
  ];
  const restartOutsideButtons = [
    startButton,
    continueButton,
    startRestartButton,
    pauseButton,
    muteButton,
    subtitleButton,
    skipButton,
    restartButton,
    dialogueNext,
    recallDismiss,
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
      dialogue.dataset.speakerId = line.speakerId;
      dialogue.dataset.verseKey = line.verseKey;
      dialogue.dataset.segmentId = line.segmentId;
      dialogue.dataset.sourceLevel = line.sourceLevel;
      dialogueSpeaker.textContent = line.speakerId;
      dialogueSource.textContent = `${line.sourceLevel} · ${line.sourceLabel}`;
      dialogueProgress.textContent = `${index + 1} / ${lines.length}`;
      dialoguePlaceholder.textContent =
        `段落識別：${line.segmentId}（逐字內容尚未獲授權／審核）`;
      dialogueMetadata.replaceChildren(
        metadataRow("Speaker", line.speakerId),
        metadataRow("Verse key", line.verseKey),
        metadataRow("Segment ID", line.segmentId),
        metadataRow("Source", `${line.sourceLevel} / ${line.sourceLabel}`),
      );
      dialogueNext.textContent =
        index === lines.length - 1 ? "繼續" : "下一段";
      dialogueNext.disabled = paused;
    };
    renderLine();

    return new Promise<void>((resolve, reject) => {
      const cleanup = (): void => {
        dialogueNext.removeEventListener("click", onNext);
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
      dialogueNext.addEventListener("click", onNext);
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
        subtitleButton,
        skipButton,
        restartButton,
      ]) {
        button.disabled = false;
      }
      shell.setStatus("B01–B19 故事運行中");
    },
    setPaused: (value) => {
      paused = value;
      pauseButton.setAttribute("aria-pressed", String(value));
      pauseButton.textContent = value ? "繼續" : "暫停";
      dialogueNext.disabled = value;
      skipButton.disabled = value;
      shell.setStatus(
        value ? "遊戲已暫停" : completed ? "故事已完成" : "B01–B19 故事運行中",
      );
    },
    setMuted: (value) => {
      muted = value;
      muteButton.setAttribute("aria-pressed", String(value));
      muteButton.textContent = value ? "取消靜音" : "靜音";
    },
    setSubtitles: (value) => {
      subtitles = value;
      subtitleButton.setAttribute("aria-pressed", String(value));
      subtitleButton.textContent = value ? "字幕：開" : "字幕：關";
      subtitlePanel.hidden = !value;
    },
    setCompleted: () => {
      completed = true;
      paused = false;
      dialogue.hidden = true;
      recall.hidden = true;
      ending.hidden = false;
      ending.dataset.blocking = "true";
      pauseButton.disabled = true;
      skipButton.disabled = true;
      restartButton.disabled = false;
      shell.setStatus("故事已完成");
      shell.setNavigationHint(null);
    },
    setNavigationHint: (message) => {
      navigationHint.hidden = message === null;
      navigationHint.textContent = message ?? "";
    },
    setStatus: (message, isError = false) => {
      status.textContent = message;
      status.dataset.error = String(isError);
    },
    setPersistenceWarning: (message) => {
      persistenceWarning.hidden = message === null;
      persistenceWarning.textContent =
        message === null ? "" : `進度同步警告：${message}`;
    },
    setDeveloperFixture: (fixtureId) => {
      fixture.hidden = fixtureId === null;
      fixture.textContent =
        fixtureId === null ? "" : `DEV FIXTURE · ${fixtureId}`;
    },
    snapshotAppliedState: () =>
      appliedState === null ? null : structuredClone(appliedState),
    setOverlay: (visible, blocking = visible) => {
      dialogue.dataset.sdkOverlayVisible = String(visible);
      dialogue.dataset.sdkInteractionBlocked = String(visible && blocking);
    },
    presentDialogue: (_beatId, lines, signal) => presentLines(lines, signal),
    applyFinalState: (state, stageGoal, testimony, optionalRecall) => {
      appliedState = structuredClone(state);
      goal.textContent = `目標：${stageGoal.description}`;
      goal.dataset.goalId = stageGoal.id;
      testimonyList.replaceChildren(
        ...(testimony.length === 0
          ? [paragraph("尚未記錄")]
          : testimony.map((entry) => {
              const card = document.createElement("article");
              card.className = "testimony-card";
              card.dataset.testimonyId = entry.id;
              const heading = document.createElement("h3");
              heading.textContent = entry.id;
              const metadata = document.createElement("p");
              metadata.textContent =
                `${entry.sourceLevel} · ${entry.category} · ${entry.verseKeys.join(", ")}`;
              card.append(heading, metadata);
              return card;
            })),
      );
      if (optionalRecall !== undefined) {
        recall.hidden = false;
        recall.dataset.recallId = optionalRecall.id;
        recall.dataset.blocking = String(optionalRecall.blocking);
        recall.dataset.score = String(optionalRecall.score);
        recallIds.textContent = optionalRecall.focusTestimonyIds.join(" · ");
      } else {
        recall.hidden = true;
        delete recall.dataset.recallId;
        delete recall.dataset.blocking;
        delete recall.dataset.score;
        recallIds.textContent = "";
      }
      shell.setStatus(
        state.beatId === "b19"
          ? "B19 已套用確定最終狀態"
          : `${state.beatId.toUpperCase()} 已套用確定最終狀態`,
      );
    },
    setHandoff: (sequenceStatus) => {
      dialogue.dataset.lastHandoff = sequenceStatus;
    },
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
  subtitleButton.addEventListener("click", () => {
    const next = !subtitles;
    shell.setSubtitles(next);
    handlers.onSubtitleChange(next);
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
  recallDismiss.addEventListener("click", () => {
    recall.hidden = true;
  });

  return shell;
}

function metadataRow(label: string, value: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const term = document.createElement("dt");
  term.textContent = label;
  const detail = document.createElement("dd");
  detail.textContent = value;
  fragment.append(term, detail);
  return fragment;
}

function paragraph(text: string): HTMLParagraphElement {
  const element = document.createElement("p");
  element.textContent = text;
  return element;
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
