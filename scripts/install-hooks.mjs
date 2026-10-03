#!/usr/bin/env node
// Points git at .githooks/ (runs on `npm install`, via the "prepare" script),
// so the pre-commit hook runs `npm run verify` before every commit. Does
// nothing outside a git checkout, e.g. when installed from a tarball.
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const inGit = spawnSync('git', ['rev-parse', '--git-dir'], { cwd: root, stdio: 'ignore' }).status === 0;
if (inGit) {
  const r = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: root, stdio: 'inherit' });
  if (r.status === 0) console.log('[hooks] git hooks installed from .githooks/ (pre-commit runs npm run verify).');
}
