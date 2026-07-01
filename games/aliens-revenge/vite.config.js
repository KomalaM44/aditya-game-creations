import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "../../docs/games/aliens-revenge",
    emptyOutDir: true,
  },
});
