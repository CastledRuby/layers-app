/** @vitest-environment jsdom */
// The owner's live-test feedback (2026-10-05): picking from lots of people,
// a plan's title, leaving the title box, new goals while planning or
// logging, and the day popup with Coach tips.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { toISODate } from '../../src/lib/dates.js';
import { dialog, logDetails, nav, person, queryDialog, renderApp, savedPerson, savedState, seedState } from './harness.jsx';

const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return toISODate(d); };
const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pressed = (name, sheet = 'Who with?') => within(dialog(sheet)).getByRole('button', { name }).getAttribute('aria-pressed');

describe('picking from lots of people', () => {
  it('puts the closest first, and the arrows and Space reach everyone past nine', async () => {
    const crowd = Array.from({ length: 12 }, (_, i) => person(`Friend ${String.fromCharCode(65 + i)}`));
    seedState({ people: [...crowd, person('Zed', { layer: 4 })] });
    const { user } = renderApp();
    await user.keyboard('p1'); // plan a coffee
    expect(dialog('Who with?')).toBeTruthy();
    expect(screen.getByText(/the first nine/)).toBeTruthy();
    await user.keyboard('1');
    expect(pressed(/^\W*Zed$/u)).toBe('true');
    for (let i = 0; i < 13; i++) await user.keyboard('{ArrowRight}'); // the first press lands on Zed
    await user.keyboard(' ');
    expect(pressed(/^\W*Friend L$/u)).toBe('true');
    await user.keyboard('{Enter}');
    expect(screen.getByLabelText('Title').value).toBe('Coffee with Zed and Friend L');
  });
});

describe("a plan's title", () => {
  it('drops a title from Plan again when you go back and pick a template', async () => {
    const morgan = person('Morgan');
    seedState({ people: [morgan], events: [{ id: 'w', title: 'Walk', kind: 'oneoff', date: day(0), time: 600, personIds: [], template: 'custom', updatedAt: '2026-01-01T00:00:00Z' }] });
    const { user } = renderApp();
    await user.keyboard('pq'); // Plan again: Walk
    expect(screen.getByLabelText('Title').value).toBe('Walk');
    await user.keyboard('{Backspace}{Backspace}1'); // back to "what", then Coffee
    await user.keyboard('1{Enter}'); // Morgan
    expect(screen.getByLabelText('Title').value).toBe('Coffee with Morgan');
  });

  it('Esc and Tab leave the title box without closing, and the keys work again', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.keyboard('p11{Enter}');
    const summary = () => screen.getByLabelText('Summary').textContent;
    await user.keyboard('n');
    await user.keyboard('Lunch at the park');
    await user.keyboard('{Escape}');
    expect(dialog('When?')).toBeTruthy();
    expect(document.activeElement).not.toBe(screen.getByLabelText('Title'));
    const before = summary();
    await user.keyboard('t');
    expect(summary()).not.toBe(before);
    await user.keyboard('n');
    await user.keyboard('{Tab}');
    expect(document.activeElement.tagName).not.toBe('INPUT');
    await user.keyboard('{Enter}');
    expect(savedState().events.map(e => e.title)).toEqual(['Lunch at the park']);
  });
});

describe('a new goal while planning or logging', () => {
  it('+ when planning makes one with them, and the plan moves it', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.keyboard('p11{Enter}');
    await user.keyboard('+');
    expect(dialog('New goal with Morgan')).toBeTruthy();
    await user.keyboard('1{Enter}'); // Become closer friends
    expect(queryDialog('New goal with Morgan')).toBeNull();
    expect(pressed('Become closer friends', 'When?')).toBe('true');
    await user.keyboard('{Enter}');
    const goal = savedPerson('Morgan').goals[0];
    expect(goal.title).toBe('Become closer friends');
    expect(savedState().events[0].goalId).toBe(goal.id);
  });

  it('"Add a goal" when logging makes one in your own words, and the log counts towards it', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.keyboard('n11'); // log: interaction, talked
    await user.keyboard('1{Enter}'); // Morgan
    expect(within(logDetails()).getByRole('button', { name: /Add a goal/ })).toBeTruthy();
    await user.keyboard('g+');
    await user.keyboard('n');
    await user.keyboard('Meet their family{Enter}');
    expect(within(dialog('Goals this moved')).getByText('Meet their family')).toBeTruthy();
    await user.keyboard('{Enter}{Enter}'); // close Goals, save the log
    const goal = savedPerson('Morgan').goals[0];
    expect(goal.title).toBe('Meet their family');
    expect(goal.progress).toBeGreaterThan(0);
  });
});

describe('the day popup', () => {
  it('↑ ↓ move a week on Today', async () => {
    seedState();
    const { user } = renderApp();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(WEEKDAY_LONG[new Date().getDay()]);
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Today');
  });

  it('Enter opens the day; T gives Coach tips for a plan, from what you know about them; P goes to Prepare', async () => {
    const morgan = person('Morgan', { interests: [{ id: 'i', text: 'climbing', at: day(-20) }] });
    seedState({ people: [morgan], events: [{ id: 'c', title: 'Coffee with Morgan', kind: 'oneoff', date: day(1), time: 600, duration: 60, personIds: [morgan.id], template: 'coffee' }] });
    const { user } = renderApp();
    await user.keyboard('{ArrowRight}{Enter}');
    const sheet = dialog(/^Tomorrow, /);
    expect(within(sheet).getByText('Coffee with Morgan')).toBeTruthy();
    await user.keyboard('t');
    const tips = dialog('Coach: Coffee with Morgan');
    expect(within(tips).getByText(/For a coffee/)).toBeTruthy();
    expect(within(tips).getByText(/They're into climbing/)).toBeTruthy();
    await user.keyboard('{Escape}{ArrowLeft}');
    expect(dialog(/^Today, /)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Today');
    await user.keyboard('{ArrowRight}t');
    await user.keyboard('p');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(nav('Coach').getAttribute('aria-current')).toBe('page');
  });
});
