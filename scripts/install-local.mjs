#!/usr/bin/env node
// Builds the current code and installs it on this computer, so the Layers you
// use always matches the source, not just the last release. The git hooks run
// it after every commit (.githooks/post-commit, post-merge); see
// docs/build-and-release.md.
//
//   npm run install:local                          build and install now
//   node scripts/install-local.mjs --if-changed    (the hooks) skip when the
//                                                  installed app already has this code
//
// It builds the Windows installer the way a release does (electron-builder,
// NSIS only, into dist-install/) and runs it silently. Nothing is published.
// The version reads like 1.0.28+local.abc1234: the last release, then the
// commit. The update check treats that as 1.0.28, so the next real release
// still installs over it.
//
// Each install: quit the running Layers cleanly (Layers.exe --quit), copy your
// data's Local Storage folder to %APPDATA%\layers-web\Install backups\ (the
// newest 10 are kept), install, then start Layers again: with its window if it
// was showing, otherwise in the tray.
//
// Skipped when LAYERS_NO_INSTALL is set, while npm run release is committing
// (LAYERS_RELEASING; the release installs its own build), during a rebase,
// and off Windows.
import { spawn, spawnSync } from 'node:child_process';
import { closeSync, cpSync, existsSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INSTALL_DIR = join(process.env.LOCALAPPDATA || '', 'Programs', 'Layers');
const INSTALLED_EXE = join(INSTALL_DIR, 'Layers.exe');
const INSTALLED_ASAR = join(INSTALL_DIR, 'resources', 'app.asar');
const DATA_DIR = join(process.env.APPDATA || '', 'layers-web');
const BACKUPS_DIR = join(DATA_DIR, 'Install backups');
const KEEP_BACKUPS = 10;
const OUT = join(root, 'dist-install');
const GENERATED = 'electron/app/index.html';
// Paths that don't end up in the app: changing only these needs no install.
// The iPhone project and its GitHub build don't reach the Windows app either.
const APP_CODE = ['.', ':(exclude)docs', ':(exclude)tests', ':(exclude)scripts', ':(exclude).githooks', ':(exclude).claude', ':(exclude)branding', ':(exclude)*.md', `:(exclude)${GENERATED}`, ':(exclude)ios', ':(exclude).github', ':(exclude)capacitor.config.json'];

const ifChanged = process.argv.includes('--if-changed');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (msg) => console.log(`[install] ${msg}`);
function fail(msg) {
  console.error(`[install] ✗ ${msg}`);
  process.exit(1);
}

// Layers is started without git's or Electron's variables from this shell
// (ELECTRON_RUN_AS_NODE would make Layers.exe run as plain Node).
const appEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(GIT_|ELECTRON_)/.test(k)));

