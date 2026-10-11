// The log's questions, written for each person (decided 2026-10-12). Each
// part is asked with their name and in the words of where you are with them:
// "deep" with someone new is getting past small talk, with a close friend
// it's talking about what really matters. The parts a goal with them is
// about come first, their weakest part is marked, and anything saved about
// them worth asking after becomes a yes-or-no question.

import { DIM_ORDER, GOAL_PRESET_DIM } from '../data/constants.js';
import { parseISODay, toISODate } from './dates.js';

const firstName = (p) => String((p && p.name) || '').trim().split(/\s+/)[0] || 'them';

// Each part's question at each layer (1 Orientation to 4 Close); n is
// their first name.
const QUESTIONS = {
  depth: {
    1: n => `How far past small talk did you get with ${n}?`,
    2: n => `How much did you get into what ${n} likes and thinks?`,
    3: n => `How much did ${n} share how they feel?`,
    4: n => `How much did you and ${n} talk about what really matters?`,
  },
  trust: {
    1: n => `How at ease did ${n} seem with you?`,
    2: n => `How much did ${n} tell you about themselves?`,
    3: n => `How much did ${n} open up about something personal?`,
    4: n => `How much did you and ${n} lean on each other?`,
  },
  reciprocity: {
    1: n => `How much did ${n} ask about you too?`,
    2: n => `How evenly did you and ${n} ask and share?`,
    3: n => `When ${n} opened up, how much did you share back?`,
    4: n => `How evenly did you and ${n} support each other?`,
  },
  interaction: {
    1: n => `How engaged was ${n}?`,
    2: n => `How much did ${n} bring up things to talk about?`,
    3: n => `How into it were you and ${n}?`,
    4: n => `How easy and natural did it feel with ${n}?`,
  },
  sharedExperiences: {
    1: n => `How much did you and ${n} do together, beyond talking?`,
    2: n => `How much did you find that you and ${n} both enjoy?`,
    3: n => `How much of a memory or a plan did you and ${n} make?`,
    4: n => `How much did it add to what you and ${n} share?`,
  },
  listening: {
    1: n => `How well did you listen to ${n}?`,
    2: n => `How well did you follow up on what ${n} said?`,
    3: n => `How heard did ${n} seem when they shared?`,
    4: n => `How well did you and ${n} really hear each other?`,
  },
};

export function dimQuestion(dim, person) {
  const layer = Math.min(4, Math.max(1, Number(person && person.layer) || 1));
  return QUESTIONS[dim][layer](firstName(person));
}

// Their six parts in the order to ask them: { dim, question, goal (the title
// of an active goal with them about this part, or null), weakest }. The
// goals' parts come first; the rest keep their usual order. Nothing is
// marked weakest while every part is level (someone just added).
export function rateRows(person) {
  const goals = new Map();
  ((person && person.goals) || []).filter(g => g && g.progress < 100).forEach(g => {
    const dim = GOAL_PRESET_DIM[g.type];
    if (dim && !goals.has(dim)) goals.set(dim, g.title);
  });
  const dims = (person && person.dims) || {};
  const level = (k) => Number(dims[k]) || 0;
  const low = Math.min(...DIM_ORDER.map(level));
  const high = Math.max(...DIM_ORDER.map(level));
  const weakest = low < high ? DIM_ORDER.find(k => level(k) === low) : null;
  const rows = DIM_ORDER.map(dim => ({ dim, question: dimQuestion(dim, person), goal: goals.get(dim) || null, weakest: dim === weakest }));
  return [...rows.filter(r => r.goal), ...rows.filter(r => !r.goal)];
}

// What's saved about them worth asking after on `day` (an ISO day): what's
// important right now (an exam, being unwell), from the last 30 days or
// with its day within two weeks either side, and plans whose day was in the
// two weeks up to it. The newest two.
export function followUps(person, day = toISODate(new Date())) {
  const shift = (n) => { const d = parseISODay(day) || new Date(); d.setDate(d.getDate() + n); return toISODate(d); };
  const twoWeeksBefore = shift(-14);
  const twoWeeksAfter = shift(14);
  const monthBefore = shift(-30);
  const live = (cat) => ((person && person[cat]) || []).filter(it => it && !it.archived && typeof it.text === 'string' && it.text.trim());
  const important = live('important').filter(it => (typeof it.when === 'string' && it.when
    ? it.when >= twoWeeksBefore && it.when <= twoWeeksAfter
    : typeof it.at === 'string' && it.at >= monthBefore && it.at <= day));
  const plans = live('plans').filter(it => typeof it.when === 'string' && it.when >= twoWeeksBefore && it.when <= day);
  const newest = (it) => it.when || it.at || '';
  return [...important, ...plans]
    .sort((a, b) => newest(b).localeCompare(newest(a)))
    .slice(0, 2)
    .map(it => ({ id: it.id, text: it.text.trim(), question: `Did you ask ${firstName(person)} about "${it.text.trim()}"?` }));
}
