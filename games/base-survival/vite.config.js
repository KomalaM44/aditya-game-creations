import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "../../docs/games/base-survival",
    emptyOutDir: true,
  },
});
