import runtimeManifest from "../../public/assets/art/manifest.json" with { type: "json" };

if (
  runtimeManifest.reviewStatus !== "polished-private-preview" ||
  runtimeManifest.releaseEligible !== false ||
  runtimeManifest.publicRedistributionApproved !== false ||
  runtimeManifest.worldContract.width !== 1248 ||
  runtimeManifest.worldContract.height !== 1280 ||
  runtimeManifest.worldContract.topology !== "courtyard-to-siloam-crop"
) {
  throw new Error("Story-local runtime art is outside the private-preview contract.");
}

interface RuntimeArtAsset {
  readonly key: string;
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly footBaseline: number | null;
}

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
  if (matches.length !== 1) {
    throw new Error(`Runtime art file ${fileName} must resolve exactly once.`);
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
    footBaseline:
      runtimeManifest.actorFootBaselines[
        fileName as keyof typeof runtimeManifest.actorFootBaselines
      ] ?? null,
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
    jesusIdle: runtimeAsset("jesus-idle.png"),
    jesusIdleLookRight: runtimeAsset("jesus-idle-look-right.png"),
    jesusClayAction: runtimeAsset("jesus-clay-action.png"),
    jesusClayActionLookRight: runtimeAsset("jesus-clay-action-look-right.png"),
    discipleA: runtimeAsset("disciple-a.png"),
    discipleALookRight: runtimeAsset("disciple-a-look-right.png"),
    discipleB: runtimeAsset("disciple-b.png"),
    discipleBLookRight: runtimeAsset("disciple-b-look-right.png"),
  }),
});

export const STORY_ART_ASSET_LIST = Object.freeze([
  STORY_ART.worldBase,
  ...Object.values(STORY_ART.props),
  ...Object.values(STORY_ART.actors),
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
    jesus: STORY_ART.actors.jesusIdle,
    "disciple-left": STORY_ART.actors.discipleA,
    "disciple-right": STORY_ART.actors.discipleB,
  };
  const art = mapping[actorId];
  if (art === undefined || art.footBaseline === null) {
    throw new RangeError(`No story-local texture is mapped for ${actorId}.`);
  }
  return art;
}
