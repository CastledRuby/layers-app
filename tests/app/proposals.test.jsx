/** @vitest-environment jsdom */
// The proposals built for 1.0.28 (docs/roadmap.md, P1-P7), driven through
// the UI the way a person would use them.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { toISODate } from '../../src/lib/dates.js';
import { dialog, nav, person, renderApp, savedPerson, savedState, seedState } from './harness.jsx';

const TODAY = toISODate(new Date());
const goal = (id, title, progress = 10) => ({ id, personId: null, category: 'relationship', type: 'learn', title, description: '', progress, history: [] });

async function startLog(user, names) {
  await user.click(document.querySelector('.fab-btn'));
  await user.click(within(dialog('What are you logging?')).getByRole('button', { name: /^Interaction/ }));
  await user.click(within(dialog('What did you do?')).getByRole('button', { name: /Talked/ }));
  const who = dialog('Who was this with?');
  for (const n of names) await user.click(within(who).getByRole('button', { name: new RegExp(n) }));
  await user.click(within(who.closest('.sheet-panel')).getByRole('button', { name: /^Confirm/ }));
  return dialog('Add details');
}
const save = (user, details) => user.click(within(details.closest('.sheet-panel')).getByRole('button', { name: 'Save interaction' }));

describe('P1 progressive "More details" when logging', () => {
  it('stays out of the way: closed until you open it', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    const details = await startLog(user, ['Morgan']);
    expect(within(details).getByRole('button', { name: /More details/ }).getAttribute('aria-expanded')).toBe('false');
    expect(within(details).queryByText('What stood out?')).toBeNull();
  });

  it('saves something new, what stood out, which goals moved and a reflection', async () => {
    const before = person('Morgan', { goals: [goal('g1', 'Learn more'), goal('g2', 'Spend time together')] });
    seedState({ people: [before] });
    const { user } = renderApp();
    const details = await startLog(user, ['Morgan']);
    await user.click(within(details).getByRole('button', { name: /More details/ }));
    await user.click(within(details).getByRole('button', { name: /Plans/ }));
    await user.type(within(details).getByLabelText('Something new'), 'Running a marathon in May{Enter}');
    await user.click(within(details).getByRole('button', { name: 'Went deeper' }));
    await user.click(within(details).getByRole('checkbox', { name: /Spend time together/ }));
    await user.type(within(details).getByLabelText('Reflection'), 'Felt easy today');
    await save(user, details);

    const morgan = savedPerson('Morgan');
    expect(morgan.plans.map(p => p.text)).toEqual(['Running a marathon in May']);
    expect(morgan.dims.depth - before.dims.depth).toBe(Math.round(3 * 1.3) + 3); // the usual bump + "Went deeper"
    expect(morgan.goals.find(g => g.id === 'g1').progress).toBeGreaterThan(10);
    expect(morgan.goals.find(g => g.id === 'g2').progress).toBe(10); // unticked: didn't move
    expect(morgan.lastChange.why).toContain('You noted: went deeper');
    const entry = savedState().journal[0];
    expect(entry).toMatchObject({ reflection: 'Felt easy today', standouts: ['depth'], added: ['Running a marathon in May'] });
  });

  it('shows the reflection in the journal, and finds it by search', async () => {
    const morgan = person('Morgan');
    seedState({ people: [morgan], journal: [{ id: 'j1', personId: morgan.id, at: TODAY, type: 'talked', meaningfulness: 3, added: [], activeListening: [], reflection: 'Felt easy today', standouts: ['depth'] }] });
    const { user } = renderApp();
    await user.click(nav('Journal'));
    expect(screen.getByText('“Felt easy today”')).toBeTruthy();
    expect(screen.getByText(/Went deeper/)).toBeTruthy();
    await user.type(screen.getByPlaceholderText('Search the journal...'), 'easy');
    expect(screen.getByText('“Felt easy today”')).toBeTruthy();
  });
});

describe('P2 journal editing and filters', () => {
  function seedJournal() {
    const morgan = person('Morgan', { layer: 1 });
    const riley = person('Riley', { layer: 3 });
    const entry = (id, who, at, summary) => ({ id, personId: who.id, at, type: 'talked', meaningfulness: 3, added: [], activeListening: [], summary });
    const threeWeeksAgo = new Date(); threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 20);
    seedState({ people: [morgan, riley], journal: [entry('j1', morgan, TODAY, 'Coffee with Morgan'), entry('j2', riley, toISODate(threeWeeksAgo), 'Walk with Riley')] });
  }

  it('edits an entry: note, type, meaningfulness and reflection', async () => {
    seedJournal();
    const { user } = renderApp();
    await user.click(nav('Journal'));
    await user.click(screen.getByRole('button', { name: /Edit entry: Morgan/ }));
    const sheet = dialog('Edit entry');
    await user.clear(within(sheet).getByLabelText('Note'));
    await user.type(within(sheet).getByLabelText('Note'), 'Long lunch with Morgan');
    await user.click(within(sheet).getByRole('button', { name: /Hung out/ }));
    await user.click(within(sheet).getByRole('button', { name: '5' }));
    await user.type(within(sheet).getByLabelText('Reflection'), 'Really relaxed');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(savedState().journal.find(j => j.id === 'j1')).toMatchObject({ summary: 'Long lunch with Morgan', type: 'hangout', meaningfulness: 5, reflection: 'Really relaxed', at: TODAY });
    expect(screen.getByText('Long lunch with Morgan')).toBeTruthy();
  });

  it('deletes an entry only after confirming', async () => {
    seedJournal();
    const { user } = renderApp();
    await user.click(nav('Journal'));
    await user.click(screen.getByRole('button', { name: /Edit entry: Riley/ }));
    await user.click(screen.getByRole('button', { name: /Delete this entry/ }));
    await user.click(screen.getByRole('button', { name: 'Delete entry' }));
    expect(savedState().journal.map(j => j.id)).toEqual(['j1']);
    expect(screen.queryByText('Walk with Riley')).toBeNull();
  });

  it('filters by period and by layer, and clears them', async () => {
    seedJournal();
    const { user } = renderApp();
    await user.click(nav('Journal'));
    await user.click(screen.getByRole('button', { name: 'Past week' }));
    expect(screen.getByText('Coffee with Morgan')).toBeTruthy();
    expect(screen.queryByText('Walk with Riley')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Any time' }));
    await user.click(screen.getByRole('button', { name: 'Layer 3' }));
    expect(screen.queryByText('Coffee with Morgan')).toBeNull();
    expect(screen.getByText('Walk with Riley')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Clear filters/ }));
    expect(screen.getByText('Coffee with Morgan')).toBeTruthy();
    expect(screen.getByText('Walk with Riley')).toBeTruthy();
  });
});
