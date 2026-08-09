import {
  PhaserSequenceAdapter,
  type PhaserSequenceAdapterConfig,
} from "@sonic74129/sequence-runtime";

import { failUnsupportedOperation } from "./operation-errors.js";
import {
  DIALOGUE_BY_BEAT,
  STAGE_GOAL_BY_BEAT,
  type CanonicalDialogueLine,
  type CanonicalFinalState,
  type CanonicalStageGoal,
} from "./story-contracts.ts";

export type SliceFinalState = CanonicalFinalState;
export type SliceDialogueLine = CanonicalDialogueLine;

export interface SliceSequenceScene {
  setMovementEnabled(enabled: boolean): void;
  focusAnchor(anchorId: string): void;
  setActorPose(actorId: string, pose: string): void;
  setActorVisible(actorId: string, visible: boolean): void;
  followActorPath(
    pathId: string,
    actorId: string,
    signal: AbortSignal,
  ): Promise<void>;
  escortActorToAnchor(
    pathId: string,
    actorId: string,
    playerArrivalAnchorId: string,
    signal: AbortSignal,
    setNavigationHint: (message: string | null) => void,
  ): Promise<void>;
  followCameraPath(pathId: string, signal: AbortSignal): Promise<void>;
  applyFinalState(state: SliceFinalState, signal: AbortSignal): Promise<void>;
}

export interface SliceSequenceUi {
  setOverlay(visible: boolean, blocking?: boolean): void;
  setNavigationHint(message: string | null): void;
  presentDialogue(
    beatId: string,
    lines: readonly SliceDialogueLine[],
    signal: AbortSignal,
  ): Promise<void>;
  applyFinalState(
    state: SliceFinalState,
    goal: CanonicalStageGoal,
  ): void;
  setHandoff(status: "completed" | "skipped"): void;
}

export interface SliceSequenceContext {
  readonly scene: SliceSequenceScene;
  readonly ui: SliceSequenceUi;
  readonly applyLogicalFinalState?: (
    state: SliceFinalState,
    signal: AbortSignal,
  ) => void | Promise<void>;
}

export interface SliceSequenceControls {
  readonly subscribeSkip: (listener: () => void) => () => void;
  readonly acquireInputLock: () => () => void;
}

function abortError(): Error {
  const error = new Error("Sequence operation aborted");
  error.name = "AbortError";
  return error;
}

function requirePayloadRecord(
  command: string,
  payload: unknown,
): Readonly<Record<string, unknown>> {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new TypeError(`${command} requires an object payload.`);
  }
  return payload as Readonly<Record<string, unknown>>;
}

function requireString(
  command: string,
  payload: Readonly<Record<string, unknown>>,
  key: string,
): string {
  const value = payload[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${command}.${key} must be a non-empty string.`);
  }
  return value;
}

function requireBoolean(
  command: string,
  payload: Readonly<Record<string, unknown>>,
  key: string,
): boolean {
  const value = payload[key];
  if (typeof value !== "boolean") {
    throw new TypeError(`${command}.${key} must be a boolean.`);
  }
  return value;
}

function requireStringArray(
  command: string,
  payload: Readonly<Record<string, unknown>>,
  key: string,
): readonly string[] {
  const value = payload[key];
  if (
    !Array.isArray(value) ||
    !value.every((entry) => typeof entry === "string" && entry.length > 0)
  ) {
    throw new TypeError(`${command}.${key} must be an array of strings.`);
  }
  return value;
}

export function bindStorySequence<TContext, TFinalState>(
  config: PhaserSequenceAdapterConfig<TContext, TFinalState>,
): PhaserSequenceAdapter<TContext, TFinalState> {
  return new PhaserSequenceAdapter(config);
}

export function createSliceSequenceAdapter(
  context: SliceSequenceContext,
  controls: SliceSequenceControls,
): PhaserSequenceAdapter<SliceSequenceContext, SliceFinalState> {
  let releaseSdkInputLock: (() => void) | undefined;
  return bindStorySequence({
    context,
    executeCommand: async (command, payload, target, signal) => {
      if (signal.aborted) {
        throw abortError();
      }
      const record = requirePayloadRecord(command, payload);
      switch (command) {
        case "focus-camera":
          target.scene.focusAnchor(requireString(command, record, "anchorId"));
          return;
        case "set-actor-pose":
          target.scene.setActorPose(
            requireString(command, record, "actorId"),
            requireString(command, record, "pose"),
          );
          return;
        case "set-actor-visible":
          target.scene.setActorVisible(
            requireString(command, record, "actorId"),
            requireBoolean(command, record, "visible"),
          );
          return;
        case "actor-follow-path":
          await Promise.all(
            [
              requireString(command, record, "primaryActorId"),
              ...requireStringArray(
                command,
                record,
                "participantActorIds",
              ),
            ].map((actorId) =>
              target.scene.followActorPath(
                requireString(command, record, "pathId"),
                actorId,
                signal,
              ),
            ),
          );
          return;
        case "escort-actor-to-anchor":
          try {
            await target.scene.escortActorToAnchor(
              requireString(command, record, "pathId"),
              requireString(command, record, "actorId"),
              requireString(command, record, "playerArrivalAnchorId"),
              signal,
              (message) => target.ui.setNavigationHint(message),
            );
          } finally {
            target.ui.setNavigationHint(null);
          }
          return;
        case "camera-follow-path":
          await target.scene.followCameraPath(
            requireString(command, record, "pathId"),
            signal,
          );
          return;
        case "present-scripture-segments": {
          const beatId = requireString(command, record, "beatId");
          const lines = DIALOGUE_BY_BEAT[beatId];
          if (lines === undefined) {
            throw new RangeError(`No canonical dialogue exists for ${beatId}.`);
          }
          target.ui.setOverlay(true, true);
          try {
            await target.ui.presentDialogue(beatId, lines, signal);
          } finally {
            target.ui.setOverlay(false);
          }
          return;
        }
        default:
          failUnsupportedOperation(`sequence.command:${command}`);
      }
    },
    applyFinalState: async (state, target, signal) => {
      if (signal.aborted) {
        throw abortError();
      }
      await target.scene.applyFinalState(state, signal);
      if (signal.aborted) {
        throw abortError();
      }
      const goal = STAGE_GOAL_BY_BEAT[state.beatId];
      if (goal === undefined) {
        throw new RangeError(`No stage goal exists for ${state.beatId}.`);
      }
      target.ui.applyFinalState(state, goal);
      await target.applyLogicalFinalState?.(state, signal);
    },
    handoff: (status, target, signal) => {
      if (signal.aborted) {
        throw abortError();
      }
      target.ui.setHandoff(status);
    },
    setInputEnabled: (enabled, target) => {
      if (!enabled && releaseSdkInputLock === undefined) {
        releaseSdkInputLock = controls.acquireInputLock();
      } else if (enabled && releaseSdkInputLock !== undefined) {
        releaseSdkInputLock();
        releaseSdkInputLock = undefined;
      }
      target.scene.setMovementEnabled(enabled);
    },
    subscribeSkip: (listener) => controls.subscribeSkip(listener),
    isUiBlocking: () => false,
  });
}
