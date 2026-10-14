import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { backupDir, listBackups, saveDailyBackup } from '../electron/backups.cjs';

const dirs = [];
const tempDir = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'layers-backups-')); dirs.push(d); return d; };
afterEach(() => { dirs.splice(0).forEach(d => fs.rmSync(d, { recursive: true, force: true })); });

describe('daily backups', () => {
  it("saves a day's backup once and never overwrites it", () => {
    const dir = path.join(tempDir(), 'Layers backups');
    const on = new Date(2026, 9, 5);
    expect(saveDailyBackup(dir, '2026-10-05', '{"people":[1]}', 14, on)).toMatchObject({ saved: true, count: 1, latest: '2026-10-05' });
    expect(saveDailyBackup(dir, '2026-10-05', '{"people":[]}', 14, on)).toMatchObject({ saved: false, count: 1 });
    expect(fs.readFileSync(path.join(dir, 'layers-backup-2026-10-05.json'), 'utf8')).toBe('{"people":[1]}');
  });

  it('keeps the newest 14, and leaves other files alone', () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'mine');
    for (let i = 1; i <= 16; i++) saveDailyBackup(dir, `2026-09-${String(i).padStart(2, '0')}`, '{}', 14, new Date(2026, 8, i));
    const kept = listBackups(dir);
    expect(kept).toHaveLength(14);
    expect(kept[0]).toBe('layers-backup-2026-09-16.json');
    expect(kept.at(-1)).toBe('layers-backup-2026-09-03.json');
    expect(fs.existsSync(path.join(dir, 'notes.txt'))).toBe(true);
  });

  it('refuses anything that is not a backup', () => {
    const dir = tempDir();
    expect(saveDailyBackup(dir, '../evil', '{}').error).toBeTruthy();
    expect(saveDailyBackup(dir, '2026-10-05', 'not json', 14, new Date(2026, 9, 5)).error).toBeTruthy();
    expect(listBackups(dir)).toEqual([]);
  });

  it("only takes a backup dated within two days of today, so far-off ones can't push the real ones out (audit 2026-10-14)", () => {
    const dir = tempDir();
    const today = new Date(2026, 9, 14);
    expect(saveDailyBackup(dir, '9999-12-01', '{}', 14, today).error).toBe('bad day');
    expect(saveDailyBackup(dir, '2026-10-17', '{}', 14, today).error).toBe('bad day');
    expect(saveDailyBackup(dir, '2026-10-16', '{}', 14, today).saved).toBe(true); // two days on: a clock a little out
    expect(saveDailyBackup(dir, '2026-10-12', '{}', 14, today).saved).toBe(true);
  });

  it('goes to Documents\\Layers backups, or the test data folder', () => {
    expect(backupDir({ documents: 'D', userData: 'U', env: {} })).toBe(path.join('D', 'Layers backups'));
    expect(backupDir({ documents: 'D', userData: 'U', env: { LAYERS_USER_DATA_DIR: 'U' } })).toBe(path.join('U', 'Backups'));
  });
});
