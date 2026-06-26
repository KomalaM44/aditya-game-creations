import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "../../docs/games/obby-123",
    emptyOutDir: true,
  },
});
