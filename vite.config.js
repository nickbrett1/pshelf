import { sveltekit } from "@sveltejs/kit/vite";
import { SvelteKitPWA } from "@vite-pwa/sveltekit";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    sveltekit(),
    // PWA support (manifest + service worker). Pshelf is SSR'd (adapter-node),
    // so the catalog data arrives inside the page HTML; offline support is
    // "network-first pages, cache-first covers & lazy editions". See README.
    SvelteKitPWA({
      // Take over as soon as a new build is deployed so a stale catalog never
      // lingers — the catalog reads from /data, not the SW cache.
      registerType: "autoUpdate",
      manifest: {
        name: "Pshelf",
        short_name: "Pshelf",
        description: "PlayStation Games on the Shelf",
        theme_color: "#0f1117",
        background_color: "#0f1117",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // SSR app: there's no static index.html to fall back to, so every page
        // is cached on visit below (network-first) instead of precaching a
        // single navigation fallback.
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // HTML pages (catalog, /psn, /fix): network-first so online you get
          // fresh data (the catalog read from /data), offline the last view.
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "pshelf-pages",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
            },
          },
          // Cover art (served from /data/covers): immutable per image, so
          // cache-first — covers work fully offline after first view.
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/covers/"),
            handler: "CacheFirst",
            options: {
              cacheName: "pshelf-covers",
              expiration: {
                maxEntries: 1500,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Lazy-loaded editions (per expanded card): serve cached instantly,
          // refresh in the background.
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/game/"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "pshelf-editions",
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    reporter: ["default", "junit"],
    outputFile: {
      junit: "./reports/junit.xml",
    },
    coverage: {
      reporter: ["lcov", "text"],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
