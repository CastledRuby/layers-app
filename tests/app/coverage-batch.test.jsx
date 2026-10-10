/** @vitest-environment jsdom */
// More of Analyse all new (chatBatch.test.jsx has the main path): chats with
// nobody in Layers and ones where it can't tell which name is you left out,
// a group chat as one log with everyone, the queue's other keys (← →, a
// detail put back, R, an answer Claude couldn't finish), a run that's only
// tiny conversations, stopping partway at the monthly limit (and what that
// cost, in Me), No limit, and answers kept after a restart logged from there.
// The main process (the folder, the key and Claude) is stood in for.
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toISODate } from '../../src/lib/dates.js';
import { dialog, nav, person, queryDialog, relaunch, renderApp, savedPerson, savedState, seedState, toasts } from './harness.jsx';

const DAY = 24 * 3600 * 1000;
const at = (daysAgo, h, m = 0) => { const d = new Date(Date.now() - daysAgo * DAY); d.setHours(h, m, 0, 0); return d; };
const pad = (n) => String(n).padStart(2, '0');
const wa = (d, name, text) => `[${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}, ${d.getHours() % 12 || 12}:${pad(d.getMinutes())}:00 ${d.getHours() < 12 ? 'am' : 'pm'}] ${name}: ${text}`;
const day = (n) => toISODate(new Date(Date.now() + n * DAY));
const month = () => `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}`;

const answer = (extractedInfo, summary) => ({
  transcript: [{ who: 'them', text: 'hi' }], conversationState: 'engaged', wentWell: [], opportunity: 'x', tryNextTime: 'Ask one more question.',
  encourager: null, emotionalCues: [], grading: { overall: 72, depth: 50, activeListening: 60, reciprocity: 60, naturalness: 70 }, recommendation: null,
  extractedInfo, next: { continueTopic: null, shareYourself: null, changeTopic: null, dontMessage: null },
  log: { meaningfulness: 3, ratings: { depth: 2, interaction: 4 }, activeListening: [], summary, chatDate: null },
});
function reply(request) {
  const text = request.content.at(-1).text;
  if (text.includes('book')) return answer([{ category: 'interests', text: 'Reading Dune', temporary: false, when: null }], 'Book club plans');
  if (text.includes('pizza')) return answer([{ category: 'preferences', text: 'Loves pineapple pizza', temporary: false, when: null }, { category: 'interests', text: 'Plays netball', temporary: false, when: null }], 'Pizza night');
  return answer([], 'How her day went');
}

const four = (d, them, lines) => lines.map((t, i) => wa(at(d, 12, i), i % 2 ? 'Liam' : them, t));
const CHATS = {
  amelie: { 'WhatsApp Chat - Amelie.zip': { kind: 'whatsapp', title: 'Amelie', files: [{ path: '_chat.txt', text: four(2, 'Amelie', ['how was your day', 'good, you?', 'long', 'tell me']).join('\n') }] } },
  amelieTwice: { 'WhatsApp Chat - Amelie.zip': { kind: 'whatsapp', title: 'Amelie', files: [{ path: '_chat.txt', text: [...four(3, 'Amelie', ['how was your day', 'good, you?', 'long', 'tell me']), ...four(1, 'Amelie', ['up for a walk', 'sure', 'at 5?', 'see you'])].join('\n') }] } },
  chloe: { 'WhatsApp Chat - Chloe.zip': { kind: 'whatsapp', title: 'Chloe', files: [{ path: '_chat.txt', text: four(1, 'Chloe', ['pizza tonight?', 'yes!', 'pineapple obviously', 'obviously']).join('\n') }] } },
  zoe: { 'WhatsApp Chat - Zoe.zip': { kind: 'whatsapp', title: 'Zoe', files: [{ path: '_chat.txt', text: four(1, 'Zoe', ['secret plans', 'ok', 'tell nobody', 'deal']).join('\n') }] } },
  bookClub: { 'WhatsApp Chat - Book club.zip': { kind: 'whatsapp', title: 'Book club', files: [{ path: '_chat.txt', text: [
    wa(at(1, 19), 'Amelie', 'which book next?'), wa(at(1, 19, 1), 'L', 'Dune!'), wa(at(1, 19, 2), 'Chloe', 'again?'), wa(at(1, 19, 3), 'L', 'it is a good book'),
  ].join('\n') }] } },
  tiny: { 'WhatsApp Chat - Amelie.zip': { kind: 'whatsapp', title: 'Amelie', files: [{ path: '_chat.txt', text: [wa(at(1, 9), 'Amelie', 'running late'), wa(at(1, 9, 1), 'Amelie', '10 min'), wa(at(1, 9, 2), 'Liam', 'ok')].join('\n') }] } },
};

