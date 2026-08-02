import {
  PhaserSequenceAdapter,
  type PhaserSequenceAdapterConfig,
} from "@sonic74129/sequence-runtime";

import { failUnwiredOperation } from "./runtime-mode.js";

export type StorySequenceBinding<TContext, TFinalState> = Pick<
  PhaserSequenceAdapterConfig<TContext, TFinalState>,
  "executeCommand" | "applyFinalState" | "handoff"
>;

export function bindStorySequence<TContext, TFinalState>(
  config: PhaserSequenceAdapterConfig<TContext, TFinalState>,
): PhaserSequenceAdapter<TContext, TFinalState> {
  return new PhaserSequenceAdapter(config);
}

export interface GrayboxSequenceControls<TContext> {
  readonly setInputEnabled: (enabled: boolean, context: TContext) => void;
  readonly subscribeSkip: (
    listener: () => void,
    context: TContext,
  ) => () => void;
  readonly isUiBlocking: (context: TContext) => boolean;
}

export function createGrayboxSequenceAdapter<TContext, TFinalState>(
  context: TContext,
  controls: GrayboxSequenceControls<TContext>,
): PhaserSequenceAdapter<TContext, TFinalState> {
  return bindStorySequence({
    context,
    executeCommand: (command) =>
      failUnwiredOperation(`sequence.command:${command}`),
    applyFinalState: () => failUnwiredOperation("sequence.final-state"),
    handoff: () => failUnwiredOperation("sequence.handoff"),
    ...controls,
  });
}
