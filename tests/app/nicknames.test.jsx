/** @vitest-environment jsdom */
// Nicknames ("Also known as"): added when editing someone, shown on their
// profile, and a chat signed with one goes to them, the nickname hidden too.
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dialog, nav, person, renderApp, savedPerson, seedState } from './harness.jsx';

const ANSWER = {
  transcript: [], conversationState: 'engaged', wentWell: [], opportunity: '', tryNextTime: '', encourager: null, emotionalCues: [],
  grading: { overall: 60, depth: 50, activeListening: 50, reciprocity: 50, naturalness: 50 }, recommendation: null, extractedInfo: [],
  next: { continueTopic: null, shareYourself: null, changeTopic: null, dontMessage: null },
  log: { meaningfulness: 3, ratings: {}, activeListening: [], summary: '', chatDate: null },
};
afterEach(() => { delete window.layersSystem; });

describe('nicknames', () => {
  it('are added when editing someone, shown on their profile, and find them in a chat', async () => {
    const bridge = {
      getAutoLaunch: () => Promise.resolve(false), setAutoLaunch: () => Promise.resolve(false), getVersion: () => Promise.resolve('test'),
      getShortcutStatus: () => Promise.resolve({ registered: true }), setTheme: () => {}, showWindow: () => {},
      getAnalysisKeyStatus: async () => ({ hasKey: true }), setAnalysisKey: async () => ({ ok: true }), clearAnalysisKey: async () => ({ ok: true }),
      runAnalysis: vi.fn(async (request) => ({ result: ANSWER, usage: { input: 1, output: 1 }, model: request.model })),
    };
    window.layersSystem = bridge;
    seedState({ profile: { name: 'Liam', focus: 'mix' }, people: [person('Amelie', { layer: 4 }), person('Chloe')] });
    const { user } = renderApp();
    await user.click(nav('People'));
    await user.click(screen.getAllByRole('button', { name: /Amelie/ })[0]);
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const sheet = dialog('Edit person');
    await user.type(within(sheet).getByLabelText('Also known as'), 'Mel, Ames, amelie{Enter}');
    expect(savedPerson('Amelie').aka).toEqual(['Mel', 'Ames']);
    expect(screen.getByText('Also known as Mel, Ames')).toBeTruthy();

    // A chat signed "Mel" is with Amelie, and "Mel" doesn't reach Claude.
    await user.keyboard('{Backspace}'); // back from her profile
    await user.click(nav('Coach'));
    await user.click(screen.getByRole('button', { name: 'Analyse a chat' }));
    await user.click(screen.getByRole('button', { name: /Chloe/ }));
    await user.click(screen.getByLabelText('The chat'));
    await user.paste('Mel: guess what\nLiam: what Mel?');
    expect(screen.getByRole('group', { name: "Who it's with" }).textContent).toMatch(/Amelie/);
    await user.click(screen.getByRole('button', { name: 'Analyse with Claude' }));
    await screen.findByText('Reconstructed conversation');
    expect(bridge.runAnalysis.mock.calls[0][0].content.at(-1).text).toBe('The chat:\n\n[them]: guess what\n[you]: what [them]?');
  });
});
