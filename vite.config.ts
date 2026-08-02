import { defineConfig } from "vite";

import gameManifest from "./game.manifest.json";

export default defineConfig({
  base: gameManifest.entry,
  build: {
    target: "es2022",
  },
  server: {
    port: 4173,
  },
});
