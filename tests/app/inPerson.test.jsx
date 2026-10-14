/** @vitest-environment jsdom */
// A conversation in person (decided 2026-10-14): Coach → Analyse → In person
// (I), four short questions, what you did and the day, and Claude reads your
// notes like a chat: the review, details to save, what to send them after,
// and a log of that kind keeping your notes. Claude is stood in for.
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toISODate } from '../../src/lib/dates.js';
import { nav, person, renderApp, savedPerson, savedState, seedState } from './harness.jsx';

const ANSWER = {
  transcript: [{ who: 'them', text: 'made up' }],
  conversationState: 'engaged',
  recommendation: null,
  grading: { overall: 72, depth: 66, activeListening: 70, reciprocity: 60, naturalness: 80 },
  wentWell: ['You asked [them] how the first week went'],
  opportunity: 'Share a bit more of your own week.',
  tryNextTime: 'Tell one story of your own when [them] opens up.',
  tipFollowed: '',
  moments: [{ quote: 'nervous about her first week', kind: 'good', note: 'You noticed how [them] felt.' }],
  encourager: null,
  emotionalCues: [],
  extractedInfo: [{ category: 'experiences', text: '[them] started at the library on Monday', temporary: false, when: '' }],
  next: { continueTopic: { text: 'Ask about the first week', natural: 'how was the rest of ur week?', playful: 'librarian of the month yet?', deeper: 'did it get less scary?' }, shareYourself: null, changeTopic: null, dontMessage: null },
  log: { meaningfulness: 4, ratings: { depth: 4, trust: 3, reciprocity: 3, interaction: 4, sharedExperiences: 3, listening: 4 }, activeListening: ['followup'], summary: 'Her first week at the library', chatDate: '' },
};

function fakeBridge() {
  const b = {
    getAutoLaunch: () => Promise.resolve(false), setAutoLaunch: () => Promise.resolve(false), getVersion: () => Promise.resolve('test'),
    getShortcutStatus: () => Promise.resolve({ registered: true }), setTheme: () => {}, showWindow: () => {},
    getAnalysisKeyStatus: async () => ({ hasKey: true }), setAnalysisKey: async () => ({ ok: true }), clearAnalysisKey: async () => ({ ok: true }),
    runAnalysis: vi.fn(async (request) => ({ result: ANSWER, usage: { input: 3000, output: 900 }, model: request.model })),
  };
  window.layersSystem = b;
  return b;
}
afterEach(() => { delete window.layersSystem; window.localStorage.removeItem('layers-analysis-spend'); });

async function openInPerson(user, name) {
  await user.click(nav('Coach'));
  await user.click(screen.getByRole('button', { name: 'Analyse a chat' }));
  await user.click(screen.getByRole('button', { name: new RegExp(name) }));
  await user.keyboard('i');
  return screen.getByLabelText('Your own chat');
}

