// readSentence (lib/sentence.js): what the quick-add box and Ctrl+K make of
// a typed sentence. "Now" is Monday 5 October 2026, 3:30 PM.
import { describe, expect, it } from 'vitest';
import { planFieldsOf, readSentence } from './lib/sentence.js';

const people = [
  { id: 'p', name: 'Priya', layer: 3 }, { id: 's', name: 'Sam', layer: 2 }, { id: 'a', name: 'Alex', layer: 2 },
  { id: 'i1', name: 'Isla', layer: 3 }, { id: 'i2', name: 'isla b', layer: 1 }, { id: 'l', name: 'liam', layer: 2 },
];
const now = new Date(2026, 9, 5, 15, 30);
const read = (text) => readSentence(text, { people, today: '2026-10-05', now });
const at = (h, m = 0) => h * 60 + m;

describe('plans', () => {
  it('reads who, what, the day and the time', () => {
    expect(read('coffee with priya fri 10am')).toMatchObject({ kind: 'plan', title: 'Coffee with Priya', template: 'coffee', personIds: ['p'], day: '2026-10-09', time: at(10), allDay: false, duration: 60, repeat: 'once', missing: [] });
    expect(read('dinner with sam and alex tomorrow 7pm 2h')).toMatchObject({ title: 'Dinner with Sam and Alex', template: 'meal', personIds: ['s', 'a'], day: '2026-10-06', time: at(19), duration: 120 });
    expect(read('coffee priya 9am')).toMatchObject({ title: 'Coffee with Priya', day: '2026-10-06', time: at(9) }); // 9 AM has gone today
  });

  it('keeps your own words as the title, without the day and time', () => {
    expect(read('lunch at nandos with isla b on fri at 1pm')).toMatchObject({ title: 'Lunch at nandos with isla b', personIds: ['i2'], day: '2026-10-09', time: at(13) });
    expect(read('call mum sunday')).toMatchObject({ title: 'Call mum', template: 'call', day: '2026-10-11', time: at(18), duration: 30 });
    expect(read('priya fri')).toMatchObject({ title: 'Plans with Priya', allDay: true, day: '2026-10-09' });
  });

  it('reads "w" (or "w/") as "with", and names an activity by its own word', () => {
    expect(read('coffee w priya fri 10am')).toMatchObject({ title: 'Coffee with Priya', template: 'coffee', personIds: ['p'], day: '2026-10-09', time: at(10) });
    expect(read('movie w sam sat 7pm')).toMatchObject({ title: 'Movie with Sam', template: 'activity', personIds: ['s'], day: '2026-10-10', time: at(19) });
    expect(read('gym w/alex wed 7am')).toMatchObject({ title: 'Gym with Alex', personIds: ['a'], day: '2026-10-07', time: at(7) });
    expect(read('games w Jo fri')).toMatchObject({ title: 'Games with Jo', unknown: ['Jo'] });
    expect(read('study w sam tomorrow')).toMatchObject({ title: 'Study with Sam' });
  });

  it('notes names that are not in Layers', () => {
    expect(read('movie night with sam and Jo sat 8pm')).toMatchObject({ title: 'Movie night with Sam and Jo', personIds: ['s'], unknown: ['Jo'], day: '2026-10-10', time: at(20) });
  });

  it('reads days: next, in, dates day first, and a date gone by as next year', () => {
    expect(read('coffee with Jo next fri').day).toBe('2026-10-16');
    expect(read('check in with priya in 3 days')).toMatchObject({ title: 'Check in with Priya', template: 'checkin', day: '2026-10-08' });
    expect(read('dentist 12/10 9:30am')).toMatchObject({ title: 'Dentist', day: '2026-10-12', time: at(9, 30) });
    expect(read('brunch with priya 12 oct')).toMatchObject({ day: '2026-10-12', time: at(10, 30) });
    expect(read('coffee with priya 3 feb').day).toBe('2027-02-03');
  });

  it('reads times: at 7 is the evening, tonight, half an hour', () => {
    expect(read('call alex at 7 for half an hour')).toMatchObject({ day: '2026-10-05', time: at(19), duration: 30 });
    expect(read('hang out with sam tonight')).toMatchObject({ title: 'Hang out with Sam', day: '2026-10-05', time: at(19) });
  });

  it('reads repeats, starting on the first day still to come', () => {
    expect(read('gym every mon wed fri 7am')).toMatchObject({ title: 'Gym', repeat: 'weekly', weekdays: [1, 3, 5], day: '2026-10-07', time: at(7) });
    expect(read('weekdays 7am run')).toMatchObject({ title: 'Run', weekdays: [1, 2, 3, 4, 5], day: '2026-10-06' });
    expect(read('mondays 6pm football')).toMatchObject({ title: 'Football', weekdays: [1], day: '2026-10-05' });
    expect(read('walk every day 8pm')).toMatchObject({ repeat: 'daily', weekdays: [0, 1, 2, 3, 4, 5, 6], day: '2026-10-05' });
  });

  it('asks when, for a plan with no day, time or kind', () => {
    expect(read('dentist').missing).toEqual(['when']);
    expect(read('walk with liam').missing).toEqual(['when']);
  });

  it('gives PlanSheet the fields it saves', () => {
    expect(planFieldsOf(read('gym every mon wed fri 7am'), 15)).toMatchObject({ title: 'Gym', kind: 'recurring', weekdays: [1, 3, 5], from: '2026-10-07', date: null, time: at(7), alert: 15 });
    expect(planFieldsOf(read('priya fri'), 0)).toMatchObject({ kind: 'oneoff', date: '2026-10-09', allDay: true, time: null, duration: null });
  });
});

