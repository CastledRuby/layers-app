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
    expect(saveDailyBackup(dir, '2026-10-05', '{"people":[1]}')).toMatchObject({ saved: true, count: 1, latest: '2026-10-05' });
    expect(saveDailyBackup(dir, '2026-10-05', '{"people":[]}')).toMatchObject({ saved: false, count: 1 });
    expect(fs.readFileSync(path.join(dir, 'layers-backup-2026-10-05.json'), 'utf8')).toBe('{"people":[1]}');
  });

  it('keeps the newest 14, and leaves other files alone', () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'mine');
    for (let i = 1; i <= 16; i++) saveDailyBackup(dir, `2026-09-${String(i).padStart(2, '0')}`, '{}');
    const kept = listBackups(dir);
    expect(kept).toHaveLength(14);
    expect(kept[0]).toBe('layers-backup-2026-09-16.json');
    expect(kept.at(-1)).toBe('layers-backup-2026-09-03.json');
    expect(fs.existsSync(path.join(dir, 'notes.txt'))).toBe(true);
  });

  it('refuses anything that is not a backup', () => {
    const dir = tempDir();
    expect(saveDailyBackup(dir, '../evil', '{}').error).toBeTruthy();
    expect(saveDailyBackup(dir, '2026-10-05', 'not json').error).toBeTruthy();
    expect(listBackups(dir)).toEqual([]);
  });

  it('goes to Documents\\Layers backups, or the test data folder', () => {
    expect(backupDir({ documents: 'D', userData: 'U', env: {} })).toBe(path.join('D', 'Layers backups'));
    expect(backupDir({ documents: 'D', userData: 'U', env: { LAYERS_USER_DATA_DIR: 'U' } })).toBe(path.join('U', 'Backups'));
  });
});
