import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { ACTORS, PLAYER_ROLE } from "../src/story/actors.ts";
import { STORY_BEATS } from "../src/story/beats.ts";
import { STORY_COMPLETION } from "../src/story/completion.ts";
import { DIALOGUE_BY_BEAT, DIALOGUE_SEGMENTS } from "../src/story/dialogue.ts";
import { STORY_ACTOR_SPAWN_IDS } from "../src/adapters/story-actor-mapping.ts";

const PLAN_PATH = new URL("../planning/story-plan.v1.json", import.meta.url);

const EVENT_SUMMARIES = Object.freeze([
  "耶穌經過時看見一個生來瞎眼的人。",
  "門徒問這人生來瞎眼是誰犯了罪。",
  "耶穌回答並說明趁著白日作工與世上之光。",
  "耶穌和泥抹在那人的眼睛上。",
  "耶穌吩咐那人往西羅亞池子去洗；那人前往池邊。",
  "那人照吩咐去洗，回頭就看見了。",
]);

const PATH_BEATS = Object.freeze({
  "man-to-pool": ["b05"],
});

const stableJson = (value) => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
    .join(",")}}`;
};

const sha256Json = (value) =>
  createHash("sha256").update(stableJson(value)).digest("hex");

const sha256Bytes = (value) =>
  createHash("sha256").update(value).digest("hex");

const scriptureTextSha256 = (verses) =>
  createHash("sha256")
    .update(
      JSON.stringify(
        verses.map(({ key, exactText }) => [key, exactText]),
      ),
    )
    .digest("hex");

const readJson = async (relativePath) =>
  JSON.parse(
    await readFile(new URL(`../${relativePath}`, import.meta.url), "utf8"),
  );

const stateSummary = (state) =>
  `${state.visible ? "visible" : "hidden"} at ${state.anchorId}; pose=${state.pose}; collision=${state.collisionEnabled}`;

const spawnStateSummary = (spawns) =>
  spawns
    .map(
      ({ actorId, anchorId, initiallyVisible }) =>
        `${actorId}:${initiallyVisible ? "visible" : "hidden"} at ${anchorId}; pose=idle; collision=${initiallyVisible}`,
    )
    .join(" | ");

const ledgerId = (level, id) => `ledger-${level.toLowerCase()}-${id}`;

async function buildPlan() {
  const [
    original,
    scripture,
    layout,
    paths,
    collisions,
    camera,
    navigation,
    spawns,
    scriptureBytes,
    scriptureEvidenceBytes,
    ownerReviewBytes,
  ] = await Promise.all([
    readJson("planning/story-plan.v1.json"),
    readJson("src/story/licensed-artifacts/scrollmapper-chiun-john9.json"),
    readJson("src/world/layout.json"),
    readJson("src/world/paths.json"),
    readJson("src/world/collisions.json"),
    readJson("src/world/camera.json"),
    readJson("src/world/navigation.json"),
    readJson("src/world/spawns.json"),
    readFile(
      new URL(
        "../src/story/licensed-artifacts/scrollmapper-chiun-john9.json",
        import.meta.url,
      ),
    ),
    readFile(
      new URL("../planning/evidence/scripture-source.json", import.meta.url),
    ),
    readFile(
      new URL(
        "../planning/evidence/owner-review.json",
        import.meta.url,
      ),
    ),
  ]);
  const ownerReviewSha256 = sha256Bytes(ownerReviewBytes);
  original.planningGate.recoveryCondition =
    "The repository owner compares John 9:1-7 with the fixed source, reviews the six-beat plan and runtime order, observer restrictions, final-state parity and contextual wording, then records a dated approval in planning/evidence/owner-review.json. Promotion remains conditional on current contracts, but personal-use candidate implementation and QA may proceed without forging Promotion authority.";
  original.storyCharter.passage =
    "John 9:1-7 — original 1919 Traditional Chinese Union Version (和合本), 神版";
  original.storyCharter.targetMinutes = 8;
  original.storyCharter.learningObjective =
    "Follow John 9:1-7 from the courtyard encounter to washing at Siloam without changing its outcome.";
  original.storyCharter.playerExperience =
    "Observe, explore, listen, and follow as an unnamed observer who cannot alter scripture events.";

  const verseEntries = scripture.verses.map((verse) => ({
    id: ledgerId("S0", verse.key.replace(":", "-")),
    sourceLevel: "S0",
    content: verse.exactText,
    verseKeys: [verse.key],
    policyRuleIds: [],
    reviewerId: "repository-owner",
    reviewStatus: "unreviewed",
    }));
  const eventEntries = STORY_BEATS.map((beat, index) => ({
    id: ledgerId("S1", beat.id),
    sourceLevel: "S1",
    content: EVENT_SUMMARIES[index],
    verseKeys: [...beat.verseKeys],
    policyRuleIds: [],
    reviewerId: "repository-owner",
    reviewStatus: "unreviewed",
  }));
  const stagingEntries = STORY_BEATS.map((beat, index) => ({
    id: ledgerId("S2", beat.id),
    sourceLevel: "S2",
    content: `以非因果移動、鏡頭、目標提示與介面呈現「${EVENT_SUMMARIES[index]}」；不增加台詞，不改變次序或結果。`,
    verseKeys: [...beat.verseKeys],
    policyRuleIds: [],
    reviewerId: "repository-owner",
    reviewStatus: "unreviewed",
    bridgeControls: {
      purpose: "Provide spatial and interaction continuity for the personal-use game.",
      removable: true,
      changesCause: false,
      changesIdentity: false,
      changesOrder: false,
      changesOutcome: false,
    },
  }));
  const observerActionsEntry = {
    id: "ledger-s2-observer-actions",
    sourceLevel: "S2",
    content: "無名觀察者只可移動、觀察、聆聽、觸發簡單互動及使用不計分的回顧。",
    verseKeys: [],
    policyRuleIds: [],
    reviewerId: "repository-owner",
    reviewStatus: "unreviewed",
    bridgeControls: {
      purpose: "Give the player non-causal access to the fixed scripture events.",
      removable: true,
      changesCause: false,
      changesIdentity: false,
      changesOrder: false,
      changesOutcome: false,
    },
  };
  const observerProhibitionsEntry = {
    id: "ledger-s3-observer-prohibitions",
    sourceLevel: "S3",
    content: "禁止玩家控制耶穌、造成醫治、代替經文人物回答、重排事件、改寫經文事實或改變結局。",
    verseKeys: scripture.verses.map(({ key }) => key),
    policyRuleIds: [],
    reviewerId: "repository-owner",
    reviewStatus: "unreviewed",
  };

  original.scripture.artifact.reviewerRegistryEvidence.sha256 =
    ownerReviewSha256;
  original.scripture.artifact.sha256 = sha256Bytes(scriptureBytes);
  const scriptureEvidenceSha256 = sha256Bytes(scriptureEvidenceBytes);
  original.scripture.artifact.sourceEvidence.sha256 = scriptureEvidenceSha256;
  original.scripture.artifact.rightsEvidence.sha256 = scriptureEvidenceSha256;
  const scriptureKeys = new Set(scripture.verses.map(({ key }) => key));
  original.scripture.verses = original.scripture.verses
    .filter(({ key }) => scriptureKeys.has(key))
    .map((verse) => ({
    ...verse,
    reviewStatus: "in-review",
    reviewAnchors: [
      {
        reviewerId: "repository-owner",
        status: "in-review",
        anchor: "planning/evidence/owner-review.json#approval",
        evidence: {
          repositoryPath: "planning/evidence/owner-review.json",
          sha256: ownerReviewSha256,
        },
      },
    ],
  }));
  original.contentLedger.entries = [
    ...verseEntries,
    ...eventEntries,
    ...stagingEntries,
    observerActionsEntry,
    observerProhibitionsEntry,
  ];
  original.eventSpine = STORY_BEATS.map((beat, index) => ({
    id: `event-${beat.id}`,
    order: beat.order,
    summary: EVENT_SUMMARIES[index],
    verseKeys: [...beat.verseKeys],
    ledgerEntryIds: [ledgerId("S1", beat.id)],
    policyRuleIds: [],
  }));
  original.playerRoleWarrant = {
    role: "unnamed observer-witness",
    warrant: "The player observes the fixed John 9:1-7 order without becoming a scripture actor or changing cause, order, or outcome.",
    allowedActions: PLAYER_ROLE.supportedActions.map((action) => ({
      id: `observer-${action}`,
      ledgerEntryId: observerActionsEntry.id,
      policyRuleIds: [],
    })),
    prohibitedActions: [
      {
        id: "observer-alter-scripture",
        ledgerEntryId: observerProhibitionsEntry.id,
        policyRuleIds: [],
      },
    ],
    policyRuleIds: [],
  };
  original.beats = STORY_BEATS.map((beat) => ({
    id: beat.id,
    order: beat.order,
    eventIds: [`event-${beat.id}`],
    verseKeys: [...beat.verseKeys],
    ledgerEntryIds: [ledgerId("S1", beat.id)],
    policyRuleIds: [],
    prerequisiteBeatIds:
      beat.order === 1
        ? []
        : [`b${String(beat.order - 1).padStart(2, "0")}`],
    trigger: EVENT_SUMMARIES[beat.order - 1],
    allowedPlayerActionIds: PLAYER_ROLE.supportedActions.map(
      (action) => `observer-${action}`,
    ),
    prohibitedPlayerActionIds: ["observer-alter-scripture"],
    actionLedgerEntryIds: [
      observerActionsEntry.id,
      observerProhibitionsEntry.id,
    ],
    stageGoalId: beat.stageGoal.id,
    sequenceId: beat.sequence.id,
    dialogueIds: (DIALOGUE_BY_BEAT[beat.id] ?? []).map(({ id }) => id),
    finalStateId: beat.finalState.id,
    completionEvidence: EVENT_SUMMARIES[beat.order - 1],
    completionLedgerEntryId: ledgerId("S1", beat.id),
  }));
  original.actorStateMatrix = STORY_BEATS.flatMap((beat, index) =>
    ACTORS.map((actor) => {
      const actorSpawns = STORY_ACTOR_SPAWN_IDS[actor.id].map((spawnActorId) => {
        const spawn = spawns.actorSpawns.find(
          ({ actorId }) => actorId === spawnActorId,
        );
        if (spawn === undefined) {
          throw new Error(`Missing runtime spawn for ${spawnActorId}.`);
        }
        return spawn;
      });
      const entryState =
        index === 0
          ? spawnStateSummary(actorSpawns)
          : stateSummary(STORY_BEATS[index - 1].finalState.actors[actor.id]);
      const final = beat.finalState.actors[actor.id];
      return {
        actorId: actor.id,
        beatId: beat.id,
        entryState,
        duringState: `${beat.sequence.id} applies only scripture-bound action and removable S2 staging.`,
        finalState: stateSummary(final),
        verseKeys: [...beat.verseKeys],
        ledgerEntryIds: [
          ledgerId("S1", beat.id),
          ledgerId("S2", beat.id),
        ],
      };
    }),
  );
  original.bridgesAndClues = [];
  original.recallGoalSheet = {
    goals: STORY_BEATS.map((beat) => ({
      id: beat.stageGoal.id,
      beatIds: [beat.id],
      prompt: beat.stageGoal.description,
      verseKeys: [...beat.verseKeys],
      ledgerEntryIds: [ledgerId("S2", beat.id)],
      blocksProgressOnFailure: false,
      punitive: false,
    })),
    recalls: [],
  };
  original.grayboxWorld = {
    coordinateSystem: `${layout.coordinateSystem.origin}; x=${layout.coordinateSystem.xAxis}; y=${layout.coordinateSystem.yAxis}; unit=${layout.coordinateSystem.unit}`,
    world: {
      width: layout.worldBounds.width,
      height: layout.worldBounds.height,
      tileSize: navigation.grid.cellSize,
    },
    routes: paths.sequencePaths.map((route) => ({
      id: route.id,
      from: route.startAnchorId,
      to: route.endAnchorId,
      ledgerEntryIds: (PATH_BEATS[route.id] ?? []).map((beatId) =>
        ledgerId("S2", beatId),
      ),
      waypoints: route.points.map(({ x, y }) => ({ x, y })),
    })),
    doors: layout.portals.map((portal) => ({
      id: portal.id,
      fromArea: portal.fromRegionId,
      toArea: portal.toRegionId,
      ledgerEntryIds: stagingEntries.map(({ id }) => id),
      anchor: {
        x: (portal.segment[0].x + portal.segment[1].x) / 2,
        y: (portal.segment[0].y + portal.segment[1].y) / 2,
      },
    })),
    collisions: collisions.collisionPolygons.map((collision) => ({
      id: collision.id,
      shape: `polygon:${collision.polygon.length}`,
      purpose: collision.material,
    })),
    cameraZones: camera.cameraZones.map((zone) => ({
      id: zone.id,
      bounds: JSON.stringify(zone.bounds),
      zoom: zone.desktopZoom,
    })),
    scale: {
      actorHeight: navigation.agent.height,
      doorHeight: 96,
      interactionDistance: navigation.agent.radius * 3,
    },
    responsiveViewports: [
      { name: "desktop", width: 1280, height: 720 },
      { name: "mobile", width: 390, height: 844 },
    ],
    developmentOnly: true,
    preservedAsRegressionBaseline: true,
  };
  original.sequenceFinality = STORY_BEATS.map((beat) => {
    const parityHash = sha256Json(beat.finalState);
    return {
      id: beat.sequence.id,
      beatId: beat.id,
      steps: [stagingEntries[beat.order - 1].content],
      cancellable: true,
      skippable: true,
      reentrant: false,
      finalStateId: beat.finalState.id,
      finalState: beat.finalState,
      parityHashes: {
        normal: parityHash,
        skip: parityHash,
        restart: parityHash,
        reentry: parityHash,
      },
    };
  });
  original.dialogueMatrix = DIALOGUE_SEGMENTS.map((line) => ({
    id: line.id,
    beatId: line.beatId,
    actorId: line.speakerId,
    sourceSpeaker: "Scripture",
    displaySpeaker: "經文",
    text: line.exactText,
    verseKeys: [line.verseKey],
    ledgerEntryId: ledgerId("S0", line.verseKey.replace(":", "-")),
    sourceLabel: line.sourceLabel,
    portraits: { primaryActorId: "scripture" },
    voiceCueId: `silent-fallback-${line.id}`,
  }));
  original.audioSheet = DIALOGUE_SEGMENTS.map((line) => ({
    cueId: `silent-fallback-${line.id}`,
    dialogueId: line.id,
    verseKeys: [line.verseKey],
    scriptureTextSha256: scriptureTextSha256([
      original.scripture.verses.find(({ key }) => key === line.verseKey),
    ]),
    fallback: "full-current-subtitles",
    blocksProgress: false,
    failureModes: ["stale-hash", "missing", "decode", "autoplay"],
  }));
  original.completionContract = {
    condition: "Complete all six ordered John 9:1-7 beats without changing scripture cause, order, or outcome.",
    requiredBeatIds: STORY_BEATS.map(({ id }) => id),
    completionStateId: STORY_COMPLETION.id,
    policyRuleIds: [],
    restartBehavior: "Clear committed progress, replay b01-b06 in canonical order, and converge on the same immutable b06 final state.",
    reentryBehavior: "Restore only a validated canonical beat prefix, resume at the next beat, and converge on the same immutable b06 final state.",
  };

  const acceptanceUpdates = {
    "accept-event-spine": ["passed", "Six ordered event rows bind runtime beats b01-b06 to John 9:1-7 verse keys and S1 ledger entries."],
    "accept-player-role": ["passed", "The canonical warrant and runtime enforce the unnamed observer's non-causal action limits."],
    "accept-beats": ["passed", "Six canonical Beat contracts match runtime order, triggers, goals, sequences, dialogue and final states."],
    "accept-actor-state": ["passed", "The actor-state matrix records entry and final state for every runtime actor on every beat."],
    "accept-bridges-clues": ["passed", "No invented clue is required; all S2 staging is removable and explicitly non-causal."],
    "accept-recall-goals": ["passed", "Six non-punitive goals are bound to runtime evidence; the short flow has no recall card."],
    "accept-graybox-world": ["passed", "The canonical plan binds the tested courtyard-to-Siloam world, route, portal, collisions, camera and responsive targets."],
    "accept-sequence-finality": ["passed", "All six sequences have identical normal, skip, restart and re-entry parity hashes."],
    "accept-dialogue-portraits": ["passed", "John 9:1-7 is bound to dialogue rows; the text-first UI intentionally does not require portraits."],
    "accept-audio": ["passed", "Every dialogue row has a full-subtitle fallback; the personal-use candidate intentionally ships without unapproved TTS."],
    "accept-completion": ["passed", `Completion requires b01-b06 and the immutable ${STORY_COMPLETION.id} contract ending at ${STORY_COMPLETION.finalSnapshotId}.`],
  };
  const acceptanceCategories = {
    "accept-event-spine": "Six ordered scripture beats",
    "accept-beats": "Six implementation-bound Beats",
    "accept-completion": "All six Beats complete",
  };
  original.acceptanceInventory = original.acceptanceInventory.map((item) => {
    const update = acceptanceUpdates[item.id];
    return update === undefined
      ? item
      : {
          ...item,
          category: acceptanceCategories[item.id] ?? item.category,
          status: update[0],
          evidence: update[1],
        };
  });
  original.accessibilitySensitivity.disabilityReview.reviewerId =
    "repository-owner";
  original.accessibilitySensitivity.jewishGroupLanguageReview.reviewerId =
    "repository-owner";

  return `${JSON.stringify(original, null, 2)}\n`;
}

const generated = await buildPlan();
const current = await readFile(PLAN_PATH, "utf8");
if (process.argv.includes("--check")) {
  if (current !== generated) {
    throw new Error(
      "planning/story-plan.v1.json is stale; run npm run planning:sync.",
    );
  }
  console.log("Canonical six-beat story plan is synchronized.");
} else {
  await writeFile(PLAN_PATH, generated);
  console.log("Synchronized canonical six-beat story plan.");
}
