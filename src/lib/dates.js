// Date handling. Records store an ISO `at` day and labels are derived when
// rendered; see docs/renderer/state-and-data.md ("Dates").

import { CATEGORIES } from '../data/constants.js';

export function parseDaysAgo(str) {
  if (!str) return 999;
  const s = String(str).toLowerCase();
  if (s.includes('just now') || s === 'today') return 0;
  if (s === 'yesterday') return 1;
  let m = s.match(/(\d+)\s*day/); if (m) return parseInt(m[1], 10);
  m = s.match(/(\d+)\s*week/); if (m) return parseInt(m[1], 10) * 7;
  m = s.match(/(\d+)\s*month/); if (m) return parseInt(m[1], 10) * 30;
  return 999;
}

// --- Date helpers for the calendar picker (item request: "timestamp buttons
// with working calendar"). Journal entries store the picked day as an ISO
// `at` date and derive their 'Today' / '2 days ago' label from it when
// rendered (see storedDay below), as do info items and timeline steps.
// Events (which can be in the future) store a real ISO date,
// since "3 days ago" doesn't make sense for something that hasn't happened yet.
export function startOfDay(d) { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; }

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function formatWeekdays(days) {
  if (!days || days.length === 0) return '';
  if (days.length === 7) return 'Every day';
  const sorted = [...days].sort((a, b) => a - b);
  let contiguous = true;
  for (let i = 1; i < sorted.length; i++) { if (sorted[i] !== sorted[i - 1] + 1) { contiguous = false; break; } }
  if (contiguous && sorted.length > 2) return `Every ${WEEKDAY_FULL[sorted[0]]}\u2013${WEEKDAY_FULL[sorted[sorted.length - 1]]}`;
  return `Every ${sorted.map(d => WEEKDAY_SHORT[d]).join(', ')}`;
}

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function dateToRelativeLabel(date, now = new Date()) {
  const today = startOfDay(now);
  const d = startOfDay(date);
  const diffDays = Math.round((today - d) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) { const w = Math.round(diffDays / 7); return `${w} week${w > 1 ? 's' : ''} ago`; }
  const mo = Math.round(diffDays / 30); return `${mo} month${mo > 1 ? 's' : ''} ago`;
}

export function formatCalendarDate(date) {
  const today = startOfDay(new Date());
  const d = startOfDay(date);
  if (d.getTime() === today.getTime()) return 'Today';
  const yest = startOfDay(new Date(today)); yest.setDate(yest.getDate() - 1);
  if (d.getTime() === yest.getTime()) return 'Yesterday';
  const tom = startOfDay(new Date(today)); tom.setDate(tom.getDate() + 1);
  if (d.getTime() === tom.getTime()) return 'Tomorrow';
  return `${WEEKDAY_SHORT[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;
}

export function toISODate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

// Chart/timeline history points (person.history, goal.history) need a date
// that stays correct forever, unlike the app's relative Journal labels
// ("Today", "3 days ago") which are meant to go stale-looking over time.
// Each new point gets a short absolute label ("Sep 12") plus a real ISO
// date (`at`) used purely for sorting, so a backdated entry (picked via the
// calendar) always lands in its correct chronological position on the
// chart regardless of when it was actually logged.
export function formatAbsoluteDate(d, now = new Date()) {
  const label = `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  return d.getFullYear() !== now.getFullYear() ? `${label}, ${d.getFullYear()}` : label;
}

function parseAbsoluteLabel(label, now = new Date()) {
  // Sample data uses labels like "Aug 20" or "Aug 20, 2025" (no `at` field).
  // Parsed properly here so distinct sample dates get distinct sort keys —
  // previously any label that didn't match the relative-label scheme fell
  // into one shared fallback bucket, which could silently merge separate
  // history points that happened to both be unparseable.
  const m = String(label).match(/^([A-Za-z]{3,9})\s+(\d{1,2})(?:,\s*(\d{4}))?$/);
  if (!m) return null;
  const monthIdx = MONTH_NAMES.findIndex(mn => mn.toLowerCase().startsWith(m[1].toLowerCase()));
  if (monthIdx === -1) return null;
  const day = parseInt(m[2], 10);
  const year = m[3] ? parseInt(m[3], 10) : now.getFullYear();
  let d = new Date(year, monthIdx, day);
  if (!m[3] && d > now) d = new Date(year - 1, monthIdx, day); // no year given and it'd be in the future -> assume last year
  return d;
}

function historySortKey(h) {
  if (h.at) return h.at; // 'YYYY-MM-DD' — sorts correctly as a plain string
  // Legacy entries from before the `at` field existed only ever used the
  // relative-label scheme ('Today', '3 days ago', ...), so infer a real
  // date from that label rather than treating "no `at`" as "always first".
  const daysAgo = parseDaysAgo(h.date);
  if (daysAgo !== 999) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return toISODate(d);
  }
  const parsed = parseAbsoluteLabel(h.date);
  if (parsed) return toISODate(parsed);
  // Truly unparseable — keep it, just don't let it collide with any other
  // unparseable entry (append the original label so each stays distinct).
  return `0000-01-01#${h.date}`;
}

