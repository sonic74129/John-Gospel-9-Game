import jesusManifest from "../../.foundation/assets/packs/identity-jesus-storybook/0.1.0/manifest.json" with { type: "json" };
import jesusPack from "../../.foundation/assets/packs/identity-jesus-storybook/0.1.0/pack.json" with { type: "json" };

const characterSheet = jesusPack.assets.find(
  ({ id }) => id === "character-sheet",
);
const runtimeFile = jesusManifest.files.find(
  ({ path }) => path === characterSheet?.runtime,
);

if (
  jesusPack.status !== "candidate" ||
  jesusPack.releaseEligible !== false ||
  characterSheet?.status !== "candidate-runtime" ||
  runtimeFile === undefined ||
  runtimeFile.width !== characterSheet.runtimeMapping.sheetWidth ||
  runtimeFile.height !== characterSheet.runtimeMapping.sheetHeight
) {
  throw new Error("Pinned candidate Jesus sheet mapping is not runtime-safe.");
}

export const CANDIDATE_JESUS_SHEET = Object.freeze({
  key: `${jesusPack.id}-${jesusPack.version}`,
  status: jesusPack.status,
  releaseEligible: jesusPack.releaseEligible,
  path:
    `assets/vendor/${jesusPack.id}/${jesusPack.version}/` +
    characterSheet.runtime.split("/").at(-1),
  frameWidth: characterSheet.runtimeMapping.cellWidth,
  frameHeight: characterSheet.runtimeMapping.cellHeight,
  footBaseline: characterSheet.runtimeMapping.footBaseline,
  frames: Object.freeze({
    down: Object.freeze({ idle: 0, walk: Object.freeze([1, 2]) }),
    up: Object.freeze({ idle: 3, walk: Object.freeze([4, 5]) }),
    right: Object.freeze({ idle: 6, walk: Object.freeze([7, 8]) }),
    left: Object.freeze({ idle: 9, walk: Object.freeze([10, 11]) }),
  }),
});
