// React hooks for time-based behaviour. Layers usually stays running in the
// tray for days, so anything tied to "today" has to notice the date change
// rather than assume the app was launched this morning.
import { useEffect, useRef, useState } from 'react';
import { toISODate } from './dates.js';
import { getLastNotifiedDate, setLastNotifiedDate } from './storage.js';
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
  latest.current = { people, journal };
  useEffect(() => {
    if (!enabled || typeof Notification === 'undefined') return undefined;
    const timer = setTimeout(() => {
      try {
        const reminder = checkInReminder(latest.current.people, latest.current.journal, getLastNotifiedDate());
        if (!reminder) return;
        const show = () => {
          new Notification('Layers', { body: reminder.body });
          setLastNotifiedDate(reminder.day);
        };
        if (Notification.permission === 'granted') show();
        else if (Notification.permission === 'default') Notification.requestPermission().then(p => { if (p === 'granted') show(); });
      } catch (e) {
        // Notifications unavailable in this environment; ignore.
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [enabled, today]);
}
