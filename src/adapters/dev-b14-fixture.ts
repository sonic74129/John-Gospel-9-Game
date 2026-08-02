import type { SequenceDefinition } from "@sonic74129/sequence-runtime";

import type { AppShell } from "../platform/app-shell.ts";
import type { PlatformRuntime } from "./sdk-platform.ts";
import type { SliceFinalState } from "./sequence-adapter.ts";
import {
  DIALOGUE_BY_BEAT,
  FINAL_SNAPSHOTS,
  TESTIMONY,
} from "./story-contracts.ts";

const FIXTURE_ID = "b14-stress";
const PRODUCTION_EXCLUSION_MARKER = "JOHN9_DEV_ONLY_B14_STRESS";

export interface DeveloperFixture {
  readonly id: string;
  run(runtime: PlatformRuntime, shell: AppShell): Promise<void>;
}

function createFixtureMetadata(): HTMLElement {
  const section = document.createElement("section");
  section.dataset.devFixtureMarker = PRODUCTION_EXCLUSION_MARKER;
  Object.assign(section.style, {
    margin: "1rem 0",
    padding: "0.85rem",
    border: "1px dashed #c5a16e",
    borderRadius: "0.7rem",
    lineHeight: "1.55",
  });

  const heading = document.createElement("h3");
  heading.textContent = "開發壓力資料";
  const state = document.createElement("p");
  state.textContent =
    "音樂狀態：silence · 對話模式：blocking · 經文內容：withheld";
  const purpose = document.createElement("p");
  purpose.textContent =
    "此長版面只驗證 390x844 捲動、控制可達性、來源標記與安全 placeholder；不包含逐字經文。";
  section.append(heading, state, purpose);

  const dialogue = DIALOGUE_BY_BEAT.b14;
  if (dialogue === undefined) {
    throw new Error("Canonical B14 dialogue metadata is missing.");
  }
  for (let index = 0; index < 8; index += 1) {
    const line = dialogue[index % dialogue.length]!;
    const placeholder = document.createElement("p");
    placeholder.textContent =
      `${index + 1}. ${line.sourceLevel} · ${line.segmentId} · 版面壓力佔位 · 經文待授權／審核`;
    section.append(placeholder);
  }

  for (const entry of TESTIMONY.filter(({ beatId }) => beatId === "b14")) {
    const card = document.createElement("article");
    card.dataset.testimonyId = entry.id;
    card.style.padding = "0.55rem";
    const title = document.createElement("h4");
    title.textContent = entry.id;
    const metadata = document.createElement("p");
    metadata.textContent =
      `${entry.sourceLevel} · ${entry.category} · ${entry.segmentIds.join(", ")}`;
    card.append(title, metadata);
    section.append(card);
  }
  return section;
}

export function createB14StressSequence(): SequenceDefinition<SliceFinalState> {
  const finalState = FINAL_SNAPSHOTS.b14;
  const dialogue = DIALOGUE_BY_BEAT.b14;
  if (finalState === undefined || dialogue === undefined) {
    throw new Error("Canonical B14 fixture contracts are missing.");
  }
  return {
    id: "developer-b14-layout-sequence",
    steps: [
      {
        kind: "command",
        command: "present-scripture-segments",
        payload: { beatId: "b14" },
      },
    ],
    finalState,
  };
}

export function resolveDeveloperFixture(
  search: string,
): DeveloperFixture | null {
  if (new URLSearchParams(search).get("fixture") !== FIXTURE_ID) {
    return null;
  }
  return {
    id: FIXTURE_ID,
    run: async (runtime, shell) => {
      const dialogue = document.querySelector<HTMLElement>("[data-dialogue]");
      const footer = dialogue?.querySelector("footer");
      if (
        dialogue === null ||
        dialogue === undefined ||
        footer === null ||
        footer === undefined
      ) {
        throw new Error("The developer fixture requires the dialogue shell.");
      }
      const metadata = createFixtureMetadata();
      dialogue.insertBefore(metadata, footer);
      try {
        const result = await runtime.runSequence(createB14StressSequence());
        shell.setStatus(
          `DEV B14 壓力測試已${result.status === "skipped" ? "跳過" : "完成"}；正式故事進度未變`,
        );
      } finally {
        metadata.remove();
      }
    },
  };
}
