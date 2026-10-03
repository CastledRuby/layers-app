// Reminders (saved events): when each one next comes up, whether it's done,
// and which are due for a desktop notification right now.
//
// An event is { id, title, kind: 'oneoff' | 'recurring', date (one-off,
// 'YYYY-MM-DD'), weekdays (recurring, 0 = Sunday), time (minutes after
// midnight), personIds, goalId?, doneAt? (one-off: the day it was done),
// doneDays? (recurring: recent days it was done or skipped; older saves
// have a single doneOn) }.
import { formatCalendarDate, parseISODay, startOfDay, toISODate } from './dates.js';

function weekdaysOf(ev) {
  return ev.weekdays || (ev.weekday != null ? [ev.weekday] : []);
}

function doneOnDay(ev, day) {
  return (ev.doneDays || []).includes(day) || ev.doneOn === day;
}

// Does the event come up on this day at all (done or not)?
function occursOn(ev, d) {
  if (ev.kind === 'oneoff') return ev.date === toISODate(d);
  return ev.kind === 'recurring' && weekdaysOf(ev).includes(d.getDay());
}

// The next time an event comes up within `days` days of `now` (today
// included), skipping an occurrence already marked done. Returns
// { day: 'YYYY-MM-DD', offset, when: 'Today' | 'Tomorrow' | 'Mon, 6 Oct' }
// or null.
export function nextOccurrence(ev, now = new Date(), days = 7) {
  const today = startOfDay(now);
  const label = (d, offset) => ({ day: toISODate(d), offset, when: offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : formatCalendarDate(d) });
  if (ev.kind === 'oneoff') {
    const d = parseISODay(ev.date);
    if (!d || ev.doneAt) return null;
    const offset = Math.round((d - today) / 86400000);
    return offset >= 0 && offset < days ? label(d, offset) : null;
  }
  if (ev.kind === 'recurring') {
    const wd = weekdaysOf(ev);
    for (let offset = 0; offset < days; offset++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
      if (wd.includes(d.getDay()) && !doneOnDay(ev, toISODate(d))) return label(d, offset);
    }
  }
  return null;
}

// What "done" means: a one-off is finished for good; a recurring one is
// done (or skipped) for that day only. Each day is kept, so skipping next
// Wednesday doesn't undo today; only the last 14 are kept.
export function markDone(ev, day) {
  if (ev.kind === 'oneoff') return { ...ev, doneAt: day };
  const days = [...new Set([...(ev.doneDays || []), ...(ev.doneOn ? [ev.doneOn] : []), day])].sort().slice(-14);
  const next = { ...ev, doneDays: days };
  delete next.doneOn;
  return next;
}

// The day a log of this reminder counts for: today if it comes up today
// (even if already marked done), otherwise its next time.
export function occurrenceToLog(ev, now = new Date()) {
  if (occursOn(ev, startOfDay(now))) return toISODate(now);
  const next = nextOccurrence(ev, now);
  return next ? next.day : toISODate(now);
}

export function isPastOneOff(ev, now = new Date()) {
  return ev.kind === 'oneoff' && !ev.doneAt && !!ev.date && ev.date < toISODate(now);
}

// Desktop notifications fire within this many minutes after an event's time,
// so a laptop that was asleep at that moment still gets it when it wakes,
// but not hours later.
export const NOTIFY_WINDOW_MINUTES = 15;

// Reminders due for a notification at `now`: today's occurrence, not done,
// within the window, and not already notified (`notified` is a Set of keys).
// Returns [{ ev, key }], key being `${ev.id}:${day}`.
export function dueReminders(events, now = new Date(), notified = new Set()) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const day = toISODate(now);
  return (events || []).flatMap(ev => {
    if (typeof ev.time !== 'number') return [];
    const next = nextOccurrence(ev, now, 1);
    if (!next || next.offset !== 0) return [];
    const late = minutes - ev.time;
    const key = `${ev.id}:${day}`;
    return late >= 0 && late <= NOTIFY_WINDOW_MINUTES && !notified.has(key) ? [{ ev, key }] : [];
  });
}

// A "remind me to follow up" for something time-sensitive you noted about
// someone: a one-off reminder three days later at 9:00 AM.
export function followUpEvent(person, item, now = new Date()) {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3);
  return {
    title: `Ask ${person.name} how "${item.text}" went`,
    personIds: [person.id],
    kind: 'oneoff',
    date: toISODate(day),
    weekdays: null,
    time: 9 * 60,
    defaultMeaningfulness: 3,
  };
}
