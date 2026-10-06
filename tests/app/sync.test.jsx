/** @vitest-environment jsdom */
// Ready for syncing (docs/roadmap.md, the phone proposal, step 1): what
// Layers saves says when each record last changed and what was deleted,
// without changing how anything works (Undo and Redo included).
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { toISODate } from '../../src/lib/dates.js';
import { nav, person, renderApp, savedPerson, savedState, seedState, toasts } from './harness.jsx';

const goal = (id, title) => ({ id, personId: null, category: 'relationship', type: 'learn', title, description: '', progress: 10, history: [] });

describe('ready for syncing', () => {
  it('a deleted plan is remembered as deleted, and Undo forgets it', async () => {
    seedState({ events: [{ id: 'e1', title: 'Call Gran', kind: 'oneoff', date: toISODate(new Date()), time: 1380, personIds: [] }] });
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: 'Call Gran' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete plan' }));
    expect(savedState().events).toEqual([]);
    expect(savedState().deleted).toEqual([{ id: 'e1', kind: 'event', at: expect.any(String) }]);
    await user.click(screen.getByRole('button', { name: 'Undo (Ctrl+Z)' }));
    expect(savedState().deleted).toEqual([]);
    expect(savedState().events[0]).toMatchObject({ id: 'e1', updatedAt: expect.any(String) });
    // Redo still works: the state itself isn't stamped.
    await user.click(screen.getByRole('button', { name: /^Redo/ }));
    expect(savedState().events).toEqual([]);
    expect(toasts()).toContain('Redone');
  });

  it('only what changed gets a new time: a goal moved, and its person', async () => {
    seedState({ people: [person('Morgan', { goals: [goal('g1', 'Learn more'), goal('g2', 'Spend time')] }), person('Riley')] });
    const { user } = renderApp();
    await user.click(nav('People'));
    await user.click(screen.getAllByRole('button', { name: /Morgan/ })[0]);
    await screen.findByText('Current relationship stage');
    await user.click(screen.getAllByRole('button', { name: /Mark progress/ })[0]);
    const morgan = savedPerson('Morgan');
    expect(morgan.updatedAt).toEqual(expect.any(String));
    expect(morgan.goals.find(g => g.updatedAt)).toBeTruthy();
    expect(morgan.goals.filter(g => g.updatedAt)).toHaveLength(1);
    expect(savedPerson('Riley').updatedAt).toBeUndefined();
  });

  it('a backup carries the times and the deletions', async () => {
    seedState({ people: [person('Morgan')], events: [{ id: 'e1', title: 'Call Gran', kind: 'oneoff', date: toISODate(new Date()), time: 1380, personIds: [] }] });
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: 'Call Gran' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete plan' }));
    let saved = null;
    const { createObjectURL, revokeObjectURL } = URL;
    URL.createObjectURL = (blob) => { saved = blob; return 'blob:x'; };
    URL.revokeObjectURL = () => {};
    try {
      await user.click(nav('Me'));
      await user.click(screen.getByRole('button', { name: /Export/ }));
    } finally { Object.assign(URL, { createObjectURL, revokeObjectURL }); }
    expect(saved).toBeTruthy();
    const text = await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsText(saved); });
    const backup = JSON.parse(text);
    expect(backup.deleted).toEqual([{ id: 'e1', kind: 'event', at: expect.any(String) }]);
    expect(backup.people[0].name).toBe('Morgan');
  });
});
