import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, normalizePath } from 'vite'
import { configDefaults } from 'vitest/config'

// Build output and Claude Code worktrees, as absolute folder prefixes. On
// Windows a watched folder can't be renamed, so watching release/ made
// electron-builder fail with EPERM. This is a prefix check, not a glob: the
// project folder's name has parentheses ("layers-source-project (2)"), which
// globs treat as syntax, and a bare '**/.claude/**' would match every file
// when the project is itself a worktree under .claude/.
const root = normalizePath(fileURLToPath(new URL('.', import.meta.url))).toLowerCase()
const unwatched = ['release', 'dist-local', 'dist', 'dist-e2e', 'dist-install', '.claude', 'ios'].map(dir => `${root}${dir}`)
const isUnwatched = (path) => {
  const p = normalizePath(path).toLowerCase()
  return unwatched.some(dir => p === dir || p.startsWith(`${dir}/`))
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    watch: { ignored: [isUnwatched] },
  },
  test: {
    // .claude/worktrees/ holds full checkouts of this repo made by Claude Code.
    // tests/e2e/ is Playwright's (npm run test:e2e), not Vitest's.
    exclude: [...configDefaults.exclude, '.claude/**', 'tests/e2e/**'],
    // Unit tests run in Node; tests/app/ opts into jsdom per file.
    setupFiles: ['tests/setup.js'],
    // The app tests drive the whole app, and a busy laptop (a game running,
    // say) can slow one past Vitest's 5 s default without anything being wrong.
    testTimeout: 15000,
  },
})
