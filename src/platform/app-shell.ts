export interface AppShellHandlers {
  readonly onStart: () => void;
  readonly onPauseChange: (paused: boolean) => void;
  readonly onMuteChange: (muted: boolean) => void;
  readonly onSubtitleChange: (visible: boolean) => void;
}

export interface AppShell {
  readonly gameContainer: HTMLElement;
  setStarted(): void;
  setPaused(paused: boolean): void;
  setMuted(muted: boolean): void;
  setSubtitles(visible: boolean): void;
  setStatus(message: string, isError?: boolean): void;
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
        <p class="platform-status" data-status role="status">準備開始</p>
      </header>
      <section class="game-frame" aria-label="遊戲區域">
        <div class="game-container" data-game-container></div>
        <div class="start-screen" data-start-screen>
          <p class="start-kicker">地圖探索灰盒</p>
          <h2>以觀察者的身分進入故事</h2>
          <p>使用方向鍵、WASD，或點按地面移動。故事內容將由獨立資料契約載入。</p>
          <button class="primary-action" type="button" data-start>開始</button>
        </div>
        <div class="subtitle-panel" data-subtitle aria-live="polite">
          平台灰盒已就緒；經文與對話仍由故事層管理。
        </div>
      </section>
      <nav class="game-controls" data-game-controls aria-label="遊戲控制">
        <button type="button" data-pause aria-pressed="false" disabled>暫停</button>
        <button type="button" data-mute aria-pressed="false" disabled>靜音</button>
        <button type="button" data-subtitles aria-pressed="true" disabled>字幕：開</button>
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
  const subtitlePanel = requireElement<HTMLElement>(root, "[data-subtitle]");
  const status = requireElement<HTMLElement>(root, "[data-status]");

  let paused = false;
  let muted = false;
  let subtitles = true;

  const shell: AppShell = {
    gameContainer,
    setStarted: () => {
      startScreen.hidden = true;
      for (const button of [pauseButton, muteButton, subtitleButton]) {
        button.disabled = false;
      }
      shell.setStatus("灰盒運行中");
    },
    setPaused: (value) => {
      paused = value;
      pauseButton.setAttribute("aria-pressed", String(value));
      pauseButton.textContent = value ? "繼續" : "暫停";
      shell.setStatus(value ? "遊戲已暫停" : "灰盒運行中");
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

  return shell;
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
