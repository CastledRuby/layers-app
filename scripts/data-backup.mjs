// A copy of your Layers data before an install: its Local Storage folder,
// copied to %APPDATA%\layers-web\Install backups\<when> before <label>\ (the
// newest 10 are kept). Both installs take one: the post-commit one
// (install-local.mjs) and a release's (release.mjs; it took none until the
// audit of 2026-10-14). See docs/build-and-release.md.
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export const DATA_DIR = join(process.env.APPDATA || '', 'layers-web');
export const BACKUPS_DIR = join(DATA_DIR, 'Install backups');
const KEEP_BACKUPS = 10;

// The folder it made, or null when there's no data yet.
export function backUpData(label, { dataDir = DATA_DIR, backupsDir = BACKUPS_DIR, now = new Date() } = {}) {
  const source = join(dataDir, 'Local Storage');
  if (!existsSync(source)) return null;
  const pad = (n) => String(n).padStart(2, '0');
  const when = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const dest = join(backupsDir, `${when} before ${label}`);
  cpSync(source, join(dest, 'Local Storage'), { recursive: true });
  const all = readdirSync(backupsDir).sort();
  for (const old of all.slice(0, Math.max(all.length - KEEP_BACKUPS, 0))) rmSync(join(backupsDir, old), { recursive: true, force: true });
  return dest;
}
