/** @vitest-environment jsdom */
// The big picture (decided 2026-10-10): "Your week" asks Claude for a read of
// this week by itself, once (names hidden, held to the monthly limit), keeps
// it, and offers a button for earlier weeks. Without a key there's none.
// Claude is stood in for.
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toISODate } from '../../src/lib/dates.js';
import { dialog, nav, person, renderApp, seedState } from './harness.jsx';

const READ = { headline: 'A warm week, mostly with [them]', wentWell: 'You cheered [them] on about the interview.', pattern: 'You asked more than you shared.', tryThisWeek: 'Share one thing about your own week.', reachOut: '' };
function fakeBridge({ hasKey = true } = {}) {
  const b = {
    getAutoLaunch: () => Promise.resolve(false), setAutoLaunch: () => Promise.resolve(false), getVersion: () => Promise.resolve('test'),
    getShortcutStatus: () => Promise.resolve({ registered: true }), setTheme: () => {}, showWindow: () => {},
    getAnalysisKeyStatus: async () => ({ hasKey }), setAnalysisKey: async () => ({ ok: true }), clearAnalysisKey: async () => ({ ok: true }),
    runAnalysis: vi.fn(async (request) => ({ result: READ, usage: { input: 1500, output: 200 }, model: request.model })),
  };
  window.layersSystem = b;
  return b;
}
afterEach(() => { delete window.layersSystem; ['layers-week-reads', 'layers-analysis-spend'].forEach(k => window.localStorage.removeItem(k)); });

const amelie = person('Amelie', { layer: 4 });
const seed = () => seedState({ profile: { name: 'Liam', focus: 'mix' }, people: [amelie], journal: [{ id: 'j1', personId: amelie.id, at: toISODate(new Date()), type: 'messaged', meaningfulness: 4, added: [], activeListening: [], summary: 'Her interview' }] });
const read = () => within(dialog('Your week')).queryByLabelText("Claude's read of your week");

describe("Claude's read of your week", () => {
  it('reads this week by itself, once, with names hidden and put back, and keeps it', async () => {
    const bridge = fakeBridge();
    seed();
    const { user } = renderApp();
    await user.click(nav('Today'));
    await user.keyboard('w');
    expect(await within(await screen.findByLabelText("Claude's read of your week")).findByText('A warm week, mostly with Amelie')).toBeTruthy();
    expect(within(read()).getByText(/You asked more than you shared/)).toBeTruthy();
    const sent = bridge.runAnalysis.mock.calls[0][0];
    expect(sent.content[0].text).toMatch(/Messaged with \[them\], Personal \(4 of 5\); note: "Her interview"/);
    expect(JSON.stringify(sent)).not.toMatch(/Amelie|Liam/);

    await user.keyboard('{Escape}');
    await user.keyboard('w');
    expect(await within(read()).findByText('A warm week, mostly with Amelie')).toBeTruthy();
    expect(bridge.runAnalysis).toHaveBeenCalledTimes(1);

    // An earlier week with nothing logged has no read to offer.
    await user.keyboard('{ArrowLeft}');
    expect(read()).toBeNull();
  });

  it("isn't there without a key", async () => {
    const bridge = fakeBridge({ hasKey: false });
    seed();
    const { user } = renderApp();
    await user.click(nav('Today'));
    await user.keyboard('w');
    expect(dialog('Your week')).toBeTruthy();
    expect(read()).toBeNull();
    expect(bridge.runAnalysis).not.toHaveBeenCalled();
  });
});
