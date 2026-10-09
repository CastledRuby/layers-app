/** @vitest-environment jsdom */
// Chats from your exports (docs/roadmap.md): a WhatsApp export or an
// Instagram download saved in the Layers chats folder shows in Coach's
// Analyse with its new conversations; picking one fills the analysis card
// (who it's with, exact times) and dates the log, and the chat moves on to
// what's after. The main process (the folder, the key and Claude) is stood in for.
import { act, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toISODate } from '../../src/lib/dates.js';
import { dialog, nav, person, renderApp, savedPerson, savedState, seedState } from './harness.jsx';

const DAY = 24 * 3600 * 1000;
const at = (daysAgo, h, m) => { const d = new Date(Date.now() - daysAgo * DAY); d.setHours(h, m, 0, 0); return d; };
const pad = (n) => String(n).padStart(2, '0');
// A WhatsApp line as iOS writes it in New Zealand: [6/10/26, 9:41:03 pm].
const wa = (d, name, text) => `[${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}, ${d.getHours() % 12 || 12}:${pad(d.getMinutes())}:00 ${d.getHours() < 12 ? 'am' : 'pm'}] ${name}: ${text}`;
const iso = (d) => `${toISODate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

const ANSWER = {
  transcript: [{ who: 'them', text: 'I got the job!!' }], conversationState: 'engaged', wentWell: ['You celebrated [them]'], opportunity: 'x', tryNextTime: 'y',
  encourager: null, emotionalCues: [], grading: { overall: 70, depth: 50, activeListening: 60, reciprocity: 60, naturalness: 70 }, recommendation: null,
  extractedInfo: [], next: { continueTopic: null, shareYourself: null, changeTopic: null, dontMessage: null },
  log: { meaningfulness: 3, ratings: { depth: 2 }, activeListening: [], summary: 'Her new job', chatDate: null },
};

function fakeBridge(files = {}) {
  const b = {
    getAutoLaunch: () => Promise.resolve(false), setAutoLaunch: () => Promise.resolve(false), getVersion: () => Promise.resolve('test'),
    getShortcutStatus: () => Promise.resolve({ registered: true }), setTheme: () => {}, showWindow: () => {},
    getAnalysisKeyStatus: async () => ({ hasKey: true }), setAnalysisKey: async () => ({ ok: true }), clearAnalysisKey: async () => ({ ok: true }),
    runAnalysis: vi.fn(async (request) => ({ result: ANSWER, usage: { input: 1, output: 1 }, model: request.model })),
    files,
    changed: null,
    getChatsInfo: async () => ({ dir: 'C:\\Users\\Liam\\OneDrive\\Documents\\Layers chats' }),
    listChatExports: vi.fn(async () => Object.entries(b.files).map(([name, f], i) => ({ name, kind: f.kind, title: f.title || null, size: 1, modified: Date.now() - i * 1000 }))),
    readChatExport: vi.fn(async (name) => b.files[name] || { error: 'gone' }),
    openChatsFolder: vi.fn(async () => ({ error: null })),
    onChatExportsChanged: (cb) => { b.changed = cb; return () => { b.changed = null; }; },
  };
  window.layersSystem = b;
  return b;
}
afterEach(() => { delete window.layersSystem; window.localStorage.removeItem('layers-chat-progress'); });

const whatsapp = (title, lines) => ({ kind: 'whatsapp', title, files: [{ path: '_chat.txt', text: lines.join('\n') }] });
async function openAnalyse(user) {
  await user.click(nav('Coach'));
  await user.click(screen.getByRole('button', { name: 'Analyse a chat' }));
  return screen.findByLabelText('From your chats');
}

describe('chats from your exports', () => {
  it("lists a WhatsApp chat's new conversations; picking one fills the card, dates the log, and moves the chat on", async () => {
    const yesterday = at(1, 21, 41);
    const bridge = fakeBridge({
      'WhatsApp Chat - Amelie.zip': whatsapp('Amelie', [
        wa(at(20, 9, 0), 'Amelie', 'old news'),
        wa(yesterday, 'Amelie', 'I got the job!!'),
        wa(new Date(yesterday.getTime() + 60000), 'Liam C', 'No way Amelie, congrats!'),
      ]),
    });
    seedState({ profile: { name: 'Liam', focus: 'mix' }, people: [person('Amelie', { layer: 4 }), person('Chloe')] });
    const { user } = renderApp();
    const card = await openAnalyse(user);
    const chat = await within(card).findByRole('button', { name: /Amelie.*WhatsApp.*1 new/ });
    await user.click(chat);
    await user.click(within(card).getByRole('button', { name: /2 messages.*Amelie: I got the job!!/ }));

    // Who it's with, and the conversation written with exact times, you under your name.
    const own = screen.getByLabelText('Your own chat');
    expect(within(own).getByRole('group', { name: "Who it's with" }).textContent).toMatch(/Amelie/);
    expect(within(own).getByText(/^From WhatsApp · Amelie · /)).toBeTruthy();
    expect(within(own).getByLabelText('The chat').value).toBe(`[${iso(yesterday)}] Amelie: I got the job!!\n[${iso(new Date(yesterday.getTime() + 60000))}] Liam: No way Amelie, congrats!`);
    await user.click(within(own).getByRole('button', { name: 'Analyse with Claude' }));
    await screen.findByText('Reconstructed conversation');
    expect(bridge.runAnalysis.mock.calls[0][0].content.at(-1).text).toBe(`The chat:\n\n[${iso(yesterday)}] [them]: I got the job!!\n[${iso(new Date(yesterday.getTime() + 60000))}] [you]: No way [them], congrats!`);

    // The log is on the conversation's day.
    const log = screen.getByLabelText('Log it');
    expect(within(log).getByText("the conversation's day")).toBeTruthy();
    await user.click(within(log).getByRole('button', { name: 'Log this chat' }));
    expect(savedState().journal).toEqual([expect.objectContaining({ personId: savedPerson('Amelie').id, at: toISODate(yesterday), type: 'messaged' })]);

    // Next time, nothing new until there's more; the earlier ones are still there.
    await user.click(screen.getByRole('button', { name: '← Analyse another chat' }));
    const again = screen.getByLabelText('From your chats');
    await user.click(within(again).getByRole('button', { name: /Amelie.*Nothing new/ }));
    expect(within(again).getByText(/Nothing new since you last analysed this chat/)).toBeTruthy();
    await user.click(within(again).getByRole('button', { name: /Earlier conversations \(2\)/ }));
    expect(within(again).getByRole('button', { name: /old news/ })).toBeTruthy();
  });

  it('shows how to add one, opens the folder, and notices a new export arriving', async () => {
    const bridge = fakeBridge();
    seedState({ people: [person('Amelie')] });
    const { user } = renderApp();
    const card = await openAnalyse(user);
    expect(await within(card).findByText(/Save to Files → OneDrive → Documents → Layers chats/)).toBeTruthy();
    expect(within(card).getByText(/Download your information → just Messages, as JSON/)).toBeTruthy();
    expect(within(card).getByText(/Apple Devices → Back up all of the data on your iPhone to this computer/)).toBeTruthy();
    await user.click(within(card).getByRole('button', { name: /Folder/ }));
    expect(bridge.openChatsFolder).toHaveBeenCalled();

    bridge.files['WhatsApp Chat - Amelie.zip'] = whatsapp('Amelie', [wa(at(0, 8, 0), 'Amelie', 'morning!')]);
    await act(async () => { bridge.changed(); });
    expect(await within(card).findByRole('button', { name: /Amelie.*1 new/ })).toBeTruthy();
  });

  it("reads Instagram's download: you're the one in every chat, and chats with people not in Layers are tucked away", async () => {
    const insta = (id, title, names, messages) => ({ path: `your_instagram_activity/messages/inbox/${id}/message_1.json`, text: JSON.stringify({ title, participants: names.map(name => ({ name })), messages }) });
    const t = at(0, 10, 0).getTime();
    fakeBridge({
      'instagram-liam.zip': { kind: 'instagram', files: [
        insta('amelie_1', 'Amelie', ['Amelie', 'liam.c'], [{ sender_name: 'liam.c', timestamp_ms: t + 1000, content: 'haha yes' }, { sender_name: 'Amelie', timestamp_ms: t, content: 'did you see this' }]),
        insta('jess_2', 'Jess', ['Jess', 'liam.c'], [{ sender_name: 'Jess', timestamp_ms: t, content: 'hey' }]),
      ] },
      'instagram-old.zip': { kind: 'instagram-html' },
    });
    seedState({ profile: { name: 'Liam', focus: 'mix' }, people: [person('Amelie')] });
    const { user } = renderApp();
    const card = await openAnalyse(user);
    expect(await within(card).findByText(/Download it again choosing JSON/)).toBeTruthy();
    expect(within(card).queryByRole('button', { name: /^📷\s*Jess/ })).toBeNull();
    await user.click(within(card).getByRole('button', { name: /Show chats with people not in Layers \(1\)/ }));
    expect(within(card).getByRole('button', { name: /Jess.*Instagram/ })).toBeTruthy();
    await user.click(within(card).getByRole('button', { name: /Amelie.*Instagram.*1 new/ }));
    await user.click(within(card).getByRole('button', { name: /2 messages/ }));
    expect(screen.getByLabelText('The chat').value).toMatch(/\] Amelie: did you see this\n\[.*\] Liam: haha yes$/);
  });

  it("lists chats with new conversations in the week review, and opens one in Coach", async () => {
    fakeBridge({
      'WhatsApp Chat - Amelie.zip': whatsapp('Amelie', [wa(at(1, 21, 0), 'Amelie', 'I got the job!!'), wa(at(1, 21, 1), 'Liam', 'congrats')]),
      'WhatsApp Chat - Jess.zip': whatsapp('Jess', [wa(at(1, 9, 0), 'Jess', 'hey')]),
    });
    seedState({ profile: { name: 'Liam', focus: 'mix' }, people: [person('Amelie', { layer: 4 })] });
    const { user } = renderApp();
    await user.keyboard('w');
    const week = dialog('Your week');
    const row = await within(week).findByRole('button', { name: /Amelie.*WhatsApp.*1 new conversation/ });
    expect(within(week).queryByRole('button', { name: /Jess/ })).toBeNull(); // not in Layers
    await user.click(row);
    expect(nav('Coach').getAttribute('aria-current')).toBe('page');
    const card = await screen.findByLabelText('From your chats');
    expect(await within(card).findByRole('button', { name: /2 messages.*Amelie: I got the job!!/ })).toBeTruthy(); // that chat, opened
  });

  it("asks which name is you when it can't tell, then uses it", async () => {
    fakeBridge({
      'WhatsApp Chat - Weekend crew.zip': whatsapp('Weekend crew', [wa(at(0, 9, 0), 'Amelie', 'brunch?'), wa(at(0, 9, 1), 'Chloe', 'yes'), wa(at(0, 9, 2), 'L', 'im in')]),
    });
    seedState({ profile: { name: 'Liam', focus: 'mix' }, people: [person('Amelie'), person('Chloe'), person('Zoe')] });
    const { user } = renderApp();
    const card = await openAnalyse(user);
    await user.click(await within(card).findByRole('button', { name: /Weekend crew/ }));
    expect(within(card).getByText('Which of these is you?')).toBeTruthy();
    await user.click(within(card).getByRole('button', { name: 'L' }));
    await user.click(within(card).getByRole('button', { name: /3 messages/ }));
    expect(within(screen.getByLabelText('Your own chat')).getByRole('group', { name: "Who it's with" }).textContent).toMatch(/Amelie.*Chloe/);
    expect(screen.getByLabelText('The chat').value).toMatch(/\] Liam: im in$/);
  });
});
