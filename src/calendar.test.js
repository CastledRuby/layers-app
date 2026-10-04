import { describe, expect, it } from 'vitest';
import { dayAgenda, keyDateOn, monthMarks, needsAnswer, occursOn, parseActionUrl, planIdeas, plannedNotifications, snoozeUntil } from './lib/calendar.js';

// Sunday 4 October 2026.
const DAY = '2026-10-04';
const local = (day, h, m = 0) => { const [y, mo, d] = day.split('-').map(Number); return new Date(y, mo - 1, d, h, m).getTime(); };
const priya = { id: 'p', name: 'Priya', layer: 4, goals: [], dates: [{ id: 'b', kind: 'birthday', date: '1998-10-05', yearly: true }] };
const coffee = { id: 'c', title: 'Coffee with Priya', kind: 'oneoff', date: DAY, time: 600, duration: 60, alert: 15, personIds: ['p'], template: 'coffee' };
const gym = { id: 'g', title: 'Gym', kind: 'recurring', weekdays: [0, 1, 2, 3, 4, 5, 6], from: '2026-10-01', time: 420, personIds: [] };

describe('occursOn', () => {
  it('one-offs on their day; daily and weekly from their first day', () => {
    expect(occursOn(coffee, DAY)).toBe(true);
    expect(occursOn(coffee, '2026-10-05')).toBe(false);
    expect(occursOn(gym, '2026-09-30')).toBe(false);
    expect(occursOn(gym, '2026-10-01')).toBe(true);
    expect(occursOn({ ...gym, weekdays: [1] }, '2026-10-05')).toBe(true); // a Monday
    expect(occursOn({ ...gym, weekdays: [1] }, DAY)).toBe(false);
  });
});

describe('key dates', () => {
  it('a yearly date comes round each year; a leap-day birthday shows on the 28th', () => {
    expect(keyDateOn({ date: '1998-10-05', yearly: true }, '2026-10-05')).toBe(true);
    expect(keyDateOn({ date: '2026-11-02', yearly: false }, '2027-11-02')).toBe(false);
    expect(keyDateOn({ date: '2000-02-29', yearly: true }, '2027-02-28')).toBe(true);
    expect(keyDateOn({ date: '2000-02-29', yearly: true }, '2028-02-28')).toBe(false);
  });
});

describe('dayAgenda', () => {
  it('splits a day into all-day items, timed events in order, and what was logged', () => {
    const state = {
      people: [{ ...priya, goals: [{ id: 'gl', title: 'See Priya monthly', progress: 20, dueDate: '2026-10-05' }] }],
      events: [coffee, gym],
      journal: [{ id: 'j', personId: 'p', at: '2026-10-05', type: 'talked', meaningfulness: 3 }],
    };
    const a = dayAgenda(state, '2026-10-05');
    expect(a.allDay.map(x => x.label)).toEqual(["Priya's birthday", 'Goal due: See Priya monthly']);
    expect(a.timed.map(x => x.ev.title)).toEqual(['Gym']);
    expect(a.logged).toHaveLength(1);
    const today = dayAgenda(state, DAY);
    expect(today.timed.map(x => [x.ev.title, x.start, x.end])).toEqual([['Gym', 420, 480], ['Coffee with Priya', 600, 660]]);
  });

  it('marks the month: planned, key dates and logged days (not daily routines)', () => {
    const marks = monthMarks({ people: [priya], events: [coffee, gym], journal: [] }, 2026, 9);
    expect(marks[DAY]).toEqual({ planned: 1, dates: 0, logged: 0 });
    expect(marks['2026-10-05']).toEqual({ planned: 0, dates: 1, logged: 0 });
  });
});

describe('needsAnswer', () => {
  it('asks about events with people once they have ended, until done', () => {
    const a = dayAgenda({ people: [priya], events: [coffee, gym] }, DAY);
    expect(needsAnswer(a, DAY, new Date(local(DAY, 10, 30)))).toEqual([]);
    expect(needsAnswer(a, DAY, new Date(local(DAY, 11, 0))).map(x => x.ev.id)).toEqual(['c']);
    const done = dayAgenda({ people: [priya], events: [{ ...coffee, doneAt: DAY }] }, DAY);
    expect(needsAnswer(done, DAY, new Date(local(DAY, 12)))).toEqual([]);
  });
});

