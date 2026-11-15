import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    // Rapier's compat build inlines its WASM (~1.7 MB gzipped); it loads only on the mission screen.
    chunkSizeWarningLimit: 5000,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
