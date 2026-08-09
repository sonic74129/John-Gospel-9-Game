import runtimeManifest from "../../public/assets/art/manifest.json" with { type: "json" };

if (
  runtimeManifest.reviewStatus !== "polished-private-preview" ||
  runtimeManifest.releaseEligible !== false ||
  runtimeManifest.publicRedistributionApproved !== false ||
  runtimeManifest.worldContract.width !== 2688 ||
  runtimeManifest.worldContract.height !== 1792 ||
  runtimeManifest.worldContract.topology !== "complete-single-source"
) {
  throw new Error("Story-local runtime art is outside the private-preview contract.");
}

export interface RuntimeArtAsset {
  readonly key: string;
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly footBaseline: number | null;
  readonly frameWidth: number;
  readonly frameHeight: number;
}

export interface ActorRenderProfile {
  readonly targetDisplayHeight: number;
}

const ADULT_BASELINE_HEIGHT = 132;

export const STORY_ACTOR_RENDER_PROFILES = Object.freeze({
  observer: Object.freeze({ targetDisplayHeight: ADULT_BASELINE_HEIGHT }),
  manBornBlind: Object.freeze({ targetDisplayHeight: ADULT_BASELINE_HEIGHT }),
  jesus: Object.freeze({ targetDisplayHeight: ADULT_BASELINE_HEIGHT }),
  supportingAdult: Object.freeze({ targetDisplayHeight: ADULT_BASELINE_HEIGHT }),
});

export const JESUS_DIRECTIONAL_FRAMES = Object.freeze({
  frameWidth: 96,
  frameHeight: 200,
  footBaseline: 193,
  frames: Object.freeze({
    down: Object.freeze({ idle: 0, walk: Object.freeze([1, 2]) }),
    up: Object.freeze({ idle: 3, walk: Object.freeze([4, 5]) }),
    right: Object.freeze({ idle: 6, walk: Object.freeze([7, 8]) }),
    left: Object.freeze({ idle: 9, walk: Object.freeze([10, 11]) }),
  }),
});

const LEGACY_ART_FOOT_BASELINE_BY_FILE: Readonly<Record<string, number>> =
  Object.freeze({
    "man-worship.png": 112,
    "jesus-found-man.png": 112,
    "neighbor-a.png": 118,
    "neighbor-b.png": 118,
    "pharisee.png": 118,
    "judean-authority.png": 118,
    "father.png": 118,
    "mother.png": 118,
  });

const outputs: Array<
  Readonly<{
    path: string;
    dimensions: Readonly<{ width: number; height: number }>;
  }>
> = [];
for (const asset of runtimeManifest.assets) {
  for (const output of asset.outputs) {
    outputs.push({ path: output.path, dimensions: output.dimensions });
  }
}

function runtimeAsset(fileName: string): Readonly<RuntimeArtAsset> {
  const matches = outputs.filter(({ path }) => path.endsWith(`/${fileName}`));
  if (matches.length === 0) {
    throw new Error(`Runtime art file ${fileName} is missing.`);
  }
  if (matches.length > 1) {
    const first = matches[0]!;
    const rest = matches.slice(1);
    const hasConflict = rest.some(
      (output) =>
        output.path !== first.path ||
        output.dimensions.width !== first.dimensions.width ||
        output.dimensions.height !== first.dimensions.height,
    );
    if (hasConflict) {
      throw new Error(
        `Runtime art file ${fileName} resolves to conflicting outputs.`,
      );
    }
  }
  const output = matches[0]!;
  const path = output.path;
  if (!path.startsWith("public/")) {
    throw new Error(`Runtime art file ${path} is outside public/.`);
  }
  return Object.freeze({
    key: `john9-art-${fileName.replace(/\.[^.]+$/, "")}`,
    path: path.slice("public/".length),
    width: output.dimensions.width,
    height: output.dimensions.height,
    footBaseline: (() => {
      const manifestBaseline =
        runtimeManifest.actorFootBaselines[
          fileName as keyof typeof runtimeManifest.actorFootBaselines
        ];
      if (manifestBaseline !== undefined) {
        return manifestBaseline;
      }
      return LEGACY_ART_FOOT_BASELINE_BY_FILE[fileName] ?? null;
    })(),
    frameWidth:
      fileName === "jesus-directional.png"
        ? JESUS_DIRECTIONAL_FRAMES.frameWidth
        : output.dimensions.width,
    frameHeight:
      fileName === "jesus-directional.png"
        ? JESUS_DIRECTIONAL_FRAMES.frameHeight
        : output.dimensions.height,
  });
}

