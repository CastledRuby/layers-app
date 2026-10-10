/** @vitest-environment jsdom */
// Bugs found by the audit of everything since 1.0.32 (2026-10-10): each test
// reproduces one through the app, so it can't come back unnoticed.
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openSyncFile, sealSyncFile } from '../../src/lib/syncFile.js';
import { nav, person, renderApp, savedState, seedState, wait } from './harness.jsx';

const PASS = 'correct horse battery';

// OneDrive's folder and the remembered passphrase, in memory (as in
// syncing.test.jsx). `gate`: a promise the next read waits for.
function fakeBridge(files = {}) {
  const b = {
    getAutoLaunch: () => Promise.resolve(false),
    setAutoLaunch: () => Promise.resolve(false),
    getVersion: () => Promise.resolve('test'),
    getShortcutStatus: () => Promise.resolve({ registered: true }),
    setTheme: () => {},
    showWindow: () => {},
    scheduleNotifications: () => Promise.resolve({ scheduled: 0 }),
    calendarReady: () => Promise.resolve([]),
    onCalendarAction: () => () => {},
    files: { ...files }, passphrase: PASS, gate: null, reads: 0,
    getSyncInfo: async () => ({ dir: 'C:\\OneDrive\\Layers sync', hasFile: 'layers-sync.json' in b.files }),
    readSyncFiles: async () => {
      b.reads++;
      if (b.gate) { const g = b.gate; b.gate = null; await g; }
      return Object.entries(b.files).map(([name, text]) => ({ name, text }));
    },
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
afterEach(() => { delete window.layersSystem; window.localStorage.clear(); });

const other = (people) => ({ people, journal: [], events: [], generalGoals: [], profile: { name: 'Tester', focus: null }, skills: {}, achievements: {}, deleted: [] });

describe('sync', () => {
  it("a change made while a sync is running isn't overwritten when the other device's changes come in", async () => {
    const bridge = fakeBridge({ 'layers-sync.json': await sealSyncFile(other([person('Sam', { updatedAt: '2026-10-07T01:00:00.000Z' })]), PASS) });
    let release;
    bridge.gate = new Promise(r => { release = r; });
    window.localStorage.setItem('layers-sync', JSON.stringify({ on: true }));
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await waitFor(() => expect(bridge.reads).toBe(1), { timeout: 5000 }); // the first sync, 2 s after start, is reading
    // Meanwhile Kai is added here.
    await user.keyboard('{Control>}{Shift>}a{/Shift}{/Control}Kai{Tab}l{Enter}');
    await waitFor(() => expect(savedState().people.map(p => p.name)).toContain('Kai'));
    release();
    await waitFor(() => expect(savedState().people.map(p => p.name).sort()).toEqual(['Kai', 'Morgan', 'Sam']), { timeout: 15000 });
    await wait(50);
    expect(screen.queryByText('Kai')).toBeTruthy();
    await waitFor(async () => {
      const { payload } = await openSyncFile(bridge.files['layers-sync.json'], PASS);
      expect(payload.people.map(p => p.name).sort()).toEqual(['Kai', 'Morgan', 'Sam']);
    }, { timeout: 15000 });
  }, 30000);
});

// --- Analyse all new (as in chatBatch.test.jsx) ---------------------------------
const DAY = 24 * 3600 * 1000;
const at = (daysAgo, h, m = 0) => { const d = new Date(Date.now() - daysAgo * DAY); d.setHours(h, m, 0, 0); return d; };
const pad = (n) => String(n).padStart(2, '0');
const wa = (d, name, text) => `[${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}, ${d.getHours() % 12 || 12}:${pad(d.getMinutes())}:00 ${d.getHours() < 12 ? 'am' : 'pm'}] ${name}: ${text}`;
const answer = (summary) => ({
  transcript: [{ who: 'them', text: 'hi' }], conversationState: 'engaged', wentWell: ['x'], opportunity: 'x', tryNextTime: 'x',
  encourager: null, emotionalCues: [], grading: { overall: 72, depth: 50, activeListening: 60, reciprocity: 60, naturalness: 70 }, recommendation: null,
  extractedInfo: [], next: { continueTopic: null, shareYourself: null, changeTopic: null, dontMessage: null },
  log: { meaningfulness: 3, ratings: {}, activeListening: [], summary, chatDate: null },
});
function chatsBridge(run) {
  const b = {
    getAutoLaunch: () => Promise.resolve(false), setAutoLaunch: () => Promise.resolve(false), getVersion: () => Promise.resolve('test'),
    getShortcutStatus: () => Promise.resolve({ registered: true }), setTheme: () => {}, showWindow: () => {},
    getAnalysisKeyStatus: async () => ({ hasKey: true }), setAnalysisKey: async () => ({ ok: true }), clearAnalysisKey: async () => ({ ok: true }),
    runAnalysis: vi.fn(run),
    files: {
      'WhatsApp Chat - Amelie.zip': { kind: 'whatsapp', title: 'Amelie', files: [{ path: '_chat.txt', text: [
        wa(at(3, 21), 'Amelie', 'I got the job!!'), wa(at(3, 21, 1), 'Liam', 'No way, congrats!'), wa(at(3, 21, 2), 'Amelie', 'thanks'), wa(at(3, 21, 3), 'Liam', 'when do you start'),
        wa(at(1, 20), 'Amelie', 'how was your day'), wa(at(1, 20, 1), 'Liam', 'good, you?'), wa(at(1, 20, 2), 'Amelie', 'long'), wa(at(1, 20, 3), 'Liam', 'tell me'),
      ].join('\n') }] },
      'WhatsApp Chat - Chloe.zip': { kind: 'whatsapp', title: 'Chloe', files: [{ path: '_chat.txt', text: [
        wa(at(1, 12), 'Chloe', 'pizza tonight?'), wa(at(1, 12, 1), 'Liam', 'yes!'), wa(at(1, 12, 2), 'Chloe', 'pineapple obviously'), wa(at(1, 12, 3), 'Liam', 'obviously'),
      ].join('\n') }] },
    },
    getChatsInfo: async () => ({ dir: 'C:\\OneDrive\\Documents\\Layers chats' }),
    listChatExports: async () => Object.entries(b.files).map(([name, f], i) => ({ name, kind: f.kind, title: f.title, size: 1, modified: Date.now() - i * 1000 })),
    readChatExport: async (name) => b.files[name] || { error: 'gone' },
    openChatsFolder: async () => ({ error: null }),
    onChatExportsChanged: () => () => {},
  };
  window.layersSystem = b;
  return b;
}

describe('Analyse all new', () => {
  it("Stop, then Analyse all new again at once, doesn't send (and pay for) the chat still being read a second time", async () => {
    let release;
    const gate = new Promise(r => { release = r; });
    let calls = 0;
    const bridge = chatsBridge(async (request) => {
      calls += 1;
      if (calls === 1) await gate; // the first is still being read when Stop is pressed
      return { result: answer('x'), usage: { input: 3000, output: 2500 }, model: request.model };
    });
    seedState({ profile: { name: 'Liam', focus: 'mix' }, people: [person('Amelie', { layer: 4 }), person('Chloe', { layer: 3 })] });
    const { user } = renderApp();
    await user.click(nav('Coach'));
    await user.click(screen.getByRole('button', { name: 'Analyse a chat' }));
    await screen.findByLabelText('Analyse all new');
    await user.keyboard('a');
    await waitFor(() => expect(bridge.runAnalysis).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    await user.keyboard('a');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull(), { timeout: 10000 });
    release();
    await waitFor(() => expect(within(screen.getByLabelText('Analyse all new')).getByRole('button', { name: /Ready to review \(3\)/ })).toBeTruthy(), { timeout: 10000 });
    await wait(100);
    const sent = bridge.runAnalysis.mock.calls.map(c => c[0].content.at(-1).text);
    expect(sent).toHaveLength(3);
    expect(new Set(sent).size).toBe(3);
  }, 30000);
});