function fakeBridge(files, { run } = {}) {
  const b = {
    getAutoLaunch: () => Promise.resolve(false), setAutoLaunch: () => Promise.resolve(false), getVersion: () => Promise.resolve('test'),
    getShortcutStatus: () => Promise.resolve({ registered: true }), setTheme: () => {}, showWindow: () => {},
    getAnalysisKeyStatus: async () => ({ hasKey: true }), setAnalysisKey: async () => ({ ok: true }), clearAnalysisKey: async () => ({ ok: true }),
    runAnalysis: vi.fn(run || (async (request) => ({ result: reply(request), usage: { input: 3000, output: 2500 }, model: request.model }))),
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
  ['layers-chat-progress', 'layers-analysis-queue', 'layers-analysis-spend', 'layers-analysis-limit'].forEach(k => window.localStorage.removeItem(k));
});

const seed = () => seedState({ profile: { name: 'Liam', focus: 'mix' }, people: [person('Amelie', { layer: 4 }), person('Chloe', { layer: 3 })] });
const card = () => screen.getByLabelText('Analyse all new');
async function openAnalyse(user) {
  await user.click(nav('Coach'));
  await user.click(screen.getByRole('button', { name: 'Analyse a chat' }));
  return screen.findByLabelText('Analyse all new');
}
const sent = (bridge) => bridge.runAnalysis.mock.calls.map(c => c[0].content.at(-1).text).join('\n');

