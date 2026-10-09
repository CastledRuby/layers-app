// React hooks for time-based behaviour (and, at the end, the Analyse all new
// runner). Layers usually stays running in the tray for days, so anything tied
// to "today" has to notice the date change rather than assume the app was
// launched this morning.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toISODate } from './dates.js';
import { plannedNotifications } from './calendar.js';
import { addNotifiedReminder, getLastNotifiedDate, getNotifiedReminders, setLastNotifiedDate } from './storage.js';
import { checkInReminder } from './text.js';
import { analysisDollars, analysisModel, analysisRequest, analysisResult, recordSpend, spendSummary } from './analysis.js';
import { batchDollars, pruneQueue, readLimit, readQueue, saveQueue } from './chatBatch.js';
import { readChatProgress, saveChatProgress } from './chatImport.js';

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

// When `key` changes, the element slides sideways from where its centre was
// to where it is now, instead of jumping: People's list going from the middle
// of a wide window to beside a profile, and back. Skipped with reduced motion.
export function useSlideAcross(ref, key) {
  const last = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const centreOf = () => { const r = el.getBoundingClientRect(); return r.left + r.width / 2; };
    const before = last.current;
    last.current = centreOf();
    // A resized window moves it too, without a slide.
    const onResize = () => { last.current = centreOf(); };
    window.addEventListener('resize', onResize);
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dx = before === null ? 0 : before - last.current;
    if (Math.abs(dx) > 4 && !reduced && typeof el.animate === 'function') {
      el.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: 340, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
    return () => window.removeEventListener('resize', onResize);
  }, [ref, key]);
}

// Whether Windows (or the browser) is in dark mode, following it as it
// changes: the theme's "Match Windows".
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

// Analyse all new (lib/chatBatch.js), run from LayersApp so it carries on
// while you use the rest of Layers. `analyse(request)` sends one chat (the
// bridge's runAnalysis); people and yourName are read as they are when each
// is sent. Each answer goes into the queue as it arrives, and each chat moves
// on past what's been sent (or marked seen, for tiny ones), so stopping, a
// problem or closing Layers leaves the rest new. It stops before going past
// the monthly limit, and when nothing comes back (the key, credit or
// connection); an answer Claude couldn't finish is queued as a problem.
// onDone({ answered, failed, note }) when a run ends.
// Returns { running: { done, total, model } | null, note, queue, setQueue,
// progress, saveProgress(key, change), start(items, model), stop() }.
export function useChatBatch({ analyse, people, yourName, onDone }) {
  const latest = useRef({ analyse, people, yourName, onDone });
  useLayoutEffect(() => { latest.current = { analyse, people, yourName, onDone }; });
  // What was dealt with in an earlier session is gone; Undo can't reach it.
  const [queue, setQueue] = useState(() => pruneQueue(readQueue(), Number.POSITIVE_INFINITY));
  const [progress, setProgress] = useState(() => readChatProgress());
  const [running, setRunning] = useState(null);
  const [note, setNote] = useState(null);
  const runs = useRef(0);
  const busy = useRef(false);
  // Items sent and not answered yet. After Stop, a run started again leaves
  // them out: the stopped run still queues their answer when it comes, so
  // sending them again would pay for them twice.
  const sending = useRef(new Set());
  useEffect(() => { saveQueue(queue); }, [queue]);
  const saveProgress = (key, change) => setProgress(saveChatProgress(key, change));
  const moveOn = (item) => setProgress(saveChatProgress(item.chatKey, { at: Math.max((readChatProgress()[item.chatKey] || {}).at || 0, item.end) }));
  const add = (entry) => setQueue(q => [...q.filter(x => x.id !== entry.id), entry]);

  async function start(items, model) {
    if (busy.current || !latest.current.analyse) return;
    busy.current = true;
    const ticket = ++runs.current;
    const total = items.filter(i => !i.tiny && !sending.current.has(i.id)).length;
    let done = 0;
    let answered = 0;
    let failed = 0;
    let stopped = null;
    setNote(null);
    setQueue(q => pruneQueue(q, Date.now() - 10 * 60 * 1000));
    setRunning({ done: 0, total, model });
    for (const item of items) {
      if (ticket !== runs.current) break;
      if (sending.current.has(item.id)) continue;
      if (!item.tiny) {
        const limit = readLimit();
        if (limit && spendSummary().thisMonth.dollars + batchDollars([item], model) > limit) { stopped = `Stopped at your US$${limit} monthly limit (Me → Chat analysis).`; break; }
        const { analyse: send, people: everyone, yourName: you } = latest.current;
        const group = item.ids.map(id => everyone.find(p => p.id === id)).filter(Boolean);
        if (group.length) {
          sending.current.add(item.id);
          const answer = await Promise.resolve(send(analysisRequest({ people: group, yourName: you, text: item.text, model }))).catch(() => null);
          sending.current.delete(item.id);
          if (answer && answer.usage) recordSpend(answer.usage, answer.model || model);
          const used = analysisModel((answer && answer.model) || model).id;
          const base = { id: item.id, chatKey: item.chatKey, title: item.title, source: item.source, day: item.day, personIds: group.map(p => p.id), model: used, chat: item.text, messages: item.messages };
          if (!answer || (answer.error && !answer.usage)) { stopped = `Stopped: ${(answer && answer.error) || "Couldn't reach Claude."}`; break; }
          if (answer.error) { add({ ...base, error: answer.error }); failed += 1; }
          else {
            const result = analysisResult(answer.result, group);
            result.log.date = item.day; // the export's own times
            add({ ...base, result, cost: analysisDollars(answer.usage, used) });
            answered += 1;
          }
        }
        done += 1;
        if (ticket === runs.current) setRunning({ done, total, model });
      }
      moveOn(item);
    }
    // A run that was stopped leaves `busy` alone: stop() cleared it, and a
    // run started since may be going.
    if (ticket === runs.current) { busy.current = false; runs.current += 1; setRunning(null); }
    const left = total - done;
    const why = stopped ? `${stopped} ${left === 1 ? 'One conversation is' : `${left} conversations are`} still new.` : null;
    setNote(why);
    if (latest.current.onDone) latest.current.onDone({ answered, failed, note: why });
  }
  function stop() {
    runs.current += 1;
    busy.current = false;
    setRunning(null);
  }
  return { running, note, queue, setQueue, progress, saveProgress, start, stop };
}
