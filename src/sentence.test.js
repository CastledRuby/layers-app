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
