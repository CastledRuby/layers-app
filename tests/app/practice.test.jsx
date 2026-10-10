/** @vitest-environment jsdom */
// Practise (decided 2026-10-10): Coach's fourth tab. Pick a situation and a
// made-up person or one of yours, text with Claude playing them (Enter sends),
// then Ctrl+Enter for feedback the way Analyse gives it; the score is kept for
// Me's "Your chats over time" and nothing is logged. Prepare's R practises
// with the person you're about to talk to. Claude is stood in for.
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nav, person, renderApp, savedState, seedState } from './harness.jsx';

const FEEDBACK = {
  transcript: [], conversationState: 'engaged', wentWell: ['You let [them] be upset without fixing it'], opportunity: 'Ask what [them] needs.', tryNextTime: 'Name the feeling back.',
  encourager: null, emotionalCues: [], grading: { overall: 72, depth: 60, activeListening: 80, reciprocity: 55, naturalness: 70 }, recommendation: null,
  extractedInfo: [], next: { continueTopic: null, shareYourself: null, changeTopic: null, dontMessage: null },
  log: { meaningfulness: 3, ratings: {}, activeListening: [], summary: 'x', chatDate: '' },
};
function fakeBridge() {
  let turn = 0;
  const b = {
    getAutoLaunch: () => Promise.resolve(false), setAutoLaunch: () => Promise.resolve(false), getVersion: () => Promise.resolve('test'),
    getShortcutStatus: () => Promise.resolve({ registered: true }), setTheme: () => {}, showWindow: () => {},
    getAnalysisKeyStatus: async () => ({ hasKey: true }), setAnalysisKey: async () => ({ ok: true }), clearAnalysisKey: async () => ({ ok: true }),
    runAnalysis: vi.fn(async (request) => {
      if (request.schema.properties.reply) { turn += 1; return { result: { reply: ['didnt get the job', 'yeah. kinda gutted', 'thanks, that helps'][turn - 1] || 'ok' }, usage: { input: 800, output: 20 }, model: request.model }; }
      return { result: FEEDBACK, usage: { input: 3000, output: 2000 }, model: request.model };
    }),
  };
  window.layersSystem = b;
  return b;
}
afterEach(() => { delete window.layersSystem; ['layers-practice', 'layers-analysis-spend'].forEach(k => window.localStorage.removeItem(k)); });

describe('Practise', () => {
  it('chats with a made-up person, then gives feedback, keeps the score for Me, and logs nothing', async () => {
    const bridge = fakeBridge();
    seedState({ profile: { name: 'Liam', focus: 'mix' }, people: [person('Priya Shah', { layer: 3 })] });
    const { user } = renderApp();
    await user.click(nav('Coach'));
    await user.keyboard('4');
    const setup = await screen.findByLabelText('Practise');
    await user.click(within(setup).getByRole('button', { name: /They share bad news/ }));
    expect(within(setup).getByRole('button', { name: 'Maya (made up)' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(within(setup).getByRole('button', { name: 'Start' }));

    // Maya starts; Enter sends; the box is ready again for the next one.
    const chat = await screen.findByLabelText('Practice chat');
    expect(await within(chat).findByText('didnt get the job')).toBeTruthy();
    expect(within(chat).getByRole('button', { name: /End, and feedback/ }).disabled).toBe(true);
    await user.type(within(chat).getByLabelText('Your message'), 'oh no Priya, im so sorry{Enter}');
    expect(await within(chat).findByText('yeah. kinda gutted')).toBeTruthy();
    expect(bridge.runAnalysis.mock.calls[1][0].content[0].text).toContain('[you]: oh no [someone], im so sorry'); // your people's names hidden
    await user.type(within(chat).getByLabelText('Your message'), 'that sucks. want to talk about it?{Enter}');
    await within(chat).findByText('thanks, that helps');
    await user.keyboard('{Control>}{Enter}{/Control}');

    const feedback = await screen.findByLabelText('Practice feedback');
    expect(within(feedback).getByText('72%')).toBeTruthy();
    expect(within(feedback).getByText(/You let Maya be upset without fixing it/)).toBeTruthy();
    const sent = bridge.runAnalysis.mock.calls.at(-1)[0];
    expect(sent.content.at(-1).text).toBe("The chat:\n\n[them]: didnt get the job\n[you]: oh no [someone], im so sorry\n[them]: yeah. kinda gutted\n[you]: that sucks. want to talk about it?\n[them]: thanks, that helps");
    expect(JSON.parse(window.localStorage.getItem('layers-practice'))).toEqual([expect.objectContaining({ situation: 'bad-news', grading: expect.objectContaining({ overall: 72 }) })]);
    expect(savedState().journal).toEqual([]);

    await user.click(nav('Me'));
    expect(screen.getByLabelText('Skills from analysed chats').textContent).toMatch(/Practice 72/);
  });

  it("R on Prepare practises with the person you're about to talk to, Claude playing them from what you know", async () => {
    const bridge = fakeBridge();
    seedState({ profile: { name: 'Liam', focus: 'mix' }, people: [person('Priya Shah', { layer: 3, interests: [{ id: 'i', emoji: '⭐', text: 'Climbing with Noah', at: '2026-10-01', temporary: false, archived: false }] }), person('Noah')] });
    const { user } = renderApp();
    await user.click(nav('Coach'));
    await waitFor(() => expect(screen.getByRole('button', { name: /Practise with Priya first/ })).toBeTruthy());
    await user.keyboard('r');
    const setup = await screen.findByLabelText('Practise');
    expect(within(setup).getByRole('button', { name: /Priya Shah/ }).getAttribute('aria-pressed')).toBe('true');
    expect(within(setup).getByText(/Claude plays Priya Shah from what Layers knows/)).toBeTruthy();
    await user.click(within(setup).getByRole('button', { name: 'Start' })); // Just chatting: they start
    await screen.findByText('didnt get the job');
    const sent = bridge.runAnalysis.mock.calls[0][0];
    expect(sent.system).toMatch(/You are \[them\], in Layer 3/);
    expect(sent.system).toContain('- Climbing with [someone]');
    expect(JSON.stringify(sent)).not.toMatch(/Priya|Noah|Liam/);
  });
});
