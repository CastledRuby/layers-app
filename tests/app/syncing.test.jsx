/** @vitest-environment jsdom */
// Sync through OneDrive (docs/roadmap.md, "The plan from here"): turning it
// on in Me with a passphrase, another device's changes coming in, a wrong
// passphrase, and turning it off. OneDrive's folder and Windows' passphrase
// keeping are stood in for (window.layersSystem); the encryption is real.
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { openSyncFile, sealSyncFile } from '../../src/lib/syncFile.js';
import { dialog, nav, person, renderApp, savedState, seedState, toasts } from './harness.jsx';

const PASS = 'correct horse battery';

// OneDrive's folder and the remembered passphrase, in memory.
function fakeBridge(files = {}) {
  const b = {
    // The rest of the bridge, doing nothing.
    getAutoLaunch: () => Promise.resolve(false),
    setAutoLaunch: () => Promise.resolve(false),
    getVersion: () => Promise.resolve('test'),
    getShortcutStatus: () => Promise.resolve({ registered: true }),
    setTheme: () => {},
    showWindow: () => {},
    scheduleNotifications: () => Promise.resolve({ scheduled: 0 }),
    calendarReady: () => Promise.resolve([]),
    onCalendarAction: () => () => {},
    files: { ...files }, passphrase: null,
    getSyncInfo: async () => ({ dir: 'C:\\Users\\Liam\\OneDrive\\Documents\\Layers sync', hasFile: 'layers-sync.json' in b.files }),
    readSyncFiles: async () => Object.entries(b.files).map(([name, text]) => ({ name, text })),
    writeSyncFile: async (text) => { b.files['layers-sync.json'] = text; return { ok: true }; },
    removeSyncCopies: async () => ({ ok: true }),
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

const other = (people) => ({ people, journal: [], events: [], generalGoals: [], profile: { name: 'Tester', focus: null }, skills: {}, achievements: {}, deleted: [] });

describe('sync through OneDrive', () => {
  it('turns on with a passphrase typed twice, writing an encrypted file, and remembers it', async () => {
    const bridge = fakeBridge();
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.click(nav('Me'));
    await user.click(screen.getByRole('button', { name: 'Turn on sync' }));
    const sheet = dialog('Sync through OneDrive');
    await user.keyboard(`${PASS}{Enter}${PASS}{Enter}`);
    await waitFor(() => expect(toasts()).toContain('Sync is on'), { timeout: 10000 });
    expect(bridge.passphrase).toBe(PASS);
    expect(bridge.files['layers-sync.json']).not.toContain('Morgan');
    const { payload } = await openSyncFile(bridge.files['layers-sync.json'], PASS);
    expect(payload.people.map(p => p.name)).toEqual(['Morgan']);
    expect(sheet.isConnected).toBe(false);
    expect(within(screen.getByLabelText('Sync')).getByRole('status').textContent).toMatch(/^On\. Last synced just now, in Documents\\Layers sync\./);
  });

  it("a passphrase that doesn't open another device's file is refused, and the right one brings its people in", async () => {
    const bridge = fakeBridge({ 'layers-sync.json': await sealSyncFile(other([person('Sam', { updatedAt: '2026-10-07T01:00:00.000Z' })]), PASS) });
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.click(nav('Me'));
    await user.click(screen.getByRole('button', { name: 'Turn on sync' }));
    const sheet = dialog('Sync through OneDrive');
    expect(within(sheet).queryByLabelText('Passphrase again')).toBeNull(); // the file's there: just once
    await user.keyboard('not the one at all{Enter}');
    await within(sheet).findByText(/doesn't open the sync file/, undefined, { timeout: 10000 });
    expect(bridge.passphrase).toBeNull();
    await user.clear(within(sheet).getByLabelText('Passphrase'));
    await user.type(within(sheet).getByLabelText('Passphrase'), `${PASS}{Enter}`);
    await waitFor(() => expect(savedState().people.map(p => p.name).sort()).toEqual(['Morgan', 'Sam']), { timeout: 10000 });
    expect(toasts()).toContain('Synced: changes from your other device');
    const { payload } = await openSyncFile(bridge.files['layers-sync.json'], PASS);
    expect(payload.people.map(p => p.name).sort()).toEqual(['Morgan', 'Sam']); // and Morgan went the other way
  });

  it('Sync now brings in a change made elsewhere; turning off forgets the passphrase', async () => {
    const bridge = fakeBridge();
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.click(nav('Me'));
    await user.click(screen.getByRole('button', { name: 'Turn on sync' }));
    await user.keyboard(`${PASS}{Enter}${PASS}{Enter}`);
    await waitFor(() => expect(toasts()).toContain('Sync is on'), { timeout: 10000 });
    // Another device adds Riley.
    const { payload } = await openSyncFile(bridge.files['layers-sync.json'], PASS);
    bridge.files['layers-sync.json'] = await sealSyncFile({ ...payload, people: [...payload.people, person('Riley', { updatedAt: new Date().toISOString() })] }, PASS);
    await user.click(screen.getByRole('button', { name: 'Sync now' }));
    await waitFor(() => expect(savedState().people.map(p => p.name).sort()).toEqual(['Morgan', 'Riley']), { timeout: 10000 });
    await user.click(screen.getByRole('button', { name: 'Turn off' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Turn off' }));
    expect(bridge.passphrase).toBeNull();
    expect(screen.getByRole('button', { name: 'Turn on sync' })).toBeTruthy();
  });
});