describe('Analyse all new: who is left out', { timeout: 60000 }, () => {
  it("never sends a chat with nobody in Layers, and leaves one out by name until you say which name is you; then a group chat is one log with everyone", async () => {
    const bridge = fakeBridge({ ...CHATS.amelie, ...CHATS.zoe, ...CHATS.bookClub });
    seed();
    const { user } = renderApp();
    await openAnalyse(user);
    expect(card().textContent).toMatch(/1 conversation with Amelie \(a day with someone each\)/);
    expect(card().textContent).toMatch(/Left out until you say which name is you, below: Book club\./);
    const chats = screen.getByLabelText('From your chats');
    expect(within(chats).getByRole('button', { name: 'Show chats with people not in Layers (1)' })).toBeTruthy();
    expect(within(chats).queryByRole('button', { name: /Zoe/ })).toBeNull();

    // Saying which name is you brings the group chat in, with both of them.
    await user.click(within(chats).getByRole('button', { name: /Book club/ }));
    await user.click(within(chats).getByRole('button', { name: 'L' }));
    await waitFor(() => expect(card().textContent).toMatch(/2 conversations with Amelie and Chloe/));
    expect(card().textContent).not.toMatch(/Left out until/);

    await user.click(within(card()).getByRole('button', { name: /^Analyse all new/ }));
    await waitFor(() => expect(toasts()).toContain('2 chats ready to review in Coach'));
    expect(bridge.runAnalysis).toHaveBeenCalledTimes(2);
    expect(sent(bridge)).not.toMatch(/secret plans|tell nobody|Zoe/);
    expect(sent(bridge)).not.toMatch(/Amelie|Chloe|Liam/);
    // Zoe's chat is still new; Amelie's has moved on.
    await user.click(within(screen.getByLabelText('From your chats')).getByRole('button', { name: 'Show chats with people not in Layers (1)' }));
    const row = (title) => within(screen.getByLabelText('From your chats')).getAllByRole('button').find(b => b.hasAttribute('aria-expanded') && b.textContent.replace(/^[^A-Za-z]+/, '').startsWith(title));
    expect(row('Zoe').textContent).toMatch(/1 new$/);
    expect(row('Amelie').textContent).toMatch(/Nothing new$/);
    expect(row('Book club').textContent).toMatch(/Nothing new$/);

    // The group chat: one log, with both of them.
    await user.keyboard('r');
    expect(dialog('Ready to review')).toBeTruthy();
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(toasts()).toContain('Logged 2 chats, and saved 1 detail');
    const amelie = savedPerson('Amelie').id;
    const chloe = savedPerson('Chloe').id;
    // (A log with several people is an entry for each, as in Analyse.)
    const club = savedState().journal.filter(j => j.summary === 'Book club plans');
    expect(club.map(j => j.personId).sort()).toEqual([amelie, chloe].sort());
    club.forEach(j => expect(j).toMatchObject({ at: day(-1), type: 'messaged' }));
    expect(savedState().journal.filter(j => j.summary === 'How her day went').map(j => j.personId)).toEqual([amelie]);
    expect(savedState().journal).toHaveLength(3);
    await waitFor(() => expect(queryDialog('Ready to review')).toBeNull());
  });

  it('a run of only tiny conversations sends nothing and marks them seen', async () => {
    const bridge = fakeBridge({ ...CHATS.tiny });
    seed();
    const { user } = renderApp();
    await openAnalyse(user);
    expect(card().textContent).toMatch(/1 tiny one \(under 4 written messages, or only one side writing\) is marked as seen without sending\./);
    expect(card().textContent).not.toMatch(/conversations? with/);
    await user.click(within(card()).getByRole('button', { name: /^Analyse all new/ }));
    await waitFor(() => expect(toasts()).toContain('Nothing worth sending: the tiny conversations are marked as seen'));
    expect(bridge.runAnalysis).not.toHaveBeenCalled();
    expect(within(screen.getByLabelText('From your chats')).getByRole('button', { name: /Amelie.*Nothing new/ })).toBeTruthy();
    expect(screen.queryByLabelText('Analyse all new')).toBeNull();
  });
});

