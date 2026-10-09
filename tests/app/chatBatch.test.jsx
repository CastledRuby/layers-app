/** @vitest-environment jsdom */
// Analyse all new (docs/roadmap.md, decided 2026-10-09): every new
// conversation in the Layers chats folder sent to Claude in one go, a day
// with someone at a time, tiny ones only marked as seen; the answers wait in
// Coach's "Ready to review" (kept if Layers closes) to log, skip or look at in
// full, with one Undo; and a monthly limit in Me it won't go past. The main
// process (the folder, the key and Claude) is stood in for.
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toISODate } from '../../src/lib/dates.js';
import { dialog, nav, person, queryDialog, relaunch, renderApp, savedPerson, savedState, seedState, toasts } from './harness.jsx';

const DAY = 24 * 3600 * 1000;
const at = (daysAgo, h, m = 0) => { const d = new Date(Date.now() - daysAgo * DAY); d.setHours(h, m, 0, 0); return d; };
const pad = (n) => String(n).padStart(2, '0');
const wa = (d, name, text) => `[${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}, ${d.getHours() % 12 || 12}:${pad(d.getMinutes())}:00 ${d.getHours() < 12 ? 'am' : 'pm'}] ${name}: ${text}`;
const day = (n) => toISODate(new Date(Date.now() + n * DAY));
const label = (n) => { const d = new Date(Date.now() + n * DAY); return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]}, ${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]}`; };

const answer = (extractedInfo, summary) => ({
  transcript: [{ who: 'them', text: 'hi' }], conversationState: 'engaged', wentWell: ['You asked about [them]'], opportunity: 'x', tryNextTime: 'Ask one more question.',
  encourager: null, emotionalCues: [], grading: { overall: 72, depth: 50, activeListening: 60, reciprocity: 60, naturalness: 70 }, recommendation: null,
  extractedInfo, next: { continueTopic: null, shareYourself: null, changeTopic: null, dontMessage: null },
  log: { meaningfulness: 3, ratings: { depth: 2, interaction: 4 }, activeListening: ['followup'], summary, chatDate: null },
});
// Each chat's answer, told apart by what's in it (names are hidden).
function reply(request) {
  const text = request.content.at(-1).text;
  if (text.includes('job')) return answer([{ category: 'important', text: '[them] starts the job', temporary: true, when: day(3) }, { category: 'interests', text: 'Bouldering', temporary: false, when: null }], 'Her new job');
  if (text.includes('pizza')) return answer([{ category: 'preferences', text: 'Loves pineapple pizza', temporary: false, when: null }], 'Pizza night');
  return answer([], 'How her day went');
}

function fakeBridge({ run } = {}) {
  const b = {
    getAutoLaunch: () => Promise.resolve(false), setAutoLaunch: () => Promise.resolve(false), getVersion: () => Promise.resolve('test'),
    getShortcutStatus: () => Promise.resolve({ registered: true }), setTheme: () => {}, showWindow: () => {},
    getAnalysisKeyStatus: async () => ({ hasKey: true }), setAnalysisKey: async () => ({ ok: true }), clearAnalysisKey: async () => ({ ok: true }),
    runAnalysis: vi.fn(run || (async (request) => ({ result: reply(request), usage: { input: 3000, output: 2500 }, model: request.model }))),
    files: {
      'WhatsApp Chat - Amelie.zip': { kind: 'whatsapp', title: 'Amelie', files: [{ path: '_chat.txt', text: [
        wa(at(3, 9), 'Amelie', 'guess what'), wa(at(3, 9, 1), 'Liam', 'what'), wa(at(3, 21), 'Amelie', 'I got the job!!'), wa(at(3, 21, 1), 'Liam', 'No way, congrats!'),
        wa(at(2, 18), 'Amelie', 'running late'), wa(at(2, 18, 1), 'Amelie', '10 min'),
        wa(at(1, 20), 'Amelie', 'how was your day'), wa(at(1, 20, 1), 'Liam', 'good, you?'), wa(at(1, 20, 2), 'Amelie', 'long'), wa(at(1, 20, 3), 'Liam', 'tell me'),
      ].join('\n') }] },
      'WhatsApp Chat - Chloe.zip': { kind: 'whatsapp', title: 'Chloe', files: [{ path: '_chat.txt', text: [
        wa(at(1, 12), 'Chloe', 'pizza tonight?'), wa(at(1, 12, 1), 'Liam', 'yes!'), wa(at(1, 12, 2), 'Chloe', 'pineapple obviously'), wa(at(1, 12, 3), 'Liam', 'obviously'),
      ].join('\n') }] },
    },
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
async function openAnalyse(user) {
  await user.click(nav('Coach'));
  await user.click(screen.getByRole('button', { name: 'Analyse a chat' }));
  return screen.findByLabelText('Analyse all new');
}

describe('Analyse all new', () => {
  it('sends each day with someone once with names hidden, marks tiny ones seen, and moves the chats on', async () => {
    const bridge = fakeBridge();
    seed();
    const { user } = renderApp();
    const card = await openAnalyse(user);
    expect(card.textContent).toMatch(/3 conversations with Amelie and Chloe \(a day with someone each\), about US\$0\.0\d with Haiku 4\.5/);
    expect(card.textContent).toMatch(/1 tiny one \(under 4 messages, or only one side talking\) is marked as seen without sending/);

    await user.keyboard('a');
    await waitFor(() => expect(toasts()).toContain('3 chats ready to review in Coach'));
    expect(bridge.runAnalysis).toHaveBeenCalledTimes(3);
    const sent = bridge.runAnalysis.mock.calls.map(c => c[0].content.at(-1).text);
    expect(sent[0]).toContain('[them]: guess what'); // Tuesday's two conversations together, names hidden
    expect(sent[0]).toContain('[them]: I got the job!!');
    expect(sent.join('\n')).not.toMatch(/Amelie|Chloe|Liam|running late/);
    // Everything's been seen, so nothing's new now.
    expect(within(screen.getByLabelText('From your chats')).getByRole('button', { name: /Amelie.*Nothing new/ })).toBeTruthy();
    expect(within(screen.getByLabelText('Analyse all new')).queryByRole('button', { name: /^Analyse all new/ })).toBeNull();
    expect(within(screen.getByLabelText('Analyse all new')).getByRole('button', { name: /Ready to review \(3\)/ })).toBeTruthy();
  });

  it('reviews the answers oldest first: a detail left out, a reminder, logged with Undo, the full review, skipped, and the rest logged at once', async () => {
    fakeBridge();
    seed();
    const { user } = renderApp();
    await openAnalyse(user);
    await user.keyboard('a');
    await waitFor(() => expect(toasts()).toContain('3 chats ready to review in Coach'));
    await user.keyboard('r');
    const sheet = () => dialog('Ready to review');
    expect(within(sheet()).getByText('1 of 3')).toBeTruthy();
    expect(within(sheet()).getByText(new RegExp(`WhatsApp · Amelie · ${label(-3)} · 4 messages`))).toBeTruthy();
    expect(within(sheet()).getByText(/Amelie starts the job · 🗓️/).textContent).toContain(label(3));
    // 2 leaves Bouldering out; B reminds the day after the job starts; Enter logs it.
    await user.keyboard('2');
    expect(within(sheet()).getByRole('button', { name: /Bouldering/ }).getAttribute('aria-pressed')).toBe('false');
    await user.keyboard('b');
    expect(toasts()).toContain(`Reminder set for ${label(4)}, 9:00 AM`);
    await user.keyboard('{Enter}');
    expect(toasts()).toContain('Logged your chat with Amelie, and saved 1 detail');
    const amelie = savedPerson('Amelie');
    expect(savedState().journal).toEqual([expect.objectContaining({ personId: amelie.id, at: day(-3), type: 'messaged', summary: 'Her new job', analysis: expect.objectContaining({ review: expect.objectContaining({ tryNextTime: 'Ask one more question.' }), chat: expect.stringContaining('I got the job!!') }) })]);
    expect(amelie.important[0]).toMatchObject({ text: 'Amelie starts the job', when: day(3), at: day(-3) });
    expect(amelie.interests.some(i => i.text === 'Bouldering')).toBe(false);
    expect(within(sheet()).getByText('1 of 2')).toBeTruthy();

    // Undo takes the log back, and it's waiting again.
    await user.click(screen.getByRole('button', { name: /^Undo/ }));
    expect(savedState().journal).toEqual([]);
    expect(within(sheet()).getByText('1 of 3')).toBeTruthy();
    // E shows the full review; X skips it (nothing logged).
    await user.keyboard('e');
    expect(dialog('Chat review: Amelie')).toBeTruthy();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(queryDialog('Chat review: Amelie')).toBeNull());
    await user.keyboard('x');
    expect(within(sheet()).getByText('1 of 2')).toBeTruthy();
    expect(savedState().journal).toEqual([]);

    // Shift+Enter logs the rest.
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(toasts()).toContain('Logged 2 chats, and saved 1 detail');
    expect(savedState().journal.map(j => [j.at, j.summary]).sort()).toEqual([[day(-1), 'How her day went'], [day(-1), 'Pizza night']]);
    expect(savedPerson('Chloe').preferences[0].text).toBe('Loves pineapple pizza');
    await waitFor(() => expect(queryDialog('Ready to review')).toBeNull());
    expect(screen.queryByRole('button', { name: /Ready to review/ })).toBeNull();
  });

  it("keeps the answers if Layers closes before they're reviewed, without asking again", async () => {
    const bridge = fakeBridge();
    seed();
    const app = renderApp();
    await openAnalyse(app.user);
    await app.user.click(screen.getByRole('button', { name: /^Analyse all new/ }));
    await waitFor(() => expect(toasts()).toContain('3 chats ready to review in Coach'));
    const again = relaunch(app);
    const card = await openAnalyse(again.user);
    expect(within(card).getByRole('button', { name: /Ready to review \(3\)/ })).toBeTruthy();
    expect(within(card).queryByRole('button', { name: /^Analyse all new/ })).toBeNull();
    expect(bridge.runAnalysis).toHaveBeenCalledTimes(3);
  });

  it("stops before going past the monthly limit, set in Me, and when Claude can't be reached; the rest stay new", async () => {
    const month = `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}`;
    window.localStorage.setItem('layers-analysis-spend', JSON.stringify({ [month]: { dollars: 4.99, chats: 200, models: { 'claude-haiku-4-5': 200 } } }));
    const bridge = fakeBridge();
    seed();
    const { user } = renderApp();
    let card = await openAnalyse(user);
    expect(card.textContent).toMatch(/more than is left of your US\$5 monthly limit \(about US\$4\.99 spent\), so it stops partway/);
    await user.keyboard('a');
    await waitFor(() => expect(within(screen.getByLabelText('Analyse all new')).getByRole('alert').textContent).toBe('Stopped at your US$5 monthly limit (Me → Chat analysis). 3 conversations are still new.'));
    expect(bridge.runAnalysis).not.toHaveBeenCalled();

    // A higher limit in Me.
    await user.click(nav('Me'));
    const limit = within(screen.getByLabelText('Chat analysis')).getByRole('group', { name: 'Monthly limit' });
    expect(within(limit).getByRole('button', { name: 'US$5' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(within(limit).getByRole('button', { name: 'US$10' }));
    expect(window.localStorage.getItem('layers-analysis-limit')).toBe('10');

    // Nothing comes back (the key, credit or connection): it stops there.
    bridge.runAnalysis.mockImplementation(async () => ({ error: "That API key isn't working. Check it in Me." }));
    card = await openAnalyse(user);
    await user.click(within(card).getByRole('button', { name: /^Analyse all new/ }));
    await waitFor(() => expect(within(screen.getByLabelText('Analyse all new')).getByRole('alert').textContent).toBe("Stopped: That API key isn't working. Check it in Me. 3 conversations are still new."));
    expect(bridge.runAnalysis).toHaveBeenCalledTimes(1);
    expect(within(screen.getByLabelText('From your chats')).getByRole('button', { name: /Amelie.*4 new/ })).toBeTruthy();
  });

  it("Sunday's week review sends you to it", async () => {
    fakeBridge();
    seed();
    const { user } = renderApp();
    await user.click(nav('Today'));
    await user.keyboard('w');
    await user.click(await within(dialog('Your week')).findByRole('button', { name: 'Analyse them all in Coach' }));
    expect(await screen.findByLabelText('Analyse all new')).toBeTruthy();
    expect(nav('Coach').getAttribute('aria-current')).toBe('page');
  });
});
