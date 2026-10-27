import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    // MapLibre (~1.1 MB, ~300 KB gzip) ist bewusst ein eigener, nachgeladener Chunk.
    chunkSizeWarningLimit: 1200,
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
});