describe('a conversation in person', () => {
  it('sends your notes (names hidden), shows them with the review, and logs it as that kind, keeping your notes', { timeout: 40000 }, async () => {
    const bridge = fakeBridge();
    seedState({ profile: { name: 'Liam', focus: 'mix' }, people: [person('Amelie Smith', { layer: 2 })] });
    const { user } = renderApp();
    const card = await openInPerson(user, 'Amelie');
    expect(within(card).getByText('Analyse a conversation in person')).toBeTruthy();
    expect(within(card).queryByLabelText('The chat')).toBeNull();
    const analyse = within(card).getByRole('button', { name: /Analyse with Claude/ });
    expect(analyse.disabled).toBe(true); // nothing written yet
    await user.click(within(card).getByRole('button', { name: /Hung out/ }));
    await user.type(within(card).getByLabelText('What did you talk about?'), 'her new job, the trip in May');
    await user.type(within(card).getByLabelText('What did Amelie share?'), 'nervous about her first week');
    await user.type(within(card).getByLabelText('How did it end?'), 'Amelie said coffee next week{Control>}{Enter}{/Control}');

    const sent = bridge.runAnalysis.mock.calls[0][0];
    expect(sent.content).toHaveLength(1);
    expect(sent.content[0].text).toContain("THE USER'S NOTES, written after:\n\nWhat you talked about:\nher new job, the trip in May\n\nWhat [them] shared:\nnervous about her first week\n\nHow it ended:\n[them] said coffee next week");
    expect(sent.content[0].text).not.toContain('What the user shared'); // skipped, so not sent
    expect(sent.system).toContain('while hanging out');
    expect(sent.system).toContain('FOR NOTES, NOT A CHAT');
    expect(JSON.stringify(sent)).not.toMatch(/Amelie|Liam/);

    expect(await screen.findByText('Your notes')).toBeTruthy();
    const notes = screen.getByLabelText('Your notes');
    expect(within(notes).getByText('nervous about her first week')).toBeTruthy();
    expect(within(notes).getByText(/You noticed how Amelie felt\./)).toBeTruthy(); // the moment, quoted from your notes
    expect(screen.queryByText('Reconstructed conversation')).toBeNull();
    expect(screen.queryByText('made up')).toBeNull(); // no invented chat is shown
    expect(screen.getByText('What to send them after')).toBeTruthy();
    const logIt = within(screen.getByLabelText('Log it'));
    expect(logIt.getByText(/🍕 Hung out with Amelie Smith · Personal/)).toBeTruthy();
    expect(logIt.getByText('the day you picked')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(savedPerson('Amelie Smith').experiences[0].text).toBe('Amelie started at the library on Monday');
    await user.click(screen.getByRole('button', { name: /Log this conversation/ }));
    const entry = savedState().journal[0];
    expect(entry).toMatchObject({ type: 'hangout', at: toISODate(new Date()), meaningfulness: 4, summary: 'Her first week at the library', analysis: { inPerson: 'hangout' } });
    expect(entry.analysis.chat).toBe('What you talked about:\nher new job, the trip in May\n\nWhat they shared:\nnervous about her first week\n\nHow it ended:\nAmelie said coffee next week');

    await user.click(nav('Journal'));
    await user.click(screen.getByRole('button', { name: /^Chat review: Amelie Smith/ }));
    const review = screen.getByRole('dialog', { name: 'Review: Amelie Smith' });
    expect(within(review).queryByLabelText('The numbers')).toBeNull();
    await user.click(within(review).getByRole('button', { name: 'Show your notes' }));
    expect(within(review).getByLabelText('Your notes').textContent).toMatch(/nervous about her first week/);
  });

  it('after logging time together, Tell Claude what was said opens it filled in, and adds the review to that log rather than logging again', async () => {
    const bridge = fakeBridge();
    seedState({ profile: { name: 'Liam', focus: 'mix' }, people: [person('Amelie'), person('Chloe')] });
    const { user } = renderApp();
    await user.click(document.querySelector('.fab-btn'));
    await user.keyboard('1');
    await user.keyboard('4'); // Hung out
    await user.click(screen.getByRole('button', { name: /Amelie/ }));
    await user.click(screen.getByRole('button', { name: /Chloe/ }));
    await user.keyboard('{Enter}');
    await user.keyboard('43{Enter}'); // how meaningful with each, then save
    const logged = savedState().journal;
    expect(logged).toHaveLength(2);
    expect(logged[0].logId).toBe(logged[1].logId);
    expect(screen.getByText('Logged time with Amelie and Chloe')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Tell Claude what was said' }));
    const card = screen.getByLabelText('Your own chat');
    expect(within(card).getByText('Analyse a conversation in person')).toBeTruthy();
    expect(within(card).getByRole('group', { name: "Who it's with" }).textContent).toMatch(/Amelie.*Chloe/);
    expect(within(card).getByRole('button', { name: /Hung out/ }).getAttribute('aria-pressed')).toBe('true');
    await user.type(within(card).getByLabelText('What did they share?'), 'Chloe is moving{Control>}{Enter}{/Control}');
    expect(bridge.runAnalysis).toHaveBeenCalledTimes(1);
    const add = await screen.findByLabelText('Add to your log');
    expect(screen.queryByLabelText('Log it')).toBeNull();
    await user.click(within(add).getByRole('button', { name: /Add to your log/ }));
    const after = savedState().journal;
    expect(after).toHaveLength(2); // the same two entries, not a new log
    expect(after.map(j => j.meaningfulness).sort()).toEqual([3, 4]); // your own ratings stand
    after.forEach(j => expect(j.analysis).toMatchObject({ inPerson: 'hangout', chat: 'What they shared:\nChloe is moving' }));
    expect(within(add).getByText('✓ Added to your log')).toBeTruthy();
    // Coach again later starts afresh: those notes reopened could replace the
    // review just added (audit 2026-10-14).
    await user.click(nav('Today'));
    await user.click(nav('Coach'));
    expect(screen.queryByLabelText('What did they share?')).toBeNull();
    expect(screen.queryByLabelText('Add to your log')).toBeNull();
  });

  it('the Journal offers it on a conversation in person logged without a review, for everyone in that log', async () => {
    fakeBridge();
    const amelie = person('Amelie');
    const chloe = person('Chloe');
    const today = toISODate(new Date());
    const entry = (id, p, type, extra = {}) => ({ id, personId: p.id, at: today, type, meaningfulness: 3, added: [], activeListening: [], ...extra });
    seedState({ people: [amelie, chloe], journal: [entry('j1', amelie, 'activity', { logId: 'L1' }), entry('j2', chloe, 'activity', { logId: 'L1' }), entry('j3', amelie, 'messaged')] });
    const { user } = renderApp();
    await user.click(nav('Journal'));
    expect(screen.getAllByRole('button', { name: /^Tell Claude what was said/ })).toHaveLength(2); // not on the messaged one
    await user.click(screen.getByRole('button', { name: /^Tell Claude what was said: Chloe/ }));
    const card = screen.getByLabelText('Your own chat');
    expect(within(card).getByRole('group', { name: "Who it's with" }).textContent).toMatch(/Amelie.*Chloe/);
    expect(within(card).getByRole('button', { name: /Did an activity/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it("isn't offered without Claude", async () => {
    const amelie = person('Amelie');
    seedState({ people: [amelie], journal: [{ id: 'j1', personId: amelie.id, at: toISODate(new Date()), type: 'talked', meaningfulness: 3, added: [], activeListening: [] }] });
    const { user } = renderApp();
    await user.click(nav('Journal'));
    expect(screen.getByRole('button', { name: /^Edit entry: Amelie/ })).toBeTruthy(); // the entry is there
    expect(screen.queryByRole('button', { name: /^Tell Claude what was said/ })).toBeNull();
  });

  it('I switches back to a chat, and the chat box is as it was', async () => {
    fakeBridge();
    seedState({ people: [person('Amelie')] });
    const { user } = renderApp();
    const card = await openInPerson(user, 'Amelie');
    expect(within(card).getByRole('group', { name: 'What to analyse' }).querySelector('[aria-pressed="true"]').textContent).toMatch(/In person/);
    await user.keyboard('i');
    expect(within(card).getByLabelText('The chat')).toBeTruthy();
    expect(within(card).queryByLabelText('What did you talk about?')).toBeNull();
  });
});
