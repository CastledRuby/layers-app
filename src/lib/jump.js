// Ctrl+K, "jump to anything": what matches what's been typed, best first.
// People, plans (two weeks back to four ahead), pages and actions, plus
// "plan priya", "log sam" and "prep alex" for a person, and a typed plan or
// log read by lib/sentence.js ("coffee with priya fri 10am"). JumpSheet shows
// the rows and LayersApp runs the one picked (`run`). See
// docs/renderer/app-structure.md.

import { getLayer } from '../data/constants.js';
import { occursOn, templateFor } from './calendar.js';
import { formatTime12, MONTH_NAMES, parseISODay, toISODate, WEEKDAY_SHORT } from './dates.js';
import { readSentence } from './sentence.js';

export const MAX_ROWS = 8;

// The pages, and the actions; `needs` hides one this build can't do.
export const PAGES = [
  { id: 'page:today', label: 'Today', sub: 'Your day', emoji: '📅', words: ['calendar', 'day', 'home'], run: { type: 'tab', tab: 'today', mode: 'day' } },
  { id: 'page:month', label: 'Month', sub: 'The month grid', emoji: '🗓️', words: ['calendar', 'month'], run: { type: 'tab', tab: 'today', mode: 'month' } },
  { id: 'page:people', label: 'People', sub: 'Everyone, by how close you are', emoji: '👥', words: ['layers', 'friends', 'map'], run: { type: 'tab', tab: 'people' } },
  { id: 'page:coach', label: 'Coach', sub: 'Prepare and Analyse', emoji: '💬', words: ['prepare', 'analyse', 'tips'], run: { type: 'tab', tab: 'coach' } },
  { id: 'page:journal', label: 'Journal', sub: 'Everything logged', emoji: '📖', words: ['history', 'logs', 'entries'], run: { type: 'tab', tab: 'journal' } },
  { id: 'page:me', label: 'Me', sub: 'Profile, settings and backups', emoji: '🙂', words: ['settings', 'profile', 'notifications'], run: { type: 'tab', tab: 'me' } },
  { id: 'page:goals', label: 'Goals', sub: 'Every goal', emoji: '🎯', words: ['targets'], run: { type: 'goals' } },
  { id: 'page:week', label: 'Your week', sub: 'Who you saw, then plan next week', emoji: '🗓️', words: ['review', 'weekly'], run: { type: 'review' } },
];
export const ACTIONS = [
  { id: 'act:log', label: 'Log an interaction', emoji: '✍️', words: ['log', 'new log', 'quick log'], run: { type: 'action', key: 'log' } },
  { id: 'act:plan', label: 'Plan something', emoji: '➕', words: ['plan', 'new plan', 'event', 'add plan'], run: { type: 'action', key: 'plan' } },
  { id: 'act:person', label: 'Add a person', emoji: '🧑', words: ['add person', 'new person', 'friend'], run: { type: 'action', key: 'addPerson' } },
  { id: 'act:goal', label: 'New goal', emoji: '🎯', words: ['add goal', 'goal'], run: { type: 'action', key: 'goal' } },
  { id: 'act:photos', label: 'Add photos from a folder', emoji: '🖼️', words: ['photos', 'pictures', 'profile pictures', 'pfp', 'avatars', 'folder'], run: { type: 'action', key: 'photos' } },
  { id: 'act:light', label: 'Light mode', emoji: '☀️', words: ['theme', 'appearance', 'light'], run: { type: 'action', key: 'light' } },
  { id: 'act:dark', label: 'Dark mode', emoji: '🌙', words: ['theme', 'appearance', 'night'], run: { type: 'action', key: 'dark' } },
  { id: 'act:system', label: 'Match Windows', sub: 'Light or dark, as Windows is', emoji: '🖥️', words: ['theme', 'appearance', 'system', 'auto'], run: { type: 'action', key: 'system' } },
  { id: 'act:export', label: 'Export a backup', emoji: '💾', words: ['backup', 'save', 'download'], run: { type: 'action', key: 'export' } },
  { id: 'act:restore', label: 'Restore from a backup', emoji: '📥', words: ['import', 'load', 'backup'], run: { type: 'action', key: 'restore' } },
  { id: 'act:backups', label: 'Open the backups folder', emoji: '📂', words: ['backups', 'folder', 'daily'], needs: 'bridge', run: { type: 'action', key: 'backups' } },
  { id: 'act:updates', label: 'Check for updates', emoji: '⬆️', words: ['update', 'version'], needs: 'updater', run: { type: 'action', key: 'updates' } },
  { id: 'act:keys', label: 'Keyboard shortcuts', emoji: '⌨️', words: ['keys', 'help', 'shortcuts'], run: { type: 'action', key: 'shortcuts' } },
  { id: 'act:startover', label: 'Delete my data and start over', emoji: '🧹', words: ['start over', 'reset', 'clear', 'delete'], run: { type: 'action', key: 'startOver' } },
];
// "plan priya": the verbs that go straight to a person's action.
const VERBS = { plan: 'plan', log: 'log', prep: 'prepare', prepare: 'prepare', open: 'open', see: 'open' };
// Each has a key, pressed once its person's actions show (→ or Tab).
export const PERSON_ACTIONS = [
  { action: 'open', key: 'O', label: (n) => `Open ${n}`, emoji: '👤' },
  { action: 'log', key: 'L', label: (n) => `Log with ${n}`, emoji: '✍️' },
  { action: 'plan', key: 'P', label: (n) => `Plan with ${n}`, emoji: '📅' },
  { action: 'prepare', key: 'R', label: (n) => `Prepare to talk with ${n}`, emoji: '💬' },
  { action: 'recheck', key: 'W', label: (n) => `Where are you now with ${n}?`, emoji: '🧭' },
];

