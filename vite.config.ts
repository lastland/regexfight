/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Project Pages site lives at https://lastland.github.io/regexfight/ so the
// production build needs the `/regexfight/` base prefix on every asset URL.
// `npm run dev` and Vitest stay at root (`/`) for ergonomics.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/regexfight/' : '/',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
}));
