/** @vitest-environment jsdom */
// More of sync through OneDrive (syncing.test.jsx has turning it on and off):
// with sync already on, Sync now merging another device's file record by
// record (the copy changed last wins, a person's goals one by one), its
// deletions taken on unless the record changed here after, a plan deleted
// here staying deleted, and a passphrase that no longer opens the file
// changing nothing. OneDrive's folder and Windows' passphrase keeping are
// stood in for; the encryption is real.
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { toISODate } from '../../src/lib/dates.js';
import { createBackup } from '../../src/lib/backup.js';
import { openSyncFile, sealSyncFile } from '../../src/lib/syncFile.js';
import { nav, person, renderApp, savedPerson, savedState, seedState } from './harness.jsx';

const PASS = 'correct horse battery';
const T1 = '2026-10-01T01:00:00.000Z';
const T2 = '2026-10-02T01:00:00.000Z';
const T3 = '2026-10-03T01:00:00.000Z';

function fakeBridge(files = {}, passphrase = PASS) {
  const b = {
    getAutoLaunch: () => Promise.resolve(false), setAutoLaunch: () => Promise.resolve(false), getVersion: () => Promise.resolve('test'),
    getShortcutStatus: () => Promise.resolve({ registered: true }), setTheme: () => {}, showWindow: () => {},
    scheduleNotifications: () => Promise.resolve({ scheduled: 0 }), calendarReady: () => Promise.resolve([]), onCalendarAction: () => () => {},
    files: { ...files }, passphrase, writes: 0,
    getSyncInfo: async () => ({ dir: 'C:\\Users\\Liam\\OneDrive\\Documents\\Layers sync', hasFile: 'layers-sync.json' in b.files }),
    readSyncFiles: async () => Object.entries(b.files).map(([name, text]) => ({ name, text })),
    writeSyncFile: async (text) => { b.files['layers-sync.json'] = text; b.writes += 1; return { ok: true }; },
    removeSyncCopies: async (names) => { names.forEach(n => delete b.files[n]); return { ok: true }; },
    setAsideSyncFile: async () => ({ ok: true }),
    getSyncPassphrase: async () => b.passphrase,
    setSyncPassphrase: async (p) => { b.passphrase = p; return { ok: true }; },
    clearSyncPassphrase: async () => { b.passphrase = null; return { ok: true }; },
    openSyncFolder: async () => ({ error: null }),
  };
  window.layersSystem = b;
  return b;
}
afterEach(() => { delete window.layersSystem; });

const fileWith = (data, pass = PASS) => sealSyncFile({ journal: [], events: [], generalGoals: [], profile: { name: 'Tester', focus: null }, skills: {}, achievements: {}, deleted: [], people: [], ...data }, pass);
const goal = (id, title, updatedAt) => ({ id, personId: null, category: 'relationship', type: 'learn', title, description: '', progress: 10, history: [], updatedAt });
const syncOn = () => window.localStorage.setItem('layers-sync', JSON.stringify({ on: true, lastSynced: null, error: null }));
async function syncNow(user) {
  await user.click(nav('Me'));
  await user.click(within(screen.getByLabelText('Sync')).getByRole('button', { name: 'Sync now' }));
}
const LONG = { timeout: 30000 };

