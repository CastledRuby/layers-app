/** @vitest-environment jsdom */
// Know what to say, the daily nudge (decided 2026-10-10): Today's "Message …
// today" says who and why, Claude writes an opener in your style when Layers
// first opens that day (names hidden; held to the monthly limit), O copies
// it, G (messaged) opens the quick log for them, Z puts them off till
// tomorrow, and nothing is asked again that day. The main process (the key and
// Claude) is stood in for.
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toISODate } from '../../src/lib/dates.js';
import { logDetails, nav, person, queryDialog, relaunch, renderApp, seedState } from './harness.jsx';

const DAY = 24 * 3600 * 1000;
const ago = (n) => toISODate(new Date(Date.now() - n * DAY));

function fakeBridge({ hasKey = true } = {}) {
  const b = {
    getAutoLaunch: () => Promise.resolve(false), setAutoLaunch: () => Promise.resolve(false), getVersion: () => Promise.resolve('test'),
    getShortcutStatus: () => Promise.resolve({ registered: true }), setTheme: () => {}, showWindow: () => {},
    getAnalysisKeyStatus: async () => ({ hasKey }), setAnalysisKey: async () => ({ ok: true }), clearAnalysisKey: async () => ({ ok: true }),
    runAnalysis: vi.fn(async (request) => ({ result: { opener: 'hey [them]!! long time, hows the new flat' }, usage: { input: 900, output: 60 }, model: request.model })),
  };
  window.layersSystem = b;
  return b;
}
afterEach(() => { delete window.layersSystem; ['layers-nudge', 'layers-analysis-spend', 'layers-analysis-limit'].forEach(k => window.localStorage.removeItem(k)); });

const sam = person('Sam Lee', { layer: 3, interests: [{ id: 'i1', emoji: '⭐', text: 'Just moved into a new flat', at: ago(40), temporary: false, archived: false }] });
const seed = () => seedState({ profile: { name: 'Liam', focus: 'mix', style: 'lowercase' }, people: [sam], journal: [{ id: 'j1', personId: sam.id, at: ago(35), type: 'talked', meaningfulness: 3, added: [], activeListening: [], summary: 'Coffee and his move' }] });
const card = () => screen.queryByLabelText('Message today');

describe('who to message today', () => {
  it("says who and why, with Claude's opener written once that day, names hidden; O copies it and Z puts them off, even after a restart", async () => {
    const bridge = fakeBridge();
    seed();
    const app = renderApp();
    await app.user.click(nav('Today'));
    expect(card().textContent).toMatch(/Message Sam Lee today/);
    expect(card().textContent).toMatch(/It's been 5 weeks since you and Sam Lee talked/);
    expect(await within(card()).findByLabelText('Opener')).toBeTruthy();
    expect(within(card()).getByLabelText('Opener').textContent).toBe('hey Sam!! long time, hows the new flat');
    const sent = bridge.runAnalysis.mock.calls[0][0];
    expect(sent.content[0].text).toContain("Why message today: It's been 5 weeks since you and [them] talked");
    expect(sent.content[0].text).toContain('- Just moved into a new flat');
    expect(sent.system).toContain('"lowercase"');
    expect(JSON.stringify(sent)).not.toMatch(/Sam|Liam/);

    await app.user.keyboard('o');
    expect(await navigator.clipboard.readText()).toBe('hey Sam!! long time, hows the new flat');
    await app.user.keyboard('z');
    expect(card()).toBeNull();

    const again = relaunch(app);
    await again.user.click(nav('Today'));
    expect(card()).toBeNull();
    expect(bridge.runAnalysis).toHaveBeenCalledTimes(1);
  });

  it('G opens the quick log for them as Messaged, and the card is done for the day', async () => {
    fakeBridge();
    seed();
    const { user } = renderApp();
    await user.click(nav('Today'));
    await within(card()).findByLabelText('Opener');
    await user.keyboard('g');
    expect(logDetails().getAttribute('aria-label') || logDetails().textContent).toMatch(/Messaged Sam Lee/);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(queryDialog(/^Messaged /)).toBeNull());
    expect(card()).toBeNull();
  });

  it("shows who and why without an opener when there's no key, or the month's limit is reached", async () => {
    const bridge = fakeBridge({ hasKey: false });
    seed();
    const { user, unmount } = renderApp();
    await user.click(nav('Today'));
    expect(card().textContent).toMatch(/Message Sam Lee today/);
    expect(within(card()).queryByLabelText('Opener')).toBeNull();
    unmount();
    const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    window.localStorage.setItem('layers-analysis-spend', JSON.stringify({ [month]: { dollars: 5.2, chats: 300, models: {} } }));
    bridge.hasKey = true;
    window.layersSystem.getAnalysisKeyStatus = async () => ({ hasKey: true });
    const again = renderApp();
    await again.user.click(nav('Today'));
    await new Promise(r => setTimeout(r, 50));
    expect(bridge.runAnalysis).not.toHaveBeenCalled();
    expect(within(card()).queryByLabelText('Opener')).toBeNull();
  });
});
