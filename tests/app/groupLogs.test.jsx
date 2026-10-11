/** @vitest-environment jsdom */
// A log with several people (decided 2026-10-12): nothing assumes it went the
// same with each. Each has their own "How meaningful" (nobody rated for you),
// their own ratings asked in their own words, their own active listening and
// something new, and "Did you ask about…?" from what's saved about them.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { toISODate } from '../../src/lib/dates.js';
import { dialog, done, nav, openExtra, person, renderApp, savedPerson, savedState, seedState } from './harness.jsx';

const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return toISODate(d); };

async function startLog(user, names) {
  await user.click(document.querySelector('.fab-btn'));
  await user.click(within(dialog('What are you logging?')).getByRole('button', { name: /^Interaction/ }));
  await user.click(within(dialog('What did you do?')).getByRole('button', { name: /Hung out/ }));
  const who = dialog('Who was this with?');
  for (const n of names) await user.click(within(who).getByRole('button', { name: new RegExp(n) }));
  await user.click(within(who.closest('.sheet-panel')).getByRole('button', { name: /^Confirm/ }));
  return dialog(/^Hung out with /);
}
const save = (user, details) => user.click(within(details.closest('.sheet-panel')).getByRole('button', { name: 'Save interaction' }));
const entryFor = (name) => savedState().journal.find(j => j.personId === savedPerson(name).id);
const tab = (name) => screen.getByRole('tab', { name: new RegExp(name) });

describe('a log with several people', () => {
  it("rates each person on their own, in turn, and won't save until everyone is rated", async () => {
    const morgan = person('Morgan');
    const riley = person('Riley', { layer: 3 });
    seedState({ people: [morgan, riley] });
    const { user } = renderApp();
    const details = await startLog(user, ['Morgan', 'Riley']);
    expect(within(details).getByText('How meaningful was it with each?')).toBeTruthy();
    expect(within(details).getAllByText('Not rated yet')).toHaveLength(2);

    await save(user, details);
    expect(savedState().journal).toEqual([]);
    expect(within(details).getByRole('status').textContent).toBe('How did it go with Morgan and Riley? Type 1–5 to rate each before saving.');

    await user.keyboard('4'); // Morgan, then the highlight moves to Riley
    expect(within(details).getByText('Personal')).toBeTruthy();
    await user.keyboard('{Enter}');
    expect(savedState().journal).toEqual([]);
    expect(within(details).getByRole('status').textContent).toMatch(/^How did it go with Riley\?/);
    await user.keyboard('2{Enter}');

    expect(entryFor('Morgan').meaningfulness).toBe(4);
    expect(entryFor('Riley').meaningfulness).toBe(2);
    // How it went with one doesn't move the other: Morgan's was more meaningful.
    const grew = (name, before) => savedPerson(name).dims.trust - before.dims.trust;
    expect(grew('Morgan', morgan)).toBeGreaterThan(grew('Riley', riley));
  });

  it("Rate each part goes person by person in each one's words, and saves each one's ratings", async () => {
    seedState({ people: [person('Morgan'), person('Riley', { layer: 3 })] });
    const { user } = renderApp();
    const details = await startLog(user, ['Morgan', 'Riley']);
    await user.keyboard('34');
    await openExtra(user, 'Rate each part');
    const sheet = dialog('How did each part go?');
    expect(tab('Morgan').getAttribute('aria-selected')).toBe('true');
    expect(within(sheet).getByRole('radiogroup', { name: 'How far past small talk did you get with Morgan?' })).toBeTruthy();
    await user.keyboard('435245'); // all six of Morgan's: on to Riley's
    expect(tab('Riley').getAttribute('aria-selected')).toBe('true');
    expect(within(sheet).getByRole('radiogroup', { name: 'How much did Riley share how they feel?' })).toBeTruthy();
    await user.keyboard('1');
    await user.keyboard('{ArrowLeft}');
    expect(within(sheet).getByRole('group', { name: 'How did each part go with Morgan?' })).toBeTruthy();
    await user.keyboard('{Enter}');
    expect(within(details).getByRole('button', { name: /Rate each part, Morgan ✓, Riley 1 of 6/ })).toBeTruthy();
    await save(user, details);
    expect(entryFor('Morgan').ratings).toEqual({ depth: 4, trust: 3, reciprocity: 5, interaction: 2, sharedExperiences: 4, listening: 5 });
    expect(entryFor('Riley').ratings).toEqual({ depth: 1 });
  });

  it("asks about what's saved about each, and a yes is remembering, for that person only", async () => {
    const riley = person('Riley', { layer: 2, important: [{ id: 'i1', emoji: '🔔', text: 'Big exam on Friday', at: day(-2), temporary: true, archived: false }] });
    seedState({ people: [person('Morgan'), riley] });
    const { user } = renderApp();
    const details = await startLog(user, ['Morgan', 'Riley']);
    await user.keyboard('33');
    await openExtra(user, 'Rate each part');
    await user.click(tab('Riley'));
    const sheet = dialog('How did each part go?');
    const ask = within(sheet).getByRole('radiogroup', { name: 'Did you ask Riley about "Big exam on Friday"?' });
    await user.click(within(ask).getByRole('radio', { name: 'Yes' }));
    await done(user, 'How did each part go?');
    expect(within(details).getByRole('button', { name: /Active listening, Riley 1/ })).toBeTruthy();
    await save(user, details);
    expect(entryFor('Riley')).toMatchObject({ askedAbout: ['Big exam on Friday'], activeListening: ['remembered'] });
    expect(entryFor('Morgan').activeListening).toEqual([]);
    expect(entryFor('Morgan')).not.toHaveProperty('askedAbout');
    await user.click(nav('Journal'));
    expect(screen.getByText('Asked about: Big exam on Friday')).toBeTruthy();
  });

  it('active listening and something new are each their own', async () => {
    seedState({ people: [person('Morgan'), person('Riley')] });
    const { user } = renderApp();
    const details = await startLog(user, ['Morgan', 'Riley']);
    await user.keyboard('33');
    await openExtra(user, 'Active listening');
    await user.keyboard('1{ArrowRight}2');
    expect(screen.getByText('Tick what you did with Riley. Each one builds that skill.')).toBeTruthy();
    await done(user, 'Did you practise active listening?');
    await openExtra(user, 'Something new');
    await user.keyboard('{ArrowRight}');
    const newInfo = dialog('Something new about Riley?');
    await user.click(within(newInfo).getByRole('button', { name: /Plans/ }));
    await user.type(within(newInfo).getByLabelText('Something new'), 'Moving to Wellington{Enter}');
    await done(user, 'Something new about Riley?');
    await save(user, details);
    expect(entryFor('Morgan')).toMatchObject({ activeListening: ['followup'], added: [] });
    expect(entryFor('Riley')).toMatchObject({ activeListening: ['paraphrase'], added: ['Moving to Wellington'] });
    expect(savedPerson('Riley').plans.map(p => p.text)).toEqual(['Moving to Wellington']);
    expect(savedPerson('Morgan').plans).toEqual([]);
  });

  it('one person still starts at 3 and saves straight away', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    const details = await startLog(user, ['Morgan']);
    expect(within(details).queryByRole('tablist')).toBeNull();
    await save(user, details);
    expect(entryFor('Morgan').meaningfulness).toBe(3);
  });
});
