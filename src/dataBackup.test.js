// The copy of your data taken before an install (scripts/data-backup.mjs),
// by the post-commit install and, since the audit of 2026-10-14, a release's.
// Made-up folders only, never the real data.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { backUpData } from '../scripts/data-backup.mjs';

const made = [];
afterEach(() => { while (made.length) fs.rmSync(made.pop(), { recursive: true, force: true }); });

describe('backUpData', () => {
  it('copies Local Storage into a folder named for when and what, keeping the newest 10', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'layers-backup-test-'));
    made.push(base);
    const dataDir = path.join(base, 'layers-web');
    const backupsDir = path.join(dataDir, 'Install backups');
    expect(backUpData('1.0.41', { dataDir, backupsDir })).toBeNull(); // no data yet
    fs.mkdirSync(path.join(dataDir, 'Local Storage', 'leveldb'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'Local Storage', 'leveldb', '000003.log'), 'your data');
    for (let i = 0; i < 12; i++) backUpData(`v${i}`, { dataDir, backupsDir, now: new Date(2026, 9, 14, 10, i) });
    const kept = fs.readdirSync(backupsDir).sort();
    expect(kept).toHaveLength(10);
    expect(kept[0]).toBe('2026-10-14 10-02-00 before v2');
    expect(fs.readFileSync(path.join(backupsDir, kept[9], 'Local Storage', 'leveldb', '000003.log'), 'utf8')).toBe('your data');
  });
});
