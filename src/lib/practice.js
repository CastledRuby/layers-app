// Practise conversations (decided 2026-10-10, docs/roadmap.md): a text chat
// with Claude playing someone, then feedback the way Analyse gives it (the
// transcript goes through analysisRequest / analysisResult). Made-up people
// in common situations, or one of your people: Claude plays them from their
// saved details and how they write in chats you've logged, every name hidden.
// Each turn goes through the same main-process call as Analyse (analysis-run).
import { LAYERS } from '../data/constants.js';
import { analysisModel, DEFAULT_ANALYSIS_MODEL, isYou, namesOf, restoreNames } from './analysis.js';
import { hideCircle } from './replies.js';
import { formatAbsoluteDate, parseISODay } from './dates.js';

const str = { type: 'string' };
const obj = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });

// The made-up situations. persona: who Claude plays (a name, and how they
// are); starts: who sends the first message; aim: what you're practising.
export const SITUATIONS = [
  { key: 'chat', title: 'Just chatting', desc: 'An ordinary catch-up by text.', name: 'Theo', persona: 'a friendly friend of the user from school, easy-going, happy to chat about their week', starts: 'them', aim: 'keep a natural, two-way conversation going' },
  { key: 'new', title: 'Starting with someone new', desc: 'Keep a first chat going past small talk.', name: 'Jess', persona: "someone new in the user's course, friendly but a little reserved at first: she answers questions but rarely asks any back until the user shares something of their own", starts: 'you', aim: 'get past small talk to something you both care about' },
  { key: 'hangout', title: 'Asking to hang out', desc: "Turn chatting into a plan, without it being awkward.", name: 'Kai', persona: 'a friend the user has been texting about a band they both like; keen to meet up but busy, so a vague "we should hang out" goes nowhere unless it becomes a real plan', starts: 'them', aim: 'suggest doing something together, and settle when' },
  { key: 'quiet', title: 'Reviving a quiet chat', desc: "Message someone you haven't talked to in a while.", name: 'Rory', persona: "a friend the user hasn't talked to in two months; a bit surprised to hear from them and guarded at first, warming up if they're genuine and ask about Rory", starts: 'you', aim: 'restart the friendship naturally, without making it awkward' },
  { key: 'bad-news', title: 'They share bad news', desc: "Be there when they're down.", name: 'Maya', persona: "a close friend who just found out she didn't get the job she really wanted; upset and a bit flat, and put off by quick advice or silver linings", starts: 'them', aim: "support her: listen, acknowledge how she feels, don't rush to fix it" },
  { key: 'say-no', title: 'Saying no kindly', desc: 'Turn down a favour without hurting them.', name: 'Ben', persona: "a friend asking the user to help him move house all Saturday, which the user can't do; a little disappointed at a no, fine if it's kind and clear", starts: 'them', aim: 'say no clearly and kindly, perhaps offering something else' },
  { key: 'mixup', title: 'Clearing up a misunderstanding', desc: 'Sort things out after a missed plan.', name: 'Zoe', persona: "a friend who's hurt that the user missed her birthday drinks without saying; short, cool replies until she feels heard", starts: 'them', aim: 'own it, understand how she feels, and make it right' },
];
export const situation = (key) => SITUATIONS.find(s => s.key === key) || SITUATIONS[0];

// How one of your people writes: a few of their own messages from chats
// you've analysed and logged (lines signed with their name or a nickname).
const LINE = /^\s*(?:\[[^\]\n]{4,40}\]\s*)?([^:\n]{1,40}?):\s+(.+)$/;
export function theirSamples(journal = [], person, yourName = '', max = 10) {
  const mine = (speaker) => namesOf(person).some(n => n.trim().toLowerCase() === speaker.trim().toLowerCase() || n.trim().split(/\s+/)[0].toLowerCase() === speaker.trim().split(/\s+/)[0].toLowerCase());
  const seen = new Set();
  const out = [];
  journal.filter(j => j && j.analysis && typeof j.analysis.chat === 'string' && j.personId === person.id)
    .slice().sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
    .forEach(j => {
      if (out.length >= max || seen.has(j.analysis.chat)) return;
      seen.add(j.analysis.chat);
      j.analysis.chat.split(/\r?\n/).map(l => l.match(LINE)).filter(m => m && !isYou(m[1], yourName) && mine(m[1])).map(m => m[2].trim())
        .filter(t => t.length > 1 && !/^\(.*\)$/.test(t)).slice(-4).reverse()
        .forEach(t => { if (out.length < max && !out.includes(t)) out.push(t.slice(0, 200)); });
    });
  return out;
}

