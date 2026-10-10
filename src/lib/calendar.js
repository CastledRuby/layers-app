// The calendar: what's on a day, what each month looks like, which
// notifications to schedule, and who it's been a while since you saw. Plain
// functions over the app's data, kept apart from Electron and Windows so the
// same logic can move to a phone later (docs/roadmap.md, the calendar).
//
// An event (state.events) is:
//   { id, title, kind: 'oneoff' | 'recurring',
//     date        one-off: 'YYYY-MM-DD'
//     weekdays    recurring: [0-6], 0 = Sunday; all seven = daily
//     from?       recurring: the first day it applies ('YYYY-MM-DD')
//     skipDays?   recurring: days it doesn't come up on, because that day
//                 alone was changed (now a one-off of its own) or deleted
//     time        minutes after midnight, or null with allDay
//     allDay?     true for an all-day event
//     duration?   minutes (DEFAULT_DURATION when missing)
//     alert?      minutes before to notify; null = no reminder. Missing means
//                 0 (at the time), which is how reminders before 1.0.30 behaved.
//     template?   a key of EVENT_TEMPLATES
//     personIds, goalId?, defaultMeaningfulness, doneAt?, doneDays?,
//     missedDays? days it didn't happen (nothing logged, not counted as done)
//     createdAt, updatedAt? }
// A person's key dates (person.dates) are { id, kind, label, date: 'YYYY-MM-DD',
// yearly }: a yearly one (birthday) comes round on the same month and day.
import { journalDaysAgo, MONTH_NAMES, parseISODay, startOfDay, toISODate } from './dates.js';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const DEFAULT_DURATION = 60;

// What you can plan, so most events need no typing: each fills the title, the
// interaction type a log of it gets, a usual time and a length.
export const EVENT_TEMPLATES = [
  { key: 'coffee', label: 'Coffee', emoji: '☕', title: (who) => who ? `Coffee with ${who}` : 'Coffee', type: 'hangout', time: 10 * 60, duration: 60 },
  { key: 'call', label: 'Call', emoji: '📞', title: (who) => who ? `Call ${who}` : 'Call', type: 'called', time: 18 * 60, duration: 30 },
  { key: 'hangout', label: 'Hang out', emoji: '🍕', title: (who) => who ? `Hang out with ${who}` : 'Hang out', type: 'hangout', time: 18 * 60, duration: 120 },
  { key: 'meal', label: 'Meal', emoji: '🍽️', title: (who) => who ? `Dinner with ${who}` : 'Dinner', type: 'hangout', time: 18 * 60 + 30, duration: 90 },
  { key: 'activity', label: 'Activity', emoji: '🎮', title: (who) => who ? `Activity with ${who}` : 'Activity', type: 'activity', time: 15 * 60, duration: 120 },
  { key: 'study', label: 'Study', emoji: '📚', title: (who) => who ? `Study with ${who}` : 'Study session', type: 'activity', time: 16 * 60, duration: 60 },
  { key: 'checkin', label: 'Check in', emoji: '💬', title: (who) => who ? `Check in with ${who}` : 'Check in', type: 'messaged', time: 19 * 60, duration: 15 },
  { key: 'custom', label: 'Something else', emoji: '✏️', title: (who) => who ? `Plans with ${who}` : 'Plans', type: 'other', time: 12 * 60, duration: 60 },
];
export const templateFor = (key) => EVENT_TEMPLATES.find(t => t.key === key) || null;

// Key dates kept on a person's profile.
export const DATE_KINDS = [
  { key: 'birthday', label: 'Birthday', emoji: '🎂', yearly: true },
  { key: 'anniversary', label: 'Anniversary', emoji: '💍', yearly: true },
  { key: 'exam', label: 'Exam', emoji: '📝', yearly: false },
  { key: 'bigday', label: 'Big day', emoji: '⭐', yearly: false },
  { key: 'custom', label: 'Something else', emoji: '📌', yearly: false },
];
export const dateKind = (key) => DATE_KINDS.find(k => k.key === key) || DATE_KINDS[DATE_KINDS.length - 1];

