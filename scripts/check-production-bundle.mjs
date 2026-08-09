import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const FORBIDDEN = [
  "b14-stress",
  "JOHN9_DEV_ONLY_B14_STRESS",
  "developer-b14-layout-sequence",
  "dev-b14-fixture",
  "developer-fixture",
  "data-developer-fixture",
  "DEV FIXTURE",
  "QA 灰盒",
  "私人灰盒",
  "候選身分灰盒",
  "經文待授權／審核",
  "審核狀態",
  "段落識別：",
  "逐字內容尚未獲授權／審核",
  "Speaker",
  "Verse key",
  "Segment ID",
  "S2 · 遊戲提示 · 不計分",
  "回想卡",
  "Duplicate playtest query parameters are not supported.",
  "playtest beat ID must not be empty.",
  "is not a supported playtest beat.",
  "契約以外的故事節點",
  "從 B01 開始",
  "已套用確定最終狀態",
  "sdkOverlayVisible",
  "sdkInteractionBlocked",
  "lastHandoff",
  "john-9-graybox",
  "graybox-shell",
  "fixed-graybox-mass",
  "dev-graybox-overlay",
  "dialogue-placeholder",
  "debugOverlay",
  "見證紀錄",
  "回想已揭示",
  "個人使用候選版",
  "等待擁有者完成",
  "S2 · 遊戲提示",
  "data-testimony",
  "data-recall",
  "data-study-questions",
];
const TEXT_EXTENSIONS = new Set([".css", ".html", ".js", ".json", ".map"]);

async function textFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return textFiles(path);
      }
      return TEXT_EXTENSIONS.has(extname(entry.name)) ? [path] : [];
    }),
  );
  return nested.flat();
}

for (const file of await textFiles(DIST)) {
  const content = await readFile(file, "utf8");
  for (const token of FORBIDDEN) {
    if (content.includes(token)) {
      throw new Error(
        `Production bundle ${relative(DIST, file)} contains DEV-only token ${token}.`,
      );
    }
  }
}
