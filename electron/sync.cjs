// Sync through OneDrive (docs/roadmap.md, "The plan from here"): the main
// process only moves the encrypted sync file and keeps the passphrase. The
// page encrypts, decrypts and merges (src/lib/syncFile.js), so a phone can do
// the same with the same code. See docs/electron.md.
//
// The file is Documents\Layers sync\layers-sync.json. Documents is in
// OneDrive on this laptop, so OneDrive carries it to other devices. When two
// devices write at once, OneDrive keeps both, naming the other copy after
// the computer ("layers-sync-LAPTOP.json"); every copy is read and merged,
// then the copies are removed.

const fs = require('fs');
const path = require('path');

const FILE = 'layers-sync.json';
const COPY = /^layers-sync.*\.json$/i;
const MAX_BYTES = 30 * 1024 * 1024;

// Documents\Layers sync, or Sync in the data folder for tests (or
// LAYERS_SYNC_DIR, so two test runs can share one).
function syncDir({ documents, userData, env = process.env }) {
  if (env.LAYERS_SYNC_DIR) return env.LAYERS_SYNC_DIR;
  if (env.LAYERS_USER_DATA_DIR) return path.join(userData, 'Sync');
  return path.join(documents, 'Layers sync');
}

// Every sync file in the folder, the main one first: [{ name, text }].
function readSyncFiles(dir) {
  let names = [];
  try { names = fs.readdirSync(dir).filter(n => COPY.test(n)); } catch { return []; }
  names.sort((a, b) => (a === FILE ? -1 : b === FILE ? 1 : a.localeCompare(b)));
  return names.flatMap(name => {
    try {
      const file = path.join(dir, name);
      if (fs.statSync(file).size > MAX_BYTES) return [];
      return [{ name, text: fs.readFileSync(file, 'utf8') }];
    } catch { return []; }
  });
}

// Written to a temporary file first, then renamed over the old one, so
// OneDrive (and a crash) never sees half a file.
function writeSyncFile(dir, text) {
  if (typeof text !== 'string' || text.length > MAX_BYTES) return { error: 'too large' };
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${FILE}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, path.join(dir, FILE));
  return { ok: true };
}

// Removes the other copies that were merged (only sync files, never the main one).
function removeSyncCopies(dir, names) {
  (Array.isArray(names) ? names : []).forEach(name => {
    if (typeof name !== 'string' || name === FILE || !COPY.test(name) || name !== path.basename(name)) return;
    try { fs.unlinkSync(path.join(dir, name)); } catch { /* already gone */ }
  });
  return { ok: true };
}

// A main file that can't be read is kept but no longer read: renamed to
// layers-sync.unreadable-<time>.bak, so a new one can be written.
function setAsideSyncFile(dir, now = new Date()) {
  try { fs.renameSync(path.join(dir, FILE), path.join(dir, `layers-sync.unreadable-${now.toISOString().replace(/[:.]/g, '-')}.bak`)); } catch { /* not there */ }
  return { ok: true };
}

// The passphrase, kept in the data folder encrypted by Windows for this user
// (Electron's safeStorage, DPAPI): readable only by this Windows account.
function passphraseStore(file, safeStorage) {
  return {
    get() {
      try {
        if (!fs.existsSync(file) || !safeStorage.isEncryptionAvailable()) return null;
        return safeStorage.decryptString(fs.readFileSync(file));
      } catch { return null; }
    },
    set(passphrase) {
      if (typeof passphrase !== 'string' || !passphrase) return { error: 'empty' };
      if (!safeStorage.isEncryptionAvailable()) return { error: 'Windows can’t protect it here' };
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, safeStorage.encryptString(passphrase));
      return { ok: true };
    },
    clear() {
      try { fs.unlinkSync(file); } catch { /* not there */ }
      return { ok: true };
    },
  };
}

module.exports = { FILE, passphraseStore, readSyncFiles, removeSyncCopies, setAsideSyncFile, syncDir, writeSyncFile };