const addDays = (day, n) => { const d = parseISODay(day); return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
export const shortDate = (day) => { const d = parseISODay(day); return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`; };

// How well `text` (and its extra words) matches the query: 0 for not at all.
export function matchScore(text, q, words = []) {
  const t = text.toLowerCase();
  if (!q) return 0;
  if (t === q) return 120;
  if (t.startsWith(q)) return 100;
  const parts = t.split(/[\s,·:]+/).filter(Boolean);
  if (parts.some(w => w.startsWith(q))) return 80;
  if (q.length >= 2 && parts.map(w => w[0]).join('').startsWith(q.replace(/\s+/g, ''))) return 60;
  if (words.some(w => w.startsWith(q) || q.startsWith(w))) return 50;
  if (t.includes(q)) return 40;
  return 0;
}

export function personRow(p) {
  return { id: `person:${p.id}`, group: 'person', label: p.name, sub: `Layer ${p.layer} · ${getLayer(p.layer).name}`, emoji: p.emoji, person: p, run: { type: 'person', id: p.id } };
}
export function personActionRows(p) {
  return PERSON_ACTIONS.map(a => ({ id: `${a.action}:${p.id}`, group: 'action', key: a.key, label: a.label(p.name), emoji: a.emoji, person: p, run: { type: 'personAction', action: a.action, id: p.id } }));
}

// Plans from two weeks back to four ahead, each on its next (or last) day.
export function planRows(events, people, today) {
  const rows = [];
  events.forEach(ev => {
    let day = null;
    if (ev.kind === 'oneoff') day = ev.date >= addDays(today, -14) && ev.date <= addDays(today, 28) ? ev.date : null;
    else for (let n = 0; n <= 7 && !day; n++) if (occursOn(ev, addDays(today, n))) day = addDays(today, n);
    if (!day) return;
    const who = (ev.personIds || []).map(id => people.find(p => p.id === id)).filter(Boolean);
    const t = templateFor(ev.template);
    const when = `${day === today ? 'Today' : shortDate(day)}${typeof ev.time === 'number' && !ev.allDay ? `, ${formatTime12(ev.time)}` : ''}`;
    rows.push({
      id: `plan:${ev.id}`, group: 'plan', label: ev.title, sub: `${when}${who.length ? ` · with ${who.map(p => p.name).join(', ')}` : ''}`,
      emoji: t ? t.emoji : '📌', day, words: who.map(p => p.name.toLowerCase()), run: { type: 'plan', eventId: ev.id, day },
    });
  });
  return rows.sort((a, b) => (a.day < today) - (b.day < today) || a.day.localeCompare(b.day));
}

// The row for a typed plan or log, if the query reads as one: two words or
// more, and a plan with nothing missing or a log with someone in it.
export function sentenceRow(query, { people, today, now }) {
  if (query.trim().split(/\s+/).length < 2) return null;
  const r = readSentence(query, { people, today, now });
  if (!r) return null;
  const who = r.personIds.map(id => people.find(p => p.id === id).name);
  if (r.kind === 'plan' && !r.missing.length) {
    const when = r.repeat === 'daily' ? 'every day' : r.repeat === 'weekly' ? `every ${r.weekdays.map(d => WEEKDAY_SHORT[d]).join(', ')}` : r.day === today ? 'today' : shortDate(r.day);
    return { id: 'sentence', group: 'sentence', label: `Plan: ${r.title}`, sub: `${when}${r.allDay ? ', all day' : `, ${formatTime12(r.time)}`}${r.unknown.length ? ` · not in Layers: ${r.unknown.join(', ')}` : ''}`, emoji: '📅', sentence: r, run: { type: 'sentence' } };
  }
  if (r.kind === 'log' && r.personIds.length) {
    return { id: 'sentence', group: 'sentence', label: `Log: ${who.join(', ')}`, sub: `${r.day === today ? 'Today' : shortDate(r.day)}${r.meaningfulness ? `, ${['very brief', 'casual', 'good', 'personal', 'deep'][r.meaningfulness - 1]}` : ' · how it went next'}`, emoji: '✍️', sentence: r, run: { type: 'sentence' } };
  }
  return null;
}

// The rows for a query (MAX_ROWS at most). Empty, it's the next plan, what
// you jumped to lately (`recent`, rows saved by JumpSheet) and Log and Plan.
export function jumpResults(query, { people = [], events = [], today, now = new Date(), recent = [], has = {} } = {}) {
  const q = query.trim().toLowerCase();
  const actions = ACTIONS.filter(a => !a.needs || has[a.needs]);
  const plans = planRows(events, people, today);
  if (!q) {
    const next = plans.find(r => r.day >= today);
    const rows = [...(next ? [{ ...next, sub: `Next · ${next.sub}` }] : []), ...recent, actions[0], actions[1]];
    return rows.filter((r, i) => rows.findIndex(x => x.id === r.id) === i).slice(0, MAX_ROWS);
  }
  // "plan priya": straight to that person's action.
  const [verb, ...restWords] = q.split(/\s+/);
  const rest = restWords.join(' ');
  const verbRows = VERBS[verb] && rest
    ? people.filter(p => matchScore(p.name, rest) > 0).slice(0, 3).map(p => personActionRows(p).find(r => r.run.action === VERBS[verb]))
    : [];
  const sentence = sentenceRow(query, { people, today, now });
  const scored = [
    ...people.map(p => { const s = Math.max(matchScore(p.name, q), ...(p.aka || []).map(n => matchScore(n, q))); return { row: personRow(p), score: s && s + 5 }; }),
    ...plans.map(r => ({ row: r, score: Math.max(matchScore(r.label, q), matchScore('', q, r.words)) })),
    ...PAGES.map(r => ({ row: { ...r, group: 'page' }, score: matchScore(r.label, q, r.words) })),
    ...actions.map(r => ({ row: { ...r, group: 'action' }, score: matchScore(r.label, q, r.words) })),
  ].filter(x => x.score > 0).sort((a, b) => b.score - a.score);
  const rows = [...verbRows, ...(sentence ? [sentence] : []), ...scored.map(x => x.row)];
  return rows.filter((r, i) => rows.findIndex(x => x.id === r.id) === i).slice(0, MAX_ROWS);
}
