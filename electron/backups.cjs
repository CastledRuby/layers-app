// Daily backups (the owner's choice, 2026-10-05): once a day Layers saves a
// copy of everything, in the same format as Me > Export data, and keeps the
// newest 14. The renderer makes the backup (src/lib/backup.js createBackup)
// and hands it over; this writes the file and tidies up.
//
// A day's file is never overwritten, so it always holds the data as it was
// when Layers first ran that day: a mistake later that day (or starting over)
// can't replace a good backup.
const fs = require('fs');
const path = require('path');

const KEEP = 14;
const NAME = /^layers-backup-(\d{4}-\d{2}-\d{2})\.json$/;
const MAX_BYTES = 50 * 1024 * 1024;

// Documents\Layers backups, where it's easy to find. Test runs (with their
// own data folder) keep backups inside it instead.
function backupDir({ documents, userData, env = process.env }) {
  if (env.LAYERS_USER_DATA_DIR) return path.join(userData, 'Backups');
  return path.join(documents, 'Layers backups');
}

// Backup file names, newest first. Only files Layers names this way count.
function listBackups(dir) {
  try {
    return fs.readdirSync(dir).filter(n => NAME.test(n)).sort().reverse();
  } catch {
    return [];
  }
}

function backupsInfo(dir) {
  const files = listBackups(dir);
  return { dir, count: files.length, latest: files.length ? files[0].match(NAME)[1] : null };
}

// Saves `json` as the backup for `day` ('YYYY-MM-DD') unless that day has one,
// then removes all but the newest `keep`. Returns { saved, ...backupsInfo }.
function saveDailyBackup(dir, day, json, keep = KEEP) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: 'bad day' };
  if (typeof json !== 'string' || json.length > MAX_BYTES) return { error: 'bad backup' };
  try { JSON.parse(json); } catch { return { error: 'not JSON' }; }
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `layers-backup-${day}.json`);
  let saved = false;
  if (!fs.existsSync(file)) {
    // Written beside it first, so a half-written backup never has the name.
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, json);
    fs.renameSync(tmp, file);
    saved = true;
  }
  listBackups(dir).slice(keep).forEach(n => {
    try { fs.unlinkSync(path.join(dir, n)); } catch { /* in use: removed next time */ }
  });
  return { saved, ...backupsInfo(dir) };
}

module.exports = { backupDir, backupsInfo, listBackups, saveDailyBackup, KEEP };