// npm and npx are .cmd shims on Windows, so they run through a shell, as one
// command line (no argument here contains a space).
function run(cmd, args, { capture = false, allowFail = false } = {}) {
  const shell = cmd === 'npm' || cmd === 'npx';
  const r = shell
    ? spawnSync([cmd, ...args].join(' '), { cwd: root, stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8', shell: true })
    : spawnSync(cmd, args, { cwd: root, stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8' });
  if (r.error) fail(`${cmd} could not start: ${r.error.message}`);
  if (r.status !== 0 && !allowFail) fail(`"${cmd} ${args.join(' ')}" exited with ${r.status}`);
  return r;
}
const git = (...args) => run('git', args, { capture: true, allowFail: true });
const gitOut = (...args) => (git(...args).stdout || '').trim();

// Which commit is installed, shared by every worktree (npm run release writes it too).
const STAMP = resolve(root, gitOut('rev-parse', '--git-common-dir'), 'layers-installed.json');
const LOCK = resolve(root, gitOut('rev-parse', '--git-common-dir'), 'layers-install.lock');

function readStamp() {
  try { return JSON.parse(readFileSync(STAMP, 'utf8')); } catch { return null; }
}

// Does the installed app already have this code? Compares the app's files at
// HEAD with the commit last installed, and counts uncommitted changes to them.
function alreadyInstalled(head) {
  const stamp = readStamp();
  if (!stamp || stamp.uncommitted || !existsSync(INSTALLED_ASAR)) return false;
  if (gitOut('status', '--porcelain', '--', ...APP_CODE)) return false;
  if (stamp.commit === head) return true;
  return git('diff', '--quiet', stamp.commit, head, '--', ...APP_CODE).status === 0;
}

// Whether this copy is a linked worktree (a Claude session's, under
// .claude/worktrees/) rather than the main checkout: its git folder isn't the
// shared one.
function inWorktree() {
  return resolve(root, gitOut('rev-parse', '--git-dir')).toLowerCase() !== resolve(root, gitOut('rev-parse', '--git-common-dir')).toLowerCase();
}

// Only main installs from the hooks (decided 2026-10-10): several Claude
// sessions commit in their own worktrees at once, and each install replaced
// the last, so the Layers on this computer changed with whichever session
// committed last. A worktree's commits don't install; merging into main
// does, and npm run install:local still installs any copy by hand.
function skipReason() {
  if (process.env.LAYERS_NO_INSTALL) return 'LAYERS_NO_INSTALL is set';
  if (ifChanged && inWorktree()) return 'this is a worktree, and only main installs (merge into main, or run npm run install:local here)';
  if (process.env.LAYERS_RELEASING) return 'npm run release installs its own build';
  if (process.platform !== 'win32') return 'Layers is installed on Windows only';
  if (['rebase-merge', 'rebase-apply'].some(p => existsSync(resolve(root, gitOut('rev-parse', '--git-path', p))))) return 'a rebase is in progress; the next commit installs';
  return null;
}

// One install at a time (commits in two worktrees at once). A lock older
// than 15 minutes is left over from a run that died.
async function takeLock() {
  for (let waited = 0; ; waited += 2000) {
    try {
      closeSync(openSync(LOCK, 'wx'));
      process.on('exit', () => rmSync(LOCK, { force: true }));
      return;
    } catch {
      let age = Infinity;
      try { age = Date.now() - statSync(LOCK).mtimeMs; } catch { /* just released */ }
      if (age > 15 * 60 * 1000) { rmSync(LOCK, { force: true }); continue; }
      if (waited === 0) log('Another install is running; waiting for it…');
      if (waited > 10 * 60 * 1000) fail(`Gave up waiting for the other install (${LOCK}).`);
      await sleep(2000);
    }
  }
}

// Reads one file out of an asar archive (header: 16-byte pickle prefix, JSON
// index, then file data). Same as scripts/release.mjs.
function readAsarFile(asarPath, name) {
  const buf = readFileSync(asarPath);
  const header = JSON.parse(buf.toString('utf8', 16, 16 + buf.readUInt32LE(12)));
  const entry = header.files[name];
  const base = 8 + buf.readUInt32LE(4);
  return buf.toString('utf8', base + Number(entry.offset), base + Number(entry.offset) + entry.size);
}

// Every running Layers.exe: [{ id, installed (it's the one in the install
// folder), renderer (its page) }]. Copies elsewhere aren't the Layers on this
// computer: another Claude session's end-to-end tests run their own build
// (2026-10-10), and only the installed one is asked to quit, stopped or
// checked on. Windows' installer won't run past any of them, though.
function layersProcesses() {
  const r = spawnSync('powershell', ['-NoProfile', '-Command', 'Get-CimInstance Win32_Process -Filter "Name=\'Layers.exe\'" | ForEach-Object { [pscustomobject]@{ id = $_.ProcessId; path = $_.ExecutablePath; renderer = [bool]($_.CommandLine -match \'--type=renderer\') } } | ConvertTo-Json -Compress'], { encoding: 'utf8' });
  let list = [];
  try { const v = JSON.parse((r.stdout || '').trim() || '[]'); list = Array.isArray(v) ? v : [v]; } catch { /* none running */ }
  return list.filter(Boolean).map(p => ({ id: p.id, installed: String(p.path || '').toLowerCase() === INSTALLED_EXE.toLowerCase(), renderer: !!p.renderer }));
}
const layersRunning = () => layersProcesses().some(p => p.installed);
const otherCopies = () => layersProcesses().filter(p => !p.installed);
// Whether Layers' page is running (a renderer process; its window is made,
// shown or not, as it starts). A Layers whose main process hit an error on
// start never gets one: it shows Electron's "Error" box, which still counts as
// running, and can't answer --quit.
const pageRunning = () => layersProcesses().some(p => p.installed && p.renderer);
async function waitForPage(seconds) {
  for (let i = 0; i < seconds * 2 && !pageRunning(); i++) await sleep(500);
  return pageRunning();
}
// Every package Layers needs when it runs (package.json's dependencies) is in
// this copy's node_modules. On 2026-10-10 a copy without the Claude SDK (a
// worktree whose npm install was incomplete) built a Layers that crashed on
// start, and installed it here.
function missingDependencies() {
  const deps = Object.keys(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).dependencies || {});
  return deps.filter(name => !existsSync(join(root, 'node_modules', ...name.split('/'), 'package.json')));
}
// Whether the installed Layers has its window showing (not a test copy's).
function windowShowing() {
  const r = spawnSync('powershell', ['-NoProfile', '-Command', '@(Get-Process Layers -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 -and $_.Path -eq $env:LAYERS_INSTALLED_EXE }).Count'], { encoding: 'utf8', env: { ...process.env, LAYERS_INSTALLED_EXE: INSTALLED_EXE } });
  return Number((r.stdout || '').trim()) > 0;
}

function backUpData(label) {
  const source = join(DATA_DIR, 'Local Storage');
  if (!existsSync(source)) return null;
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const when = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const dest = join(BACKUPS_DIR, `${when} before ${label}`);
  cpSync(source, join(dest, 'Local Storage'), { recursive: true });
  const all = readdirSync(BACKUPS_DIR).sort();
  for (const old of all.slice(0, Math.max(all.length - KEEP_BACKUPS, 0))) rmSync(join(BACKUPS_DIR, old), { recursive: true, force: true });
  return dest;
}

async function main() {
  const skip = skipReason();
  if (skip) { if (ifChanged) log(`Not installing: ${skip}.`); else fail(`Can't install: ${skip}.`); return; }

  await takeLock();
  const head = gitOut('rev-parse', 'HEAD');
  if (ifChanged && alreadyInstalled(head)) { log(`Layers on this computer already has this code (${head.slice(0, 7)}).`); return; }

  const missing = missingDependencies();
  if (missing.length) fail(`This copy's node_modules is missing ${missing.join(', ')}, so the build would crash on start. Run npm install here, then npm run install:local.`);

  const uncommitted = Boolean(gitOut('status', '--porcelain', '--', ...APP_CODE));
  const release = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
  const version = `${release}+local.${head.slice(0, 7)}${uncommitted ? '.uncommitted' : ''}`;
  log(`Building Layers ${version}…`);

  // build:electron rewrites the tracked electron/app/index.html, which only
  // releases commit. Put it back afterwards if it was unchanged before.
  const generatedWasClean = !gitOut('status', '--porcelain', '--', GENERATED);
  try {
    run('npm', ['run', '--silent', 'build:electron']);
    rmSync(OUT, { recursive: true, force: true });
    run('npx', ['electron-builder', '--win', 'nsis', '--x64', '--publish', 'never', `--config.directories.output=${relative(root, OUT)}`, `--config.extraMetadata.version=${version}`]);
  } finally {
    if (generatedWasClean) git('checkout', '--', GENERATED);
  }
  const installer = join(OUT, `Layers Setup ${version}.exe`);
  if (!existsSync(installer)) fail(`The build has no ${relative(root, installer)}.`);

  // A Layers that crashed on start can't quit itself: it's stopped instead.
  if (layersRunning() && !(await waitForPage(5))) {
    log('The running Layers crashed on start, so it was stopped.');
    layersProcesses().filter(p => p.installed).forEach(p => spawnSync('taskkill', ['/PID', String(p.id), '/F'], { stdio: 'ignore' }));
    for (let i = 0; i < 20 && layersRunning(); i++) await sleep(500);
  }
  const showWindow = layersRunning() && windowShowing();
  if (layersRunning() && existsSync(INSTALLED_EXE)) {
    log('Asking the running Layers to quit…');
    spawnSync(INSTALLED_EXE, ['--quit'], { stdio: 'ignore', timeout: 20000, env: appEnv });
    for (let i = 0; i < 40 && layersRunning(); i++) await sleep(500);
    if (layersRunning()) fail("Layers didn't quit, so nothing was installed. Quit it from the tray icon and run npm run install:local.");
  }

  // Windows' installer won't run while any Layers.exe is open (it exited with 2
  // when another session's tests had theirs open), so wait for those to close.
  if (otherCopies().length) {
    log("Waiting for other copies of Layers (another session's tests, perhaps) to close…");
    for (let i = 0; i < 300 && otherCopies().length; i++) await sleep(1000);
    if (otherCopies().length) {
      if (existsSync(INSTALLED_EXE) && !layersRunning()) spawn(INSTALLED_EXE, showWindow ? [] : ['--hidden'], { detached: true, stdio: 'ignore', env: appEnv }).unref();
      fail("Other copies of Layers are still open (another session's tests, perhaps), and Windows won't install while they are. The Layers that was installed before was started again; run npm run install:local once they've closed.");
    }
  }

  const backup = backUpData(version);
  if (backup) log(`Backed up your data to ${backup}`);

  log(`Installing Layers ${version}…`);
  const r = spawnSync(installer, ['/S'], { stdio: 'inherit', timeout: 5 * 60 * 1000, env: appEnv });
  if (r.error || r.status !== 0) {
    if (existsSync(INSTALLED_EXE) && !layersRunning()) spawn(INSTALLED_EXE, showWindow ? [] : ['--hidden'], { detached: true, stdio: 'ignore', env: appEnv }).unref();
    fail(`The installer ${r.error ? `couldn't start (${r.error.code || r.error.message})` : `exited with ${r.status}`}. The Layers that was installed before was started again.`);
  }
  const installed = JSON.parse(readAsarFile(INSTALLED_ASAR, 'package.json')).version;
  if (installed !== version) fail(`The installed app reports ${installed}, expected ${version}.`);

  spawn(INSTALLED_EXE, showWindow ? [] : ['--hidden'], { detached: true, stdio: 'ignore', env: appEnv }).unref();
  for (let i = 0; i < 20 && !layersRunning(); i++) await sleep(500);
  await sleep(3000); // still running a moment later, so it didn't crash on startup
  if (!layersRunning()) fail(`Layers ${version} is installed but didn't stay running. Start it from the Start menu to see what happens; your data backup is in ${backup}.`);
  if (!(await waitForPage(15))) fail(`Layers ${version} is installed but hit a problem on start (its page never opened; there may be an "Error" box). Your data backup is in ${backup}.`);

  writeFileSync(STAMP, JSON.stringify({ commit: head, uncommitted, version, installedAt: new Date().toISOString() }, null, 2) + '\n');
  log(`Layers ${version} is installed and running${showWindow ? '' : ' (in the tray)'}.`);
}

main().catch(err => fail(err && err.stack ? err.stack : String(err)));
