/** @vitest-environment jsdom */
// Data and screen fixes from the audit of 2026-10-14: a log opened with nobody
// in it asks who first (R used to crash it); a save that fails says so until
// saving works; two logs taken together both count; confirms act on the data
// as it is when you confirm; Start over that keeps your progress keeps it
// through setting up again; editing an entry has Undo; and a log's in-person
// notes aren't reopened once their review is added.
import { act, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_SKILLS, INITIAL_PEOPLE } from '../../src/data/seed.js';
import { toISODate } from '../../src/lib/dates.js';
import { readSentence } from '../../src/lib/sentence.js';
import { STORAGE_KEY } from '../../src/lib/storage.js';
import { dialog, nav, openMe, person, renderApp, savedPerson, savedState, seedState, toasts, wait } from './harness.jsx';

const TODAY = toISODate(new Date());

afterEach(() => { delete window.layersSystem; vi.restoreAllMocks(); });

function fakeBridge(extra = {}) {
  const listeners = [];
  const bridge = {
    getAutoLaunch: () => Promise.resolve(false), setAutoLaunch: () => Promise.resolve(false), getVersion: () => Promise.resolve('test'),
    getShortcutStatus: () => Promise.resolve({ registered: true }), setTheme: () => {}, showWindow: () => {},
    scheduleNotifications: () => Promise.resolve({ scheduled: 0 }),
    calendarReady: () => Promise.resolve([]),
    onCalendarAction: (cb) => { listeners.push(cb); return () => { listeners.splice(listeners.indexOf(cb), 1); }; },
    press: (link) => act(async () => { listeners.forEach(cb => cb(link)); }),
    ...extra,
  };
  window.layersSystem = bridge;
  return bridge;
}
const goal = (id, personId, title) => ({ id, personId, category: 'relationship', type: 'learn', title, description: '', progress: 10, history: [] });
const coffee = (id, p) => ({ id, title: `Coffee with ${p.name}`, kind: 'oneoff', date: TODAY, time: 0, duration: 60, personIds: [p.id], template: 'coffee' });

describe('a log opened with nobody in it', () => {
  it('asks who first, then has its details for them (R used to crash it)', async () => {
    let send = null;
    fakeBridge({ onQuickAdd: (cb) => { send = cb; return () => {}; } });
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await wait(50);
    // The quick-add box's "open in full", for a log that names nobody.
    await act(async () => send({ type: 'open', sentence: readSentence('talked yesterday', { people: [] }) }));
    expect(dialog('Who was this with?')).toBeTruthy();
    await user.keyboard('1{Enter}');
    expect(dialog('Talked with Morgan')).toBeTruthy();
    await user.keyboard('r');
    expect(dialog('How did each part go?')).toBeTruthy();
  });
});

describe('saving', () => {
  it("says so while changes can't be saved, until they can again", async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    const real = Storage.prototype.setItem;
    let full = true;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === STORAGE_KEY && full) throw new Error('QuotaExceededError');
      return real.call(this, key, value);
    });
    await user.keyboard('{Control>}k{/Control}');
    await user.keyboard('log morgan deep{Enter}');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/couldn't save your latest changes/);
    expect(within(alert).getByRole('button', { name: 'Export' })).toBeTruthy();
    full = false;
    await user.keyboard('{Control>}k{/Control}');
    await user.keyboard('log morgan good{Enter}');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(savedState().journal).toHaveLength(2);
  });
});

describe('two logs taken together', () => {
  it("both count: two notification ratings waiting when Layers starts each move that person's goal", async () => {
    const morgan = person('Morgan', { goals: [] });
    const sam = person('Sam', { goals: [] });
    morgan.goals = [goal('gm', morgan.id, 'Ask about the move')];
    sam.goals = [goal('gs', sam.id, 'Plan a trip')];
    fakeBridge({ calendarReady: () => Promise.resolve([`layers://rate?e=cm&d=${TODAY}&r=4`, `layers://rate?e=cs&d=${TODAY}&r=5`]) });
    seedState({ people: [morgan, sam], events: [coffee('cm', morgan), coffee('cs', sam)] });
    renderApp();
    await wait(100);
    const s = savedState();
    expect(s.journal.map(j => j.personId).sort()).toEqual([morgan.id, sam.id].sort());
    expect(savedPerson('Morgan').goals[0].progress).toBeGreaterThan(10); // lost before: Sam's log was made from the data before Morgan's
    expect(savedPerson('Sam').goals[0].progress).toBeGreaterThan(10);
  });
});

