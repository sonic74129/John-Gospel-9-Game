import type { StoryAction, StoryTrigger } from "@sonic74129/content-schema";
import type { SequenceDefinition } from "@sonic74129/sequence-runtime";

export interface CanonicalActor {
  readonly id: string;
  readonly label: string;
  readonly initialAnchorId: string;
}

export interface CanonicalProp {
  readonly id: string;
  readonly label: string;
  readonly initialAnchorId: string;
}

export interface CanonicalDialogueLine {
  readonly id: string;
  readonly beatId: string;
  readonly speakerId: string;
  readonly portraitSubjectId?: string;
  readonly portraitState?:
    | "blind"
    | "washing"
    | "seeing"
    | "worship"
    | "speaking";
  readonly verseKey: string;
  readonly segmentId: string;
  readonly sourceLevel: "S0";
  readonly sourceLabel: string;
  readonly exactText: string;
  readonly textSha256: string;
}

export interface CanonicalStageGoal {
  readonly id: string;
  readonly beatId: string;
  readonly description: string;
  readonly requiredBeatIds: readonly string[];
  readonly sourceLevel: string;
}

export interface CanonicalActorSnapshot {
  readonly visible: boolean;
  readonly anchorId: string;
  readonly pose: string;
  readonly label: string;
  readonly collisionEnabled: boolean;
}

export interface CanonicalFinalState {
  readonly id: string;
  readonly beatId: string;
  readonly actors: Readonly<Record<string, CanonicalActorSnapshot>>;
  readonly props: Readonly<{
    clay: Readonly<{
      visible: boolean;
      anchorId: string;
      state: string;
      collisionEnabled: boolean;
    }>;
  }>;
  readonly camera: Readonly<{
    anchorId: string;
    mode: string;
    transition: string;
  }>;
  readonly controls: Readonly<{
    playerActorId: string;
    movementEnabled: boolean;
    interactionEnabled: boolean;
    dialogueEnabled: boolean;
    locked: boolean;
  }>;
  readonly triggers: Readonly<{
    completedBeatIds: readonly string[];
    nextBeatId: string | null;
  }>;
  readonly music: Readonly<{
    cueId: string;
    playing: boolean;
    ducked: boolean;
  }>;
}

export interface CanonicalSequence
  extends SequenceDefinition<CanonicalFinalState> {
  readonly beatId: string;
  readonly cancellable: true;
  readonly skippable: true;
  readonly reentrant: false;
}

