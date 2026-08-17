import { defineConfig, loadEnv } from "vite";

import appConfig from "./app.config.json";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    base: env.VITE_BASE_PATH || appConfig.entry,
    build: {
      target: "es2022",
    },
    server: {
      port: 4173,
    },
  };
});
