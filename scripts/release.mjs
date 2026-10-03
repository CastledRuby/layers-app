// One-command release: bump, test, build, publish to GitHub, then install
// the new version on this computer.
//
//   npm run release                       patch bump (1.0.24 -> 1.0.25)
//   npm run release -- minor              or major, or an exact version like 1.2.0
//   npm run release -- --notes notes.md   release notes (default: commit subjects since the last tag)
//   npm run release -- --no-install       publish without installing here
//   npm run release -- --publish-only     re-upload the current version's built files (after a failed upload)
//   npm run release -- --install-only     just install the current version's installer from release/
//
// Order: everything local (bump, test, build, package) runs before anything
// leaves this computer, so a failure there leaves GitHub untouched. Then:
// commit "Release vX.Y.Z" and push it to main, create the published GitHub
// release with the asset names latest.yml expects, check the public update
// feed, quit the running Layers cleanly (Layers.exe --quit), install
// silently, relaunch, and check the installed app.asar carries the version.
//
// Needs the GitHub CLI logged in to an account that can publish to REPO
// (gh auth login). Windows only: it builds and installs the NSIS installer.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO = 'CastledRuby/layers-app';
const RELEASE_DIR = join(root, 'release');
const INSTALL_DIR = join(process.env.LOCALAPPDATA || '', 'Programs', 'Layers');

const args = process.argv.slice(2);
const has = (name) => args.includes(name);
const valueOf = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const notesFile = valueOf('--notes');
const bump = args.find(a => !a.startsWith('--') && a !== notesFile) || 'patch';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (msg) => console.log(`\n[release] ${msg}`);
function fail(msg) {
  console.error(`\n[release] ✗ ${msg}`);
  process.exit(1);
}

// Runs a command with live output; stops the release if it fails.
// npm/npx are .cmd shims on Windows, so they need a shell.
function run(cmd, cmdArgs, { capture = false, allowFail = false, shell = false } = {}) {
  const r = spawnSync(cmd, cmdArgs, { cwd: root, stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8', shell });
  if (r.error) fail(`${cmd} could not start: ${r.error.message}`);
  if (r.status !== 0 && !allowFail) fail(`"${cmd} ${cmdArgs.join(' ')}" exited with ${r.status}${capture && r.stderr ? `\n${r.stderr}` : ''}`);
  return r;
}
const output = (cmd, cmdArgs, opts) => (run(cmd, cmdArgs, { ...opts, capture: true }).stdout || '').trim();
const npm = (...a) => run('npm', a, { shell: true });
const git = (...a) => run('git', a);
const gitOut = (...a) => output('git', a);
const readVersion = () => JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

function findGh() {
  const candidates = [
    'gh',
    join(process.env.ProgramFiles || 'C:\\Program Files', 'GitHub CLI', 'gh.exe'),
    join(process.env.LOCALAPPDATA || '', 'Programs', 'GitHub CLI', 'gh.exe'),
  ];
  for (const c of candidates) {
    if (spawnSync(c, ['--version'], { encoding: 'utf8' }).status === 0) return c;
  }
  fail('GitHub CLI not found. Install it (winget install GitHub.cli), then run "gh auth login".');
}

// electron-builder writes "Layers Setup X.exe"; GitHub stores hyphenated
// names, and latest.yml (which installed apps read) points at those.
function releaseAssets(v) {
  return {
    [`Layers-Setup-${v}.exe`]: `Layers Setup ${v}.exe`,
    [`Layers-Setup-${v}.exe.blockmap`]: `Layers Setup ${v}.exe.blockmap`,
    [`Layers-${v}.exe`]: `Layers ${v}.exe`,
    'latest.yml': 'latest.yml',
  };
}

function checkBuiltFiles(v) {
  for (const local of Object.values(releaseAssets(v))) {
    if (!existsSync(join(RELEASE_DIR, local))) fail(`release/${local} is missing. Build it first (npm run electron:build:win).`);
  }
  const feed = readFileSync(join(RELEASE_DIR, 'latest.yml'), 'utf8');
  if (!feed.includes(`version: ${v}`) || !feed.includes(`Layers-Setup-${v}.exe`)) fail(`release/latest.yml is not for ${v}.`);
}

function releaseNotes(v) {
  if (notesFile) return notesFile;
  const prevTag = output('git', ['describe', '--tags', '--abbrev=0', '--match', 'v*', 'HEAD^'], { allowFail: true });
  const range = prevTag ? `${prevTag}..HEAD` : 'HEAD';
  const subjects = gitOut('log', '--no-merges', '--format=%s', range)
    .split('\n').map(s => s.trim()).filter(s => s && !/^Release v/.test(s));
  const lines = ['## Changes', '', ...(subjects.length ? subjects.map(s => `- ${s}`) : ['- Maintenance release'])];
  if (prevTag) lines.push('', `**Full changelog:** https://github.com/${REPO}/compare/${prevTag}...v${v}`);
  const file = join(RELEASE_DIR, `notes-${v}.md`);
  writeFileSync(file, lines.join('\n') + '\n');
  return file;
}

async function publish(gh, v) {
  checkBuiltFiles(v);
  if (spawnSync(gh, ['release', 'view', `v${v}`, '-R', REPO], { encoding: 'utf8' }).status === 0) {
    fail(`GitHub already has a v${v} release. Bump the version instead of overwriting it.`);
  }
  const stage = join(RELEASE_DIR, `upload-${v}`);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  const uploads = Object.entries(releaseAssets(v)).map(([published, local]) => {
    const dest = join(stage, published);
    copyFileSync(join(RELEASE_DIR, local), dest);
    return dest;
  });
  const sha = gitOut('rev-parse', 'HEAD');
  log(`Publishing GitHub release v${v} (${sha.slice(0, 7)})…`);
  run(gh, ['release', 'create', `v${v}`, '-R', REPO, '--target', sha, '--title', v, '--notes-file', releaseNotes(v), ...uploads]);
  rmSync(stage, { recursive: true, force: true });

  // What installed copies of Layers actually check for updates.
  const feedUrl = `https://github.com/${REPO}/releases/latest/download/latest.yml`;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const feed = await (await fetch(feedUrl)).text();
      if (feed.includes(`version: ${v}`)) { log(`Update feed now offers ${v}.`); return; }
    } catch { /* retry */ }
    await sleep(5000);
  }
  console.warn(`[release] ! The release exists, but ${feedUrl} did not show ${v} yet. Check it on GitHub.`);
}

