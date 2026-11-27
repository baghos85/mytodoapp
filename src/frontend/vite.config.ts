import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: {
    port: 5173,
    // Local inner loop: the API runs on http://localhost:5080 (SPEC 10.7).
    proxy: {
      '/api': 'http://localhost:5080',
    },
  },
  test: {
    environment: 'node',
  },
});