export function sortHistory(arr) {
  // Dedupe by day (last occurrence wins) as well as sort — this means any
  // duplicate points already sitting in saved data from before this fix
  // existed get cleaned up automatically on display, not just new ones.
  const byKey = new Map();
  for (const h of arr) byKey.set(historySortKey(h), h);
  return [...byKey.values()]
    .sort((a, b) => historySortKey(a).localeCompare(historySortKey(b)))
    // Guarantee every plotted point has a real, non-empty label — no
    // matter how it got here, the chart should never show a blank tick.
    .map(h => (h.date && String(h.date).trim()) ? h : { ...h, date: h.at ? formatAbsoluteDate(new Date(h.at + 'T00:00:00')) : '—' });
}

// Logging twice in the same day used to add a second chart point with the
// same label ("Sep 12" appearing twice), which just looks like a glitch on
// a small chart. A day is the chart's real granularity, so a same-day log
// now updates that day's point in place instead of stacking another one.
export function pushHistoryPoint(history, point) {
  return sortHistory([...history, point]);
}

// Journal entries, info items ("Last mentioned") and timeline steps all store
// their day as `at` ('YYYY-MM-DD'), and the 'Today' / '3 days ago' label is
// derived from it at render time. They used to store the label itself,
// computed once, so anything saved as 'Today' read 'Today' forever. A record
// without a usable `at` falls back to its old label — journal `date`, info
// item `updated`, timeline `date` — read as of `now`.
function parseISODay(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function storedDay(at, legacyLabel, now = new Date()) {
  const d = parseISODay(at);
  if (d) return d;
  const daysAgo = parseDaysAgo(legacyLabel);
  if (daysAgo !== 999) { const day = startOfDay(now); day.setDate(day.getDate() - daysAgo); return day; }
  return legacyLabel ? parseAbsoluteLabel(legacyLabel, now) : null;
}

// 999 for a record with no readable date, matching parseDaysAgo's "long ago".
function storedDaysAgo(at, legacyLabel, now = new Date()) {
  const d = storedDay(at, legacyLabel, now);
  return d ? Math.max(0, Math.round((startOfDay(now) - d) / 86400000)) : 999;
}

function storedDateLabel(at, legacyLabel, now = new Date()) {
  const d = storedDay(at, legacyLabel, now);
  return d ? dateToRelativeLabel(d, now) : String(legacyLabel || '—');
}

export function journalDaysAgo(entry, now = new Date()) { return storedDaysAgo(entry && entry.at, entry && entry.date, now); }

export function journalDateLabel(entry, now = new Date()) { return storedDateLabel(entry && entry.at, entry && entry.date, now); }

// A rolling 7 days, not the calendar week.
export function isJournalThisWeek(entry, now = new Date()) { return journalDaysAgo(entry, now) < 7; }

export function infoItemDaysAgo(item, now = new Date()) { return storedDaysAgo(item && item.at, item && item.updated, now); }

export function infoItemDateLabel(item, now = new Date()) { return storedDateLabel(item && item.at, item && item.updated, now); }

// The timeline is a record of when things happened, so it always shows the
// calendar date ('Sep 26', or 'Aug 4, 2025' in another year), never '2 weeks
// ago'. A step with no date at all (the "Current: <layer>" step) keeps its
// text, e.g. 'Now'.
export function timelineDateLabel(step, now = new Date()) {
  const d = storedDay(step && step.at, step && step.date, now);
  return d ? formatAbsoluteDate(d, now) : String((step && step.date) || '—');
}

// Gives legacy records (saved before `at` existed) a fixed `at`, on load and
// on import. A stored relative label doesn't say *when* it was 'Today', so
// it's read as of `anchor`: now (the first launch after this change) for
// saved data, or a backup's `exportedAt`, since no label in a backup can be
// newer than the export. Either way an old record is never dated earlier
// than it really happened, so nobody is flagged as "haven't caught up"
// sooner than they should be. Absolute seed labels ('Aug 31') parse
// exactly. Records with no readable date are left as they are.
function backfillAnchor(anchor) {
  const parsed = anchor ? new Date(anchor) : new Date();
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function backfillDated(records, legacyKey, ref, staleKeys = []) {
  return records.map(r => {
    if (!r || parseISODay(r.at)) return r;
    const d = storedDay(r.at, r[legacyKey], ref);
    if (!d) return r;
    const next = { ...r, at: toISODate(d) };
    [legacyKey, ...staleKeys].forEach(k => { delete next[k]; }); // stale once `at` exists; nothing reads them
    return next;
  });
}

export function backfillJournalDates(journal, anchor) {
  return backfillDated(journal, 'date', backfillAnchor(anchor), ['isThisWeek']);
}

export function backfillPeopleDates(people, anchor) {
  const ref = backfillAnchor(anchor);
  return people.map(p => {
    if (!p || typeof p !== 'object') return p;
    const next = { ...p };
    CATEGORIES.forEach(c => { if (Array.isArray(p[c.key])) next[c.key] = backfillDated(p[c.key], 'updated', ref); });
    if (Array.isArray(p.timeline)) next.timeline = backfillDated(p.timeline, 'date', ref);
    return next;
  });
}

// Minutes-since-midnight is the source of truth for TimeDropdown; formatted
// as h:mm AM/PM for display and stored on events as a plain integer.
export function formatTime12(totalMinutes) {
  if (totalMinutes == null) return '';
  let h = Math.floor(totalMinutes / 60); const m = totalMinutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${period}`;
}

export function nowToMinutes() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