// The calendar's notification settings, kept on the profile (Me >
// Notifications). Missing values use these.
export const NOTIFY_DEFAULTS = {
  reminderNotifications: true, // per-event reminders
  defaultAlert: 15, // minutes before, for new events
  morningSummary: true,
  morningTime: 8 * 60,
  eveningHeadsUp: true,
  eveningTime: 20 * 60,
  askAfter: true, // "How did it go?" when an event with people ends
  keyDateReminders: true, // birthdays and key dates: a week before, the evening before, the morning of
  catchUpWeekly: true, // a weekly list of who you haven't seen, at morningTime
  catchUpDay: 6, // 0 = Sunday ... 6 = Saturday
  quietNudges: true, // when someone Personal or Close goes quieter than usual
  weeklyReview: true, // "Your week", Sundays at reviewTime
  reviewTime: 19 * 60,
};
export function notifySettings(profile) {
  const p = profile || {};
  return Object.fromEntries(Object.entries(NOTIFY_DEFAULTS).map(([k, v]) => [k, p[k] === undefined ? v : p[k]]));
}

const dayDate = (day) => parseISODay(day);
const addDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
const weekdaysOf = (ev) => ev.weekdays || (ev.weekday != null ? [ev.weekday] : []);
export const isDaily = (ev) => ev.kind === 'recurring' && weekdaysOf(ev).length === 7;

// Does the event come up on this day ('YYYY-MM-DD')?
export function occursOn(ev, day) {
  if (ev.kind === 'oneoff') return ev.date === day;
  if (ev.kind !== 'recurring') return false;
  if (ev.from && day < ev.from) return false;
  if (ev.skipDays && ev.skipDays.includes(day)) return false;
  const d = dayDate(day);
  return !!d && weekdaysOf(ev).includes(d.getDay());
}

export function isDoneOn(ev, day) {
  if (ev.kind === 'oneoff') return !!ev.doneAt;
  return (ev.doneDays || []).includes(day) || ev.doneOn === day;
}

// "Didn't happen" on that day: no log, and not asked about again.
export function isMissedOn(ev, day) {
  return (ev.missedDays || []).includes(day);
}

export const durationOf = (ev) => (typeof ev.duration === 'number' && ev.duration > 0 ? ev.duration : DEFAULT_DURATION);
export const alertOf = (ev) => (ev.alert === undefined ? 0 : ev.alert);
const timed = (ev) => !ev.allDay && typeof ev.time === 'number';

// Does a key date fall on this day? A yearly one matches month and day (a
// 29 February birthday shows on the 28th in other years).
export function keyDateOn(kd, day) {
  if (!kd || typeof kd.date !== 'string') return false;
  if (!kd.yearly) return kd.date === day;
  const md = kd.date.slice(5);
  const target = day.slice(5);
  if (md === target) return true;
  const year = Number(day.slice(0, 4));
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return md === '02-29' && !leap && target === '02-28';
}

// "Priya's birthday", or "Priya: Driving test" for one of your own wording.
export function keyDateLabel(person, kd) {
  if (kd.kind === 'custom' && kd.label) return `${person.name}: ${kd.label}`;
  return `${person.name}'s ${dateKind(kd.kind).label.toLowerCase()}`;
}

