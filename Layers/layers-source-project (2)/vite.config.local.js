import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Config for a single, self-contained HTML file you can double-click and
// open directly from disk (no server, no install).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  build: {
    outDir: 'dist-local',
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
  },
})
