// React hooks for time-based behaviour. Layers usually stays running in the
// tray for days, so anything tied to "today" has to notice the date change
// rather than assume the app was launched this morning.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toISODate } from './dates.js';
import { dueReminders } from './reminders.js';
import { addNotifiedReminder, getLastNotifiedDate, getNotifiedReminders, setLastNotifiedDate } from './storage.js';
import { checkInReminder } from './text.js';

// The local date as 'YYYY-MM-DD', updated within a minute of midnight (and
// as soon as the window becomes visible again, e.g. after the laptop wakes).
// Pass it to anything that derives "Today" / "N days ago" so it refreshes.
export function useToday() {
  const [today, setToday] = useState(() => toISODate(new Date()));
  useEffect(() => {
    const tick = () => setToday(toISODate(new Date())); // same value: React skips the render
    const timer = setInterval(tick, 60 * 1000);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  return today;
}

// The "haven't checked in" desktop notification, at most once per day. It
// checks shortly after launch and again whenever `today` changes, using the
// latest people and journal. It used to check once per launch, with the data
// as it was at launch, so an app left in the tray never reminded you again.
export function useDailyCheckIn(enabled, people, journal, today) {
  const latest = useRef({ people, journal });
  useLayoutEffect(() => { latest.current = { people, journal }; });
  useEffect(() => {
    if (!enabled || typeof Notification === 'undefined') return undefined;
    const timer = setTimeout(() => {
      try {
        const reminder = checkInReminder(latest.current.people, latest.current.journal, getLastNotifiedDate());
        if (!reminder) return;
        const show = () => {
          notify('Layers', reminder.body);
          setLastNotifiedDate(reminder.day);
        };
        if (Notification.permission === 'granted') show();
        else if (Notification.permission === 'default') Notification.requestPermission().then(p => { if (p === 'granted') show(); });
      } catch {
        // Notifications unavailable in this environment; ignore.
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [enabled, today]);
}

// A desktop notification. Clicking it brings Layers to the front (the
// window is usually hidden in the tray).
function notify(title, body) {
  const n = new Notification(title, { body });
  n.onclick = () => { if (window.layersSystem && window.layersSystem.showWindow) window.layersSystem.showWindow(); };
  return n;
}

// Reminders notify at their time (P6): checked every 30 seconds while Layers
// runs, including in the tray, and at most once per reminder per day
// (lib/reminders.js dueReminders). Turned off in Me > Notifications.
export function useReminderNotifications(enabled, events, people) {
  const latest = useRef({ events, people });
  useLayoutEffect(() => { latest.current = { events, people }; });
  useEffect(() => {
    if (!enabled || typeof Notification === 'undefined') return undefined;
    const check = () => {
      if (Notification.permission !== 'granted') {
        if (Notification.permission === 'default') Notification.requestPermission();
        return;
      }
      const { events: evs, people: ppl } = latest.current;
      dueReminders(evs, new Date(), getNotifiedReminders()).forEach(({ ev, key }) => {
        const names = (ev.personIds || []).map(id => (ppl.find(p => p.id === id) || {}).name).filter(Boolean);
        try { notify('Layers reminder', names.length ? `${ev.title} (${names.join(', ')})` : ev.title); } catch { return; }
        addNotifiedReminder(key);
      });
    };
    check();
    const timer = setInterval(check, 30 * 1000);
    return () => clearInterval(timer);
  }, [enabled]);
}
