// Done state and follow-ups for plans (calendar events). Which days a plan
// comes up on, the day plan and its notifications are in lib/calendar.js.
import { parseISODay, toISODate } from './dates.js';

// What "done" means: a one-off is finished for good; a repeating plan is
// done (or skipped) for that day only. Each day is kept, so skipping next
// Wednesday doesn't undo today; only the last 14 are kept.
// Done (or logged) after all takes back "didn't happen" for that day.
export function markDone(ev, day) {
  const base = ev.missedDays ? { ...ev, missedDays: ev.missedDays.filter(d => d !== day) } : ev;
  if (base.kind === 'oneoff') return { ...base, doneAt: day };
  const days = [...new Set([...(base.doneDays || []), ...(base.doneOn ? [base.doneOn] : []), day])].sort().slice(-14);
  const next = { ...base, doneDays: days };
  delete next.doneOn;
  return next;
}

// It didn't happen: nothing is logged, it isn't counted as done, and
// "How did it go?" stops asking. A repeating plan is marked for that day only;
// the last 14 are kept, as with done.
export function markMissed(ev, day) {
  return { ...ev, missedDays: [...new Set([...(ev.missedDays || []), day])].sort().slice(-14) };
}

// A "remind me to follow up" for something time-sensitive you noted about
// someone: a one-off reminder at 9:00 AM, at the time. It's the day after the
// detail happens when it has a day (`when`, from an analysed chat), but not
// before tomorrow; otherwise three days later.
export function followUpEvent(person, item, now = new Date()) {
  const on = parseISODay(item.when);
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const after = on ? new Date(on.getFullYear(), on.getMonth(), on.getDate() + 1) : null;
  const day = after ? (after < tomorrow ? tomorrow : after) : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3);
  return {
    title: `Ask ${person.name} how "${item.text}" went`,
    personIds: [person.id],
    kind: 'oneoff',
    date: toISODate(day),
    weekdays: null,
    time: 9 * 60,
    duration: 15,
    alert: 0,
    template: 'checkin',
    defaultMeaningfulness: 3,
  };
}
