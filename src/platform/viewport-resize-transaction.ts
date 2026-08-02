import type { GameViewportSize } from "./responsive-game-size.ts";

export interface ViewportResizeTransaction {
  readonly pending: GameViewportSize | null;
  queue(size: GameViewportSize): boolean;
  flush(): boolean;
  cancel(): void;
}

export function createViewportResizeTransaction(options: Readonly<{
  isReady: () => boolean;
  apply: (size: GameViewportSize) => void;
}>): ViewportResizeTransaction {
  let pending: GameViewportSize | null = null;
  let cancelled = false;

  const flush = (): boolean => {
    if (cancelled || pending === null || !options.isReady()) {
      return false;
    }
    const applying = pending;
    options.apply(applying);
    if (pending === applying) {
      pending = null;
    }
    return true;
  };

  return {
    get pending() {
      return pending === null ? null : { ...pending };
    },
    queue: (size) => {
      if (cancelled) {
        return false;
      }
      pending = { ...size };
      return flush();
    },
    flush,
    cancel: () => {
      cancelled = true;
      pending = null;
    },
  };
}
