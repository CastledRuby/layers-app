import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    watch: {
      // Build output. On Windows a watched folder can't be renamed, so a
      // running dev server made electron-builder fail with EPERM when it
      // moved release/<version>/win-unpacked.tmp into place.
      ignored: ['**/release/**', '**/dist-local/**', '**/dist/**', '**/.claude/**'],
    },
  },
  test: {
    // .claude/worktrees/ holds full checkouts of this repo made by Claude Code.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
})
