/** @vitest-environment jsdom */
// Knowing which page you're on, starting over, setting Layers up again, and
// the planning extras: "Plan again" and the overlap warning.
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toISODate } from '../../src/lib/dates.js';
import { dialog, nav, person, queryDialog, renderApp, savedPerson, savedState, seedState, toasts, wait } from './harness.jsx';

const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return toISODate(d); };
const TOMORROW = day(1);

afterEach(() => { vi.restoreAllMocks(); });

describe('the page you are on', () => {
  it('is marked in the tab bar, and a new page slides in from its side', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    expect(nav('Today').getAttribute('aria-current')).toBe('page');
    await user.click(nav('Journal'));
    expect(nav('Journal').getAttribute('aria-current')).toBe('page');
    expect(nav('Today').getAttribute('aria-current')).toBeNull();
    expect(document.querySelector('[data-page="journal"]').className).toBe('page-anim--fwd');
    await user.click(nav('People'));
    expect(document.querySelector('[data-page="people"]').className).toBe('page-anim--back');
  });
});

describe('Delete my data and start over', () => {
  function seedEverything() {
    const morgan = person('Morgan');
    seedState({
      people: [morgan],
      journal: [{ id: 'j', personId: morgan.id, at: day(-1), type: 'talked', meaningfulness: 3, added: [], activeListening: [] }],
      events: [{ id: 'g', title: 'Gym', kind: 'oneoff', date: TOMORROW, time: 600, personIds: [] }],
    });
  }
  async function openStartOver(user) {
    await user.click(nav('Me'));
    await user.click(screen.getByRole('button', { name: 'Delete my data and start over' }));
    return dialog('Start over');
  }
  async function hold(user, ms) {
    await user.keyboard('{Enter>}');
    await wait(ms);
    await user.keyboard('{/Enter}');
  }

  it('offers a backup, needs a held press, and goes back to setting up', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:backup');
    URL.revokeObjectURL = vi.fn();
    seedEverything();
    const { user } = renderApp();
    const sheet = await openStartOver(user);
    expect(within(sheet).getAllByRole('checkbox').every(c => c.getAttribute('aria-checked') === 'true')).toBe(true);
    expect(within(sheet).getByText('1 person, with their details, goals, key dates and journal')).toBeTruthy();
    await user.keyboard('{Enter}');
    expect(dialog('Save a backup first?')).toBeTruthy();
    await user.keyboard('b');
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(screen.getByText('Backup saved')).toBeTruthy();
    await user.keyboard('{Enter}');
    expect(dialog('Delete for good?')).toBeTruthy();

    await hold(user, 300); // let go too soon: nothing happens
    expect(savedState().people).toHaveLength(1);
    await hold(user, 1700);
    const s = savedState();
    expect([s.people, s.journal, s.events]).toEqual([[], [], []]);
    expect(s.onboarded).toBe(false);
    expect({ ...s.profile, updatedAt: undefined }).toEqual({ name: '', focus: null });
    expect(screen.getByText('Welcome to Layers')).toBeTruthy();
  });

  it('can clear just some things, keeping the rest', async () => {
    seedEverything();
    const { user } = renderApp();
    await openStartOver(user);
    await user.keyboard('1245'); // untick People, Journal, Progress, Settings: just plans
    expect(screen.getByRole('button', { name: /Clear 1 of 5/ })).toBeTruthy();
    await user.keyboard('{Enter}{Enter}'); // on, and on without a backup
    const confirm = dialog('Delete for good?');
    expect(within(confirm).getByText('Kept')).toBeTruthy();
    await hold(user, 1700);
    const s = savedState();
    expect(s.events).toEqual([]);
    expect(s.people).toHaveLength(1);
    expect(s.journal).toHaveLength(1);
    expect(s.onboarded).toBe(true);
    expect(toasts()).toContain('Cleared plans');
    expect(queryDialog('Delete for good?')).toBeNull();
  });
});

