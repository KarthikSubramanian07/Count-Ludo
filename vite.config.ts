/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Count Ludo ships as a fully static site: zero backend, zero runtime deps.
// The PWA plugin gives us installability + offline once the assets are cached.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    // The whole game is small enough to want a single legible bundle.
    cssCodeSplit: false,
    reportCompressedSize: true,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: 'Count Ludo',
        short_name: 'Count Ludo',
        description: 'Play Ludo online free. No ads, no downloads, no signup.',
        theme_color: '#12131a',
        background_color: '#12131a',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.ts'],
      reporter: ['text', 'html'],
    },
  },
});
