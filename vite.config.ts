import { defineConfig } from "vite";

import appConfig from "./app.config.json";

export default defineConfig({
  base: appConfig.entry,
  build: {
    target: "es2022",
  },
  server: {
    port: 4173,
  },
});