// The encryption is real, so these are slow on a busy laptop.
describe('sync through OneDrive, once it is on', { timeout: 60000 }, () => {
  it('merges record by record: the copy changed last wins, and a person\'s goals are merged one by one', async () => {
    const morganThere = person('Morgan', { id: 'p-morgan', layer: 1, updatedAt: T1, goals: [goal('g1', 'Learn more', T1), goal('g2', 'Ask about the move', T3)] });
    const rileyThere = person('Riley', { id: 'p-riley', layer: 3, updatedAt: T3 });
    const samThere = person('Sam', { id: 'p-sam', layer: 2, updatedAt: T2 });
    const bridge = fakeBridge({ 'layers-sync.json': await fileWith({ people: [morganThere, rileyThere, samThere] }) });
    syncOn();
    seedState({ people: [
      person('Morgan', { id: 'p-morgan', layer: 2, updatedAt: T2, goals: [goal('g1', 'Learn what she loves', T3), goal('g2', 'Spend time', T1)] }),
      person('Riley', { id: 'p-riley', layer: 1, updatedAt: T1 }),
    ] });
    const { user } = renderApp();
    await syncNow(user);
    await waitFor(() => expect(savedState().people.map(p => p.name)).toEqual(['Morgan', 'Riley', 'Sam']), LONG);
    expect(savedPerson('Morgan').layer).toBe(2); // changed here last
    expect(savedPerson('Riley').layer).toBe(3); // changed there last
    expect(savedPerson('Sam').layer).toBe(2); // only there
    expect(savedPerson('Morgan').goals.map(g => g.title)).toEqual(['Learn what she loves', 'Ask about the move']);
    // And the file has the same.
    await waitFor(async () => {
      const { payload } = await openSyncFile(bridge.files['layers-sync.json'], PASS);
      expect(payload.people.map(p => [p.name, p.layer])).toEqual([['Morgan', 2], ['Riley', 3], ['Sam', 2]]);
      expect(payload.people[0].goals.map(g => g.title)).toEqual(['Learn what she loves', 'Ask about the move']);
    }, LONG);
    await waitFor(() => expect(within(screen.getByLabelText('Sync')).getByRole('status').textContent).toMatch(/^On\. Last synced just now/), LONG);
  });

  it("takes on another device's deletions, unless the record changed here after", async () => {
    const bridge = fakeBridge({ 'layers-sync.json': await fileWith({
      people: [],
      deleted: [{ id: 'p-sam', kind: 'person', at: T2 }, { id: 'p-riley', kind: 'person', at: T2 }],
    }) });
    syncOn();
    seedState({ people: [
      person('Sam', { id: 'p-sam', updatedAt: T1 }), // deleted there after it last changed here
      person('Riley', { id: 'p-riley', updatedAt: T3 }), // changed here after it was deleted there
    ] });
    const { user } = renderApp();
    await syncNow(user);
    await waitFor(() => expect(savedState().people.map(p => p.name)).toEqual(['Riley']), LONG);
    expect(savedState().deleted).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'p-sam', kind: 'person' })]));
    await waitFor(async () => {
      const { payload } = await openSyncFile(bridge.files['layers-sync.json'], PASS);
      expect(payload.people.map(p => p.name)).toEqual(['Riley']);
    }, LONG);
  });

  it("a plan deleted here stays deleted, though the other device's file still has it", async () => {
    const today = toISODate(new Date());
    const plan = { id: 'e1', title: 'Call Gran', kind: 'oneoff', date: today, time: 1380, personIds: [], updatedAt: T1 };
    const bridge = fakeBridge({ 'layers-sync.json': await fileWith({ events: [plan] }) });
    syncOn();
    seedState({ events: [plan] });
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: 'Call Gran' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete plan' }));
    expect(savedState().events).toEqual([]);
    await syncNow(user);
    await waitFor(async () => {
      const { payload } = await openSyncFile(bridge.files['layers-sync.json'], PASS);
      expect(payload.events).toEqual([]);
      expect(payload.deleted).toEqual([expect.objectContaining({ id: 'e1', kind: 'event' })]);
    }, LONG);
    expect(savedState().events).toEqual([]);
  });

  it('a passphrase that no longer opens the file (changed on another device) says so and changes nothing', async () => {
    const theirs = await fileWith({ people: [person('Sam', { id: 'p-sam', updatedAt: T3 })] }, 'a brand new passphrase');
    const bridge = fakeBridge({ 'layers-sync.json': theirs });
    syncOn();
    seedState({ people: [person('Morgan', { id: 'p-morgan', updatedAt: T1 })] });
    const { user } = renderApp();
    await syncNow(user);
    await waitFor(() => expect(within(screen.getByLabelText('Sync')).getByRole('status').textContent).toBe("That passphrase doesn't open the sync file (or the file was changed). Check it's the one you chose first."), LONG);
    expect(bridge.writes).toBe(0);
    expect(bridge.files['layers-sync.json']).toBe(theirs);
    expect(savedState().people.map(p => p.name)).toEqual(['Morgan']);
  });

  it("OneDrive's conflicting copy is merged in and removed", async () => {
    const bridge = fakeBridge({
      'layers-sync.json': await fileWith({ people: [person('Morgan', { id: 'p-morgan', updatedAt: T1 })] }),
      'layers-sync-LAPTOP.json': await fileWith({ people: [person('Morgan', { id: 'p-morgan', updatedAt: T1 }), person('Riley', { id: 'p-riley', updatedAt: T2 })] }),
    });
    syncOn();
    seedState({ people: [person('Morgan', { id: 'p-morgan', updatedAt: T1 })] });
    const { user } = renderApp();
    await syncNow(user);
    await waitFor(() => expect(savedState().people.map(p => p.name)).toEqual(['Morgan', 'Riley']), LONG);
    await waitFor(() => expect(Object.keys(bridge.files)).toEqual(['layers-sync.json']), LONG);
    const { payload } = await openSyncFile(bridge.files['layers-sync.json'], PASS);
    expect(payload.people.map(p => p.name)).toEqual(['Morgan', 'Riley']);
  });
  it("importing a backup turns sync off, so the sync file doesn't undo it", async () => {
    const bridge = fakeBridge({ 'layers-sync.json': await fileWith({ people: [person('Morgan', { id: 'p-morgan', updatedAt: T3 }), person('Riley', { id: 'p-riley', updatedAt: T3 })] }) });
    syncOn();
    seedState({ people: [person('Morgan', { id: 'p-morgan', updatedAt: T1 })] });
    const { user } = renderApp();
    await user.click(nav('Me'));
    const backup = createBackup({ people: [person('Sam', { id: 'p-sam', updatedAt: T1 })], journal: [], generalGoals: [], events: [], skills: {}, profile: { name: 'Tester', focus: null }, achievements: {} });
    await user.upload(document.querySelector('input[type="file"][accept="application/json"]'), new File([JSON.stringify(backup)], 'layers-backup.json', { type: 'application/json' }));
    expect(await screen.findByText(/Sync turns off on this laptop, so your other devices don't undo it/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem('layers-sync')).on).toBe(false), LONG);
    expect(bridge.passphrase).toBe(null);
    await waitFor(() => expect(savedState().people.map(p => p.name)).toEqual(['Sam']), LONG);
    await new Promise(r => setTimeout(r, 300));
    expect(savedState().people.map(p => p.name)).toEqual(['Sam']);
  });
});