// Reads one file out of an asar archive (header: 16-byte pickle prefix,
// JSON index, then file data), to check what the installed app contains.
function readAsarFile(asarPath, name) {
  const buf = readFileSync(asarPath);
  const headerSize = buf.readUInt32LE(12);
  const header = JSON.parse(buf.toString('utf8', 16, 16 + headerSize));
  const entry = header.files[name];
  const base = 8 + buf.readUInt32LE(4);
  return buf.toString('utf8', base + Number(entry.offset), base + Number(entry.offset) + entry.size);
}

function layersRunning() {
  const r = spawnSync('tasklist', ['/FI', 'IMAGENAME eq Layers.exe', '/NH'], { encoding: 'utf8' });
  return /Layers\.exe/i.test(r.stdout || '');
}

async function install(v) {
  const installer = join(RELEASE_DIR, `Layers Setup ${v}.exe`);
  if (!existsSync(installer)) fail(`release/Layers Setup ${v}.exe is missing. Build it first.`);
  const installedExe = join(INSTALL_DIR, 'Layers.exe');
  if (layersRunning() && existsSync(installedExe)) {
    log('Asking the running Layers to quit…');
    spawnSync(installedExe, ['--quit'], { stdio: 'ignore', timeout: 20000 });
    for (let i = 0; i < 30 && layersRunning(); i++) await sleep(500);
    // Builds before 1.0.25 ignore --quit; the installer closes those itself.
  }
  log(`Installing Layers ${v} on this computer…`);
  const r = spawnSync(installer, ['/S', '--force-run'], { stdio: 'inherit', timeout: 5 * 60 * 1000 });
  if (r.status !== 0) fail(`The installer exited with ${r.status}.`);
  const installed = JSON.parse(readAsarFile(join(INSTALL_DIR, 'resources', 'app.asar'), 'package.json')).version;
  if (installed !== v) fail(`Installed app reports ${installed}, expected ${v}.`);
  for (let i = 0; i < 20 && !layersRunning(); i++) await sleep(500);
  log(layersRunning() ? `Layers ${v} is installed and running.` : `Layers ${v} is installed. Start it from the Start menu.`);
}

async function main() {
  if (process.platform !== 'win32') fail('Releases are built and installed on Windows.');

  if (has('--install-only')) return install(readVersion());
  const gh = findGh();
  run(gh, ['auth', 'status'], { capture: true });

  if (has('--publish-only')) {
    const v = readVersion();
    await publish(gh, v);
    if (!has('--no-install')) await install(v);
    return;
  }

  if (gitOut('status', '--porcelain')) fail('There are uncommitted changes. Commit them first, so the release matches a commit.');
  git('fetch', 'origin', '--tags', '--quiet');
  if (run('git', ['merge-base', '--is-ancestor', 'origin/main', 'HEAD'], { allowFail: true }).status !== 0) {
    fail('HEAD does not contain origin/main. Pull or merge first, so the push to main is a fast-forward.');
  }

  npm('version', bump, '--no-git-tag-version');
  const v = readVersion();
  if (gitOut('ls-remote', '--tags', 'origin', `v${v}`)) {
    git('checkout', '--', 'package.json', 'package-lock.json');
    fail(`Tag v${v} already exists on GitHub.`);
  }
  log(`Releasing ${v}`);

  npm('test');
  npm('run', 'build:electron');
  npm('run', 'docs:map');
  run('npx', ['electron-builder', '--win', '--x64', '--publish', 'never'], { shell: true });
  checkBuiltFiles(v);

  git('add', '-A');
  git('commit', '--quiet', '-m', `Release v${v}`);
  git('push', 'origin', 'HEAD:main');

  await publish(gh, v);
  if (!has('--no-install')) await install(v);
  log(`Done: https://github.com/${REPO}/releases/tag/v${v}`);
}

main().catch(err => fail(err && err.stack ? err.stack : String(err)));
