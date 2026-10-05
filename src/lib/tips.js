// Coach tips for one plan, shown from the day popup (DaySheet) and the plan
// itself (EventSheet): tips for the kind of plan (PLAN_TIPS, by template),
// then for each person what's saved about them (Prepare's hooks: what to
// follow up on, what you last talked about and noted, their interests and
// plans), their key dates around the plan, and the goal the plan moves.
// Everything comes from templates and saved data; nothing is made up.

import { PLAN_TIPS, presetMeta } from '../data/constants.js';
import { keyDateLabel, keyDateOn, templateFor } from './calendar.js';
import { parseISODay, toISODate } from './dates.js';
import { buildPotentialHooks } from './text.js';

const SOON_DAYS = 14;
const addDays = (day, n) => { const d = parseISODay(day); return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };

// A person's key dates from the plan's day to two weeks after it, soonest
// first: [{ label, inDays }].
export function datesAround(person, day) {
  const out = [];
  for (let n = 0; n <= SOON_DAYS; n++) {
    const on = addDays(day, n);
    (person.dates || []).forEach(kd => { if (keyDateOn(kd, on)) out.push({ label: keyDateLabel(person, kd), inDays: n }); });
  }
  return out;
}

// { activity: { label, emoji, tips }, people: [{ person, hooks, dates,
// lighter }], goal: { title, tip } | null }. `lighter` is set for Layer 1
// and 2: Social Penetration Theory keeps personal topics for later.
export function planTips(ev, { people = [], journal = [], generalGoals = [] }, day, now = new Date()) {
  const template = templateFor(ev.template) || templateFor('custom');
  const who = (ev.personIds || []).map(id => people.find(p => p.id === id)).filter(Boolean);
  const goals = [...people.flatMap(p => p.goals || []), ...generalGoals];
  const goal = ev.goalId ? goals.find(g => g.id === ev.goalId) : null;
  const preset = goal ? presetMeta(goal.type) : null;
  return {
    activity: { label: template.label, emoji: template.emoji, tips: PLAN_TIPS[template.key] || PLAN_TIPS.custom },
    people: who.map(person => ({
      person,
      hooks: buildPotentialHooks(person, journal, now).slice(0, 4),
      dates: datesAround(person, day),
      lighter: person.layer <= 2,
    })),
    goal: goal && goal.progress < 100 ? { title: goal.title, tip: preset ? preset.suggestion : null } : null,
  };
}
