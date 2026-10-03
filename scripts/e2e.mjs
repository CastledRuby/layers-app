#!/usr/bin/env node
// End-to-end tests against the packaged app (docs/testing.md).
//
//   npm run test:e2e                 build the renderer, package dist-e2e/, run tests/e2e
//   npm run test:e2e -- --no-build   reuse the last dist-e2e/ build
//   node scripts/e2e.mjs --exe <path to Layers.exe>
//                                    test an existing build (the release script
//                                    passes release/<version>/win-unpacked)
//
// The tests launch Layers with a temporary data folder, so they never touch
// your real Layers data, and they can run while Layers is open.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const exeArg = args.includes('--exe') ? args[args.indexOf('--exe') + 1] : null;
const build = !exeArg && !args.includes('--no-build');
const exe = exeArg ? resolve(exeArg) : join(root, 'dist-e2e', 'win-unpacked', 'Layers.exe');

function run(cmd, cmdArgs, env = process.env) {
  console.log(`\n[e2e] ${cmd} ${cmdArgs.join(' ')}`);
  const r = spawnSync(cmd, cmdArgs, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', env });
  if (r.status !== 0) {
    console.error(`[e2e] ${cmd} exited with ${r.status}`);
    process.exit(r.status || 1);
  }
}

if (build) {
  run('npm', ['run', 'build:electron']);
  run('npx', ['electron-builder', '--win', '--x64', '--dir', '--publish', 'never', '--config.directories.output=dist-e2e']);
}
if (!existsSync(exe)) {
  console.error(`[e2e] No packaged app at ${exe}. Run without --no-build first.`);
  process.exit(1);
}
run('npx', ['playwright', 'test'], { ...process.env, LAYERS_EXE: exe });
console.log('\n[e2e] All end-to-end tests passed.');
