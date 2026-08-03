import runtimeManifest from "../../public/assets/art/manifest.json" with { type: "json" };

if (
  runtimeManifest.reviewStatus !== "polished-private-preview" ||
  runtimeManifest.releaseEligible !== false ||
  runtimeManifest.publicRedistributionApproved !== false ||
  runtimeManifest.worldContract.width !== 2560 ||
  runtimeManifest.worldContract.height !== 1792 ||
  runtimeManifest.worldContract.topology !== "north-south-zig-zag"
) {
  throw new Error("Story-local runtime art is outside the private-preview contract.");
}

const outputs: Array<Readonly<{ path: string }>> = [];
for (const asset of runtimeManifest.assets) {
  for (const output of asset.outputs) {
    outputs.push({ path: output.path });
  }
}

function runtimeAsset(fileName: string): Readonly<{ key: string; path: string }> {
  const matches = outputs.filter(({ path }) => path.endsWith(`/${fileName}`));
  if (matches.length !== 1) {
    throw new Error(`Runtime art file ${fileName} must resolve exactly once.`);
  }
  const path = matches[0]!.path;
  if (!path.startsWith("public/")) {
    throw new Error(`Runtime art file ${path} is outside public/.`);
  }
  return Object.freeze({
    key: `john9-art-${fileName.replace(/\.[^.]+$/, "")}`,
    path: path.slice("public/".length),
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
    observer: runtimeAsset("observer.png"),
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
});

export const STORY_ART_ASSET_LIST = Object.freeze([
  STORY_ART.worldBase,
  ...Object.values(STORY_ART.props),
  ...Object.values(STORY_ART.actors),
]);

if (STORY_ART_ASSET_LIST.length !== outputs.length) {
  throw new Error("Every processed runtime art file must be wired exactly once.");
}

export function actorTextureForSpawn(actorId: string): string {
  const mapping: Readonly<Record<string, string>> = {
    "player-observer": STORY_ART.actors.observer.key,
    "man-born-blind": STORY_ART.actors.manBlind.key,
    jesus: STORY_ART.actors.jesusIdle.key,
    "disciple-left": STORY_ART.actors.discipleA.key,
    "disciple-right": STORY_ART.actors.discipleB.key,
    "neighbor-left": STORY_ART.actors.neighborA.key,
    "neighbor-right": STORY_ART.actors.neighborB.key,
    "pharisee-left": STORY_ART.actors.pharisee.key,
    "pharisee-right": STORY_ART.actors.judeanAuthority.key,
    "parent-left": STORY_ART.actors.father.key,
    "parent-right": STORY_ART.actors.mother.key,
  };
  const texture = mapping[actorId];
  if (texture === undefined) {
    throw new RangeError(`No story-local texture is mapped for ${actorId}.`);
  }
  return texture;
}
