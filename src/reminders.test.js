// Plans' done state and follow-ups (lib/reminders.js).
import { describe, expect, it } from 'vitest';
import { isDoneOn } from './lib/calendar.js';
import { followUpEvent, markDone } from './lib/reminders.js';

// Sunday 4 Oct 2026, 9:05 AM local
const NOW = new Date(2026, 9, 4, 9, 5);
const weekly = (weekdays, extra = {}) => ({ id: 'w', title: 'Call Gran', kind: 'recurring', weekdays, time: 9 * 60, personIds: [], ...extra });
const oneoff = (date, extra = {}) => ({ id: 'o', title: 'Dentist', kind: 'oneoff', date, time: 9 * 60, personIds: [], ...extra });

describe('markDone', () => {
  it('finishes a one-off for good and a repeating one for the day', () => {
    expect(markDone(oneoff('2026-10-04'), '2026-10-04')).toMatchObject({ doneAt: '2026-10-04' });
    expect(markDone(weekly([0]), '2026-10-04')).toMatchObject({ doneDays: ['2026-10-04'] });
  });
  it("skipping a later day doesn't undo today", () => {
    const ev = markDone(markDone(weekly([0, 3]), '2026-10-04'), '2026-10-07');
    expect(ev.doneDays).toEqual(['2026-10-04', '2026-10-07']);
    expect(isDoneOn(ev, '2026-10-04')).toBe(true);
    expect(isDoneOn(ev, '2026-10-11')).toBe(false);
  });
  it('reads the single doneOn of older saves', () => {
    expect(isDoneOn(weekly([0], { doneOn: '2026-10-04' }), '2026-10-04')).toBe(true);
    expect(markDone(weekly([0], { doneOn: '2026-10-04' }), '2026-10-05')).toEqual(expect.objectContaining({ doneDays: ['2026-10-04', '2026-10-05'] }));
  });
});

describe('followUpEvent', () => {
  it('makes a one-off three days later at 9 AM, reminding at the time', () => {
    const ev = followUpEvent({ id: 'p1', name: 'Ana' }, { text: 'Job interview' }, NOW);
    expect(ev).toMatchObject({ title: 'Ask Ana how "Job interview" went', personIds: ['p1'], kind: 'oneoff', date: '2026-10-07', time: 540, alert: 0 });
  });
  it('is the day after, for a detail with the day it happens, but never before tomorrow', () => {
    const on = (when) => followUpEvent({ id: 'p1', name: 'Ana' }, { text: 'Job interview on Thu 15 Oct', when }, NOW).date;
    expect(on('2026-10-15')).toBe('2026-10-16');
    expect(on('2026-10-04')).toBe('2026-10-05'); // today: tomorrow
    expect(on('2026-09-30')).toBe('2026-10-05'); // already been
    expect(on('not a day')).toBe('2026-10-07');
  });
});
