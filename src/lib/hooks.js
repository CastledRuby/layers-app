// React hooks for time-based behaviour. Layers usually stays running in the
// tray for days, so anything tied to "today" has to notice the date change
// rather than assume the app was launched this morning.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toISODate } from './dates.js';
import { plannedNotifications } from './calendar.js';
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

// Daily backups in the Windows app: shortly after Layers starts, and when
// the day changes while it runs, a copy of everything goes to the backups
// folder (electron/backups.cjs keeps one a day, the newest 14). `makeBackup`
// returns the backup as JSON; `onDone` gets what the folder holds now.
export function useDailyBackup(enabled, today, makeBackup, onDone) {
  const latest = useRef({ makeBackup, onDone });
  useLayoutEffect(() => { latest.current = { makeBackup, onDone }; });
  useEffect(() => {
    const bridge = typeof window !== 'undefined' ? window.layersSystem : null;
    if (!enabled || !bridge || !bridge.saveDailyBackup) return undefined;
    // A moment after startup, once any saved-data repairs have settled.
    const timer = setTimeout(() => {
      Promise.resolve(bridge.saveDailyBackup(today, latest.current.makeBackup()))
        .then(result => { if (result && !result.error && latest.current.onDone) latest.current.onDone(result); })
        .catch(() => {});
    }, 4000);
    return () => clearTimeout(timer);
  }, [enabled, today]);
}

// Whether Windows (or the browser) is in dark mode, following it as it
// changes: the theme's "Match Windows".
// Whether the window is wide enough for the desktop layout (900 px or more):
// the month beside the day, the people list beside a profile, a readable
// column for the other pages and sheets as a centred panel (.is-wide in
// theme.js). Narrower, Layers is the phone-shaped card it always was.
export const WIDE_QUERY = '(min-width: 900px)';
export function useWide() {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && !!window.matchMedia(WIDE_QUERY).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(WIDE_QUERY);
    const onChange = () => setWide(!!mq.matches);
    onChange();
    if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', onChange); else if (mq.removeListener) mq.removeListener(onChange); };
  }, []);
  return wide;
}

export function useSystemDark() {
  const query = '(prefers-color-scheme: dark)';
  const [dark, setDark] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && !!window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(query);
    const onChange = () => setDark(!!mq.matches);
    onChange();
    if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', onChange); else if (mq.removeListener) mq.removeListener(onChange); };
  }, []);
  return dark;
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

// The calendar's notifications (lib/calendar.js plannedNotifications):
// reminders before each plan, "How did it go?" after one, and the morning
// and evening summaries.
// - In the Windows app (window.layersSystem.scheduleNotifications), the next
//   two weeks are handed to Windows whenever they change, and again every
//   hour as that window moves on. Windows shows them on time, even with
//   Layers closed, with buttons that come back as layers:// links.
// - Anywhere else (a browser), Layers shows each one itself while it runs,
//   once, within 15 minutes of its time.
const SCHEDULE_DAYS = 14;
const LATE_MINUTES = 15;

export function useCalendarNotifications({ enabled, state, settings, snoozes }) {
  const latest = useRef({ state, settings, snoozes });
  useLayoutEffect(() => { latest.current = { state, settings, snoozes }; });
  const canSchedule = typeof window !== 'undefined' && !!(window.layersSystem && window.layersSystem.scheduleNotifications);
  const [hour, setHour] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setHour(h => h + 1), 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const lastSent = useRef(null);
  const settingsKey = JSON.stringify(settings);
  useEffect(() => {
    if (!canSchedule) return undefined;
    const timer = setTimeout(() => {
      const now = Date.now();
      const cur = latest.current;
      const list = enabled ? plannedNotifications(cur.state, cur.settings, now, now + SCHEDULE_DAYS * 86400000, cur.snoozes) : [];
      const json = JSON.stringify(list);
      if (json === lastSent.current) return;
      lastSent.current = json;
      Promise.resolve(window.layersSystem.scheduleNotifications(list)).catch(() => { lastSent.current = null; });
    }, 1500);
    return () => clearTimeout(timer);
  }, [canSchedule, enabled, state.events, state.people, state.generalGoals, settingsKey, snoozes, hour]);

  useEffect(() => {
    if (canSchedule || !enabled || typeof Notification === 'undefined') return undefined;
    const check = () => {
      if (Notification.permission !== 'granted') {
        if (Notification.permission === 'default') Notification.requestPermission();
        return;
      }
      const now = Date.now();
      const cur = latest.current;
      const seen = getNotifiedReminders();
      plannedNotifications(cur.state, cur.settings, now - LATE_MINUTES * 60000, now, cur.snoozes).forEach(n => {
        if (seen.has(n.tag)) return;
        try { notify(n.title, n.body); } catch { return; }
        addNotifiedReminder(n.tag);
      });
    };
    check();
    const timer = setInterval(check, 30 * 1000);
    return () => clearInterval(timer);
  }, [canSchedule, enabled]);
}
