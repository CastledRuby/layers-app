// Done state and follow-ups for plans (calendar events). Which days a plan
// comes up on, the day plan and its notifications are in lib/calendar.js.
import { toISODate } from './dates.js';

// What "done" means: a one-off is finished for good; a repeating plan is
// done (or skipped) for that day only. Each day is kept, so skipping next
// Wednesday doesn't undo today; only the last 14 are kept.
export function markDone(ev, day) {
  if (ev.kind === 'oneoff') return { ...ev, doneAt: day };
  const days = [...new Set([...(ev.doneDays || []), ...(ev.doneOn ? [ev.doneOn] : []), day])].sort().slice(-14);
  const next = { ...ev, doneDays: days };
  delete next.doneOn;
  return next;
}

// A "remind me to follow up" for something time-sensitive you noted about
// someone: a one-off reminder three days later at 9:00 AM, at the time.
export function followUpEvent(person, item, now = new Date()) {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3);
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
