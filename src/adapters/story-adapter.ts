import { StoryEngine } from "@sonic74129/story-runtime";

import storyConfig from "../story/story.config.json";

export interface PlatformStoryState {
  readonly storyId: string;
  readonly completedBeatIds: readonly string[];
}

export type PlatformStoryEvent = Readonly<{ type: "platform:start" }>;

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

export function createStoryRuntime(): StoryEngine<
  PlatformStoryState,
  PlatformStoryEvent
> {
  return new StoryEngine({
    definition: {
      initialState: Object.freeze({
        storyId: STORY_METADATA.id,
        completedBeatIds: Object.freeze([]) as readonly string[],
      }),
      beats: [],
    },
    reduce: (state) => state,
  });
}
