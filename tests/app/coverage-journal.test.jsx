/** @vitest-environment jsdom */
// Kept chat reviews on journal entries (analysis.test.jsx has one kept by
// logging): saved ones read again after a restart, an older analysis with
// only its scores (no review to open), one with no scores dropped at startup
// while its log stays, and the Journal's search over kept chats and reviews
// (any case, with a person picked too).
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { toISODate } from '../../src/lib/dates.js';
import { dialog, nav, person, relaunch, renderApp, savedState, seedState } from './harness.jsx';

const DAY = 24 * 3600 * 1000;
const day = (n) => toISODate(new Date(Date.now() + n * DAY));
const amelie = person('Amelie', { id: 'p-amelie', layer: 3 });
const chloe = person('Chloe', { id: 'p-chloe', layer: 2 });
const review = {
  wentWell: ['You celebrated straight away'], opportunity: 'Ask about the commute', tryNextTime: 'Share a story of your own',
  encourager: null, emotionalCues: [{ emoji: '🎉', text: 'Proud' }], recommendation: null,
  next: { continueTopic: { text: 'Ask about her first week', natural: 'How was the first week?', playful: 'Star-gazer era!', deeper: 'What drew you to it?' }, shareYourself: null, changeTopic: null, dontMessage: null },
};
const kept = { grading: { overall: 80, depth: 70, activeListening: 84, reciprocity: 56, naturalness: 75 }, conversationState: 'engaged', model: 'claude-haiku-4-5', review, chat: 'Amelie: I got the job at the Observatory!\nLiam: congrats!!' };
const entries = () => [
  { id: 'e1', personId: amelie.id, at: day(-2), type: 'messaged', meaningfulness: 4, added: [], activeListening: [], summary: 'Her new job', analysis: kept },
  { id: 'e2', personId: chloe.id, at: day(-1), type: 'talked', meaningfulness: 3, added: [], activeListening: [], summary: 'Coffee by the river' },
  { id: 'e3', personId: chloe.id, at: day(-5), type: 'messaged', meaningfulness: 3, added: [], activeListening: [], summary: 'Older analysed chat', analysis: { grading: { overall: 55 }, conversationState: 'flat' } },
  { id: 'e4', personId: chloe.id, at: day(-6), type: 'messaged', meaningfulness: 3, added: [], activeListening: [], summary: 'Broken analysis', analysis: { grading: { depth: 3 }, conversationState: 'engaged' } },
];
const seed = () => seedState({ profile: { name: 'Liam', focus: 'mix' }, people: [amelie, chloe], journal: entries() });
const reviewButtons = () => screen.queryAllByRole('button', { name: /^Chat review: / });

describe('kept chat reviews on the Journal', { timeout: 60000 }, () => {
  it('are read again after a restart: the review, its suggestions and the chat', async () => {
    seed();
    const app = renderApp();
    const { user } = relaunch(app);
    await user.click(nav('Journal'));
    expect(reviewButtons().map(b => b.getAttribute('aria-label'))).toEqual([expect.stringMatching(/^Chat review: Amelie, /)]);
    await user.click(reviewButtons()[0]);
    const sheet = dialog('Chat review: Amelie');
    expect(within(sheet).getByText(/You celebrated straight away/)).toBeTruthy();
    expect(within(sheet).getByText(/Ask about the commute/)).toBeTruthy();
    expect(within(sheet).getByText(/Share a story of your own/)).toBeTruthy();
    expect(within(sheet).getByText('Star-gazer era!')).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: 'Show the chat' }));
    expect(within(sheet).getByLabelText('The chat').textContent).toBe(kept.chat);
    await user.click(within(sheet).getByRole('button', { name: 'Hide the chat' }));
    expect(within(sheet).queryByLabelText('The chat')).toBeNull();
  });

  it("an older analysis keeps its scores without a review to open; one without scores is dropped, and its log stays", async () => {
    seed();
    const { user } = renderApp();
    await user.click(nav('Journal'));
    expect(screen.getByText(/grading 55%/)).toBeTruthy();
    expect(screen.getByText(/grading 80%/)).toBeTruthy();
    expect(reviewButtons()).toHaveLength(1);
    const saved = savedState().journal;
    expect(saved.find(j => j.id === 'e3').analysis).toEqual({ grading: { overall: 55 }, conversationState: 'flat' });
    expect(saved.find(j => j.id === 'e4')).toMatchObject({ summary: 'Broken analysis' });
    expect(saved.find(j => j.id === 'e4').analysis).toBeUndefined();
    expect(saved.find(j => j.id === 'e1').analysis).toEqual(kept);
  });
});

describe("the Journal's search", { timeout: 60000 }, () => {
  it("looks in kept chats and Claude's review, in any case", async () => {
    seed();
    const { user } = renderApp();
    await user.click(nav('Journal'));
    const search = screen.getByLabelText('Search the journal');
    const shown = () => ['Her new job', 'Coffee by the river', 'Older analysed chat'].filter(s => screen.queryByText(new RegExp(s)));

    await user.type(search, 'OBSERVATORY'); // in the chat
    expect(shown()).toEqual(['Her new job']);
    await user.clear(search);
    await user.type(search, 'the commute'); // Claude's opportunity
    expect(shown()).toEqual(['Her new job']);
    await user.clear(search);
    await user.type(search, 'story of your own'); // try next time
    expect(shown()).toEqual(['Her new job']);
    await user.clear(search);
    await user.type(search, 'celebrated'); // what went well
    expect(shown()).toEqual(['Her new job']);
    await user.clear(search);
    await user.type(search, 'river');
    expect(shown()).toEqual(['Coffee by the river']);
    await user.clear(search);
    await user.type(search, 'chloe'); // a person's name finds their logs
    expect(shown()).toEqual(['Coffee by the river', 'Older analysed chat']);
    await user.clear(search);
    await user.type(search, 'nothing like this');
    expect(shown()).toEqual([]);
    await user.clear(search);
    expect(shown()).toEqual(['Her new job', 'Coffee by the river', 'Older analysed chat']);
  });
});
