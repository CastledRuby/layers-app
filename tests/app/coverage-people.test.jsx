/** @vitest-environment jsdom */
// Who's in your circle, at the edges: nobody at all (with a key, a chats
// folder, Ctrl+K, the week review, the quick log and sync all there), a
// nickname finding someone in an exported chat for Analyse all new (and
// hidden before it's sent), and an answer waiting in the queue for someone
// who has since been removed. The main process is stood in for.
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openSyncFile } from '../../src/lib/syncFile.js';
import { dialog, nav, person, renderApp, savedState, seedState, toasts, trackErrors } from './harness.jsx';

const DAY = 24 * 3600 * 1000;
const at = (daysAgo, h, m = 0) => { const d = new Date(Date.now() - daysAgo * DAY); d.setHours(h, m, 0, 0); return d; };
const pad = (n) => String(n).padStart(2, '0');
const wa = (d, name, text) => `[${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}, ${d.getHours() % 12 || 12}:${pad(d.getMinutes())}:00 ${d.getHours() < 12 ? 'am' : 'pm'}] ${name}: ${text}`;
const ANSWER = {
  transcript: [], conversationState: 'engaged', wentWell: [], opportunity: '', tryNextTime: '', encourager: null, emotionalCues: [],
  grading: { overall: 60, depth: 50, activeListening: 50, reciprocity: 50, naturalness: 50 }, recommendation: null,
  extractedInfo: [{ category: 'interests', text: '[them] loves Melbourne', temporary: false, when: null }],
  next: { continueTopic: null, shareYourself: null, changeTopic: null, dontMessage: null },
  log: { meaningfulness: 3, ratings: {}, activeListening: [], summary: 'Trip talk', chatDate: null },
};
const MEL_CHAT = { 'WhatsApp Chat - Mel.zip': { kind: 'whatsapp', title: 'Mel', files: [{ path: '_chat.txt', text: [
  wa(at(1, 18), 'Mel', 'back from Melbourne!'), wa(at(1, 18, 1), 'Liam', 'welcome back Mel'), wa(at(1, 18, 2), 'Mel', 'missed you'), wa(at(1, 18, 3), 'Liam', 'same, Ames'),
].join('\n') }] } };

function fakeBridge(files = {}) {
  const b = {
    getAutoLaunch: () => Promise.resolve(false), setAutoLaunch: () => Promise.resolve(false), getVersion: () => Promise.resolve('test'),
    getShortcutStatus: () => Promise.resolve({ registered: true }), setTheme: () => {}, showWindow: () => {},
    scheduleNotifications: () => Promise.resolve({ scheduled: 0 }), calendarReady: () => Promise.resolve([]), onCalendarAction: () => () => {},
    getAnalysisKeyStatus: async () => ({ hasKey: true }), setAnalysisKey: async () => ({ ok: true }), clearAnalysisKey: async () => ({ ok: true }),
    runAnalysis: vi.fn(async (request) => ({ result: ANSWER, usage: { input: 3000, output: 2500 }, model: request.model })),
    files,
    getChatsInfo: async () => ({ dir: 'C:\\Users\\Liam\\OneDrive\\Documents\\Layers chats' }),
    listChatExports: vi.fn(async () => Object.entries(b.files).map(([name, f], i) => ({ name, kind: f.kind, title: f.title, size: 1, modified: Date.now() - i * 1000 }))),
    readChatExport: vi.fn(async (name) => b.files[name] || { error: 'gone' }),
    openChatsFolder: vi.fn(async () => ({ error: null })),
    onChatExportsChanged: () => () => {},
  };
  window.layersSystem = b;
  return b;
}
afterEach(() => {
  delete window.layersSystem;
  ['layers-chat-progress', 'layers-analysis-queue', 'layers-analysis-spend', 'layers-analysis-limit', 'layers-sync'].forEach(k => window.localStorage.removeItem(k));
});

