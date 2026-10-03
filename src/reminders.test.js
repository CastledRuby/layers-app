// Reminders (P6): next occurrence, done state, notification timing, follow-ups.
import { describe, expect, it } from 'vitest';
import { dueReminders, followUpEvent, isPastOneOff, markDone, nextOccurrence, occurrenceToLog } from './lib/reminders.js';

// Sunday 4 Oct 2026 (weekday 0), 9:05 AM local
const NOW = new Date(2026, 9, 4, 9, 5);
const weekly = (weekdays, extra = {}) => ({ id: 'w', title: 'Call Gran', kind: 'recurring', weekdays, time: 9 * 60, personIds: [], ...extra });
const oneoff = (date, extra = {}) => ({ id: 'o', title: 'Dentist', kind: 'oneoff', date, time: 9 * 60, personIds: [], ...extra });

describe('nextOccurrence', () => {
  it('finds the next weekday within the week, not only today', () => {
    expect(nextOccurrence(weekly([0]), NOW)).toMatchObject({ day: '2026-10-04', when: 'Today' });
    expect(nextOccurrence(weekly([1]), NOW)).toMatchObject({ day: '2026-10-05', when: 'Tomorrow' });
    expect(nextOccurrence(weekly([3]), NOW)).toMatchObject({ day: '2026-10-07', offset: 3 });
  });

  it("skips today's occurrence once it's done", () => {
    expect(nextOccurrence(weekly([0, 1], { doneOn: '2026-10-04' }), NOW)).toMatchObject({ day: '2026-10-05' });
    expect(nextOccurrence(weekly([0], { doneOn: '2026-10-04' }), NOW)).toBeNull();
  });

  it('shows one-offs in the next 7 days until done', () => {
    expect(nextOccurrence(oneoff('2026-10-10'), NOW)).toMatchObject({ offset: 6 });
    expect(nextOccurrence(oneoff('2026-10-11'), NOW)).toBeNull();
    expect(nextOccurrence(oneoff('2026-10-03'), NOW)).toBeNull();
    expect(nextOccurrence(oneoff('2026-10-05', { doneAt: '2026-10-04' }), NOW)).toBeNull();
  });
});

describe('markDone / isPastOneOff', () => {
  it('finishes a one-off for good and a recurring one for the day', () => {
    expect(markDone(oneoff('2026-10-04'), '2026-10-04')).toMatchObject({ doneAt: '2026-10-04' });
    expect(markDone(weekly([0]), '2026-10-04')).toMatchObject({ doneDays: ['2026-10-04'] });
  });
  it("skipping a later day doesn't undo today", () => {
    const ev = markDone(markDone(weekly([0, 3]), '2026-10-04'), '2026-10-07');
    expect(ev.doneDays).toEqual(['2026-10-04', '2026-10-07']);
    expect(nextOccurrence(ev, NOW, 14)).toMatchObject({ day: '2026-10-11' }); // 4th and 7th both kept
  });
  it('reads the single doneOn of older saves', () => {
    expect(nextOccurrence(weekly([0], { doneOn: '2026-10-04' }), NOW, 14)).toMatchObject({ day: '2026-10-11' });
    expect(markDone(weekly([0], { doneOn: '2026-10-04' }), '2026-10-05')).toEqual(expect.objectContaining({ doneDays: ['2026-10-04', '2026-10-05'] }));
  });
  it('logs today when the reminder comes up today, even if already done', () => {
    expect(occurrenceToLog(weekly([0], { doneDays: ['2026-10-04'] }), NOW)).toBe('2026-10-04');
    expect(occurrenceToLog(weekly([3]), NOW)).toBe('2026-10-07');
  });
  it('flags a one-off whose day has passed without being done', () => {
    expect(isPastOneOff(oneoff('2026-10-03'), NOW)).toBe(true);
    expect(isPastOneOff(oneoff('2026-10-03', { doneAt: '2026-10-03' }), NOW)).toBe(false);
    expect(isPastOneOff(oneoff('2026-10-04'), NOW)).toBe(false);
  });
});

describe('dueReminders', () => {
  it('notifies within 15 minutes after the time, once', () => {
    const events = [weekly([0]), oneoff('2026-10-04')];
    expect(dueReminders(events, NOW).map(d => d.key)).toEqual(['w:2026-10-04', 'o:2026-10-04']);
    expect(dueReminders(events, NOW, new Set(['w:2026-10-04'])).map(d => d.key)).toEqual(['o:2026-10-04']);
  });
  it("doesn't notify early, too late, when done, or for another day", () => {
    expect(dueReminders([weekly([0])], new Date(2026, 9, 4, 8, 59))).toEqual([]);
    expect(dueReminders([weekly([0])], new Date(2026, 9, 4, 9, 16))).toEqual([]);
    expect(dueReminders([weekly([0], { doneOn: '2026-10-04' })], NOW)).toEqual([]);
    expect(dueReminders([weekly([1])], NOW)).toEqual([]);
  });
});

describe('followUpEvent', () => {
  it('makes a one-off three days later at 9 AM', () => {
    const ev = followUpEvent({ id: 'p1', name: 'Ana' }, { text: 'Job interview' }, NOW);
    expect(ev).toMatchObject({ title: 'Ask Ana how "Job interview" went', personIds: ['p1'], kind: 'oneoff', date: '2026-10-07', time: 540 });
  });
});