// Everything on one day, for the day plan:
//   allDay  key dates, goals due and all-day events
//   timed   events with a time, earliest first, each with start/end minutes
//   logged  journal entries for the day
export function dayAgenda({ events = [], people = [], generalGoals = [], journal = [] }, day) {
  const peopleById = Object.fromEntries(people.map(p => [p.id, p]));
  const allDay = [];
  people.forEach(p => (p.dates || []).forEach(kd => {
    if (keyDateOn(kd, day)) allDay.push({ kind: 'date', id: `${p.id}:${kd.id}`, person: p, keyDate: kd, label: keyDateLabel(p, kd), emoji: dateKind(kd.kind).emoji });
  }));
  const goals = [...people.flatMap(p => (p.goals || []).map(g => ({ g, person: p }))), ...generalGoals.map(g => ({ g, person: null }))];
  goals.forEach(({ g, person }) => {
    if (g.dueDate === day && g.progress < 100) allDay.push({ kind: 'goal', id: `goal:${g.id}`, goal: g, person, label: `Goal due: ${g.title}`, emoji: '🎯' });
  });
  const items = events.filter(ev => occursOn(ev, day)).map(ev => ({
    kind: 'event', id: ev.id, ev, day,
    people: (ev.personIds || []).map(id => peopleById[id]).filter(Boolean),
    done: isDoneOn(ev, day),
    missed: isMissedOn(ev, day),
    start: timed(ev) ? ev.time : null,
    end: timed(ev) ? ev.time + durationOf(ev) : null,
  }));
  items.filter(it => it.start === null).forEach(it => allDay.push(it));
  const timedItems = items.filter(it => it.start !== null).sort((a, b) => a.start - b.start || a.ev.title.localeCompare(b.ev.title));
  const logged = journal.filter(j => j.at === day && peopleById[j.personId]).map(j => ({ kind: 'logged', id: j.id, entry: j, person: peopleById[j.personId] }));
  return { allDay, timed: timedItems, logged };
}

// Dots for a month grid: { 'YYYY-MM-DD': { planned, dates, logged } }.
// Daily routines aren't counted, or every day would have a dot and the days
// with something special on wouldn't stand out.
export function monthMarks(state, year, month) {
  const out = {};
  const days = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const day = toISODate(new Date(year, month, d));
    const a = dayAgenda(state, day);
    const planned = [...a.timed, ...a.allDay.filter(x => x.kind === 'event')].filter(it => !isDaily(it.ev)).length;
    const dates = a.allDay.filter(x => x.kind !== 'event').length;
    if (planned || dates || a.logged.length) out[day] = { planned, dates, logged: a.logged.length };
  }
  return out;
}

// The plans made or changed most recently, one of each (the same title and
// people), newest first: "Plan again" in PlanSheet.
export function recentPlans(events = [], limit = 4) {
  const stamp = (ev) => String(ev.updatedAt || ev.createdAt || '');
  const seen = new Set();
  const out = [];
  [...events].sort((a, b) => stamp(b).localeCompare(stamp(a))).forEach(ev => {
    const key = `${String(ev.title || '').trim().toLowerCase()}|${[...(ev.personIds || [])].sort().join(',')}`;
    if (out.length >= limit || seen.has(key)) return;
    seen.add(key);
    out.push(ev);
  });
  return out;
}

// Timed plans on `day`, not yet done, that overlap a plan from `start` for
// `duration` minutes (leaving out the plan being edited, `exceptId`).
export function clashesOn(state, day, start, duration, exceptId) {
  const events = (state.events || []).filter(ev => ev.id !== exceptId);
  return dayAgenda({ ...state, events }, day).timed.filter(it => !it.done && !it.missed && it.start < start + duration && it.end > start);
}

// Events whose time has passed today (or on an earlier day still being
// looked at) that have people and aren't done, or marked as didn't happen:
// "How did it go?"
export function needsAnswer(agenda, day, now = new Date()) {
  const today = toISODate(now);
  if (day > today) return [];
  const minutes = now.getHours() * 60 + now.getMinutes();
  return agenda.timed.filter(it => !it.done && !it.missed && it.people.length > 0 && (day < today || it.end <= minutes));
}

