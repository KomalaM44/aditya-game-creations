import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "../../docs/games/forest-camp-survival",
    emptyOutDir: true,
  },
});
