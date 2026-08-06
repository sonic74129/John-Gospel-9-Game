import runtimeManifest from "../../public/assets/art/manifest.json" with { type: "json" };

if (
  runtimeManifest.reviewStatus !== "copilot-accepted-runtime-ready" ||
  runtimeManifest.distributionScope !== "private" ||
  runtimeManifest.evidenceCollector !== "copilot" ||
  runtimeManifest.acceptanceExecutor !== "copilot" ||
  runtimeManifest.worldContract.width !== 2560 ||
  runtimeManifest.worldContract.height !== 1792 ||
  runtimeManifest.worldContract.topology !== "north-south-zig-zag"
) {
  throw new Error("Story-local runtime art is outside the release contract.");
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
    roadsideCanopy: runtimeAsset("roadside-canopy.png"),
    poolPalmFrond: runtimeAsset("pool-palm-frond.png"),
    neighborsAwning: runtimeAsset("neighbors-awning.png"),
    outerOliveBranch: runtimeAsset("outer-olive-branch.png"),
    courtyardGate: runtimeAsset("courtyard-gate.png"),
    clayVessel: runtimeAsset("clay-vessel.png"),
    poolMarker: runtimeAsset("pool-marker.png"),
    waitingStool: runtimeAsset("waiting-stool.png"),
  }),
  actors: Object.freeze({
    observerDown: runtimeAsset("observer-down.png"),
    observerUp: runtimeAsset("observer-up.png"),
    observerRight: runtimeAsset("observer-right.png"),
    observerLeft: runtimeAsset("observer-left.png"),
    manBlind: runtimeAsset("man-blind.png"),
    manClay: runtimeAsset("man-clay.png"),
    manSeeing: runtimeAsset("man-seeing.png"),
    manWorship: runtimeAsset("man-worship.png"),
    jesusIdle: runtimeAsset("jesus-idle.png"),
    jesusClayAction: runtimeAsset("jesus-clay-action.png"),
    jesusFoundMan: runtimeAsset("jesus-found-man.png"),
    discipleA: runtimeAsset("disciple-a.png"),
    discipleB: runtimeAsset("disciple-b.png"),
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

if (STORY_ART_ASSET_LIST.length !== outputs.length) {
  throw new Error("Every processed runtime art file must be wired exactly once.");
}

export function actorArtForSpawn(actorId: string): Readonly<RuntimeArtAsset> {
  const mapping: Readonly<Record<string, Readonly<RuntimeArtAsset>>> = {
    "player-observer": STORY_ART.actors.observerDown,
    "man-born-blind": STORY_ART.actors.manBlind,
    jesus: STORY_ART.actors.jesusIdle,
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

export type ObserverDirection = "down" | "up" | "right" | "left";

export function observerArtForDirection(
  direction: ObserverDirection,
): Readonly<RuntimeArtAsset> {
  return {
    down: STORY_ART.actors.observerDown,
    up: STORY_ART.actors.observerUp,
    right: STORY_ART.actors.observerRight,
    left: STORY_ART.actors.observerLeft,
  }[direction];
}