describe('setting up', () => {
  it('adds people by tapping or typing, with how close they are, then sets notifications and plans', async () => {
    const { user } = renderApp();
    expect(screen.getByLabelText('Step 1 of 3: You')).toBeTruthy();
    await user.type(screen.getByLabelText('Your name'), 'Sam{Enter}');
    expect(screen.getByText("Who's in your circle?")).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '+ Mum' }));
    expect(screen.queryByRole('dialog')).toBeNull(); // no questions unless asked: Mum stays at Orientation
    await user.type(screen.getByLabelText("Person's name"), 'Ana{Shift>}{Enter}{/Shift}'); // add and ask
    await user.keyboard('yyyyynnn'); // Layer 2, not Layer 3
    expect(screen.getByRole('status', { name: "Where you're starting" }).textContent).toMatch(/Layer 2: Exploratory · 40% in/);
    await user.keyboard('{Enter}');
    expect(screen.getByText(/40% into Layer 2/)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Person's name")); // ready for the next name
    await user.click(within(screen.getByRole('group', { name: 'How close are you to Ana?' })).getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Continue with 2 people' }));
    expect(screen.getByText("You're all set, Sam")).toBeTruthy();
    await user.click(screen.getByRole('switch', { name: /Morning summary/ }));
    await user.keyboard('p');
    expect(dialog('Plan something')).toBeTruthy();
    expect(savedPerson('Mum').layer).toBe(1);
    expect(savedPerson('Ana').layer).toBe(4);
    expect({ ...savedState().profile, updatedAt: undefined }).toEqual({ name: 'Sam', focus: null, morningSummary: false });
  });

  it('D adds a birthday while setting up, typed as "14 mar"', async () => {
    const { user } = renderApp();
    await user.type(screen.getByLabelText('Your name'), 'Sam{Enter}');
    await user.type(screen.getByLabelText("Person's name"), 'Kai{Enter}');
    await user.keyboard('{Escape}d'); // out of the name box, then D for the newest
    const sheet = dialog('🎂 Birthday');
    expect(document.activeElement).toBe(within(sheet).getByLabelText('Type the day'));
    await user.keyboard('14 mar');
    expect(within(sheet).getByRole('status', { name: 'The date' }).textContent).toBe('14 March, every year');
    await user.keyboard('{Enter}');
    expect(within(screen.getByRole('group', { name: "Kai's dates" })).getByText(/🎂 14 Mar/)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Person's name")); // ready for the next name
    await user.keyboard('{Enter}'); // an empty box goes on
    expect(screen.getByText("You're all set, Sam")).toBeTruthy();
    await user.keyboard('{Enter}'); // Go to Today
    expect(savedPerson('Kai').dates).toEqual([expect.objectContaining({ kind: 'birthday', yearly: true, date: expect.stringMatching(/-03-14$/) })]);
  });

  it('can restore from a backup instead', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: 'Restore from a backup' }));
    expect(click).toHaveBeenCalled();
  });
});

describe('planning extras', () => {
  it('"Plan again" (Q) repeats a recent plan on the day being planned', async () => {
    const morgan = person('Morgan');
    seedState({ people: [morgan], events: [{ id: 'c', title: 'Coffee with Morgan', kind: 'recurring', weekdays: [6], from: day(-30), time: 600, duration: 90, alert: 30, personIds: [morgan.id], template: 'coffee', createdAt: day(-30) }] });
    const { user } = renderApp();
    await user.keyboard('p');
    expect(within(dialog('Plan something')).getByRole('button', { name: /Coffee with Morgan/ })).toBeTruthy();
    await user.keyboard('q');
    const when = dialog('When?');
    expect(within(when).getByLabelText('Title').value).toBe('Coffee with Morgan');
    expect(within(when).getByLabelText('Summary').textContent).toBe('Today, 10:00 AM–11:30 AM · reminder 30 min before');
    await user.keyboard('{Enter}');
    expect(savedState().events.find(e => e.id !== 'c')).toMatchObject({ kind: 'oneoff', date: day(0), time: 600, duration: 90, alert: 30, personIds: [morgan.id] });
  });

  it('warns when a new plan overlaps one you already have', async () => {
    seedState({ events: [{ id: 'g', title: 'Gym', kind: 'oneoff', date: TOMORROW, time: 600, duration: 60, personIds: [] }] });
    const { user } = renderApp();
    await user.keyboard('p1{Enter}'); // Coffee (10:00 AM), nobody
    expect(screen.queryByRole('status')).toBeNull();
    await user.keyboard('2'); // tomorrow
    expect(screen.getByRole('status').textContent).toBe('Overlaps Gym (10:00 AM–11:00 AM)');
    await user.keyboard('t'); // 9:00-10:00 AM ends just as Gym starts
    expect(screen.queryByRole('status')).toBeNull();
    await user.keyboard('l'); // 2 hours, to 11:00, overlaps again
    expect(screen.getByRole('status').textContent).toBe('Overlaps Gym (10:00 AM–11:00 AM)');
  });
});