describe('logs', () => {
  it('"log" with a rating word or number', () => {
    expect(read('log priya deep')).toMatchObject({ kind: 'log', personIds: ['p'], meaningfulness: 5, type: 'talked', day: '2026-10-05', missing: [] });
    expect(read('log isla 4')).toMatchObject({ personIds: ['i1'], meaningfulness: 4 });
  });

  it('what happened, from the verb, with what it was about as the note', () => {
    expect(read('talked to sam about his new job')).toMatchObject({ kind: 'log', personIds: ['s'], type: 'talked', note: 'his new job', meaningfulness: null, missing: ['rating'] });
    expect(read('messaged liam yesterday')).toMatchObject({ type: 'messaged', day: '2026-10-04' });
    expect(read('coffee with alex yesterday good')).toMatchObject({ kind: 'log', type: 'hangout', meaningfulness: 3, day: '2026-10-04' });
  });

  it('a weekday in a log is the one just gone, and asks who when nobody is named', () => {
    expect(read('called mum fri')).toMatchObject({ kind: 'log', type: 'called', day: '2026-10-02', missing: ['who', 'rating'] });
  });
});

it('reads nothing from an empty sentence', () => {
  expect(read('   ')).toBeNull();
});

describe('fixes from the audit of 2026-10-14', () => {
  it('weekdays said on their own repeat weekly, or are the days of a repeat said', () => {
    expect(read('gym tue thu fri 7am')).toMatchObject({ repeat: 'weekly', interval: 1, weekdays: [2, 4, 5], day: '2026-10-06', time: at(7) });
    expect(read('football fortnightly on tue and thu 6pm')).toMatchObject({ repeat: 'weekly', interval: 2, weekdays: [2, 4], day: '2026-10-06' });
    expect(read('swim weekly mon wed 5pm')).toMatchObject({ repeat: 'weekly', weekdays: [1, 3], day: '2026-10-05' });
    expect(read('coffee with priya fri 10am')).toMatchObject({ repeat: 'once', day: '2026-10-09' });
    expect(read('called sam mon and tue')).toMatchObject({ kind: 'log' }); // a log isn't a repeat
  });

  it('"thurs" and "tues" are one day, not every week', () => {
    expect(read('coffee thurs 10am')).toMatchObject({ repeat: 'once', day: '2026-10-08' });
    expect(read('swim tues 6pm')).toMatchObject({ repeat: 'once', day: '2026-10-06' });
    expect(read('swim thursdays 6pm')).toMatchObject({ repeat: 'weekly', weekdays: [4] });
  });

  it('an hour without am or pm is the evening for dinner or tonight', () => {
    expect(read('dinner with sam at 8')).toMatchObject({ time: at(20), day: '2026-10-05' });
    expect(read('tonight at 9 drinks')).toMatchObject({ time: at(21), day: '2026-10-05' });
    expect(read('dinner fri 8:30')).toMatchObject({ time: at(20, 30), day: '2026-10-09' });
    expect(read('breakfast at 8 tomorrow')).toMatchObject({ time: at(8) });
    expect(read('dinner fri 8am').time).toBe(at(8)); // said, so kept
  });

  it('"last fri" is the one just gone, unless a month is said', () => {
    expect(read('saw sam last fri')).toMatchObject({ kind: 'log', day: '2026-10-02' });
    expect(read('dinner with sam last mon good')).toMatchObject({ kind: 'log', day: '2026-09-28', meaningfulness: 3 });
    expect(read('drinks monthly last fri 6pm')).toMatchObject({ repeat: 'monthly', monthly: { nth: -1, weekday: 5 } });
    expect(read('dinner last sunday of every month')).toMatchObject({ repeat: 'monthly', monthly: { nth: -1, weekday: 0 } });
  });

  it("today's weekday with its time gone is next week's", () => {
    expect(read('coffee mon 10am').day).toBe('2026-10-12');
    expect(read('coffee mon 5pm').day).toBe('2026-10-05');
    expect(read('coffee today 10am').day).toBe('2026-10-05'); // today said, so today
  });
});

