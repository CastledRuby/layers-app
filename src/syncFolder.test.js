// The sync folder (electron/sync.cjs) on a temporary folder: where it is,
// writing the file whole, the copies OneDrive makes, and the passphrase kept
// encrypted (Windows' protection stood in for).
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { passphraseStore, readSyncFiles, removeSyncCopies, setAsideSyncFile, syncDir, writeSyncFile } from '../electron/sync.cjs';

const dirs = [];
const tempDir = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'layers-sync-')); dirs.push(d); return d; };
afterEach(() => { dirs.splice(0).forEach(d => fs.rmSync(d, { recursive: true, force: true })); });

describe('the sync folder', () => {
  it('is Documents\\Layers sync, or a test folder', () => {
    expect(syncDir({ documents: 'C:\\Docs', userData: 'C:\\Data', env: {} })).toBe(path.join('C:\\Docs', 'Layers sync'));
    expect(syncDir({ documents: 'C:\\Docs', userData: 'C:\\Data', env: { LAYERS_USER_DATA_DIR: 'x' } })).toBe(path.join('C:\\Data', 'Sync'));
    expect(syncDir({ documents: 'C:\\Docs', userData: 'C:\\Data', env: { LAYERS_SYNC_DIR: 'C:\\Shared' } })).toBe('C:\\Shared');
  });

  it('writes the file whole, and reads every sync file, the main one first', () => {
    const dir = path.join(tempDir(), 'Layers sync');
    expect(readSyncFiles(dir)).toEqual([]); // no folder yet
    writeSyncFile(dir, 'one');
    writeSyncFile(dir, 'two');
    fs.writeFileSync(path.join(dir, 'layers-sync-LAPTOP.json'), 'copy');
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'mine');
    expect(readSyncFiles(dir)).toEqual([{ name: 'layers-sync.json', text: 'two' }, { name: 'layers-sync-LAPTOP.json', text: 'copy' }]);
    expect(fs.readdirSync(dir).filter(n => n.endsWith('.tmp'))).toEqual([]);
  });

  it('removes only the merged copies, never the main file or anything else', () => {
    const dir = tempDir();
    writeSyncFile(dir, 'main');
    fs.writeFileSync(path.join(dir, 'layers-sync-LAPTOP.json'), 'copy');
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'mine');
    removeSyncCopies(dir, ['layers-sync-LAPTOP.json', 'layers-sync.json', 'notes.txt', '..\\layers-sync-x.json']);
    expect(fs.readdirSync(dir).sort()).toEqual(['layers-sync.json', 'notes.txt']);
  });

  it("keeps a file that can't be read, under another name", () => {
    const dir = tempDir();
    writeSyncFile(dir, 'broken');
    setAsideSyncFile(dir, new Date('2026-10-07T01:02:03Z'));
    expect(fs.readdirSync(dir)).toEqual(['layers-sync.unreadable-2026-10-07T01-02-03-000Z.bak']);
    expect(readSyncFiles(dir)).toEqual([]);
  });

  it('keeps the passphrase encrypted, and forgets it', () => {
    const file = path.join(tempDir(), 'sync-passphrase.bin');
    const fake = { isEncryptionAvailable: () => true, encryptString: (s) => Buffer.from(`enc:${s}`), decryptString: (b) => b.toString().slice(4) };
    const store = passphraseStore(file, fake);
    expect(store.get()).toBeNull();
    expect(store.set('correct horse battery')).toEqual({ ok: true });
    expect(fs.readFileSync(file, 'utf8')).toBe('enc:correct horse battery');
    expect(store.get()).toBe('correct horse battery');
    store.clear();
    expect(store.get()).toBeNull();
    expect(passphraseStore(file, { ...fake, isEncryptionAvailable: () => false }).set('x')).toMatchObject({ error: expect.any(String) });
  });
});