describe('plannedNotifications', () => {
  const state = { people: [priya], events: [coffee], journal: [] };
  const window = [local(DAY, 0), local(DAY, 23, 59)];

  it('reminds ahead, asks how it went, and sums up the morning and the evening before', () => {
    const list = plannedNotifications(state, {}, ...window);
    expect(list.map(n => [n.kind, new Date(n.at).getHours(), new Date(n.at).getMinutes()])).toEqual([
      ['morning', 8, 0], ['alert', 9, 45], ['after', 11, 0], ['evening', 20, 0],
    ]);
    expect(list[1]).toMatchObject({ title: 'Coffee with Priya', body: 'In 15 minutes · 10:00 AM · with Priya', eventId: 'c', day: DAY });
    expect(list[0].body).toBe('10:00 AM Coffee with Priya');
    expect(list[3]).toMatchObject({ title: 'Tomorrow: 1 thing', body: "🎂 Priya's birthday" });
  });

  it('follows the settings, skips done events, and adds snoozes', () => {
    const quiet = plannedNotifications(state, { morningSummary: false, eveningHeadsUp: false, askAfter: false }, ...window);
    expect(quiet.map(n => n.kind)).toEqual(['alert']);
    expect(plannedNotifications({ ...state, events: [{ ...coffee, doneAt: DAY }] }, { morningSummary: false, eveningHeadsUp: false }, ...window)).toEqual([]);
    const snoozed = plannedNotifications(state, { reminderNotifications: false, morningSummary: false, eveningHeadsUp: false, askAfter: false }, ...window, [{ id: 's1', eventId: 'c', day: DAY, at: local(DAY, 10, 10) }]);
    expect(snoozed.map(n => [n.kind, n.tag])).toEqual([['snooze', 's:s1']]);
  });

  it('reminders made before 1.0.30 (no alert) still come at their time', () => {
    const old = { id: 'o', title: 'Call Gran', kind: 'oneoff', date: DAY, time: 600, personIds: [] };
    const list = plannedNotifications({ events: [old] }, { morningSummary: false, eveningHeadsUp: false }, ...window);
    expect(list.map(n => [n.kind, new Date(n.at).getHours(), n.body])).toEqual([['alert', 10, 'Starting now · 10:00 AM']]);
  });
});

describe('planIdeas', () => {
  it('suggests close people you have not seen for a while, unless something is planned', () => {
    const now = new Date(local(DAY, 12));
    const journal = [{ id: 'j', personId: 'p', at: '2026-09-10', type: 'talked', meaningfulness: 3 }];
    const ideas = planIdeas({ people: [priya], journal, events: [] }, now);
    expect(ideas.map(i => [i.person.name, i.template, i.text])).toEqual([['Priya', 'coffee', "You haven't seen Priya in 3 weeks."]]);
    expect(planIdeas({ people: [priya], journal, events: [{ ...coffee, date: '2026-10-06' }] }, now)).toEqual([]);
  });
});

describe('notification actions', () => {
  it('reads layers:// links from notification buttons', () => {
    expect(parseActionUrl('layers://done?e=c&d=2026-10-04')).toEqual({ action: 'done', eventId: 'c', day: '2026-10-04', minutes: null });
    expect(parseActionUrl('layers://snooze?e=c&d=2026-10-04&m=tomorrow').minutes).toBe('tomorrow');
    expect(parseActionUrl('layers://format-disk')).toBeNull();
    expect(parseActionUrl('https://example.com')).toBeNull();
  });

  it('snoozes for minutes, or until the same time tomorrow', () => {
    const now = new Date(local(DAY, 9, 45));
    expect(snoozeUntil('10', now)).toBe(local(DAY, 9, 55));
    expect(snoozeUntil('tomorrow', now)).toBe(local('2026-10-05', 9, 45));
  });
});
