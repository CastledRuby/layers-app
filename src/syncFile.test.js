// The sync file (lib/syncFile.js): encrypted with the passphrase, readable
// only with it, and one round of syncing against a stand-in for OneDrive's
// folder (electron/sync.cjs is tested on its own in syncFolder.test.js).
import { describe, expect, it } from 'vitest';
import { openSyncFile, sealSyncFile, syncOnce, SyncError } from './lib/syncFile.js';

const NOW = '2026-10-07T01:00:00.000Z';
const person = (id, extra = {}) => ({ id, name: id, emoji: '🧑', layer: 1, overall: 20, dims: {}, goals: [], history: [], timeline: [], interests: [], preferences: [], plans: [], experiences: [], important: [], ...extra });
const data = (extra = {}) => ({ people: [], journal: [], events: [], generalGoals: [], profile: { name: 'Liam', focus: null }, skills: {}, achievements: {}, deleted: [], ...extra });

// OneDrive's folder, in memory: { name: text }.
function folder(files = {}) {
  const f = { files: { ...files }, writes: 0, setAside: 0,
    readSyncFiles: async () => Object.entries(f.files).sort(([a], [b]) => (a === 'layers-sync.json' ? -1 : b === 'layers-sync.json' ? 1 : a.localeCompare(b))).map(([name, text]) => ({ name, text })),
    writeSyncFile: async (text) => { f.writes++; f.files['layers-sync.json'] = text; return { ok: true }; },
    removeSyncCopies: async (names) => { names.forEach(n => { if (n !== 'layers-sync.json') delete f.files[n]; }); return { ok: true }; },
    setAsideSyncFile: async () => { f.setAside++; f.files['layers-sync.unreadable.bak'] = f.files['layers-sync.json']; delete f.files['layers-sync.json']; return { ok: true }; },
  };
  return f;
}

describe('the sync file', () => {
  it('opens with the passphrase, and only with it', async () => {
    const text = await sealSyncFile(data({ people: [person('kai')] }), 'correct horse battery');
    expect(text).not.toContain('kai'); // nothing readable in it
    const { payload } = await openSyncFile(text, 'correct horse battery');
    expect(payload.people[0].id).toBe('kai');
    await expect(openSyncFile(text, 'wrong passphrase')).rejects.toMatchObject({ code: 'wrong-passphrase' });
  });

  it('a changed byte makes it unreadable, not wrong', async () => {
    const file = JSON.parse(await sealSyncFile(data(), 'correct horse battery'));
    const bytes = atob(file.data);
    file.data = btoa(String.fromCharCode(bytes.charCodeAt(0) ^ 1) + bytes.slice(1));
    await expect(openSyncFile(JSON.stringify(file), 'correct horse battery')).rejects.toBeInstanceOf(SyncError);
  });

  it('says when a file isn’t one, or comes from a newer Layers', async () => {
    await expect(openSyncFile('not json', 'x')).rejects.toMatchObject({ code: 'not-sync-file' });
    await expect(openSyncFile(JSON.stringify({ layersSync: 99 }), 'x')).rejects.toMatchObject({ code: 'newer' });
  });
});

describe('syncOnce', () => {
  const pass = 'correct horse battery';

  it('the first sync writes the file; the same data again writes nothing', async () => {
    const f = folder();
    const local = data({ people: [person('kai')] });
    const first = await syncOnce({ bridge: f, passphrase: pass, local, now: NOW });
    expect(first.changed).toBe(false);
    expect(f.writes).toBe(1);
    await syncOnce({ bridge: f, passphrase: pass, local, now: NOW });
    expect(f.writes).toBe(1);
  });

  it("takes what the other device added, and gives it what's new here", async () => {
    const f = folder({ 'layers-sync.json': await sealSyncFile(data({ people: [person('sam', { updatedAt: NOW })] }), pass) });
    const result = await syncOnce({ bridge: f, passphrase: pass, local: data({ people: [person('kai')] }), now: NOW });
    expect(result.changed).toBe(true);
    expect(result.merged.people.map(p => p.id)).toEqual(['kai', 'sam']);
    const { payload } = await openSyncFile(f.files['layers-sync.json'], pass);
    expect(payload.people.map(p => p.id)).toEqual(['kai', 'sam']);
  });

  it('two devices taking turns settle: once each has the other’s, nothing more is written', async () => {
    const f = folder();
    let laptop = data({ people: [person('kai', { updatedAt: NOW })], skills: { followUp: { label: 'Follow-up questions', current: 10, history: [] } } });
    let desktop = data({ people: [person('sam', { updatedAt: NOW })], profile: { name: 'Liam', focus: 'mix', updatedAt: NOW } });
    const turn = async (local) => { const r = await syncOnce({ bridge: f, passphrase: pass, local, now: NOW }); return r.changed ? r.merged : local; };
    laptop = await turn(laptop);
    desktop = await turn(desktop);
    laptop = await turn(laptop);
    const writes = f.writes;
    desktop = await turn(desktop);
    laptop = await turn(laptop);
    expect(f.writes).toBe(writes);
    expect(laptop.people.map(p => p.id).sort()).toEqual(['kai', 'sam']);
    expect(desktop.people.map(p => p.id).sort()).toEqual(['kai', 'sam']);
    expect(laptop.profile.focus).toBe('mix');
  });

  it('a wrong passphrase stops it before anything is written', async () => {
    const f = folder({ 'layers-sync.json': await sealSyncFile(data(), pass) });
    await expect(syncOnce({ bridge: f, passphrase: 'not it at all', local: data(), now: NOW })).rejects.toMatchObject({ code: 'wrong-passphrase' });
    expect(f.writes).toBe(0);
  });

  it('merges the copies OneDrive made when two devices wrote at once, then removes them', async () => {
    const f = folder({
      'layers-sync.json': await sealSyncFile(data({ people: [person('sam')] }), pass),
      'layers-sync-LAPTOP.json': await sealSyncFile(data({ people: [person('ana')] }), pass),
    });
    const result = await syncOnce({ bridge: f, passphrase: pass, local: data(), now: NOW });
    expect(result.merged.people.map(p => p.id).sort()).toEqual(['ana', 'sam']);
    expect(Object.keys(f.files)).toEqual(['layers-sync.json']);
  });

  it("puts a file that can't be read aside, and writes a new one", async () => {
    const f = folder({ 'layers-sync.json': '{"layersSync":1,"broken":true}' });
    await syncOnce({ bridge: f, passphrase: pass, local: data({ people: [person('kai')] }), now: NOW });
    expect(f.setAside).toBe(1);
    expect((await openSyncFile(f.files['layers-sync.json'], pass)).payload.people[0].id).toBe('kai');
  });
});
