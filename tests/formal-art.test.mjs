import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { basename } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { reconcileCandidateFiles } from "../scripts/art-generate.mjs";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = await readJson("public/assets/art/manifest.json");
const review = await readJson(
  "production/asset-reviews/story-local-art-review.json",
);
const worldSelection = await readJson(
  "production/art-source/environment-outdoor/environment.john9-zigzag-world/v2/run-001/selection.json",
);
const propsSelection = await readJson(
  "production/art-source/environment-outdoor/environment.john9-zigzag-props/v2/run-001/selection.json",
);
const adapterSource = await readFile(
  "src/adapters/art-asset-adapter.ts",
  "utf8",
);
const sceneSource = await readFile("src/adapters/story-scene.ts", "utf8");

function imageDimensions(bytes, path) {
  if (bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    const chunk = bytes.toString("ascii", 12, 16);
    if (chunk === "VP8X") {
      return {
        width: bytes.readUIntLE(24, 3) + 1,
        height: bytes.readUIntLE(27, 3) + 1,
      };
    }
    if (chunk === "VP8 ") {
      return {
        width: bytes.readUInt16LE(26) & 0x3fff,
        height: bytes.readUInt16LE(28) & 0x3fff,
      };
    }
    if (chunk === "VP8L" && bytes[20] === 0x2f) {
      const bits = bytes.readUInt32LE(21);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
      };
    }
  }
  throw new Error(`Unsupported runtime image format: ${path}`);
}

test("formal art manifest pins the cropped courtyard-to-Siloam private-preview contract", () => {
  assert.equal(manifest.reviewStatus, "polished-private-preview");
  assert.equal(manifest.releaseEligible, false);
  assert.equal(manifest.publicRedistributionApproved, false);
  assert.deepEqual(manifest.worldContract, {
    width: 1248,
    height: 1280,
    topology: "courtyard-to-siloam-crop",
    sourceWidth: 2560,
    sourceHeight: 1792,
    retainedSourceBounds: {
      left: 576,
      top: 224,
      right: 1824,
      bottom: 1504,
    },
  });
  assert.equal(review.runtimeInventory.files, 14);
  assert.deepEqual(review.runtimeInventory.worldDimensions, {
    width: 1248,
    height: 1280,
  });
  assert.ok(review.selectedAssets.some((id) => id.includes("zigzag-world@v2")));
  assert.ok(review.selectedAssets.every((id) => !id.includes("world-base@v1")));
});

test("world processing records two unscaled direct-paste crops over neutral fill", () => {
    const world = manifest.assets.find(
      ({ assetId }) => assetId === "environment.john9-zigzag-world",
    );
    assert.ok(world);
    const [output] = world.outputs;
    assert.deepEqual(output.dimensions, { width: 1248, height: 1280 });
    assert.equal(output.processing.tool, "ffmpeg");
    assert.deepEqual(output.processing.canvas, {
      width: 1248,
      height: 1280,
      color: "#ead9b7",
    });
    assert.deepEqual(output.processing.placements, [
      {
        sourceCrop: [840, 240, 1800, 1140],
        destination: [264, 16],
        scale: "none",
        blend: "none",
      },
      {
        sourceCrop: [600, 1020, 1220, 1480],
        destination: [24, 796],
        scale: "none",
        blend: "none",
      },
    ]);
    assert.equal(output.processing.lossless, true);
});

test("world crop rebuild is deterministic and preserves exact retained pixels", async () => {
    const worldPath =
      "public/assets/art/environment-outdoor/environment.john9-zigzag-world/v2/run-001/world-base.webp";
    const before = await readFile(worldPath);
    const rebuild = spawnSync(process.execPath, ["scripts/art-process.mjs"], {
      encoding: "utf8",
    });
    assert.equal(rebuild.status, 0, rebuild.stderr);
    assert.deepEqual(await readFile(worldPath), before);

    const directory = await mkdtemp(`${tmpdir()}/john9-world-crop-test-`);
    try {
      const canonicalPath = `${directory}/canonical.webp`;
      const canonical = spawnSync(
        "python3",
        [
          "scripts/art-process-image.py",
          "--input",
          worldSelection.source.path,
          "--output",
          canonicalPath,
          "--crop",
          "27,0,1125,768",
          "--size",
          "2560x1792",
          "--quality",
          "90",
        ],
        { encoding: "utf8" },
      );
      assert.equal(canonical.status, 0, canonical.stderr);
      const canonicalPngPath = `${directory}/canonical.png`;
      const decode = spawnSync(
        "ffmpeg",
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-i",
          canonicalPath,
          "-frames:v",
          "1",
          canonicalPngPath,
        ],
        { encoding: "utf8" },
      );
      assert.equal(decode.status, 0, decode.stderr);
      const expectedCrop = (name, crop) => {
        const path = `${directory}/${name}.png`;
        const result = spawnSync(
          "ffmpeg",
          [
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            canonicalPngPath,
            "-vf",
            `crop=${crop}`,
            "-frames:v",
            "1",
            path,
          ],
          { encoding: "utf8" },
        );
        assert.equal(result.status, 0, result.stderr);
        return path;
      };
      const courtyardPath = expectedCrop("courtyard", "960:900:840:240");
      const poolPath = expectedCrop("pool", "620:460:600:1020");

      const pillowCropHash = (path, box) => {
        const result = spawnSync(
          "python3",
          [
            "-c",
            "from PIL import Image; import hashlib,sys; image=Image.open(sys.argv[1]).convert('RGBA'); print(hashlib.sha256(image.crop(tuple(map(int,sys.argv[2].split(',')))).tobytes()).hexdigest())",
            path,
            box,
          ],
          { encoding: "utf8" },
        );
        assert.equal(result.status, 0, result.stderr);
        return result.stdout.trim();
      };
      assert.equal(
        pillowCropHash(worldPath, "264,16,1224,916"),
        pillowCropHash(courtyardPath, "0,0,960,900"),
      );
      assert.equal(
        pillowCropHash(worldPath, "24,796,644,1256"),
        pillowCropHash(poolPath, "0,0,620,460"),
      );
      const neutralPixel = spawnSync(
        "python3",
        [
          "-c",
          "from PIL import Image; import sys; print(','.join(map(str,Image.open(sys.argv[1]).convert('RGBA').getpixel((0,0)))))",
          worldPath,
        ],
        { encoding: "utf8" },
      );
      assert.equal(neutralPixel.status, 0, neutralPixel.stderr);
      assert.equal(neutralPixel.stdout.trim(), "234,217,183,255");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
});

