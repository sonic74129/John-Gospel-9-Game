import type {
  SliceDialogueLine,
  SliceFinalState,
  SliceSequenceUi,
} from "../adapters/sequence-adapter.ts";

export interface AppShellHandlers {
  readonly onStart: () => void;
  readonly onPauseChange: (paused: boolean) => void;
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
  setStatus(message: string, isError?: boolean): void;
  setDeveloperFixture(fixtureId: string | null): void;
}

function abortError(): Error {
  const error = new Error("Sequence operation aborted");
  error.name = "AbortError";
  return error;
}

export function createAppShell(
  root: HTMLElement,
  handlers: AppShellHandlers,
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
          <p class="developer-fixture" data-developer-fixture hidden></p>
        </div>
      </header>
      <section class="game-frame" aria-label="遊戲區域">
        <div class="game-container" data-game-container></div>
        <div class="slice-hud" data-slice-hud>
          <p class="license-notice" data-license-notice>經文待授權／審核</p>
          <p class="stage-goal" data-stage-goal>目標：留心路旁</p>
        </div>
        <div class="start-screen" data-start-screen>
          <p class="start-kicker">私人開發灰盒 · B01–B07</p>
          <h2>以觀察者的身分進入故事</h2>
          <p>使用方向鍵、WASD，或點按地面移動；Space 或點按人物互動。</p>
          <p class="review-warning">本切片不顯示未授權逐字經文，只呈現安全的段落識別與審核狀態。</p>
          <button class="primary-action" type="button" data-start>開始</button>
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
          <section class="stress-metadata" data-stress-metadata hidden>
            <h3>開發壓力資料</h3>
            <p>音樂狀態：silence · 對話模式：blocking · 經文內容：withheld</p>
            <p>此長版面只驗證窄屏捲動、按鈕可達性、來源標記與安全 placeholder；不包含逐字經文。</p>
            <div data-stress-testimony></div>
          </section>
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
      </section>
      <nav class="game-controls" data-game-controls aria-label="遊戲控制">
        <button type="button" data-pause aria-pressed="false" disabled>暫停</button>
        <button type="button" data-mute aria-pressed="false" disabled>靜音</button>
        <button type="button" data-subtitles aria-pressed="true" disabled>字幕：開</button>
        <button type="button" data-skip disabled>跳過目前演出</button>
      </nav>
    </article>
  `;

  const gameContainer = requireElement<HTMLElement>(
    root,
    "[data-game-container]",
  );
  const startScreen = requireElement<HTMLElement>(root, "[data-start-screen]");
  const startButton = requireElement<HTMLButtonElement>(root, "[data-start]");
  const pauseButton = requireElement<HTMLButtonElement>(root, "[data-pause]");
  const muteButton = requireElement<HTMLButtonElement>(root, "[data-mute]");
  const subtitleButton = requireElement<HTMLButtonElement>(
    root,
    "[data-subtitles]",
  );
  const skipButton = requireElement<HTMLButtonElement>(root, "[data-skip]");
  const subtitlePanel = requireElement<HTMLElement>(root, "[data-subtitle]");
  const status = requireElement<HTMLElement>(root, "[data-status]");
  const goal = requireElement<HTMLElement>(root, "[data-stage-goal]");
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
  const stressMetadata = requireElement<HTMLElement>(
    root,
    "[data-stress-metadata]",
  );
  const stressTestimony = requireElement<HTMLElement>(
    root,
    "[data-stress-testimony]",
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

  let paused = false;
  let muted = false;
  let subtitles = true;

  const presentLines = (
    lines: readonly SliceDialogueLine[],
    signal: AbortSignal,
    stress: boolean,
  ): Promise<void> => {
    if (signal.aborted) {
      return Promise.reject(abortError());
    }
    dialogue.hidden = false;
    dialogue.dataset.blocking = "true";
    stressMetadata.hidden = !stress;
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
        stressMetadata.hidden = true;
        stressTestimony.replaceChildren();
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
      startScreen.hidden = true;
      for (const button of [
        pauseButton,
        muteButton,
        subtitleButton,
        skipButton,
      ]) {
        button.disabled = false;
      }
      shell.setStatus("B01–B07 切片運行中");
    },
    setPaused: (value) => {
      paused = value;
      pauseButton.setAttribute("aria-pressed", String(value));
      pauseButton.textContent = value ? "繼續" : "暫停";
      dialogueNext.disabled = value;
      skipButton.disabled = value;
      shell.setStatus(value ? "遊戲已暫停" : "B01–B07 切片運行中");
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
    setStatus: (message, isError = false) => {
      status.textContent = message;
      status.dataset.error = String(isError);
    },
    setDeveloperFixture: (fixtureId) => {
      fixture.hidden = fixtureId === null;
      fixture.textContent =
        fixtureId === null ? "" : `DEV FIXTURE · ${fixtureId}`;
    },
    setOverlay: (visible, blocking = visible) => {
      dialogue.dataset.sdkOverlayVisible = String(visible);
      dialogue.dataset.sdkInteractionBlocked = String(visible && blocking);
    },
    presentDialogue: (_beatId, lines, signal) =>
      presentLines(lines, signal, false),
    presentStressFixture: (lines, testimony, signal) => {
      stressTestimony.replaceChildren(
        ...testimony.map((entry) => {
          const card = document.createElement("article");
          card.className = "stress-testimony-card";
          card.dataset.testimonyId = entry.id;
          const heading = document.createElement("h4");
          heading.textContent = entry.id;
          const metadata = document.createElement("p");
          metadata.textContent =
            `${entry.sourceLevel} · ${entry.category} · ${entry.segmentIds.join(", ")}`;
          card.append(heading, metadata);
          return card;
        }),
      );
      return presentLines(lines, signal, true);
    },
    applyFinalState: (state, stageGoal, testimony, optionalRecall) => {
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
      }
      shell.setStatus(
        state.beatId === "b07"
          ? "B01–B07 已完成；B08–B19 尚未接線"
          : `${state.beatId.toUpperCase()} 已套用確定最終狀態`,
      );
    },
    setHandoff: (sequenceStatus) => {
      dialogue.dataset.lastHandoff = sequenceStatus;
    },
  };

  startButton.addEventListener("click", handlers.onStart, { once: true });
  pauseButton.addEventListener("click", () => {
    handlers.onPauseChange(!paused);
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