// --- A turn ----------------------------------------------------------------------
export const TURN_SCHEMA = obj({ reply: str });
// The request for their next message: { system, content, schema, model }.
// messages: [{ who: 'you' | 'them', text }] so far. person: one of your people
// (with everyone, details and samples), or null for the situation's made-up one.
export function turnRequest({ situationKey, person = null, everyone = [], yourName = '', details = [], samples = [], messages = [], model = DEFAULT_ANALYSIS_MODEL }) {
  const s = situation(situationKey);
  const hide = (t) => (person ? hideCircle(t, { people: [person], everyone, yourName }) : hideCircle(t, { everyone, yourName }));
  const layer = person ? LAYERS.find(l => l.id === person.layer) || LAYERS[0] : null;
  const who = person
    ? `You are [them], in Layer ${layer.id} (${layer.fullName}) of the user's relationships: ${layer.desc}${details.length ? `\nWhat the user knows about [them]:\n${details.slice(0, 12).map(d => `- ${hide(d)}`).join('\n')}` : ''}${samples.length ? `\nHow [them] writes (their own messages; write like this):\n${samples.map(m => `- ${hide(m)}`).join('\n')}` : ''}`
    : `You are ${s.name}, ${s.persona}.`;
  const lines = messages.map(m => `${m.who === 'you' ? '[you]' : person ? '[them]' : s.name}: ${hide(m.text)}`).join('\n');
  return {
    system: [
      'You are role-playing a text conversation so the user, [you], can practise talking with people, inside Layers, a private app for getting better at conversation. Real names have been swapped for tags.',
      who,
      `The situation: ${s.key === 'chat' ? 'an ordinary catch-up by text' : s.desc.toLowerCase().replace(/\.$/, '')}. The user is practising how to ${s.aim}.`,
      'Stay in character and reply as them only: one text message, short and casual like a real text (usually under 25 words), reacting the way a real person would: warmer and more open when the user is warm, curious and shares, shorter when they\'re dull, pushy or only ask questions. Never coach the user, never mention being an AI or a practice, and don\'t end the conversation yourself unless it has clearly finished.',
    ].join('\n\n'),
    content: [{ type: 'text', text: lines ? `The conversation so far:\n\n${lines}\n\nWrite ${person ? '[them]' : s.name}'s next message.` : `Start the conversation with the first message from ${person ? '[them]' : s.name}.` }],
    schema: TURN_SCHEMA,
    model: analysisModel(model).id,
  };
}
// Their message from Claude's answer, names back ('' if there's none).
export function turnResult(raw, person = null) {
  const r = person ? restoreNames(raw || {}, person.name) : raw || {};
  return typeof r.reply === 'string' ? r.reply.trim() : '';
}

// Who the feedback is about, for analysisRequest: the person, or the made-up
// one (Layer 2, as for someone you're getting to know).
export const practicePartner = (situationKey, person = null) => person || { id: 'practice', name: situation(situationKey).name, layer: 2 };
// The practice as a chat for Analyse: "Name: text" lines, you under your name.
// Anyone else in your circle (everyone) mentioned is [someone] already, as in
// each turn; Analyse hides the two of you.
export function practiceText(messages, { situationKey, person = null, yourName = '', everyone = [] }) {
  const them = practicePartner(situationKey, person).name;
  const text = (t) => (everyone.length ? hideCircle(t, { people: person ? [person] : [], everyone }) : t);
  return messages.map(m => `${m.who === 'you' ? yourName || 'Me' : them}: ${text(m.text)}`).join('\n');
}

// --- Kept scores (this laptop) ---------------------------------------------------
// [{ at (ISO day), situation, personId?, grading: { overall, depth,
// activeListening, reciprocity, naturalness } }], the newest 200.
const KEY = 'layers-practice';
const num = (n) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null);
export function readPractice() {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) || '[]');
    return (Array.isArray(v) ? v : []).filter(r => r && typeof r.at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.at) && r.grading && num(r.grading.overall) !== null);
  } catch { return []; }
}
export function addPractice(record) {
  const g = record.grading || {};
  const clean = { at: record.at, situation: situation(record.situation).key, ...(record.personId ? { personId: record.personId } : {}), grading: { overall: num(g.overall), depth: num(g.depth), activeListening: num(g.activeListening), reciprocity: num(g.reciprocity), naturalness: num(g.naturalness) } };
  const next = [...readPractice(), clean].slice(-200);
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* this session only */ }
  return next;
}
// Practice scores by day, for Me's chart: [{ at, date, practice }] (each
// day's overall scores averaged), oldest first.
export function practiceTrend(records = [], now = new Date()) {
  const days = new Map();
  records.forEach(r => { if (!days.has(r.at)) days.set(r.at, []); days.get(r.at).push(r.grading.overall); });
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([at, list]) => ({ at, date: formatAbsoluteDate(parseISODay(at), now), practice: Math.round(list.reduce((s, n) => s + n, 0) / list.length) }));
}
