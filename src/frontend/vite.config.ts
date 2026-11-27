import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

// App palette (SPEC 7.5). Keep in sync with --color-primary / --color-bg in shared/styles/global.css.
const themeColor = '#1d4ed8';
const backgroundColor = '#ffffff';

const DEFAULT_API_BASE_URL = '/api/v1';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Workbox route for the read-only offline cache (SPEC 7.5, 10.8), built from VITE_API_BASE_URL so the
 * API path is never hard-coded twice. A relative base is anchored right after "scheme://host[:port]".
 */
function apiCachePattern(apiBaseUrl: string): RegExp {
  const base = apiBaseUrl.replace(/\/+$/, '');
  return /^https?:\/\//.test(base)
    ? new RegExp(`^${escapeRegExp(base)}/`)
    : new RegExp(`^https?://[^/]+${escapeRegExp(base)}/`);
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  const apiBaseUrl = env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        // Registered from React (virtual:pwa-register/react), no inline script: CSP-safe.
        injectRegister: false,
        includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180x180.png'],
        manifest: {
          name: 'MyTodoApp',
          short_name: 'Todo',
          description: 'Your personal task manager.',
          lang: 'en',
          start_url: '/today',
          scope: '/',
          display: 'standalone',
          theme_color: themeColor,
          background_color: backgroundColor,
          icons: [
            { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: '/icons/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // App shell: precache all build output (incl. every lazy page chunk).
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          cleanupOutdatedCaches: true,
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/health/, /^\/healthz/],
          runtimeCaching: [
            {
              urlPattern: apiCachePattern(apiBaseUrl),
              method: 'GET',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-v1',
                networkTimeoutSeconds: 10,
                expiration: { maxEntries: 100, maxAgeSeconds: 604800 },
                cacheableResponse: { statuses: [200] },
              },
            },
          ],
        },
      }),
    ],
    server: {
      port: 5173,
      // Local inner loop: the API runs on http://localhost:5080 (SPEC 10.7).
      proxy: {
        '/api': 'http://localhost:5080',
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      // A zone west of UTC, so a date-only value parsed as UTC would show up as the previous day.
      env: { TZ: 'America/Los_Angeles' },
      restoreMocks: true,
      unstubGlobals: true,
      unstubEnvs: true,
    },
  };
});
