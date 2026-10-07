// Skills over time from analysed chats (docs/renderer/state-and-data.md,
// "Skills over time"): the scores Claude gave the chats you logged (journal
// entries with analysis.grading), as points to chart, one per day, for one
// person or everyone.

import { formatAbsoluteDate, parseISODay } from './dates.js';

// What's charted, from each analysis's grading.
export const TREND_LINES = [
  { key: 'listening', from: 'activeListening', label: 'Listening' },
  { key: 'depth', from: 'depth', label: 'Depth' },
  { key: 'balance', from: 'reciprocity', label: 'Balance' },
  { key: 'naturalness', from: 'naturalness', label: 'Naturalness' },
];

// [{ at, date, listening, depth, balance, naturalness, overall, chats }],
// oldest first: each day's analysed chats averaged. With everyone, a group
// chat (logged once per person, the same scores) counts once.
export function chatTrend(journal = [], personId = null, now = new Date()) {
  const seen = new Set();
  const days = new Map();
  journal.forEach(j => {
    const g = j && j.analysis && j.analysis.grading;
    if (!g || typeof g.overall !== 'number' || !j.at || (personId && j.personId !== personId)) return;
    const same = `${j.at}|${JSON.stringify(g)}`;
    if (!personId) { if (seen.has(same)) return; seen.add(same); }
    if (!days.has(j.at)) days.set(j.at, []);
    days.get(j.at).push(g);
  });
  const avg = (list, k) => {
    const nums = list.map(g => g[k]).filter(n => typeof n === 'number');
    return nums.length ? Math.round(nums.reduce((s, n) => s + n, 0) / nums.length) : null;
  };
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([at, list]) => ({
    at,
    date: formatAbsoluteDate(parseISODay(at), now),
    ...Object.fromEntries(TREND_LINES.map(l => [l.key, avg(list, l.from)])),
    overall: avg(list, 'overall'),
    chats: list.length,
  }));
}

// Since the first point: { listening: +12, ... } (null with under two points).
export function trendChange(points) {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  return Object.fromEntries(TREND_LINES.map(l => [l.key, first[l.key] === null || last[l.key] === null ? null : last[l.key] - first[l.key]]));
}