export const STORY_ART = Object.freeze({
  worldBase: runtimeAsset("world-base.webp"),
  props: Object.freeze({
    clayVessel: runtimeAsset("clay-vessel.png"),
  }),
  actors: Object.freeze({
    observer: runtimeAsset("observer.png"),
    manBlind: runtimeAsset("man-blind.png"),
    manClay: runtimeAsset("man-clay.png"),
    manSeeing: runtimeAsset("man-seeing.png"),
    manWorship: runtimeAsset("man-worship.png"),
    jesusDirectional: runtimeAsset("jesus-directional.png"),
    jesusIdle: runtimeAsset("jesus-idle.png"),
    jesusIdleLookRight: runtimeAsset("jesus-idle-look-right.png"),
    jesusClayAction: runtimeAsset("jesus-clay-action.png"),
    jesusClayActionLookRight: runtimeAsset("jesus-clay-action-look-right.png"),
    jesusFoundMan: runtimeAsset("jesus-found-man.png"),
    discipleA: runtimeAsset("disciple-a.png"),
    discipleALookRight: runtimeAsset("disciple-a-look-right.png"),
    discipleB: runtimeAsset("disciple-b.png"),
    discipleBLookRight: runtimeAsset("disciple-b-look-right.png"),
    neighborA: runtimeAsset("neighbor-a.png"),
    neighborB: runtimeAsset("neighbor-b.png"),
    pharisee: runtimeAsset("pharisee.png"),
    judeanAuthority: runtimeAsset("judean-authority.png"),
    father: runtimeAsset("father.png"),
    mother: runtimeAsset("mother.png"),
  }),
  portraits: Object.freeze({
    jesus: runtimeAsset("portrait-jesus.png"),
    manBlind: runtimeAsset("portrait-man-blind.png"),
    manSeeing: runtimeAsset("portrait-man-seeing.png"),
    disciples: runtimeAsset("portrait-disciples.png"),
    neighbors: runtimeAsset("portrait-neighbors.png"),
    authorities: runtimeAsset("portrait-authorities.png"),
    parents: runtimeAsset("portrait-parents.png"),
  }),
});

export const STORY_ART_ASSET_LIST = Object.freeze([
  STORY_ART.worldBase,
  ...Object.values(STORY_ART.props),
  ...Object.values(STORY_ART.actors),
  ...Object.values(STORY_ART.portraits),
]);

if (
  new Set(STORY_ART_ASSET_LIST.map(({ path }) => path)).size !==
  STORY_ART_ASSET_LIST.length
) {
  throw new Error("Every story runtime art file must be wired exactly once.");
}

export function actorArtForSpawn(actorId: string): Readonly<RuntimeArtAsset> {
  const mapping: Readonly<Record<string, Readonly<RuntimeArtAsset>>> = {
    "player-observer": STORY_ART.actors.observer,
    "man-born-blind": STORY_ART.actors.manBlind,
    jesus: STORY_ART.actors.jesusDirectional,
    "disciple-left": STORY_ART.actors.discipleA,
    "disciple-right": STORY_ART.actors.discipleB,
    "neighbor-left": STORY_ART.actors.neighborA,
    "neighbor-right": STORY_ART.actors.neighborB,
    "pharisee-left": STORY_ART.actors.pharisee,
    "pharisee-right": STORY_ART.actors.judeanAuthority,
    "parent-left": STORY_ART.actors.father,
    "parent-right": STORY_ART.actors.mother,
  };
  const art = mapping[actorId];
  if (art === undefined || art.footBaseline === null) {
    throw new RangeError(`No story-local texture is mapped for ${actorId}.`);
  }
  return art;
}

export function actorRenderProfileForSpawn(
  actorId: string,
): Readonly<ActorRenderProfile> {
  const mapping: Readonly<Record<string, Readonly<ActorRenderProfile>>> = {
    "player-observer": STORY_ACTOR_RENDER_PROFILES.observer,
    "man-born-blind": STORY_ACTOR_RENDER_PROFILES.manBornBlind,
    jesus: STORY_ACTOR_RENDER_PROFILES.jesus,
    "disciple-left": STORY_ACTOR_RENDER_PROFILES.supportingAdult,
    "disciple-right": STORY_ACTOR_RENDER_PROFILES.supportingAdult,
    "neighbor-left": STORY_ACTOR_RENDER_PROFILES.supportingAdult,
    "neighbor-right": STORY_ACTOR_RENDER_PROFILES.supportingAdult,
    "pharisee-left": STORY_ACTOR_RENDER_PROFILES.supportingAdult,
    "pharisee-right": STORY_ACTOR_RENDER_PROFILES.supportingAdult,
    "parent-left": STORY_ACTOR_RENDER_PROFILES.supportingAdult,
    "parent-right": STORY_ACTOR_RENDER_PROFILES.supportingAdult,
  };
  const profile = mapping[actorId];
  if (profile === undefined) {
    throw new RangeError(`No story-local render profile is mapped for ${actorId}.`);
  }
  return profile;
}
