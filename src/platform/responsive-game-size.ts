export interface GameViewportSize {
  readonly width: number;
  readonly height: number;
}

interface MeasurableElement {
  getBoundingClientRect(): Readonly<{ width: number; height: number }>;
}

interface ResizeObserverPort {
  observe(target: MeasurableElement): void;
  disconnect(): void;
}

interface ResizeEventTargetPort {
  addEventListener(
    type: "resize" | "orientationchange",
    listener: () => void,
  ): void;
  removeEventListener(
    type: "resize" | "orientationchange",
    listener: () => void,
  ): void;
}

export interface ResponsiveGameSizeController {
  readonly active: boolean;
  readonly suspended: boolean;
  readonly size: GameViewportSize | null;
  start(): void;
  refresh(): void;
  suspend(): void;
  resume(): void;
  dispose(): void;
}

interface ResponsiveGameSizeOptions {
  readonly container: MeasurableElement;
  readonly resize: (size: GameViewportSize) => void;
  readonly initialSize?: GameViewportSize;
  readonly createObserver?: (
    onResize: () => void,
  ) => ResizeObserverPort;
  readonly eventTarget?: ResizeEventTargetPort;
  readonly scheduleTask?: (callback: () => void) => number;
  readonly cancelTask?: (handle: number) => void;
}

export function measureGameViewport(
  container: MeasurableElement,
): GameViewportSize | null {
  const bounds = container.getBoundingClientRect();
  if (
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    return null;
  }
  return {
    width: Math.max(1, Math.round(bounds.width)),
    height: Math.max(1, Math.round(bounds.height)),
  };
}

export function requireGameViewport(
  container: MeasurableElement,
): GameViewportSize {
  const size = measureGameViewport(container);
  if (size === null) {
    throw new Error("The game container has no measurable viewport.");
  }
  return size;
}

export function createResponsiveGameSizeController(
  options: ResponsiveGameSizeOptions,
): ResponsiveGameSizeController {
  const scheduleTask =
    options.scheduleTask ??
    ((callback: () => void) => window.setTimeout(callback, 0));
  const cancelTask =
    options.cancelTask ??
    ((handle: number) => window.clearTimeout(handle));
  const createObserver =
    options.createObserver ??
    ((onResize: () => void): ResizeObserverPort => {
      const observer = new ResizeObserver(onResize);
      return {
        observe: (target) => observer.observe(target as Element),
        disconnect: () => observer.disconnect(),
      };
    });
  const eventTarget = options.eventTarget ?? window;

  let active = false;
  let suspended = false;
  let taskHandle: number | null = null;
  let size: GameViewportSize | null =
    options.initialSize === undefined ? null : { ...options.initialSize };
  let observer: ResizeObserverPort | null = null;

  const applyMeasuredSize = (force: boolean): void => {
    taskHandle = null;
    if (!active || suspended) {
      return;
    }
    const measured = measureGameViewport(options.container);
    if (
      measured === null ||
      (!force &&
        size?.width === measured.width &&
        size.height === measured.height)
    ) {
      return;
    }
    options.resize(measured);
    size = measured;
  };

  const applyScheduledSize = (): void => applyMeasuredSize(false);

  const scheduleRefresh = (): void => {
    if (!active || suspended || taskHandle !== null) {
      return;
    }
    taskHandle = scheduleTask(applyScheduledSize);
  };

  return {
    get active() {
      return active;
    },
    get suspended() {
      return suspended;
    },
    get size() {
      return size === null ? null : { ...size };
    },
    start: () => {
      if (active) {
        return;
      }
      active = true;
      observer = createObserver(scheduleRefresh);
      observer.observe(options.container);
      eventTarget.addEventListener("resize", scheduleRefresh);
      eventTarget.addEventListener("orientationchange", scheduleRefresh);
      applyMeasuredSize(false);
    },
    refresh: scheduleRefresh,
    suspend: () => {
      if (!active || suspended) {
        return;
      }
      suspended = true;
      if (taskHandle !== null) {
        cancelTask(taskHandle);
        taskHandle = null;
      }
    },
    resume: () => {
      if (!active || !suspended) {
        return;
      }
      suspended = false;
      applyMeasuredSize(true);
    },
    dispose: () => {
      if (!active) {
        return;
      }
      active = false;
      suspended = false;
      if (taskHandle !== null) {
        cancelTask(taskHandle);
        taskHandle = null;
      }
      observer?.disconnect();
      observer = null;
      eventTarget.removeEventListener("resize", scheduleRefresh);
      eventTarget.removeEventListener("orientationchange", scheduleRefresh);
    },
  };
}
