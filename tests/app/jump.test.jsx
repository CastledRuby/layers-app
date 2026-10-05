/** @vitest-environment jsdom */
// Ctrl+K, jump to anything (JumpSheet, lib/jump.js): people, their actions,
// pages, actions, and plans or logs typed as a sentence.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { toISODate } from '../../src/lib/dates.js';
import { dialog, nav, person, queryDialog, renderApp, savedState, seedState, toasts } from './harness.jsx';

const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return toISODate(d); };
const options = () => within(screen.getByRole('listbox', { name: 'Results' })).getAllByRole('option').map(o => o.textContent);

async function jump(user, text) {
  await user.keyboard('{Control>}k{/Control}');
  expect(dialog('Jump to')).toBeTruthy();
  if (text) await user.keyboard(text);
}

describe('Ctrl+K', () => {
  it('finds a person and opens them; → shows what you can do with them', async () => {
    seedState({ people: [person('Morgan'), person('Sam')] });
    const { user } = renderApp();
    await jump(user, 'mor');
    expect(options()[0]).toMatch(/Morgan/);
    await user.keyboard('{ArrowRight}');
    expect(options()).toEqual(expect.arrayContaining([expect.stringMatching(/Prepare to talk with Morgan/)]));
    await user.keyboard('{ArrowLeft}{Enter}');
    expect(queryDialog('Jump to')).toBeNull();
    expect(screen.getByRole('button', { name: 'Plan something' })).toBeTruthy(); // on Morgan's profile
  });

  it('"plan sam" goes straight to planning with them', async () => {
    seedState({ people: [person('Morgan'), person('Sam')] });
    const { user } = renderApp();
    await jump(user, 'plan sam{Enter}');
    await user.keyboard('1'); // Coffee
    expect(screen.getByLabelText('Title').value).toBe('Coffee with Sam');
  });

  it('works over an open sheet, closing it to go to a page', async () => {
    seedState();
    const { user } = renderApp();
    await user.keyboard('p');
    expect(dialog('Plan something')).toBeTruthy();
    await jump(user, 'journal{Enter}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(nav('Journal').getAttribute('aria-current')).toBe('page');
  });

  it('runs actions: Dark mode', async () => {
    seedState();
    const { user } = renderApp();
    await jump(user, 'dark{Enter}');
    expect(savedState().themeMode).toBe('dark');
  });

  it('saves a plan typed as a sentence, with Undo', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await jump(user, 'coffee with morgan tomorrow 10am');
    expect(options()[0]).toMatch(/Plan: Coffee with Morgan/);
    await user.keyboard('{Enter}');
    const ev = savedState().events[0];
    expect(ev).toMatchObject({ title: 'Coffee with Morgan', date: day(1), time: 600, template: 'coffee' });
    expect(toasts()).toContain('Plan saved');
    await user.keyboard('{Control>}z{/Control}');
    expect(savedState().events).toEqual([]);
  });

  it('Ctrl+Enter opens a typed plan in full instead', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await jump(user, 'gym every mon wed fri 7am{Control>}{Enter}{/Control}');
    expect(dialog('When?')).toBeTruthy();
    expect(screen.getByLabelText('Title').value).toBe('Gym');
    expect(savedState().events).toEqual([]);
  });

  it('logs a sentence with a rating straight away, and opens the log for one without', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await jump(user, 'log morgan deep{Enter}');
    expect(savedState().journal).toEqual([expect.objectContaining({ meaningfulness: 5, type: 'talked' })]);
    await jump(user, 'called morgan yesterday{Enter}');
    expect(dialog('Called Morgan')).toBeTruthy();
  });
});
