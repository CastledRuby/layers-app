// The activity calendar (docs/roadmap.md, "The plan from here", step 5): the
// last six months of logs as a grid of days, weeks across and Monday to
// Sunday down, each day shaded by how many logs and how meaningful they were.
// Shown on a profile (that person's logs) and on the Journal (everyone's).

import { MONTH_NAMES, parseISODay, toISODate } from './dates.js';

export const ACTIVITY_WEEKS = 26;

// How dark a day is, 0 (nothing) to 4, from the meaningfulness of its logs
// added up: one brief chat is light, a deep one or a few good ones dark.
export function activityLevel(score) {
  return score <= 0 ? 0 : score <= 3 ? 1 : score <= 6 ? 2 : score <= 10 ? 3 : 4;
}

// { weeks: [[{ day, count, score, level, future }] x 7] x ACTIVITY_WEEKS,
// months: [{ col, label }] where a month starts, total: logs in the grid }.
// The last column is this week (Monday to Sunday); days after today are
// marked `future`.
export function activityGrid(journal, today, weeks = ACTIVITY_WEEKS) {
  const byDay = new Map();
  (journal || []).forEach(j => {
    if (!j || typeof j.at !== 'string') return;
    const was = byDay.get(j.at) || { count: 0, score: 0 };
    byDay.set(j.at, { count: was.count + 1, score: was.score + (Number(j.meaningfulness) || 1) });
  });
  const now = parseISODay(today);
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) - (weeks - 1) * 7);
  const grid = [];
  const months = [];
  let total = 0;
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + w * 7 + d);
      const day = toISODate(date);
      const got = byDay.get(day) || { count: 0, score: 0 };
      total += day <= today ? got.count : 0;
      col.push({ day, count: got.count, score: got.score, level: activityLevel(got.score), future: day > today });
      if (date.getDate() === 1 || (w === 0 && d === 0)) months.push({ col: w, label: MONTH_NAMES[date.getMonth()].slice(0, 3) });
    }
    grid.push(col);
  }
  // A label right next to another would overlap: keep the later one.
  const spaced = months.filter((m, i) => !months[i + 1] || months[i + 1].col - m.col >= 3);
  return { weeks: grid, months: spaced, total };
}
