/** @vitest-environment jsdom */
// Calendar fixes from the audit of 2026-10-14: editing a plan keeps its days
// at times of their own and a monthly plan's own day; every 2-4 weeks starts on
// its first day rather than a week late; and a day at its own time hasn't
// started until then.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { toISODate } from '../../src/lib/dates.js';
import { dialog, nav, renderApp, savedState, seedState } from './harness.jsx';

const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return toISODate(d); };
const TODAY = day(0);

async function openPlan(user, title) {
  await user.click(screen.getByRole('button', { name: title }));
  await user.keyboard('e'); // Edit
  return dialog('Edit plan');
}

describe('editing a plan keeps what it had', () => {
  it("an every-day plan with a day at its own time opens on certain days, and keeps it when saved", async () => {
    const gym = { id: 'g', title: 'Gym', kind: 'recurring', weekdays: [0, 1, 2, 3, 4, 5, 6], from: day(-7), time: 7 * 60, duration: 60, times: { [new Date().getDay()]: 17 * 60 }, personIds: [], template: 'activity' };
    seedState({ events: [gym] });
    const { user } = renderApp();
    await user.click(nav('Today'));
    const when = await openPlan(user, 'Gym');
    expect(within(when).getByRole('button', { name: 'A different time on some days' }).getAttribute('aria-pressed')).toBe('true');
    await user.keyboard('{Enter}');
    expect(savedState().events.find(e => e.id === 'g')).toMatchObject({ times: { [new Date().getDay()]: 17 * 60 }, weekdays: [0, 1, 2, 3, 4, 5, 6], from: day(-7) });
  });

  it('a plan on the 31st, opened on a shorter month\'s last day, stays on the 31st', async () => {
    // The next short month's last day from today, where "the 31st" falls.
    const now = new Date();
    let target = null;
    for (let m = 0; m < 3 && !target; m++) {
      const last = new Date(now.getFullYear(), now.getMonth() + m + 1, 0);
      if (last.getDate() < 31 && last >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) target = last;
    }
    const steps = Math.round((target - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
    const rent = { id: 'r', title: 'Rent', kind: 'recurring', weekdays: [], monthly: { day: 31 }, from: '2026-01-31', time: 9 * 60, duration: 30, personIds: [], template: 'custom' };
    seedState({ events: [rent] });
    const { user } = renderApp();
    await user.click(nav('Today'));
    if (steps) await user.keyboard(`{ArrowRight>${steps}/}`);
    const when = await openPlan(user, 'Rent');
    expect(within(when).getByRole('group', { name: 'Each month' }).querySelector('[aria-pressed="true"]').textContent).toBe('On the 31st');
    await user.keyboard('{Enter}');
    expect(savedState().events.find(e => e.id === 'r')).toMatchObject({ monthly: { day: 31 }, from: '2026-01-31' });
  });
});

describe('a new plan', () => {
  it('every 2 weeks on a day that is not today starts on that day, not a week late', async () => {
    seedState();
    const { user } = renderApp();
    await user.keyboard('p8{Enter}'); // Something else, nobody
    await user.keyboard('rrrr'); // On certain days, today's day on
    const todays = new Date().getDay();
    const tomorrows = (todays + 1) % 7;
    await user.keyboard(String(((tomorrows + 6) % 7) + 1)); // tomorrow's day on
    await user.keyboard(String(((todays + 6) % 7) + 1)); // today's off
    await user.keyboard('e'); // every 2 weeks
    await user.keyboard('{Enter}');
    expect(savedState().events[0]).toMatchObject({ interval: 2, weekdays: [tomorrows], from: day(1) });
  });
});

describe('a day at a time of its own', () => {
  it("hasn't started until its own time, whatever the plan's time is", async () => {
    const late = { id: 'l', title: 'Late swim', kind: 'recurring', weekdays: [0, 1, 2, 3, 4, 5, 6], from: day(-3), time: 0, duration: 30, times: { [new Date().getDay()]: 23 * 60 + 59 }, personIds: [], template: 'activity' };
    seedState({ events: [late] });
    const { user } = renderApp();
    await user.click(nav('Today'));
    await user.click(screen.getByRole('button', { name: 'Late swim' }));
    const sheet = dialog(/Late swim/);
    expect(within(sheet).queryByRole('button', { name: /didn.t happen/i })).toBeNull();
    expect(TODAY).toBeTruthy();
  });
});
