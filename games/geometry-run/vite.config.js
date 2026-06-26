import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "../../docs/games/geometry-run",
    emptyOutDir: true,
  },
});