describe('Analyse all new: the review queue', { timeout: 60000 }, () => {
  it('R opens it; ← → move between answers; a number puts a detail back; one Claude couldn\'t finish can only be skipped', async () => {
    const bridge = fakeBridge({ ...CHATS.amelieTwice, ...CHATS.chloe }, {
      run: async (request) => (request.content.at(-1).text.includes('walk')
        ? { error: 'Claude stopped partway.', usage: { input: 3000, output: 10 }, model: request.model }
        : { result: reply(request), usage: { input: 3000, output: 2500 }, model: request.model }),
    });
    seed();
    const { user } = renderApp();
    await openAnalyse(user);
    await user.keyboard('a');
    await waitFor(() => expect(toasts()).toContain('2 chats ready to review in Coach'));
    expect(bridge.runAnalysis).toHaveBeenCalledTimes(3);
    expect(within(card()).getByRole('button', { name: /Ready to review \(3\)/ })).toBeTruthy();

    await user.keyboard('r');
    const sheet = () => dialog('Ready to review');
    const where = () => within(sheet()).getByText(/^\d of \d$/).textContent;
    const titles = [];
    for (let i = 0; i < 3; i += 1) {
      titles.push(within(sheet()).getByText(/^WhatsApp · /).textContent);
      await user.keyboard('{ArrowRight}');
    }
    expect(where()).toBe('3 of 3'); // → stops at the last
    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    expect(where()).toBe('1 of 3');
    expect(new Set(titles).size).toBe(3);

    // Go to the one Claude couldn't finish: Enter logs nothing; X skips it.
    while (!within(sheet()).queryByText(/Claude couldn't finish this one/) && where() !== '3 of 3') await user.keyboard('{ArrowRight}');
    expect(within(sheet()).getByText(/Claude couldn't finish this one: Claude stopped partway\./)).toBeTruthy();
    expect(within(sheet()).getByRole('button', { name: /Skip it/ })).toBeTruthy();
    expect(within(sheet()).queryByRole('button', { name: /^Log it/ })).toBeNull();
    await user.keyboard('{Enter}');
    expect(savedState().journal).toEqual([]);
    await user.keyboard('x');
    expect(where()).toMatch(/of 2$/);
    expect(within(sheet()).queryByText(/Claude couldn't finish/)).toBeNull();

    // Chloe's: 1 leaves the first detail out, 1 again puts it back, 2 leaves the second out.
    while (!within(sheet()).queryByText('Chloe')) await user.keyboard('{ArrowRight}');
    const pressed = (name) => within(sheet()).getByRole('button', { name }).getAttribute('aria-pressed');
    await user.keyboard('1');
    expect(pressed(/pineapple/)).toBe('false');
    await user.keyboard('1');
    expect(pressed(/pineapple/)).toBe('true');
    await user.keyboard('2');
    expect(pressed(/netball/)).toBe('false');
    await user.keyboard('{Enter}');
    expect(toasts()).toContain('Logged your chat with Chloe, and saved 1 detail');
    const chloe = savedPerson('Chloe');
    expect(chloe.preferences.map(p => p.text)).toEqual(['Loves pineapple pizza']);
    expect((chloe.interests || []).some(i => i.text === 'Plays netball')).toBe(false);
    expect(where()).toBe('1 of 1');
  });

  it("answers kept after a restart are logged from there, and once logged they're gone after the next restart", async () => {
    const bridge = fakeBridge({ ...CHATS.chloe });
    seed();
    const app = renderApp();
    await openAnalyse(app.user);
    await app.user.keyboard('a');
    await waitFor(() => expect(toasts()).toContain('1 chat ready to review in Coach'));
    const again = relaunch(app);
    await openAnalyse(again.user);
    await again.user.keyboard('r');
    expect(within(dialog('Ready to review')).getByText(/Loves pineapple pizza/)).toBeTruthy();
    await again.user.keyboard('{Enter}');
    expect(toasts()).toContain('Logged your chat with Chloe, and saved 2 details');
    expect(savedState().journal).toEqual([expect.objectContaining({ at: day(-1), summary: 'Pizza night', type: 'messaged' })]);
    expect(savedPerson('Chloe').preferences[0].text).toBe('Loves pineapple pizza');

    const third = relaunch(again);
    await third.user.click(nav('Coach'));
    await third.user.click(screen.getByRole('button', { name: 'Analyse a chat' }));
    await within(await screen.findByLabelText('From your chats')).findByRole('button', { name: /Chloe.*Nothing new/ });
    expect(screen.queryByLabelText('Analyse all new')).toBeNull();
    expect(screen.queryByRole('button', { name: /Ready to review/ })).toBeNull();
    expect(bridge.runAnalysis).toHaveBeenCalledTimes(1);
    expect(savedState().journal).toHaveLength(1);
  });
});

describe('Analyse all new: the monthly limit and what it cost', { timeout: 60000 }, () => {
  it('stops partway, before going past US$5: what was sent waits to be reviewed, the rest stay new, and Me counts it', async () => {
    window.localStorage.setItem('layers-analysis-spend', JSON.stringify({ [month()]: { dollars: 4.97, chats: 200, models: { 'claude-haiku-4-5': 200 } } }));
    const bridge = fakeBridge({ ...CHATS.amelieTwice, ...CHATS.chloe });
    seed();
    const { user } = renderApp();
    await openAnalyse(user);
    expect(card().textContent).toMatch(/3 conversations with Amelie and Chloe/);
    expect(card().textContent).toMatch(/so it stops partway/);
    await user.keyboard('a');
    await waitFor(() => expect(toasts()).toContain('Stopped at your US$5 monthly limit (Me → Chat analysis). 2 conversations are still new. 1 chat ready to review in Coach.'));
    expect(bridge.runAnalysis).toHaveBeenCalledTimes(1);
    expect(within(card()).getByRole('alert').textContent).toBe('Stopped at your US$5 monthly limit (Me → Chat analysis). 2 conversations are still new.');
    expect(within(card()).getByRole('button', { name: /Ready to review \(1\)/ })).toBeTruthy();
    const spend = JSON.parse(window.localStorage.getItem('layers-analysis-spend'))[month()];
    expect(spend.chats).toBe(201);
    expect(spend.dollars).toBeLessThanOrEqual(5);

    await user.click(nav('Me'));
    expect(screen.getByLabelText('What Claude has cost').textContent).toMatch(/This month: about US\$4\.99 for 201 chats \(Haiku 4\.5\)/);
  });

  it('No limit sends everything, without a warning', async () => {
    window.localStorage.setItem('layers-analysis-spend', JSON.stringify({ [month()]: { dollars: 4.99, chats: 200, models: { 'claude-haiku-4-5': 200 } } }));
    window.localStorage.setItem('layers-analysis-limit', '0');
    const bridge = fakeBridge({ ...CHATS.amelieTwice, ...CHATS.chloe });
    seed();
    const { user } = renderApp();
    await openAnalyse(user);
    expect(card().textContent).not.toMatch(/stops partway/);
    await user.keyboard('a');
    await waitFor(() => expect(toasts()).toContain('3 chats ready to review in Coach'));
    expect(bridge.runAnalysis).toHaveBeenCalledTimes(3);
    await user.click(nav('Me'));
    const limit = within(screen.getByLabelText('Chat analysis')).getByRole('group', { name: 'Monthly limit' });
    expect(within(limit).getByRole('button', { name: 'No limit' }).getAttribute('aria-pressed')).toBe('true');
    expect(limit.textContent).toMatch(/It sends everything new, whatever it costs\./);
  });

  it("Me shows this month by model and last month's total, and nothing when nothing's been spent", async () => {
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastKey = `${last.getFullYear()}-${pad(last.getMonth() + 1)}`;
    const older = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const olderKey = `${older.getFullYear()}-${pad(older.getMonth() + 1)}`;
    window.localStorage.setItem('layers-analysis-spend', JSON.stringify({
      [month()]: { dollars: 0.25, chats: 3, models: { 'claude-haiku-4-5': 2, 'claude-sonnet-5-5': 1 } },
      [lastKey]: { dollars: 1.234, chats: 1, models: { 'claude-opus-5-5': 1 } },
      [olderKey]: { dollars: 9, chats: 50, models: { 'claude-haiku-4-5': 50 } },
    }));
    fakeBridge({});
    seed();
    const { user } = renderApp();
    await user.click(nav('Me'));
    const spent = screen.getByLabelText('What Claude has cost').textContent;
    expect(spent).toMatch(/This month: about US\$0\.25 for 3 chats \(2 with Haiku 4\.5, 1 with Sonnet 5\.5\)/);
    expect(spent).toMatch(/Last month: about US\$1\.23 for 1 chat(?!s)/);
    expect(spent).not.toMatch(/US\$9/);
  });

  it('a month under a cent reads "under US$0.01", not "about under US$0.01"', async () => {
    window.localStorage.setItem('layers-analysis-spend', JSON.stringify({ [month()]: { dollars: 0.004, chats: 1, models: { 'claude-haiku-4-5': 1 } } }));
    fakeBridge({});
    seed();
    const { user } = renderApp();
    await user.click(nav('Me'));
    const spent = screen.getByLabelText('What Claude has cost').textContent;
    expect(spent).toMatch(/This month: under US\$0\.01 for 1 chat/);
  });

  it("Me says nothing about cost before anything's been analysed", async () => {
    fakeBridge({});
    seed();
    const { user } = renderApp();
    await user.click(nav('Me'));
    expect(screen.getByLabelText('Chat analysis')).toBeTruthy();
    expect(screen.queryByLabelText('What Claude has cost')).toBeNull();
  });
});
