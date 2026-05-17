/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import content from './vite-plugins/content';

// Project Pages site lives at https://lastland.github.io/regexfight/ so the
// production build needs the `/regexfight/` base prefix on every asset URL.
// `npm run dev` and Vitest stay at root (`/`) for ergonomics.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/regexfight/' : '/',
  plugins: [react(), content()],
  build: {
    // YAML and JSON content assets must never be inlined as base64 data
    // URLs in the JS bundle — that would defeat the whole point of the
    // content plugin. The default 4096 B threshold puts some content files
    // on the boundary. Returning `undefined` for everything else means
    // "fall back to the default threshold".
    assetsInlineLimit: (filePath) =>
      filePath.endsWith('.yaml') || filePath.endsWith('.json')
        ? false
        : undefined,
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'vite-plugins/**/*.test.ts'],
  },
}));
