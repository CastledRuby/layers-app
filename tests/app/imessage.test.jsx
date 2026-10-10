/** @vitest-environment jsdom */
// iMessage from an iPhone backup (decided 2026-10-10): its chats show in
// Coach's "From your chats" with the backup's day, your messages already known
// as yours, and they're analysed like an export's, one at a time or with
// Analyse all new. Read again only when there's a newer backup. The main
// process (the backup, the key and Claude) is stood in for.
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nav, person, renderApp, seedState } from './harness.jsx';

const DAY = 24 * 3600 * 1000;
const at = (daysAgo, h, m = 0) => { const d = new Date(Date.now() - daysAgo * DAY); d.setHours(h, m, 0, 0); return d.getTime(); };
const pad = (n) => String(n).padStart(2, '0');
const iso = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const BACKUP = { name: "Liam's iPhone", at: at(0, 7, 12) };
const CHATS = [{
  key: 'imessage:iMessage;-;+64212345678', source: 'imessage', title: 'Amelie Smith', participants: ['Amelie Smith'], me: 'Me',
  messages: [{ at: at(1, 21, 41), sender: 'Amelie Smith', text: 'I got the job!!' }, { at: at(1, 21, 42), sender: 'Me', text: 'No way, congrats!' }, { at: at(1, 21, 43), sender: 'Amelie Smith', text: 'thank youuu' }, { at: at(1, 21, 44), sender: 'Me', text: 'so proud' }],
}];

function fakeBridge(read) {
  const b = {
    getAutoLaunch: () => Promise.resolve(false), setAutoLaunch: () => Promise.resolve(false), getVersion: () => Promise.resolve('test'),
    getShortcutStatus: () => Promise.resolve({ registered: true }), setTheme: () => {}, showWindow: () => {},
    getAnalysisKeyStatus: async () => ({ hasKey: true }), setAnalysisKey: async () => ({ ok: true }), clearAnalysisKey: async () => ({ ok: true }),
    runAnalysis: vi.fn(),
    getChatsInfo: async () => ({ dir: 'C:\\Users\\Liam\\OneDrive\\Documents\\Layers chats' }),
    listChatExports: vi.fn(async () => []),
    readChatExport: vi.fn(async () => ({ error: 'gone' })),
    openChatsFolder: vi.fn(async () => ({ error: null })),
    onChatExportsChanged: () => () => {},
    readIMessages: vi.fn(read),
  };
  window.layersSystem = b;
  return b;
}
afterEach(() => { delete window.layersSystem; ['layers-chat-progress', 'layers-analysis-queue'].forEach(k => window.localStorage.removeItem(k)); });

async function openAnalyse(user) {
  await user.click(nav('Coach'));
  await user.click(screen.getByRole('button', { name: 'Analyse a chat' }));
  return screen.findByLabelText('From your chats');
}

describe('iMessage from an iPhone backup', () => {
  it("lists its chats with the backup's day, knows which messages are yours, and fills the card like an export", async () => {
    const bridge = fakeBridge(async (knownAt) => (knownAt === BACKUP.at ? { backup: BACKUP, same: true } : { backup: BACKUP, chats: CHATS }));
    seedState({ profile: { name: 'Liam', focus: 'mix' }, people: [person('Amelie', { layer: 4 })] });
    const { user } = renderApp();
    const card = await openAnalyse(user);
    expect(await within(card).findByText(/^iMessage from Liam's iPhone, backed up Today, /)).toBeTruthy();
    expect(within(card).getByText(/Back up again for newer messages/)).toBeTruthy();
    expect(screen.getByLabelText('Analyse all new').textContent).toMatch(/1 conversation with Amelie/);

    await user.click(within(card).getByRole('button', { name: /Amelie Smith.*iMessage · Amelie.*1 new/ }));
    expect(within(card).queryByText('Which of these is you?')).toBeNull();
    await user.click(within(card).getByRole('button', { name: /4 messages.*Amelie Smith: I got the job!!/ }));
    const own = screen.getByLabelText('Your own chat');
    expect(within(own).getByText(/^From iMessage · Amelie Smith · /)).toBeTruthy();
    expect(within(own).getByLabelText('The chat').value).toBe([
      `[${iso(at(1, 21, 41))}] Amelie: I got the job!!`, `[${iso(at(1, 21, 42))}] Liam: No way, congrats!`,
      `[${iso(at(1, 21, 43))}] Amelie: thank youuu`, `[${iso(at(1, 21, 44))}] Liam: so proud`,
    ].join('\n'));

    // Coming back, the same backup isn't read again.
    await user.click(nav('Today'));
    await openAnalyse(user);
    expect(bridge.readIMessages).toHaveBeenLastCalledWith(BACKUP.at);
    expect(await within(screen.getByLabelText('From your chats')).findByRole('button', { name: /Amelie Smith/ })).toBeTruthy();
  });

  it('says why when the backup is encrypted, and how to back up when there is none', async () => {
    fakeBridge(async () => ({ backup: BACKUP, error: "Your iPhone backup is encrypted, so Layers can't read its messages." }));
    seedState({ profile: { name: 'Liam', focus: 'mix' }, people: [person('Amelie')] });
    const { user } = renderApp();
    const card = await openAnalyse(user);
    expect((await within(card).findByRole('alert')).textContent).toBe("iPhone backup: Your iPhone backup is encrypted, so Layers can't read its messages.");
    await user.click(within(card).getByRole('button', { name: 'How to add one' }));
    expect(within(card).getByText(/Apple Devices → Back up all of the data on your iPhone to this computer/)).toBeTruthy();
  });
});
