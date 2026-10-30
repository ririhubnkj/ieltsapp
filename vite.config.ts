/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react()],
  // 自分専用版(npm run build:personal)はアーティファクトとして公開するので、
  // 出力先を分け、再公開のたびに同じパスへ上書きできるようファイル名を固定する
  // みんな向けの IELTS 版(npm run build:everyone)は公開版の dist の下 /ielts/ に出し、同じ GitHub Pages に載せる
  build:
    mode === 'everyone'
      ? { outDir: 'dist/ielts', emptyOutDir: true }
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
