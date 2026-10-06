import { describe, expect, it } from 'vitest';
import { clashesOn, dayAgenda, keyDateOn, monthMarks, needsAnswer, occursOn, parseActionUrl, planIdeas, plannedNotifications, quietDay, recentPlans, snoozeUntil, usualGap, weekSummary } from './lib/calendar.js';

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
    expect(occursOn({ ...gym, weekdays: [1], skipDays: ['2026-10-05'] }, '2026-10-05')).toBe(false); // that Monday changed or deleted on its own
    expect(occursOn({ ...gym, weekdays: [1], skipDays: ['2026-10-05'] }, '2026-10-12')).toBe(true);
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
    const list = plannedNotifications(state, { weeklyReview: false }, ...window);
    expect(list.map(n => [n.kind, new Date(n.at).getHours(), new Date(n.at).getMinutes()])).toEqual([
      ['morning', 8, 0], ['alert', 9, 45], ['after', 11, 0], ['date', 20, 0], ['evening', 20, 0],
    ]);
    expect(list[1]).toMatchObject({ title: 'Coffee with Priya', body: 'In 15 minutes · 10:00 AM · with Priya', eventId: 'c', day: DAY });
    expect(list[0].body).toBe('10:00 AM Coffee with Priya');
    expect(list[4]).toMatchObject({ title: 'Tomorrow: 1 thing', body: "🎂 Priya's birthday" });
  });

  it('reminds of birthdays a week before, the evening before and on the morning', () => {
    const quiet = { morningSummary: false, eveningHeadsUp: false, askAfter: false, reminderNotifications: false, weeklyReview: false };
    const weekBefore = '2026-09-28';
    const list = plannedNotifications({ people: [priya] }, quiet, local(weekBefore, 0), local('2026-10-05', 23, 59));
    expect(list.map(n => [n.tag, new Date(n.at).getDate(), new Date(n.at).getHours(), n.title])).toEqual([
      ['kw:b:2026-10-05', 28, 8, "🎂 Priya's birthday is in a week"],
      ['kb:b:2026-10-05', 4, 20, "🎂 Tomorrow: Priya's birthday"],
      ['kt:b:2026-10-05', 5, 8, "🎂 Today: Priya's birthday"],
    ]);
    expect(list[0]).toMatchObject({ kind: 'date', personId: 'p', day: '2026-10-05', body: 'Monday 5 October. Plan something with Priya?' });
    expect(plannedNotifications({ people: [priya] }, { ...quiet, keyDateReminders: false }, local(weekBefore, 0), local('2026-10-05', 23, 59))).toEqual([]);
  });

  it('follows the settings, skips done events, and adds snoozes', () => {
    const quiet = plannedNotifications(state, { morningSummary: false, eveningHeadsUp: false, askAfter: false, keyDateReminders: false, weeklyReview: false }, ...window);
    expect(quiet.map(n => n.kind)).toEqual(['alert']);
    expect(plannedNotifications({ ...state, events: [{ ...coffee, doneAt: DAY }] }, { morningSummary: false, eveningHeadsUp: false, keyDateReminders: false, weeklyReview: false }, ...window)).toEqual([]);
    const snoozed = plannedNotifications(state, { reminderNotifications: false, morningSummary: false, eveningHeadsUp: false, askAfter: false, keyDateReminders: false, weeklyReview: false }, ...window, [{ id: 's1', eventId: 'c', day: DAY, at: local(DAY, 10, 10) }]);
    expect(snoozed.map(n => [n.kind, n.tag])).toEqual([['snooze', 's:s1']]);
  });

  it('reminders made before 1.0.30 (no alert) still come at their time', () => {
    const old = { id: 'o', title: 'Call Gran', kind: 'oneoff', date: DAY, time: 600, personIds: [] };
    const list = plannedNotifications({ events: [old] }, { morningSummary: false, eveningHeadsUp: false, weeklyReview: false }, ...window);
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
    expect(parseActionUrl('layers://done?e=c&d=2026-10-04')).toEqual({ action: 'done', eventId: 'c', personId: null, day: '2026-10-04', minutes: null, rating: null });
    expect(parseActionUrl('layers://plan?p=p&d=2026-10-05')).toMatchObject({ action: 'plan', personId: 'p', day: '2026-10-05' });
    expect(parseActionUrl('layers://rate?e=c&d=2026-10-04&r=4')).toMatchObject({ action: 'rate', eventId: 'c', rating: 4 });
    expect(parseActionUrl('layers://rate?e=c&r=9').rating).toBeNull();
    expect(parseActionUrl('layers://review?d=2026-10-04')).toMatchObject({ action: 'review', day: '2026-10-04' });
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

describe('planning helpers', () => {
  it('recentPlans: newest first, one of each title and people', () => {
    const a = { id: 'a', title: 'Coffee with Priya', personIds: ['p'], createdAt: '2026-09-01' };
    const b = { id: 'b', title: 'coffee with Priya ', personIds: ['p'], updatedAt: '2026-10-02T10:00:00.000Z' };
    const c = { id: 'c', title: 'Gym', personIds: [], createdAt: '2026-10-01' };
    expect(recentPlans([a, b, c]).map(e => e.id)).toEqual(['b', 'c']);
    expect(recentPlans([a, b, c], 1).map(e => e.id)).toEqual(['b']);
  });

  it('clashesOn: timed plans that overlap, not ones that only touch, nor the one being edited', () => {
    const state = { events: [coffee, gym] }; // coffee 10:00-11:00, gym 7:00-8:00 daily
    expect(clashesOn(state, DAY, 630, 60).map(it => it.ev.id)).toEqual(['c']);
    expect(clashesOn(state, DAY, 660, 30)).toEqual([]);
    expect(clashesOn(state, DAY, 400, 300).map(it => it.ev.id)).toEqual(['g', 'c']);
    expect(clashesOn(state, DAY, 630, 60, 'c')).toEqual([]);
  });
});

describe('keeping in touch', () => {
  const off = { morningSummary: false, eveningHeadsUp: false, askAfter: false, reminderNotifications: false, keyDateReminders: false, weeklyReview: false, quietNudges: false, catchUpWeekly: false };
  const log = (personId, at) => ({ id: `${personId}-${at}`, personId, at, type: 'talked', meaningfulness: 3 });

  it('usualGap is the middle gap between logged days; quietDay is half as long again', () => {
    const journal = ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-25'].map(at => log('p', at));
    expect(usualGap('p', journal)).toBe(7); // gaps 7, 7, 10
    expect(quietDay(priya, journal)).toMatchObject({ last: '2026-09-25', limit: 11, day: '2026-10-06', usual: 7 });
    expect(quietDay(priya, journal.slice(0, 2))).toMatchObject({ limit: 7, usual: null }); // too little history: Layer 4's 7 days
    expect(quietDay(priya, [])).toBeNull();
  });

  it('nudges once, at noon on the day someone close goes quiet, unless something with them is planned', () => {
    const journal = ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-25'].map(at => log('p', at));
    const range = [local('2026-10-01', 0), local('2026-10-12', 0)];
    const list = plannedNotifications({ people: [priya], journal }, { ...off, quietNudges: true }, ...range);
    expect(list.map(n => [n.kind, n.tag, new Date(n.at).getDate(), new Date(n.at).getHours()])).toEqual([['quiet', 'q:p:2026-10-06', 6, 12]]);
    expect(list[0]).toMatchObject({ personId: 'p', title: "It's been a while since you saw Priya", body: '11 days, longer than usual for you two. Plan something?' });
    const planned = [{ id: 'x', title: 'Coffee', kind: 'oneoff', date: '2026-10-09', time: 600, personIds: ['p'] }];
    expect(plannedNotifications({ people: [priya], journal, events: planned }, { ...off, quietNudges: true }, ...range)).toEqual([]);
    expect(plannedNotifications({ people: [{ ...priya, layer: 2 }], journal }, { ...off, quietNudges: true }, ...range)).toEqual([]);
  });

  it('lists who to catch up with on the chosen day, and reviews the week on Sundays', () => {
    const journal = [log('p', '2026-09-01')];
    const range = [local('2026-10-01', 0), local('2026-10-07', 23, 59)];
    const list = plannedNotifications({ people: [priya], journal }, { ...off, catchUpWeekly: true, catchUpDay: 6, weeklyReview: true }, ...range);
    expect(list.map(n => [n.kind, n.day, new Date(n.at).getHours()])).toEqual([['catchup', '2026-10-03', 8], ['review', '2026-10-04', 19]]);
    expect(list[0]).toMatchObject({ title: 'Catch up with Priya?', body: 'Priya (5 weeks)', people: [{ id: 'p', name: 'Priya' }] });
  });

  it('weekSummary: who you saw, plans done (not daily routines), goals moved and next week', () => {
    const state = {
      people: [{ ...priya, goals: [{ id: 'g1', title: 'x', progress: 30, history: [{ at: '2026-09-30', value: 30 }] }] }],
      journal: [log('p', '2026-10-01'), log('p', '2026-10-03'), log('p', '2026-09-27')],
      events: [{ ...coffee, doneAt: DAY }, gym, { ...coffee, id: 'n', date: '2026-10-07', doneAt: undefined }],
    };
    expect(weekSummary(state, DAY)).toMatchObject({ from: '2026-09-28', to: '2026-10-04', logs: 2, planned: 1, done: 1, nextMonday: '2026-10-05', nextPlanned: 1 });
    expect(weekSummary(state, DAY).seen.map(p => p.name)).toEqual(['Priya']);
    expect(weekSummary(state, DAY).goalsMoved.map(g => g.id)).toEqual(['g1']);
  });
});