describe('confirms', () => {
  it('Remove the sample people acts on the data as it is when you confirm, not when it opened', async () => {
    const morgan = person('Morgan', { goals: [] });
    morgan.goals = [goal('gm', morgan.id, 'Ask about the move')];
    const bridge = fakeBridge();
    seedState({ people: [INITIAL_PEOPLE[0], morgan], events: [coffee('cm', morgan)] });
    const { user } = renderApp();
    await openMe(user, 'Your data');
    await user.click(screen.getByRole('button', { name: 'Remove sample people' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Remove the sample people?' });
    await bridge.press(`layers://rate?e=cm&d=${TODAY}&r=4`); // Morgan logged meanwhile, from a notification
    await user.click(within(confirm).getByRole('button', { name: 'Remove samples' }));
    expect(savedState().people.map(p => p.name)).toEqual(['Morgan']);
    expect(savedState().journal).toEqual([expect.objectContaining({ personId: morgan.id, meaningfulness: 4 })]);
    expect(savedPerson('Morgan').goals[0].progress).toBeGreaterThan(10);
  });

  it("Remove person says Undo brings them back, and it does", async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.click(nav('People'));
    await user.click(screen.getAllByRole('button', { name: /Morgan/ })[0]);
    await screen.findByText('Current relationship stage');
    await user.click(screen.getByRole('button', { name: /Edit/ }));
    await user.click(screen.getByRole('button', { name: /Remove this person/ }));
    const confirm = screen.getByRole('alertdialog', { name: 'Remove Morgan?' });
    expect(confirm.textContent).not.toMatch(/cannot be undone/);
    expect(confirm.textContent).toMatch(/Undo on the message after brings them back/);
    await user.click(within(confirm).getByRole('button', { name: 'Remove person' }));
    expect(savedState().people).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Undo (Ctrl+Z)' }));
    expect(savedState().people.map(p => p.name)).toEqual(['Morgan']);
  });
});

describe('Start over, keeping your progress', () => {
  it('keeps your own goals and skills through setting up again, and counts only your own goals', async () => {
    const morgan = person('Morgan', { goals: [] });
    morgan.goals = [goal('gm', morgan.id, 'Ask about the move')];
    const skills = { ...EMPTY_SKILLS, reciprocity: { ...EMPTY_SKILLS.reciprocity, current: 40 } };
    seedState({ people: [morgan], generalGoals: [goal('g1', null, 'Ask more questions')], skills });
    const { user } = renderApp();
    await openMe(user, 'Your data');
    await user.click(screen.getByRole('button', { name: 'Delete my data and start over' }));
    const sheet = dialog('Start over');
    expect(within(sheet).getByText('1 goal, your skill levels and achievements')).toBeTruthy(); // not Morgan's
    await user.keyboard('4'); // keep Skills, achievements and your own goals
    await user.keyboard('{Enter}{Enter}');
    await user.keyboard('{Enter>}');
    await wait(1700);
    await user.keyboard('{/Enter}');
    expect(screen.getByText('Welcome to Layers')).toBeTruthy();
    await user.type(screen.getByLabelText('Your name'), 'Sam{Enter}');
    await user.type(screen.getByLabelText("Person's name"), 'Kai{Enter}');
    await user.keyboard('{Enter}{Enter}'); // on, then Go to Today
    const s = savedState();
    expect(s.onboarded).toBe(true);
    expect(s.people.map(p => p.name)).toEqual(['Kai']);
    expect(s.generalGoals.map(g => g.title)).toEqual(['Ask more questions']);
    expect(s.skills.reciprocity.current).toBe(40);
  });
});

describe('editing an entry', () => {
  it('has Undo', async () => {
    const morgan = person('Morgan');
    seedState({ people: [morgan], journal: [{ id: 'j1', personId: morgan.id, at: TODAY, type: 'talked', meaningfulness: 3, added: [], activeListening: [] }] });
    const { user } = renderApp();
    await user.click(nav('Journal'));
    await user.click(screen.getByRole('button', { name: /^Edit entry: Morgan/ }));
    await user.keyboard('5{Enter}');
    expect(savedState().journal[0].meaningfulness).toBe(5);
    expect(toasts()).toContain('Entry updated');
    await user.click(screen.getByRole('button', { name: 'Undo (Ctrl+Z)' }));
    expect(savedState().journal[0].meaningfulness).toBe(3);
  });
});
