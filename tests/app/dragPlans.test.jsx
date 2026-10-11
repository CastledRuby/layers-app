/** @vitest-environment jsdom */
// Moving plans by dragging (decided 2026-10-11): a plan's row onto a day in
// the week strip or month; in the week view (V), a block onto another day and
// time, in 15-minute steps. A repeating plan moves for that day only. Undo
// puts it back. jsdom has no drag data, so a stand-in carries it.
import { createEvent, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { toISODate, WEEKDAY_SHORT } from '../../src/lib/dates.js';
import { nav, renderApp, savedState, seedState, toasts } from './harness.jsx';

const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return toISODate(d); };
const TODAY = day(0);
function dataTransfer() {
  const data = {};
  return { data, types: [], effectAllowed: 'all', dropEffect: 'none', setData(k, v) { data[k] = v; if (!this.types.includes(k)) this.types.push(k); }, getData(k) { return data[k] || ''; } };
}
// jsdom's drag events have no pointer position, so it's set on each event.
function fire(kind, el, dt, at = {}) {
  const ev = createEvent[kind](el, { dataTransfer: dt });
  Object.entries(at).forEach(([k, v]) => Object.defineProperty(ev, k, { value: v }));
  fireEvent(el, ev);
}
function drag(from, to, { at = {}, grab = {} } = {}) {
  const dt = dataTransfer();
  fire('dragStart', from, dt, grab);
  fire('dragOver', to, dt, at);
  fire('drop', to, dt, at);
}
const label = (iso) => { const d = new Date(`${iso}T00:00:00`); return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()}`; };

describe('moving plans by dragging', () => {
  it('a plan onto another day in the week strip moves it there, with Undo', async () => {
    seedState({ events: [{ id: 'c', title: 'Coffee', kind: 'oneoff', date: TODAY, time: 600, duration: 60, personIds: [], template: 'coffee' }] });
    const { user } = renderApp();
    await user.click(nav('Today'));
    const row = screen.getByRole('button', { name: 'Coffee' });
    expect(row.getAttribute('draggable')).toBe('true');
    const strip = [...document.querySelectorAll('.day-cell')];
    const target = strip.find(b => b.getAttribute('aria-pressed') !== 'true');
    drag(row, target);
    const moved = savedState().events.find(e => e.id === 'c');
    expect(moved.date).not.toBe(TODAY);
    expect(moved.time).toBe(600);
    expect(toasts().some(t => /^"Coffee" moved to /.test(t))).toBe(true);
    await user.click(screen.getByRole('button', { name: /^Undo/ }));
    expect(savedState().events.find(e => e.id === 'c').date).toBe(TODAY);
  });

  it('V shows the week with times; a repeating plan dragged to another day and time moves for that day only', async () => {
    const gym = { id: 'g', title: 'Gym', kind: 'recurring', weekdays: [0, 1, 2, 3, 4, 5, 6], from: day(-30), time: 18 * 60, duration: 60, personIds: [], template: 'activity' };
    seedState({ events: [gym] });
    const { user } = renderApp();
    await user.click(nav('Today'));
    await user.keyboard('v');
    const week = screen.getByLabelText('Week');
    const block = within(week).getAllByRole('button', { name: 'Gym, 6:00 PM' }).find(b => b.closest('[role="group"]').getAttribute('aria-label') === label(TODAY));
    const other = [...week.querySelectorAll('.week-col')].find(c => c.getAttribute('aria-label') !== label(TODAY));
    // The grid starts at 7 AM, 44 px an hour: 4 hours down is 11 AM.
    drag(block, other, { grab: { clientY: 0 }, at: { clientY: 4 * 44 } });
    const events = savedState().events;
    const moved = events.find(e => e.id !== 'g');
    expect(moved).toMatchObject({ kind: 'oneoff', title: 'Gym', time: 11 * 60 });
    expect(moved).not.toHaveProperty('weekdays');
    expect(moved.date).not.toBe(TODAY);
    expect(events.find(e => e.id === 'g').skipDays).toEqual([TODAY]);
    expect(toasts().some(t => /moved to .*11:00 AM \(that day only\)$/.test(t))).toBe(true);
    await user.keyboard('v');
    expect(screen.queryByLabelText('Week')).toBeNull();
  });

  it("Google Calendar's events and plans already done don't move", async () => {
    seedState({ events: [{ id: 'd', title: 'Done thing', kind: 'oneoff', date: TODAY, time: 600, duration: 60, personIds: [], doneAt: TODAY }] });
    const { user } = renderApp();
    await user.click(nav('Today'));
    expect(screen.getByRole('button', { name: 'Done thing, done' }).getAttribute('draggable')).toBe('false');
  });
});