export interface CanonicalStoryBeat {
  readonly id: string;
  readonly order: number;
  readonly verseKeys: readonly string[];
  readonly verseIds: readonly string[];
  readonly sourceLevel: "scripture";
  readonly prerequisite: "story-start" | Readonly<{ beatCompleted: string }>;
  readonly trigger: StoryTrigger;
  readonly actions: readonly StoryAction[];
  readonly sequence: CanonicalSequence;
  readonly stageGoal: CanonicalStageGoal;
  readonly finalState: CanonicalFinalState;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasString(value: Readonly<Record<string, unknown>>, key: string): boolean {
  return typeof value[key] === "string";
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isCanonicalActor(value: unknown): value is CanonicalActor {
  return (
    isRecord(value) &&
    hasString(value, "id") &&
    hasString(value, "label") &&
    hasString(value, "initialAnchorId")
  );
}

function isCanonicalDialogueLine(value: unknown): value is CanonicalDialogueLine {
  return (
    isRecord(value) &&
    hasString(value, "id") &&
    hasString(value, "beatId") &&
    hasString(value, "speakerId") &&
    (value.portraitSubjectId === undefined ||
      typeof value.portraitSubjectId === "string") &&
    (value.portraitState === undefined ||
      ["blind", "washing", "seeing", "worship", "speaking"].includes(
        value.portraitState as string,
      )) &&
    hasString(value, "verseKey") &&
    hasString(value, "segmentId") &&
    value.sourceLevel === "S0" &&
    hasString(value, "sourceLabel") &&
    hasString(value, "exactText") &&
    hasString(value, "textSha256")
  );
}

function isCanonicalStageGoal(value: unknown): value is CanonicalStageGoal {
  return (
    isRecord(value) &&
    hasString(value, "id") &&
    hasString(value, "beatId") &&
    hasString(value, "description") &&
    isStringArray(value.requiredBeatIds) &&
    hasString(value, "sourceLevel")
  );
}

function isCanonicalActorSnapshot(
  value: unknown,
): value is CanonicalActorSnapshot {
  return (
    isRecord(value) &&
    typeof value.visible === "boolean" &&
    hasString(value, "anchorId") &&
    hasString(value, "pose") &&
    hasString(value, "label") &&
    typeof value.collisionEnabled === "boolean"
  );
}

function isCanonicalFinalState(value: unknown): value is CanonicalFinalState {
  if (
    !isRecord(value) ||
    !hasString(value, "id") ||
    !hasString(value, "beatId") ||
    !isRecord(value.actors) ||
    !Object.values(value.actors).every(isCanonicalActorSnapshot) ||
    !isRecord(value.props) ||
    !isRecord(value.props.clay) ||
    !isRecord(value.camera) ||
    !isRecord(value.controls) ||
    !isRecord(value.triggers) ||
    !isRecord(value.music)
  ) {
    return false;
  }
  return (
    typeof value.props.clay.visible === "boolean" &&
    hasString(value.props.clay, "anchorId") &&
    hasString(value.camera, "anchorId") &&
    hasString(value.controls, "playerActorId") &&
    typeof value.controls.movementEnabled === "boolean" &&
    isStringArray(value.triggers.completedBeatIds) &&
    (typeof value.triggers.nextBeatId === "string" ||
      value.triggers.nextBeatId === null) &&
    hasString(value.music, "cueId")
  );
}

function isStoryTrigger(value: unknown): value is StoryTrigger {
  if (!isRecord(value) || !hasString(value, "type")) {
    return false;
  }
  if (value.type === "event") {
    return hasString(value, "event");
  }
  if (value.type === "proximity") {
    return (
      hasString(value, "actorId") &&
      hasString(value, "targetId") &&
      typeof value.radius === "number"
    );
  }
  return value.type === "manual";
}

function isStoryAction(value: unknown): value is StoryAction {
  return isRecord(value) && hasString(value, "type");
}

function isCanonicalSequence(value: unknown): value is CanonicalSequence {
  return (
    isRecord(value) &&
    hasString(value, "id") &&
    hasString(value, "beatId") &&
    Array.isArray(value.steps) &&
    isCanonicalFinalState(value.finalState) &&
    value.cancellable === true &&
    value.skippable === true &&
    value.reentrant === false
  );
}

function isCanonicalStoryBeat(value: unknown): value is CanonicalStoryBeat {
  return (
    isRecord(value) &&
    hasString(value, "id") &&
    typeof value.order === "number" &&
    isStringArray(value.verseKeys) &&
    isStringArray(value.verseIds) &&
    value.sourceLevel === "scripture" &&
    isStoryTrigger(value.trigger) &&
    Array.isArray(value.actions) &&
    value.actions.every(isStoryAction) &&
    isCanonicalSequence(value.sequence) &&
    isCanonicalStageGoal(value.stageGoal) &&
    isCanonicalFinalState(value.finalState)
  );
}

function isArrayOf<T>(
  value: unknown,
  predicate: (entry: unknown) => entry is T,
): value is readonly T[] {
  return Array.isArray(value) && value.every(predicate);
}

function isRecordOf<T>(
  value: unknown,
  predicate: (entry: unknown) => entry is T,
): value is Readonly<Record<string, T>> {
  return isRecord(value) && Object.values(value).every(predicate);
}

function requireExport<T>(
  module: Readonly<Record<string, unknown>>,
  name: string,
  predicate: (value: unknown) => value is T,
): T {
  const value = module[name];
  if (!predicate(value)) {
    throw new TypeError(`Canonical story export ${name} has an invalid shape.`);
  }
  return value;
}

async function loadStoryModule(
  name: string,
): Promise<Readonly<Record<string, unknown>>> {
  const loaded: unknown = await import(`../story/${name}.ts`);
  if (!isRecord(loaded)) {
    throw new TypeError(`Canonical story module ${name} did not load.`);
  }
  return loaded;
}

const [
  actorsModule,
  beatsModule,
  completionModule,
  dialogueModule,
  stageGoalsModule,
] = await Promise.all([
  loadStoryModule("actors"),
  loadStoryModule("beats"),
  loadStoryModule("completion"),
  loadStoryModule("dialogue"),
  loadStoryModule("stage-goals"),
]);

export const ACTORS = requireExport(
  actorsModule,
  "ACTORS",
  (value): value is readonly CanonicalActor[] =>
    isArrayOf(value, isCanonicalActor),
);
export const PROPS = requireExport(
  actorsModule,
  "PROPS",
  (value): value is readonly CanonicalProp[] =>
    isArrayOf(value, isCanonicalActor),
);
export const STORY_BEATS = requireExport(
  beatsModule,
  "STORY_BEATS",
  (value): value is readonly CanonicalStoryBeat[] =>
    isArrayOf(value, isCanonicalStoryBeat),
);
export const FINAL_SNAPSHOTS = requireExport(
  completionModule,
  "FINAL_SNAPSHOTS",
  (value): value is Readonly<Record<string, CanonicalFinalState>> =>
    isRecordOf(value, isCanonicalFinalState),
);
export const DIALOGUE_BY_BEAT = requireExport(
  dialogueModule,
  "DIALOGUE_BY_BEAT",
  (value): value is Readonly<
    Record<string, readonly CanonicalDialogueLine[]>
  > =>
    isRecordOf(
      value,
      (entry): entry is readonly CanonicalDialogueLine[] =>
        isArrayOf(entry, isCanonicalDialogueLine),
    ),
);
export const STAGE_GOAL_BY_BEAT = requireExport(
  stageGoalsModule,
  "STAGE_GOAL_BY_BEAT",
  (value): value is Readonly<Record<string, CanonicalStageGoal>> =>
    isRecordOf(value, isCanonicalStageGoal),
);
