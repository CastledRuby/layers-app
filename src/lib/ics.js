// Other calendars, read-only (docs/roadmap.md, "The plan from here", step 4):
// reading an iCalendar file (what Google Calendar's secret iCal address
// gives) and listing its events between two days, in this computer's time.
//
// Handles what Google writes: events with a time zone (TZID), in UTC (Z) or
// all day; repeats (RRULE: daily, weekly on chosen days, monthly, yearly, with
// INTERVAL, COUNT and UNTIL); days taken out (EXDATE); single occurrences
// moved or changed (RECURRENCE-ID); and cancelled events, which are left out.

// --- Reading the file --------------------------------------------------------

// Unfolds continued lines, and splits each into { name, params, value }.
function lines(text) {
  const out = [];
  String(text || '').replace(/\r\n?/g, '\n').split('\n').forEach(line => {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length) out[out.length - 1] += line.slice(1);
    else if (line) out.push(line);
  });
  return out.map(line => {
    const colon = line.search(/:(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    const head = colon < 0 ? line : line.slice(0, colon);
    const value = colon < 0 ? '' : line.slice(colon + 1);
    const [name, ...rest] = head.split(';');
    const params = {};
    rest.forEach(p => { const i = p.indexOf('='); if (i > 0) params[p.slice(0, i).toUpperCase()] = p.slice(i + 1).replace(/^"|"$/g, ''); });
    return { name: name.toUpperCase(), params, value };
  });
}
const unescape = (v) => v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

// A DATE or DATE-TIME value as { y, m, d, h, mi, s, allDay, zone }: zone is
// 'Z' (UTC), a TZID, or null (floating, this computer's time).
function readTime(value, params) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(String(value).trim());
  if (!m) return null;
  const allDay = params.VALUE === 'DATE' || !m[4];
  return { y: +m[1], m: +m[2], d: +m[3], h: allDay ? 0 : +m[4], mi: allDay ? 0 : +m[5], s: allDay ? 0 : +m[6], allDay, zone: m[7] ? 'Z' : params.TZID || null };
}

// "PT1H30M", "P1D": minutes.
function readDuration(value) {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(value).trim());
  if (!m) return null;
  return (m[1] === '-' ? -1 : 1) * ((+m[2] || 0) * 7 * 1440 + (+m[3] || 0) * 1440 + (+m[4] || 0) * 60 + (+m[5] || 0) + Math.round((+m[6] || 0) / 60));
}

// The file's events: { uid, title, location, start, end, duration, rrule,
// exdates, recurrenceId, cancelled }, and the calendar's name.
export function parseCalendar(text) {
  const events = [];
  let name = null;
  let ev = null;
  for (const { name: key, params, value } of lines(text)) {
    if (key === 'BEGIN' && value.toUpperCase() === 'VEVENT') { ev = { exdates: [] }; continue; }
    if (key === 'END' && value.toUpperCase() === 'VEVENT') { if (ev && ev.start) events.push(ev); ev = null; continue; }
    if (!ev) { if (key === 'X-WR-CALNAME' && value) name = unescape(value); continue; }
    if (key === 'UID') ev.uid = value;
    else if (key === 'SUMMARY') ev.title = unescape(value);
    else if (key === 'LOCATION') ev.location = unescape(value);
    else if (key === 'DTSTART') ev.start = readTime(value, params);
    else if (key === 'DTEND') ev.end = readTime(value, params);
    else if (key === 'DURATION') ev.duration = readDuration(value);
    else if (key === 'RRULE') ev.rrule = Object.fromEntries(value.split(';').map(p => p.split('=')).filter(p => p.length === 2).map(([k, v]) => [k.toUpperCase(), v]));
    else if (key === 'EXDATE') value.split(',').forEach(v => { const t = readTime(v, params); if (t) ev.exdates.push(t); });
    else if (key === 'RECURRENCE-ID') ev.recurrenceId = readTime(value, params);
    else if (key === 'STATUS') ev.cancelled = value.toUpperCase() === 'CANCELLED';
  }
  return { name, events };
}

