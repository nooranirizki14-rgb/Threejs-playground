import { defineConfig } from 'vite';

// base './' => the production build works from ANY folder or sub-path
// (itch.io, GitHub Pages, a plain static host, ...).
export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['localhost', '127.0.0.1', '.e2b.app', '.arena.ai'],
  },
  preview: {
    host: '0.0.0.0',
    port: 5193,
    allowedHosts: ['localhost', '127.0.0.1', '.e2b.app', '.arena.ai'],
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
  },
});
