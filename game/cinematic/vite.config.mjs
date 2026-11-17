// Dev server for the intro video (not part of the game build). Run from game/:
//   npx vite --config cinematic/vite.config.mjs
// Serves game/ at the root, so the cinematic imports the game's src/ and loads public/terrain/ like the game does.
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(here, '..'),
  base: '/', // terrainUrl() builds on BASE_URL; '/' keeps it right from /cinematic/intro.html
  cacheDir: path.resolve(here, '.vite'), // own cache: never shares the game's (or another checkout's) prebundle
  server: {
    port: Number(process.env.CINEMATIC_PORT) || 5410,
    strictPort: true,
    open: false,
    fs: { allow: [path.resolve(here, '..'), path.resolve(here, '../node_modules')] },
  },
  logLevel: 'warn',
});