// --- Times -------------------------------------------------------------------

// How far ahead of UTC a zone is at instant t, in minutes (Intl knows the rules).
function zoneOffset(t, zone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(t));
  const get = (k) => Number(parts.find(p => p.type === k).value);
  return Math.round((Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second')) - t) / 60000);
}

// A wall-clock time in its zone as a real instant (a Date).
function toInstant({ y, m, d, h, mi, s, zone }) {
  if (zone === 'Z') return new Date(Date.UTC(y, m - 1, d, h, mi, s));
  if (zone) {
    try {
      const guess = Date.UTC(y, m - 1, d, h, mi, s);
      let t = guess - zoneOffset(guess, zone) * 60000;
      t = guess - zoneOffset(t, zone) * 60000; // once more, across a change to or from daylight time
      return new Date(t);
    } catch { /* an unknown zone: read it as this computer's time */ }
  }
  return new Date(y, m - 1, d, h, mi, s);
}

const pad = (n) => String(n).padStart(2, '0');
const isoOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const wallDay = ({ y, m, d }) => `${y}-${pad(m)}-${pad(d)}`;
// Calendar arithmetic on a wall-clock time, keeping its hour and zone.
function shift(t, { days = 0, months = 0, years = 0 }) {
  const date = new Date(Date.UTC(t.y + years, t.m - 1 + months, t.d + days));
  return { ...t, y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
}
const weekday = (t) => new Date(Date.UTC(t.y, t.m - 1, t.d)).getUTCDay();
const DAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
// The same instant check for EXDATE and RECURRENCE-ID (all-day ones by day).
const sameOccurrence = (a, b) => (a.allDay || b.allDay ? wallDay(a) === wallDay(b) : toInstant(a).getTime() === toInstant(b).getTime());

// --- Occurrences -------------------------------------------------------------

const MAX_STEPS = 20000;

// Every start of an event (wall-clock times in its own zone), up to `last`
// (an ISO day, inclusive) or its COUNT or UNTIL.
function starts(ev, last) {
  const first = ev.start;
  if (!ev.rrule) return [first];
  const r = ev.rrule;
  const freq = (r.FREQ || '').toUpperCase();
  const interval = Math.max(1, parseInt(r.INTERVAL, 10) || 1);
  const count = r.COUNT ? parseInt(r.COUNT, 10) : Infinity;
  const until = r.UNTIL ? readTime(r.UNTIL, {}) : null;
  const untilAt = until ? (until.allDay ? null : toInstant(until).getTime()) : null;
  const past = (t) => (until && (until.allDay ? wallDay(t) > wallDay(until) : toInstant(t).getTime() > untilAt)) || wallDay(t) > last;
  const out = [];
  const byDay = freq === 'WEEKLY' && r.BYDAY ? r.BYDAY.split(',').map(x => DAYS[x.slice(-2).toUpperCase()]).filter(x => x !== undefined) : null;
  // Monthly by weekday: "1FR" is the first Friday, "-1FR" the last, "FR" every Friday.
  const byWeekdayInMonth = freq === 'MONTHLY' && r.BYDAY ? r.BYDAY.split(',').map(x => {
    const m = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/i.exec(x.trim());
    return m ? { n: m[1] ? parseInt(m[1], 10) : 0, wd: DAYS[m[2].toUpperCase()] } : null;
  }).filter(Boolean) : null;
  for (let i = 0, steps = 0; out.length < count && steps < MAX_STEPS; i++, steps++) {
    if ((freq === 'WEEKLY' && byDay) || (byWeekdayInMonth && byWeekdayInMonth.length)) {
      let days;
      if (freq === 'WEEKLY') {
        // Week i (from the start's week, Monday first unless WKST says), each day picked.
        const weekStart = shift(first, { days: i * 7 * interval - ((weekday(first) + 6) % 7) });
        days = byDay.map(wd => shift(weekStart, { days: (wd + 6) % 7 }));
      } else {
        // Month i, each picked weekday found in it.
        const monthStart = shift({ ...first, d: 1 }, { months: i * interval });
        days = [];
        for (const { n, wd } of byWeekdayInMonth) {
          const all = [];
          for (let t = shift(monthStart, { days: (wd - weekday(monthStart) + 7) % 7 }); t.m === monthStart.m; t = shift(t, { days: 7 })) all.push(t);
          if (!n) days.push(...all);
          else if (all[n > 0 ? n - 1 : all.length + n]) days.push(all[n > 0 ? n - 1 : all.length + n]);
        }
        days = days.filter((t, k) => days.findIndex(o => wallDay(o) === wallDay(t)) === k);
      }
      days.sort((a, b) => (wallDay(a) < wallDay(b) ? -1 : 1));
      let done = false;
      for (const t of days) {
        if (wallDay(t) < wallDay(first)) continue;
        if (past(t) || out.length >= count) { done = true; break; }
        out.push(t);
      }
      if (done) break;
      continue;
    }
    const t = freq === 'DAILY' ? shift(first, { days: i * interval })
      : freq === 'WEEKLY' ? shift(first, { days: i * 7 * interval })
        : freq === 'MONTHLY' ? shift(first, { months: i * interval })
          : freq === 'YEARLY' ? shift(first, { years: i * interval }) : null;
    // A repeat this doesn't know (hourly, say) still shows its first time.
    if (!t) { if (!out.length && !past(first)) out.push(first); break; }
    if (past(t)) break;
    // A 31st in a shorter month doesn't happen (as in RFC 5545).
    if ((freq === 'MONTHLY' || freq === 'YEARLY') && t.d !== first.d) continue;
    out.push(t);
  }
  return out;
}

// The events between two ISO days (inclusive) as items for the day plan:
// { key, title, location, date, time (minutes, or null all day), duration,
// allDay }. An all-day event over several days shows on each (up to two weeks).
export function calendarItems(parsed, from, to) {
  const moved = new Map(); // uid -> occurrences moved or changed (RECURRENCE-ID)
  parsed.events.filter(ev => ev.recurrenceId).forEach(ev => {
    if (!moved.has(ev.uid)) moved.set(ev.uid, []);
    moved.get(ev.uid).push(ev);
  });
  const items = [];
  const add = (ev, t) => {
    const begin = toInstant(t);
    const length = ev.duration != null ? ev.duration
      : ev.end ? Math.round((toInstant(ev.end) - toInstant(ev.start)) / 60000) : (t.allDay ? 1440 : 0);
    if (t.allDay) {
      const days = Math.min(14, Math.max(1, Math.round(length / 1440)));
      for (let i = 0; i < days; i++) {
        const day = wallDay(shift(t, { days: i }));
        if (day >= from && day <= to) items.push({ key: `${ev.uid || ev.title}@${day}`, title: ev.title || 'Busy', location: ev.location || null, date: day, time: null, duration: null, allDay: true });
      }
      return;
    }
    const day = isoOf(begin);
    if (day < from || day > to) return;
    items.push({ key: `${ev.uid || ev.title}@${begin.getTime()}`, title: ev.title || 'Busy', location: ev.location || null, date: day, time: begin.getHours() * 60 + begin.getMinutes(), duration: Math.max(0, length), allDay: false });
  };
  parsed.events.forEach(ev => {
    if (ev.cancelled || ev.recurrenceId) return;
    const changed = moved.get(ev.uid) || [];
    starts(ev, to).forEach(t => {
      if (ev.exdates.some(x => sameOccurrence(x, t))) return;
      if (changed.some(c => sameOccurrence(c.recurrenceId, t))) return; // replaced below
      add(ev, t);
    });
  });
  moved.forEach(list => list.forEach(ev => { if (!ev.cancelled) add(ev, ev.start); }));
  return items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time ?? -1) - (b.time ?? -1)));
}
