#!/usr/bin/env node
// The fast checks to run after every change (docs/testing.md):
//
//   npm run verify
//
// 1. lint        oxlint: errors fail, warnings are listed
// 2. code map    docs/generated/code-map.md matches the source
// 3. tests       unit tests and the app tests that drive the whole UI (Vitest)
// 4. build       the renderer still builds
//
// The pre-commit hook runs this before every commit, and `npm run release`
// runs it before building. The slower end-to-end tests against the packaged
// app are `npm run test:e2e`; the release script runs those too.
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const steps = [
  ['lint', 'npx', ['oxlint', 'src', 'electron', 'scripts', 'tests']],
  ['code map', 'node', ['scripts/gen-code-map.mjs', '--check']],
  ['tests', 'npx', ['vitest', 'run']],
  ['build', 'npx', ['vite', 'build', '--config', 'vite.config.local.js', '--logLevel', 'warn']],
];

const results = [];
for (const [name, cmd, args] of steps) {
  const started = Date.now();
  console.log(`\n[verify] ${name}: ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  results.push(`${r.status === 0 ? '✓' : '✗'} ${name} (${seconds}s)`);
  if (r.status !== 0) {
    console.error(`\n[verify] ${results.join('  ')}`);
    if (name === 'code map') console.error('[verify] The code map is out of date: run `npm run docs:map` and commit it.');
    console.error(`[verify] ✗ ${name} failed.`);
    process.exit(r.status || 1);
  }
}
console.log(`\n[verify] ${results.join('  ')}`);
console.log('[verify] All checks passed.');