describe('every few weeks, and monthly (2026-10-11)', () => {
  it('reads fortnightly, every other tue, and every 2 weeks on a day', () => {
    expect(read('football fortnightly sat 9am')).toMatchObject({ repeat: 'weekly', interval: 2, weekdays: [6], day: '2026-10-10', time: at(9) });
    expect(read('gym every other tue thu 7am')).toMatchObject({ repeat: 'weekly', interval: 2, weekdays: [2, 4], day: '2026-10-06' });
    expect(read('study every 2 weeks on mon 4pm')).toMatchObject({ repeat: 'weekly', interval: 2, weekdays: [1], day: '2026-10-05' });
    expect(read('call every three weeks')).toMatchObject({ repeat: 'weekly', interval: 3 });
    expect(read('gym every tue')).toMatchObject({ repeat: 'weekly', interval: 1, weekdays: [2] });
  });

  it('reads a day of the month, or a weekday of it, starting on the next one', () => {
    expect(read('book club monthly on the 15th 7pm')).toMatchObject({ repeat: 'monthly', monthly: { day: 15 }, day: '2026-10-15', weekdays: null });
    expect(read('drinks first fri of the month 6pm')).toMatchObject({ repeat: 'monthly', monthly: { nth: 1, weekday: 5 }, day: '2026-11-06' });
    expect(read('dinner last sunday of every month')).toMatchObject({ repeat: 'monthly', monthly: { nth: -1, weekday: 0 }, day: '2026-10-25' });
    expect(read('rent the 1st of every month')).toMatchObject({ repeat: 'monthly', monthly: { day: 1 }, day: '2026-11-01' });
    expect(read('call mum every month')).toMatchObject({ repeat: 'monthly', monthly: { day: 5 } });
    expect(read('dinner 15th october')).toMatchObject({ repeat: 'once', day: '2026-10-15' });
  });

  it('saves them as the plan sheet would', () => {
    expect(planFieldsOf(read('drinks first fri of the month 6pm'), 15)).toMatchObject({ kind: 'recurring', weekdays: [], monthly: { nth: 1, weekday: 5 }, interval: null, from: '2026-11-06' });
    expect(planFieldsOf(read('gym every other tue thu 7am'), 15)).toMatchObject({ kind: 'recurring', weekdays: [2, 4], interval: 2, monthly: null });
  });
});