test("formal environment review points to the exact processed selections", () => {
  for (const selection of [worldSelection, propsSelection]) {
    const selected = `${selection.assetId}@${selection.promptVersion}/${selection.run}/candidate-${String(selection.selectedCandidate).padStart(2, "0")}`;
    assert.ok(review.selectedAssets.includes(selected), selected);
    const runtime = manifest.assets.find(
      ({ assetId, promptVersion, run }) =>
        assetId === selection.assetId &&
        promptVersion === selection.promptVersion &&
        run === selection.run,
    );
    assert.equal(runtime?.selectedCandidate, selection.selectedCandidate, selected);
    assert.equal(runtime?.source.sha256, selection.source.sha256, selected);
  }
});

test("all 14 six-beat runtime outputs match recorded bytes, hashes, and dimensions", async () => {
  const outputs = manifest.assets.flatMap(({ outputs }) => outputs);
  assert.equal(outputs.length, 14);
  assert.equal(new Set(outputs.map(({ path }) => path)).size, outputs.length);
  for (const output of outputs) {
    const bytes = await readFile(output.path);
    assert.equal(bytes.byteLength, output.bytes, output.path);
    assert.equal(sha256(bytes), output.sha256, output.path);
    assert.deepEqual(imageDimensions(bytes, output.path), output.dimensions);
  }
});

test("every runtime output is wired once and obsolete world art is unwired", () => {
  const outputs = manifest.assets.flatMap(({ outputs }) => outputs);
  for (const { path } of outputs) {
    const fileName = basename(path);
    assert.equal(
      adapterSource.split(`runtimeAsset("${fileName}")`).length - 1,
      1,
      fileName,
    );
  }
  assert.doesNotMatch(adapterSource, /john9-world-base@v1|foreground-props@v1/);
});

test("actor foot baselines are complete and applied on spawn and pose changes", () => {
  const actorOutputs = manifest.assets
    .filter(({ family }) => family.startsWith("characters-"))
    .flatMap(({ outputs }) => outputs);
  assert.equal(actorOutputs.length, 12);
  assert.equal(Object.keys(manifest.actorFootBaselines).length, 12);
  for (const { path, dimensions } of actorOutputs) {
    const baseline = manifest.actorFootBaselines[basename(path)];
    assert.ok(Number.isInteger(baseline), path);
    assert.ok(baseline > 0 && baseline <= dimensions.height, path);
  }
  assert.match(sceneSource, /art\.footBaseline! \/ art\.height/g);
  assert.match(sceneSource, /#syncNarrativeTextures\(\)/);
});

test("formal art wiring excludes deleted regions and later-story actors", () => {
  assert.match(adapterSource, /runtimeAsset\("clay-vessel\.png"\)/);
  assert.match(sceneSource, /STORY_ART\.props\.clayVessel/);
  assert.doesNotMatch(
    `${adapterSource}\n${sceneSource}\n${JSON.stringify(manifest)}`,
    /neighbor-|inquiry-|outside-|outer-road|pharisee|parent-|worship|found-man/i,
  );
});

test("MAI generation refuses an unapproved token destination before Azure auth", () => {
  const result = spawnSync(
    process.execPath,
    [
      "scripts/art-generate.mjs",
      "--family",
      "environment-outdoor",
      "--asset",
      "environment.john9-zigzag-world",
      "--dry-run",
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        AZURE_MAI_ENDPOINT: "https://example.invalid/",
      },
    },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must use the approved origin/);
});

test("resume recovers an immutable candidate written before its manifest update", async () => {
  const directory = await mkdtemp(`${tmpdir()}/john9-art-resume-`);
  try {
    await copyFile(
      "production/art-pipeline/candidates/environment-outdoor/environment.john9-zigzag-world/v2/run-001/candidate-01.png",
      `${directory}/candidate-01.png`,
    );
    const candidates = await reconcileCandidateFiles(
      directory,
      {
        assetId: "environment.john9-zigzag-world",
        candidateCount: 2,
        machineAcceptance: {
          exactWidth: 1152,
          exactHeight: 768,
          maximumBytes: 20_000_000,
        },
      },
      [],
    );
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].path, "candidate-01.png");
    assert.equal(candidates[0].recoveredFromInterruptedWrite, true);
    assert.equal(candidates[0].machineAccepted, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
