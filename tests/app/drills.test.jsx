/** @vitest-environment jsdom */
// Practice drills (decided 2026-10-10): "Today's drill" on Today until you've
// done one (R to reply, ↵ sends), Claude's score and a better reply in your
// style, kept as practice; a Quick drill in Coach → Practise with Another.
// The main process (the key and Claude) is stood in for.
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toISODate } from '../../src/lib/dates.js';
import { drillFor } from '../../src/lib/drills.js';
import { nav, person, relaunch, renderApp, seedState } from './harness.jsx';

const TODAY = toISODate(new Date());
function fakeBridge({ hasKey = true } = {}) {
  const b = {
    getAutoLaunch: () => Promise.resolve(false), setAutoLaunch: () => Promise.resolve(false), getVersion: () => Promise.resolve('test'),
    getShortcutStatus: () => Promise.resolve({ registered: true }), setTheme: () => {}, showWindow: () => {},
    getAnalysisKeyStatus: async () => ({ hasKey }), setAnalysisKey: async () => ({ ok: true }), clearAnalysisKey: async () => ({ ok: true }),
    runAnalysis: vi.fn(async (request) => ({ result: { score: 64, worked: 'Friendly, and [you] kept it open.', better: 'sat arvo? climbing gym, 2pm', why: 'A time and a place make it a plan.' }, usage: { input: 700, output: 80 }, model: request.model })),
  };
  window.layersSystem = b;
  return b;
}
afterEach(() => { delete window.layersSystem; });

// Rowan: a name no drill's made-up person has, so finding it in what's sent means a leak.
const rowan = person('Rowan Lee', { layer: 3 });
const seed = () => seedState({ profile: { name: 'Liam', focus: 'mix', style: 'lowercase' }, people: [rowan] });
const card = () => screen.queryByLabelText("Today's drill");

describe("today's drill", () => {
  it('R replies, ↵ sends it with names hidden, and the score and a better reply come back; it stays done after a restart', async () => {
    const bridge = fakeBridge();
    seed();
    const app = renderApp();
    await app.user.click(nav('Today'));
    const drill = drillFor(TODAY);
    expect(await screen.findByLabelText("Today's drill")).toBeTruthy();
    expect(card().textContent).toContain(drill.text);
    expect(card().textContent).toContain(`Your aim: ${drill.aim}`);

    await app.user.keyboard('r');
    expect(document.activeElement).toBe(within(card()).getByLabelText('Your reply'));
    await app.user.keyboard('yes!! with Rowan too?{Enter}');
    await waitFor(() => expect(within(card()).getByLabelText('Better reply').textContent).toBe('sat arvo? climbing gym, 2pm'));
    expect(within(card()).getByLabelText('Score').textContent).toBe('64');
    expect(card().textContent).toContain('✓ Friendly, and you kept it open.');
    const sent = bridge.runAnalysis.mock.calls[0][0];
    expect(sent.content[0].text).toContain(drill.text);
    expect(sent.content[0].text).toContain('"yes!! with [someone] too?"');
    expect(sent.system).toContain('"lowercase"');
    expect(JSON.stringify(sent)).not.toMatch(/Rowan|Liam/);
    expect(JSON.parse(window.localStorage.getItem('layers-practice'))).toEqual([{ at: TODAY, situation: 'drill', drill: drill.key, grading: { overall: 64, depth: null, activeListening: null, reciprocity: null, naturalness: null } }]);

    const again = relaunch(app);
    await again.user.click(nav('Today'));
    await new Promise(r => setTimeout(r, 50));
    expect(card()).toBeNull();
    expect(bridge.runAnalysis).toHaveBeenCalledTimes(1);
  });

  it("isn't on Today without a key", async () => {
    fakeBridge({ hasKey: false });
    seed();
    const { user } = renderApp();
    await user.click(nav('Today'));
    await new Promise(r => setTimeout(r, 50));
    expect(card()).toBeNull();
  });

  it('Practise has a quick drill too, and Another moves on to the next', async () => {
    const bridge = fakeBridge();
    seed();
    const { user } = renderApp();
    await user.click(nav('Coach'));
    await user.keyboard('4');
    const quick = await screen.findByLabelText('Quick drill');
    const first = drillFor(TODAY);
    expect(quick.textContent).toContain(first.text);
    await user.type(within(quick).getByLabelText('Your reply'), 'sounds good{Enter}');
    await waitFor(() => expect(within(screen.getByLabelText('Quick drill')).getByLabelText('Better reply')).toBeTruthy());
    await user.click(within(screen.getByLabelText('Quick drill')).getByRole('button', { name: 'Another' }));
    expect(screen.getByLabelText('Quick drill').textContent).not.toContain(first.text);
    expect(within(screen.getByLabelText('Quick drill')).getByLabelText('Your reply')).toBeTruthy();
    expect(bridge.runAnalysis).toHaveBeenCalledTimes(1);

    // Done in Practise counts for today: Today's card has gone.
    await user.click(nav('Today'));
    expect(card()).toBeNull();
  });
});