describe('with nobody in your circle', { timeout: 60000 }, () => {
  it("Coach's Analyse asks for someone first and sends nothing, though there's a key and chats in the folder", async () => {
    const errors = trackErrors();
    const bridge = fakeBridge({ ...MEL_CHAT });
    seedState({ profile: { name: 'Liam', focus: 'mix' } });
    const { user } = renderApp();
    await user.click(nav('Coach'));
    await user.click(screen.getByRole('button', { name: 'Analyse a chat' }));
    expect(screen.getByText(/Add someone in the People tab first/)).toBeTruthy();
    expect(screen.queryByLabelText('Analyse all new')).toBeNull();
    await user.keyboard('a');
    expect(bridge.runAnalysis).not.toHaveBeenCalled();
    await user.click(nav('Me'));
    expect(screen.getByLabelText('Chat analysis')).toBeTruthy();
    errors.stop();
    expect(errors.errors).toEqual([]);
  });

  it('Ctrl+K, the week review and the quick log open without anyone', async () => {
    const errors = trackErrors();
    fakeBridge();
    seedState({ profile: { name: 'Liam', focus: 'mix' } });
    const { user } = renderApp();
    await user.keyboard('{Control>}k{/Control}');
    expect(dialog('Jump to')).toBeTruthy();
    await user.keyboard('sam');
    expect(within(dialog('Jump to')).queryByText('Sam')).toBeNull();
    await user.keyboard('{Escape}');
    await user.click(nav('Today'));
    await user.keyboard('w');
    expect(await screen.findByRole('dialog', { name: 'Your week' })).toBeTruthy();
    await user.keyboard('{Escape}');
    await user.keyboard('n');
    expect(await screen.findByText('Add someone in People first')).toBeTruthy();
    errors.stop();
    expect(errors.errors).toEqual([]);
  });

  it('syncing writes a file with nobody in it, and brings nothing back', async () => {
    const b = fakeBridge();
    Object.assign(b, {
      syncFiles: {}, passphrase: 'correct horse battery',
      getSyncInfo: async () => ({ dir: 'C:\\Users\\Liam\\OneDrive\\Documents\\Layers sync', hasFile: 'layers-sync.json' in b.syncFiles }),
      readSyncFiles: async () => Object.entries(b.syncFiles).map(([name, text]) => ({ name, text })),
      writeSyncFile: async (text) => { b.syncFiles['layers-sync.json'] = text; return { ok: true }; },
      removeSyncCopies: async () => ({ ok: true }), setAsideSyncFile: async () => ({ ok: true }),
      getSyncPassphrase: async () => b.passphrase, setSyncPassphrase: async () => ({ ok: true }), clearSyncPassphrase: async () => ({ ok: true }),
      openSyncFolder: async () => ({ error: null }),
    });
    window.localStorage.setItem('layers-sync', JSON.stringify({ on: true, lastSynced: null, error: null }));
    seedState({ profile: { name: 'Liam', focus: 'mix' } });
    const { user } = renderApp();
    await user.click(nav('Me'));
    await user.click(within(screen.getByLabelText('Sync')).getByRole('button', { name: 'Sync now' }));
    await waitFor(() => expect(b.syncFiles['layers-sync.json']).toBeTruthy(), { timeout: 15000 });
    const { payload } = await openSyncFile(b.syncFiles['layers-sync.json'], 'correct horse battery');
    expect(payload.people).toEqual([]);
    expect(savedState().people).toEqual([]);
    expect(toasts()).not.toContain('Synced: changes from your other device');
  });
});

describe('nicknames in exported chats', { timeout: 60000 }, () => {
  it('an export named with a nickname goes to them in Analyse all new, every nickname hidden but not a word that starts like one', async () => {
    const bridge = fakeBridge({ ...MEL_CHAT });
    seedState({ profile: { name: 'Liam', focus: 'mix' }, people: [person('Amelie', { layer: 3, aka: ['Mel', 'Ames'] }), person('Chloe')] });
    const { user } = renderApp();
    await user.click(nav('Coach'));
    await user.click(screen.getByRole('button', { name: 'Analyse a chat' }));
    const card = await screen.findByLabelText('Analyse all new');
    expect(card.textContent).toMatch(/1 conversation with Amelie/);
    await user.keyboard('a');
    await waitFor(() => expect(toasts()).toContain('1 chat ready to review in Coach'));
    const sent = bridge.runAnalysis.mock.calls[0][0].content.at(-1).text;
    expect(sent).not.toMatch(/\bMel\b|Ames|Amelie|Liam/);
    expect(sent).toContain('back from Melbourne!');
    expect(sent).toContain('[them]: missed you');
    // The answer's shown with her name back.
    await user.keyboard('r');
    expect(within(dialog('Ready to review')).getByText(/Amelie loves Melbourne/)).toBeTruthy();
  });
});

describe('an answer waiting for someone since removed', { timeout: 60000 }, () => {
  it('logs nothing, and can be skipped', async () => {
    const errors = trackErrors();
    fakeBridge();
    const yesterday = new Date(Date.now() - DAY);
    const iso = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;
    const result = { ...ANSWER, extractedInfo: [], log: { ...ANSWER.log, personIds: ['p-gone'], date: iso } };
    window.localStorage.setItem('layers-analysis-queue', JSON.stringify([
      { id: 'k|1', chatKey: 'k', title: 'Riley', source: 'whatsapp', day: iso, personIds: ['p-gone'], model: 'claude-haiku-4-5', result, chat: '[x] hi', cost: 0.01 },
    ]));
    seedState({ profile: { name: 'Liam', focus: 'mix' }, people: [person('Chloe')] });
    const { user } = renderApp();
    await user.click(nav('Coach'));
    await user.click(screen.getByRole('button', { name: 'Analyse a chat' }));
    await user.click(await screen.findByRole('button', { name: /Ready to review \(1\)/ }));
    const sheet = dialog('Ready to review');
    expect(within(sheet).getByText('Riley')).toBeTruthy();
    await user.keyboard('{Enter}');
    expect(savedState().journal).toEqual([]);
    await user.keyboard('x');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Ready to review' })).toBeNull());
    expect(screen.queryByRole('button', { name: /Ready to review/ })).toBeNull();
    errors.stop();
    expect(errors.errors).toEqual([]);
  });
});
