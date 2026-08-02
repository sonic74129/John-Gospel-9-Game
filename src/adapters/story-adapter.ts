import type { StoryEngine } from "@sonic74129/story-runtime";

import storyConfig from "../story/story.config.json";
import {
  GRAYBOX_SHELL_MODE,
  GRAYBOX_STORY_STATUS,
  failUnwiredOperation,
} from "./runtime-mode.js";

export const STORY_METADATA = Object.freeze({
  id: storyConfig.id,
  title: storyConfig.title,
  language: storyConfig.language,
  playerRole: Object.freeze({
    type: storyConfig.playerRole.type,
    hasDialogue: storyConfig.playerRole.hasDialogue,
    mayChangeScriptureOutcome:
      storyConfig.playerRole.mayChangeScriptureOutcome,
    mayControlJesus: storyConfig.playerRole.mayControlJesus,
    mayCauseMiracle: storyConfig.playerRole.mayCauseMiracle,
  }),
});

export interface StoryRuntimeBinding<TState, TEvent> {
  readonly mode: "story";
  readonly engine: StoryEngine<TState, TEvent>;
}

export interface GrayboxStoryRuntime {
  readonly mode: typeof GRAYBOX_SHELL_MODE;
  readonly wired: false;
  readonly completed: false;
  advance(event: unknown): never;
}

export function bindStoryRuntime<TState, TEvent>(
  engine: StoryEngine<TState, TEvent>,
): StoryRuntimeBinding<TState, TEvent> {
  return Object.freeze({ mode: "story", engine });
}

export function createGrayboxStoryRuntime(): GrayboxStoryRuntime {
  return Object.freeze({
    ...GRAYBOX_STORY_STATUS,
    advance: () => failUnwiredOperation("story.advance"),
  });
}
