import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const FORBIDDEN = [
  "b14-stress",
  "JOHN9_DEV_ONLY_B14_STRESS",
  "developer-b14-layout-sequence",
  "dev-b14-fixture",
];
const TEXT_EXTENSIONS = new Set([".css", ".html", ".js", ".json", ".map"]);
const FORBIDDEN_PATH_PARTS = [
  "production/art-pipeline",
  "production/art-source",
  "/candidates/",
  "contact-sheet",
  "selected-source",
];

async function bundleFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return bundleFiles(path);
      }
      return [path];
    }),
  );
  return nested.flat();
}

for (const file of await bundleFiles(DIST)) {
  const bundlePath = relative(DIST, file).replaceAll("\\", "/");
  for (const token of FORBIDDEN_PATH_PARTS) {
    if (`/${bundlePath}`.includes(token)) {
      throw new Error(`Production bundle contains raw art path ${bundlePath}.`);
    }
  }
  if (!TEXT_EXTENSIONS.has(extname(file))) {
    continue;
  }
  const content = await readFile(file, "utf8");
  for (const token of FORBIDDEN) {
    if (content.includes(token)) {
      throw new Error(
        `Production bundle ${relative(DIST, file)} contains DEV-only token ${token}.`,
      );
    }
  }
}
