// The big picture (decided 2026-10-10, docs/roadmap.md): Claude's read of
// your week in Sunday's "Your week". What's sent is the week's logs (who, the
// kind, how meaningful, the note, and for analysed chats Claude's scores and
// review) and who you haven't seen in a while, every name a tag; the answer
// is a headline, what went well, a pattern, one thing to try and who to
// reach out to. Asked once a week, through the same main-process call as
// Analyse, and kept on this laptop.
import { ML_LABELS, TYPE_META } from '../data/constants.js';
import { analysisModel, DEFAULT_ANALYSIS_MODEL, restoreNames, tokensFor } from './analysis.js';
import { hideCircle } from './replies.js';
import { parseISODay } from './dates.js';

const str = { type: 'string' };
const obj = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_LOGS = 30;

export const WEEK_SCHEMA = obj({ headline: str, wentWell: str, pattern: str, tryThisWeek: str, reachOut: str });

// { request: { system, content, schema, model }, who: the people it tags, in
// order (for weekReadResult) }, or null when nothing was logged that week.
// from, to: the week's first and last day; quiet: planIdeas' [{ person, days }].
export function weekReadRequest({ from, to, people = [], journal = [], quiet = [], yourName = '', model = DEFAULT_ANALYSIS_MODEL }) {
  const logs = journal.filter(j => j && j.at >= from && j.at <= to).slice().sort((a, b) => a.at.localeCompare(b.at)).slice(-MAX_LOGS);
  if (!logs.length) return null;
  const ids = [...new Set([...logs.map(j => j.personId), ...quiet.map(q => q.person.id)])];
  const who = ids.map(id => people.find(p => p.id === id)).filter(Boolean);
  const tokens = tokensFor(who.length);
  const tag = (id) => { const i = who.findIndex(p => p.id === id); return i < 0 ? '[someone]' : `[${tokens[i]}]`; };
  // Names in notes and reviews: the week's people as their tags, yours as
  // [you], anyone else as [someone].
  const hide = (t) => hideCircle(String(t || ''), { people: who, everyone: people, yourName });
  const line = (j) => {
    const d = parseISODay(j.at);
    const a = j.analysis;
    const m = j.meaningfulness || 3;
    const parts = [`${DAYS[d.getDay()]} ${j.at}: ${(TYPE_META[j.type] || { label: 'Time together' }).label} with ${tag(j.personId)}, ${ML_LABELS[m - 1] || 'Good'} (${m} of 5)`];
    if (j.summary) parts.push(`note: "${hide(j.summary)}"`);
    if (j.reflection) parts.push(`how it felt: "${hide(j.reflection)}"`);
    if (a && a.grading) parts.push(`Claude's scores: overall ${a.grading.overall}, listening ${a.grading.activeListening}, depth ${a.grading.depth}, balance ${a.grading.reciprocity}, naturalness ${a.grading.naturalness}`);
    if (a && a.review) {
      if (Array.isArray(a.review.wentWell) && a.review.wentWell.length) parts.push(`went well: ${a.review.wentWell.map(hide).join('; ')}`);
      if (a.review.opportunity) parts.push(`missed: ${hide(a.review.opportunity)}`);
    }
    return `- ${parts.join('; ')}`;
  };
  const quietLines = quiet.filter(q => who.some(p => p.id === q.person.id)).map(q => `- ${tag(q.person.id)}, not seen for ${q.days} days (Layer ${q.person.layer})`);
  const request = {
    system: [
      "You are the coach inside Layers, a private app that helps someone be more intentional about their relationships and get better at conversation. You're reading the user's week to give them the big picture. Real names have been swapped for tags; refer to people only by their tags and to the user as \"you\". Be warm, specific and honest, like a perceptive friend; never preachy.",
      'Write, each in one or two sentences: headline (how their week went socially); wentWell (one specific thing that went well, pointing at a conversation); pattern (one pattern across the week, such as asking more than sharing, or only talking to the same people; only what the logs show); tryThisWeek (one concrete thing to practise next week); reachOut (who to reach out to and why, from those not seen in a while or a conversation worth following up; empty if nobody stands out).',
    ].join('\n\n'),
    content: [{ type: 'text', text: [`The week ${from} to ${to}. What the user logged:`, ...logs.map(line), ...(quietLines.length ? ['', 'Not seen in a while (nothing planned with them):', ...quietLines] : [])].join('\n') }],
    schema: WEEK_SCHEMA,
    model: analysisModel(model).id,
  };
  return { request, who };
}
// Claude's read with names back: { headline, wentWell, pattern, tryThisWeek, reachOut }.
export function weekReadResult(raw, who = []) {
  const r = restoreNames(raw || {}, who.length ? who.map(p => p.name) : ['them']);
  const s = (v) => (typeof v === 'string' ? v.trim() : '');
  return { headline: s(r.headline), wentWell: s(r.wentWell), pattern: s(r.pattern), tryThisWeek: s(r.tryThisWeek), reachOut: s(r.reachOut) };
}

// --- Kept reads (this laptop) ----------------------------------------------------
// { [the week's first day]: { at (ms), read } }, the newest 26 weeks.
const KEY = 'layers-week-reads';
export function readWeekReads() {
  try { const v = JSON.parse(window.localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; }
}
export function saveWeekRead(from, read, now = Date.now()) {
  const all = { ...readWeekReads(), [from]: { at: now, read } };
  const kept = Object.fromEntries(Object.entries(all).sort(([a], [b]) => b.localeCompare(a)).slice(0, 26));
  try { window.localStorage.setItem(KEY, JSON.stringify(kept)); } catch { /* this session only */ }
  return kept;
}
