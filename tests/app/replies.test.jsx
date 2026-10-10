/** @vitest-environment jsdom */
// Know what to say, reply ideas (decided 2026-10-10): Coach's What to say tab
// (3) takes their latest messages, pasted or from a chat (Reply ideas on a
// chat in Analyse), and Claude suggests three replies in your style, from
// your own messages in logged chats and the line in Me. Q, W, E copy them.
// The main process (the key and Claude) is stood in for.
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nav, person, renderApp, savedState, seedState } from './harness.jsx';

const DAY = 24 * 3600 * 1000;
const pad = (n) => String(n).padStart(2, '0');
const wa = (d, name, text) => `[${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}, ${d.getHours() % 12 || 12}:${pad(d.getMinutes())}:00 ${d.getHours() < 12 ? 'am' : 'pm'}] ${name}: ${text}`;
const REPLIES = { read: '[them] wants to know if you are in', natural: 'yes!! what time', playful: 'obviously, someone has to beat [them]', deeper: 'yes, and how did the interview go?' };

function fakeBridge(extra = {}) {
  const b = {
    getAutoLaunch: () => Promise.resolve(false), setAutoLaunch: () => Promise.resolve(false), getVersion: () => Promise.resolve('test'),
    getShortcutStatus: () => Promise.resolve({ registered: true }), setTheme: () => {}, showWindow: () => {},
    getAnalysisKeyStatus: async () => ({ hasKey: true }), setAnalysisKey: async () => ({ ok: true }), clearAnalysisKey: async () => ({ ok: true }),
    runAnalysis: vi.fn(async (request) => ({ result: REPLIES, usage: { input: 1500, output: 200 }, model: request.model })),
    ...extra,
  };
  window.layersSystem = b;
  return b;
}
afterEach(() => { delete window.layersSystem; window.localStorage.removeItem('layers-analysis-spend'); window.localStorage.removeItem('layers-chat-progress'); });

const amelie = person('Amelie');
const seed = () => seedState({
  profile: { name: 'Liam', focus: 'mix', style: 'lowercase, lots of emoji' },
  people: [person('Priya Shah', { layer: 3 }), amelie],
  journal: [{ id: 'j1', personId: amelie.id, at: '2026-10-01', type: 'messaged', meaningfulness: 3, added: [], activeListening: [], analysis: { grading: { overall: 70 }, conversationState: 'engaged', chat: 'Amelie: hi\nLiam: heyy whats up 😄' } }],
});

describe('What to say', () => {
  it('suggests three replies in your style, names hidden and put back, and Q W E copy them', async () => {
    const bridge = fakeBridge();
    seed();
    const { user } = renderApp();
    await user.click(nav('Coach'));
    await user.keyboard('3');
    const card = await screen.findByLabelText('Reply ideas');
    await user.type(within(card).getByLabelText('Their latest messages'), 'Priya: are you coming sat??');
    expect(within(card).getByRole('group', { name: "Who it's with" }).textContent).toMatch(/Priya Shah/);
    expect(bridge.runAnalysis).not.toHaveBeenCalled();
    await user.keyboard('{Control>}{Enter}{/Control}');

    const replies = await screen.findByLabelText('Replies');
    const sent = bridge.runAnalysis.mock.calls[0][0];
    expect(sent.content[0].text).toBe('The latest messages:\n\n[them]: are you coming sat??');
    expect(sent.system).toContain('- heyy whats up 😄');
    expect(sent.system).toContain('"lowercase, lots of emoji"');
    expect(JSON.stringify(sent)).not.toMatch(/Priya|Liam|Amelie/);
    expect(within(replies).getByText('Priya wants to know if you are in')).toBeTruthy();
    expect(within(replies).getByText('obviously, someone has to beat Priya')).toBeTruthy();
    await user.keyboard('w');
    expect(await navigator.clipboard.readText()).toBe('obviously, someone has to beat Priya'); // user-event's own clipboard
    await waitFor(() => expect(within(replies).getByRole('button', { name: /Copy the playful reply/ }).textContent).toMatch(/Copied/));
    expect(JSON.parse(window.localStorage.getItem('layers-analysis-spend'))).toBeTruthy(); // what it cost, counted
  });

  it('opens from a chat in Analyse with its latest messages in', async () => {
    const t = new Date(Date.now() - DAY);
    t.setHours(20, 0, 0, 0);
    fakeBridge({
      getChatsInfo: async () => ({ dir: 'C:\\Users\\Liam\\OneDrive\\Documents\\Layers chats' }),
      listChatExports: async () => [{ name: 'WhatsApp Chat - Amelie.zip', kind: 'whatsapp', title: 'Amelie', size: 1, modified: Date.now() }],
      readChatExport: async () => ({ kind: 'whatsapp', title: 'Amelie', files: [{ path: '_chat.txt', text: [wa(t, 'Amelie', 'are you free sat?'), wa(new Date(t.getTime() + 60000), 'Liam', 'maybe, why?')].join('\n') }] }),
      openChatsFolder: async () => ({ error: null }),
      onChatExportsChanged: () => () => {},
    });
    seed();
    const { user } = renderApp();
    await user.click(nav('Coach'));
    await user.click(screen.getByRole('button', { name: 'Analyse a chat' }));
    const chats = await screen.findByLabelText('From your chats');
    await user.click(await within(chats).findByRole('button', { name: /Amelie.*WhatsApp/ }));
    await user.click(within(chats).getByRole('button', { name: /Reply ideas for the latest/ }));
    expect(screen.getByRole('button', { name: 'What to say' }).getAttribute('aria-pressed')).toBe('true');
    const card = screen.getByLabelText('Reply ideas');
    expect(within(card).getByText(/^From WhatsApp · Amelie · /)).toBeTruthy();
    expect(within(card).getByLabelText('Their latest messages').value).toMatch(/\] Amelie: are you free sat\?\n\[.*\] Liam: maybe, why\?$/);
    expect(within(card).getByRole('group', { name: "Who it's with" }).textContent).toMatch(/Amelie/);
  });

  it('keeps how you text, written in Me', async () => {
    fakeBridge();
    seedState({ profile: { name: 'Liam', focus: 'mix' } });
    const { user } = renderApp();
    await user.click(nav('Me'));
    const field = within(screen.getByLabelText('Chat analysis')).getByLabelText('How you text');
    await user.type(field, '  short and   lowercase {Enter}');
    expect(savedState().profile.style).toBe('short and lowercase');
  });
});