// People it's been a while since you logged anything with, and nothing is
// planned with them in the next week: "You haven't seen Priya in 3 weeks."
// The closer the layer, the sooner it's suggested.
const QUIET_DAYS = { 1: 35, 2: 21, 3: 14, 4: 7 };
export function planIdeas({ people = [], journal = [], events = [] }, now = new Date(), max = 2) {
  const today = startOfDay(now);
  const nextWeek = Array.from({ length: 7 }, (_, i) => toISODate(addDays(today, i)));
  const planned = new Set(events.filter(ev => nextWeek.some(day => occursOn(ev, day) && !isDoneOn(ev, day) && !isMissedOn(ev, day))).flatMap(ev => ev.personIds || []));
  const last = new Map();
  journal.forEach(j => {
    const d = journalDaysAgo(j, now);
    if (!last.has(j.personId) || d < last.get(j.personId)) last.set(j.personId, d);
  });
  return people
    .filter(p => !planned.has(p.id) && last.has(p.id))
    .map(p => ({ person: p, days: last.get(p.id), limit: QUIET_DAYS[p.layer] || 21 }))
    .filter(x => x.days >= x.limit)
    .sort((a, b) => b.days / b.limit - a.days / a.limit)
    .slice(0, max)
    .map(x => ({ ...x, template: x.person.layer >= 3 ? 'coffee' : 'checkin', text: `You haven't seen ${x.person.name} in ${sinceText(x.days)}.` }));
}
// How long you usually go between seeing someone: the middle of the gaps
// between their last seven logged days. Null with fewer than three.
export function usualGap(personId, journal = []) {
  const days = [...new Set(journal.filter(j => j.personId === personId && j.at).map(j => j.at))].sort().slice(-7);
  if (days.length < 3) return null;
  const gaps = days.slice(1).map((d, i) => Math.round((dayDate(d) - dayDate(days[i])) / 86400000)).sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

// When someone counts as gone quiet: half as long again as your usual gap
// (7 to 60 days), or their layer's QUIET_DAYS until there's enough history.
// { day, limit, last, usual }, or null if nothing's been logged with them.
export function quietDay(person, journal = []) {
  const days = journal.filter(j => j.personId === person.id && j.at).map(j => j.at).sort();
  if (!days.length) return null;
  const usual = usualGap(person.id, journal);
  const limit = usual === null ? (QUIET_DAYS[person.layer] || 21) : Math.min(60, Math.max(7, Math.round(usual * 1.5)));
  const last = days[days.length - 1];
  return { day: toISODate(addDays(dayDate(last), limit)), limit, last, usual };
}

// Today's "who to message" (Know what to say, decided 2026-10-10): one person
// and why, worked out here, so it's free. In order: their key date today or
// tomorrow, asking how something went (a saved detail whose day was in the
// last three days), then whoever has gone quietest past their usual gap
// (quietDay). Not anyone with a plan that day, already logged that day, or
// put off (`skipped`, their ids). { person, kind: 'date' | 'followup' |
// 'quiet', text } or null.
export function messageNudge({ people = [], journal = [], events = [] }, day, skipped = []) {
  const busy = new Set([
    ...events.filter(ev => occursOn(ev, day) && !isMissedOn(ev, day)).flatMap(ev => ev.personIds || []),
    ...journal.filter(j => j.at === day).map(j => j.personId),
    ...skipped,
  ]);
  const open = people.filter(p => !busy.has(p.id));
  const tomorrow = toISODate(addDays(dayDate(day), 1));
  for (const when of [day, tomorrow]) {
    for (const p of open) {
      const kd = (p.dates || []).find(d => keyDateOn(d, when));
      if (kd) return { person: p, kind: 'date', text: `${keyDateLabel(p, kd)} is ${when === day ? 'today' : 'tomorrow'}` };
    }
  }
  const from = toISODate(addDays(dayDate(day), -3));
  const follow = open.flatMap(p => ['important', 'plans'].flatMap(cat => (p[cat] || []).filter(it => it && !it.archived && typeof it.when === 'string' && it.when >= from && it.when < day).map(it => ({ p, it }))))
    .sort((a, b) => b.it.when.localeCompare(a.it.when))[0];
  if (follow) return { person: follow.p, kind: 'followup', text: `Ask ${follow.p.name} how "${follow.it.text}" went` };
  const quiet = open.map(p => ({ p, q: quietDay(p, journal) })).filter(x => x.q && x.q.day <= day)
    .map(x => ({ ...x, days: Math.round((dayDate(day) - dayDate(x.q.last)) / 86400000) }))
    .sort((a, b) => b.days / b.q.limit - a.days / a.q.limit)[0];
  if (quiet) return { person: quiet.p, kind: 'quiet', text: `It's been ${sinceText(quiet.days)} since you and ${quiet.p.name} talked` };
  return null;
}

// One week, Monday to Sunday, around `day`: the weekly review. Daily
// routines aren't counted as plans, so they don't drown out the rest.
export function weekSummary({ people = [], journal = [], events = [], generalGoals = [] }, day) {
  const d = dayDate(day);
  const monday = addDays(d, -((d.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => toISODate(addDays(monday, i)));
  const next = Array.from({ length: 7 }, (_, i) => toISODate(addDays(monday, 7 + i)));
  const inWeek = (iso) => iso >= days[0] && iso <= days[6];
  const logs = journal.filter(j => j.at && inWeek(j.at));
  const seen = [...new Set(logs.map(j => j.personId))].map(id => people.find(p => p.id === id)).filter(Boolean);
  let planned = 0;
  let done = 0;
  let nextPlanned = 0;
  events.filter(ev => !isDaily(ev)).forEach(ev => {
    days.forEach(x => { if (occursOn(ev, x)) { planned++; if (isDoneOn(ev, x)) done++; } });
    next.forEach(x => { if (occursOn(ev, x)) nextPlanned++; });
  });
  const goalsMoved = [...people.flatMap(p => p.goals || []), ...generalGoals].filter(g => (g.history || []).some(h => h.at && inWeek(h.at)));
  return { from: days[0], to: days[6], seen, logs: logs.length, planned, done, goalsMoved, nextMonday: next[0], nextPlanned };
}

function sinceText(days) {
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  return `${Math.round(days / 30)} months`;
}

const at = (day, minutes) => { const d = dayDate(day); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, minutes).getTime(); };
const clock = (minutes) => {
  const h = Math.floor(minutes / 60) % 24; const m = minutes % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const names = (list) => list.length <= 2 ? list.join(' and ') : `${list.slice(0, 2).join(', ')} and ${list.length - 2} more`;
function alertWhen(alert) {
  if (alert === 0) return 'Starting now';
  if (alert < 60) return `In ${alert} minutes`;
  if (alert < 1440) return alert === 60 ? 'In 1 hour' : `In ${alert / 60} hours`;
  return 'Tomorrow';
}

// Every notification due between `from` and `to` (ms), oldest first:
//   { tag, at, kind: 'alert' | 'after' | 'morning' | 'evening' | 'snooze' | 'date'
//                   | 'catchup' | 'quiet' | 'review',
//     title, body, eventId?, personId?, day?, people? }
// The weekly catch-up list (catchup, on catchUpDay at morningTime) carries up
// to three `people` for its Plan buttons; "gone quiet" (quiet) is at noon on
// quietDay(); the weekly review (review) is on Sundays at reviewTime.
// A key date (kind 'date') reminds you a week before and on the morning (at
// morningTime), and the evening before (at eveningTime); its day is the key
// date's.
// Windows schedules these ahead (electron/toasts.cjs), so they arrive with
// Layers closed; elsewhere the app shows them while it runs (lib/hooks.js).
// `snoozes` are [{ id, eventId, day, at }].
export function plannedNotifications(state, settings, from, to, snoozes = []) {
  const s = { ...NOTIFY_DEFAULTS, ...settings };
  const out = [];
  const firstDay = startOfDay(new Date(from - 24 * 3600 * 1000));
  const lastDay = startOfDay(new Date(to + 24 * 3600 * 1000));
  const peopleById = Object.fromEntries((state.people || []).map(p => [p.id, p]));
  const withWho = (ev) => {
    const who = (ev.personIds || []).map(id => peopleById[id] && peopleById[id].name).filter(Boolean);
    return who.length ? names(who) : '';
  };
  const summaryLine = (agenda) => [
    ...agenda.allDay.map(x => x.kind === 'event' ? x.ev.title : `${x.emoji} ${x.label}`),
    ...agenda.timed.filter(it => !it.done).map(it => `${clock(it.start)} ${it.ev.title}`),
  ];
  for (let d = firstDay; d <= lastDay; d = addDays(d, 1)) {
    const day = toISODate(d);
    const agenda = dayAgenda(state, day);
    if (s.reminderNotifications) {
      [...agenda.timed, ...agenda.allDay.filter(x => x.kind === 'event')].forEach(it => {
        const alert = alertOf(it.ev);
        if (it.done || it.missed || alert === null) return;
        const start = it.start === null ? 9 * 60 : it.start;
        const who = withWho(it.ev);
        out.push({
          tag: `a:${it.ev.id}:${day}`, at: at(day, start) - alert * 60000, kind: 'alert', eventId: it.ev.id, day,
          title: it.ev.title,
          body: [it.start === null ? 'All day' : `${alertWhen(alert)} · ${clock(start)}`, who && `with ${who}`].filter(Boolean).join(' · '),
        });
      });
    }
    if (s.askAfter) {
      agenda.timed.forEach(it => {
        if (it.done || it.missed || !it.people.length) return;
        out.push({ tag: `f:${it.ev.id}:${day}`, at: at(day, it.end), kind: 'after', eventId: it.ev.id, day, title: `How did it go with ${withWho(it.ev)}?`, body: `${it.ev.title}. Log it, or just tick it off.` });
      });
    }
    // The morning's who to message (messageNudge), as things stand.
    const nudge = messageNudge(state, day);
    const lines = [...summaryLine(agenda), ...(nudge ? [`💬 ${nudge.text}`] : [])];
    if (s.morningSummary && lines.length) {
      out.push({ tag: `m:${day}`, at: at(day, s.morningTime), kind: 'morning', day, title: `Today: ${lines.length === 1 ? '1 thing' : `${lines.length} things`}`, body: lines.join(' · ') });
    }
    if (s.keyDateReminders) {
      (state.people || []).forEach(p => (p.dates || []).forEach(kd => {
        const { emoji } = dateKind(kd.kind);
        const label = keyDateLabel(p, kd);
        [['w', 7, s.morningTime], ['b', 1, s.eveningTime], ['t', 0, s.morningTime]].forEach(([code, ahead, time]) => {
          const on = toISODate(addDays(d, ahead));
          if (!keyDateOn(kd, on)) return;
          const onDate = dayDate(on);
          out.push({
            tag: `k${code}:${kd.id}:${on}`, at: at(day, time), kind: 'date', personId: p.id, day: on,
            title: ahead === 7 ? `${emoji} ${label} is in a week` : ahead === 1 ? `${emoji} Tomorrow: ${label}` : `${emoji} Today: ${label}`,
            body: ahead === 0 ? `Plan something with ${p.name}, or send them a message.` : `${WEEKDAY_NAMES[onDate.getDay()]} ${onDate.getDate()} ${MONTH_NAMES[onDate.getMonth()]}. Plan something with ${p.name}?`,
          });
        });
      }));
    }
    if (s.catchUpWeekly && d.getDay() === s.catchUpDay) {
      const ideas = planIdeas(state, d, 5);
      if (ideas.length) {
        out.push({
          tag: `c:${day}`, at: at(day, s.morningTime), kind: 'catchup', day,
          people: ideas.slice(0, 3).map(x => ({ id: x.person.id, name: x.person.name })),
          title: ideas.length === 1 ? `Catch up with ${ideas[0].person.name}?` : `Catch up this week: ${ideas.length} people`,
          body: ideas.map(x => `${x.person.name} (${sinceText(x.days)})`).join(' · '),
        });
      }
    }
    if (s.weeklyReview && d.getDay() === 0) {
      out.push({ tag: `r:${day}`, at: at(day, s.reviewTime), kind: 'review', day, title: 'Your week', body: 'Who you saw and what got done, then next week planned in one go.' });
    }
    const tomorrow = toISODate(addDays(d, 1));
    const next = summaryLine(dayAgenda(state, tomorrow));
    if (s.eveningHeadsUp && next.length) {
      out.push({ tag: `e:${tomorrow}`, at: at(day, s.eveningTime), kind: 'evening', day: tomorrow, title: `Tomorrow: ${next.length === 1 ? '1 thing' : `${next.length} things`}`, body: next.join(' · ') });
    }
  }
  // Someone Personal or Close going quieter than usual: once, at noon on the
  // day it happens, unless something with them is planned (or done) between.
  if (s.quietNudges) {
    (state.people || []).filter(p => p.layer >= 3).forEach(p => {
      const q = quietDay(p, state.journal || []);
      if (!q) return;
      const withThem = (state.events || []).filter(ev => (ev.personIds || []).includes(p.id));
      for (let x = addDays(dayDate(q.last), 1); x <= addDays(dayDate(q.day), 7); x = addDays(x, 1)) {
        const iso = toISODate(x);
        if (withThem.some(ev => occursOn(ev, iso))) return;
      }
      out.push({
        tag: `q:${p.id}:${q.day}`, at: at(q.day, 12 * 60), kind: 'quiet', personId: p.id, day: q.day,
        title: `It's been a while since you saw ${p.name}`,
        body: `${sinceText(q.limit)}${q.usual === null ? '' : ', longer than usual for you two'}. Plan something?`,
      });
    });
  }
  const eventsById = Object.fromEntries((state.events || []).map(ev => [ev.id, ev]));
  snoozes.forEach(sn => {
    const ev = eventsById[sn.eventId];
    if (!ev || isDoneOn(ev, sn.day) || isMissedOn(ev, sn.day)) return;
    const who = withWho(ev);
    out.push({ tag: `s:${sn.id}`, at: sn.at, kind: 'snooze', eventId: ev.id, day: sn.day, title: ev.title, body: ['Snoozed reminder', who && `with ${who}`].filter(Boolean).join(' · ') });
  });
  return out.filter(n => n.at >= from && n.at <= to).sort((a, b) => a.at - b.at);
}

// A snooze for an event's occurrence: 10 or 60 minutes from now, or the same
// time tomorrow ('tomorrow').
export function snoozeUntil(minutes, now = new Date()) {
  if (minutes === 'tomorrow') return now.getTime() + 24 * 3600 * 1000;
  return now.getTime() + Number(minutes) * 60000;
}

// What a notification button asks for, from its layers:// link:
//   layers://done?e=<event id>&d=<day>      tick it off
//   layers://log?e=..&d=..                  open the quick log, filled in
//   layers://snooze?e=..&d=..&m=10|60|tomorrow
//   layers://open?d=..[&e=..]               show that day (and event)
export function parseActionUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'layers:') return null;
    const action = (u.hostname || u.pathname.replace(/^\/+/, '')).replace(/\/+$/, '');
    if (!['done', 'log', 'snooze', 'open', 'plan', 'rate', 'review'].includes(action)) return null;
    const p = u.searchParams;
    const day = p.get('d');
    const rating = Number(p.get('r'));
    return { action, eventId: p.get('e') || null, personId: p.get('p') || null, day: day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null, minutes: p.get('m') || null, rating: rating >= 1 && rating <= 5 ? rating : null };
  } catch {
    return null;
  }
}
