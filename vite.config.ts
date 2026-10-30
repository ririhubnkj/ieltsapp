/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    react(),
    // IELTS 版はホーム画面に追加してアプリとして開け、一度開けばオフラインでも動くようにする
    ...(mode === 'everyone'
      ? [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icon.svg', 'apple-touch-icon.png'],
            manifest: {
              name: 'IELTS 4技能トレーニング',
              short_name: 'IELTS',
              description: 'レベル別の IELTS の Writing・Reading・語彙・Speaking 練習',
              lang: 'ja',
              start_url: '.',
              scope: '.',
              display: 'standalone',
              orientation: 'portrait',
              background_color: '#f5f2ea',
              theme_color: '#012169',
              icons: [
                { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
            workbox: {
              // 内蔵の題材がすべて JS に入っているので、上限を上げて丸ごと保存する
              maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
              globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
              runtimeCaching: [
                {
                  urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
                  handler: 'CacheFirst',
                  options: { cacheName: 'fonts', expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 } },
                },
              ],
            },
          }),
        ]
      : []),
  ],
  // 自分専用版(npm run build:personal)はアーティファクトとして公開するので、
  // 出力先を分け、再公開のたびに同じパスへ上書きできるようファイル名を固定する
  // みんな向けの IELTS 版(npm run build:everyone)は dist に出し、そのまま GitHub Pages のトップに載せる
  build:
    mode === 'everyone'
      ? { outDir: 'dist', emptyOutDir: true }
      : mode === 'personal'
      ? {
          outDir: 'dist-personal',
          rollupOptions: {
            output: {
              entryFileNames: 'assets/app.js',
              chunkFileNames: 'assets/[name].js',
              assetFileNames: 'assets/app[extname]',
            },
          },
        }
      : {},
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
}))
