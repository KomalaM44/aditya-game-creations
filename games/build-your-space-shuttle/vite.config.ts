import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: '../../docs/games/build-your-space-shuttle',
    emptyOutDir: true
  }
});
