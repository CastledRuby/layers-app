// Real conversation analysis (docs/roadmap.md, "The plan from here", step 6):
// what Claude is asked about a chat you chose, the shape of its answer (the
// same as the sample chats in data/scenarios.js, so Coach shows both the
// same way), and keeping names out of pasted text. The main process sends it
// (electron/analysis.cjs), only when you press Analyse.

import { CATEGORIES, CONV_STATES, LAYERS } from '../data/constants.js';

export const ANALYSIS_MODEL_NAME = 'Claude Haiku 4.5';
// Claude Haiku 4.5's prices per million tokens (US$), for "this one cost about".
const PRICE = { input: 1, output: 5 };
export const MAX_SCREENSHOTS = 6;
export const THEM = '[them]';
export const YOU = '[you]';

const str = { type: 'string' };
const obj = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const orNull = (schema) => ({ anyOf: [schema, { type: 'null' }] });
const tones = obj({ text: str, natural: str, playful: str, deeper: str });

// The answer, as JSON (structured outputs keep Claude to it).
export const ANALYSIS_SCHEMA = obj({
  transcript: { type: 'array', items: obj({ who: { type: 'string', enum: ['them', 'you'] }, text: str }) },
  conversationState: { type: 'string', enum: Object.keys(CONV_STATES) },
  recommendation: orNull(str),
  grading: obj({ overall: { type: 'integer' }, depth: { type: 'integer' }, activeListening: { type: 'integer' }, reciprocity: { type: 'integer' }, naturalness: { type: 'integer' }, goalImpact: { type: 'integer' } }),
  wentWell: { type: 'array', items: str },
  opportunity: str,
  tryNextTime: str,
  encourager: orNull(obj({ type: { type: 'string', enum: ['good', 'improve'] }, line: str, why: str })),
  emotionalCues: { type: 'array', items: obj({ emoji: str, text: str }) },
  extractedInfo: { type: 'array', items: obj({ category: { type: 'string', enum: CATEGORIES.map(c => c.key) }, text: str, temporary: { type: 'boolean' } }) },
  next: obj({ continueTopic: orNull(tones), shareYourself: orNull(tones), changeTopic: orNull(tones), dontMessage: orNull(tones) }),
});

// What Claude is told. `layer` (1-4) says how close you are, so it can
// pitch the advice; nothing else about them is sent.
export function analysisSystem(layer) {
  const l = LAYERS.find(x => x.id === layer) || LAYERS[0];
  return [
    'You are the conversation coach inside Layers, a private app that helps someone be more intentional about their relationships and improve their own social skills.',
    `You will see one chat (pasted text and/or screenshots) between the user, called ${YOU}, and one other person, called ${THEM}. They are in Layer ${l.id} (${l.fullName}) of the user's relationships: ${l.desc}`,
    'Analyse it the way a warm, perceptive friend would: specific to what was actually said, honest, never preachy. Interpretations of feelings are possibilities, not facts; never diagnose anyone.',
    `In everything you write, refer to the other person only as ${THEM} and speak to the user as "you"; never use real names, even if a screenshot shows them.`,
    'transcript: the chat as you read it, in order. In screenshots, bubbles on the right are usually the user\'s ("you"). Leave out anything you can\'t read rather than guess.',
    `conversationState: ${Object.entries(CONV_STATES).map(([k, v]) => `${k} (${v.desc})`).join('; ')}.`,
    'recommendation: one sentence when the best move is not to push the conversation further, otherwise null.',
    'grading: whole numbers 0-100 for overall, depth, activeListening, reciprocity and naturalness; goalImpact 0-15 for how much this chat moved the relationship forward.',
    'wentWell: two to four specific things. opportunity and tryNextTime: one or two sentences each. encourager: how the user used short encouragers ("really?", "what happened?"), or null if there were none.',
    'emotionalCues: up to three, each with one emoji. extractedInfo: things worth remembering about them (interests, preferences, plans, experiences, or important temporary things), each short; temporary is true for one-off events.',
    'next: what the user could say next, in the four slots that fit (null for ones that don\'t); for each, a one-line idea (text) and three ready-to-send messages in the user\'s own style from the chat (natural, playful, deeper). Use dontMessage when the chat has wound down or a moment should be left to sit; its three messages are then light, closing ones.',
  ].join('\n\n');
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Every way a name appears: in full, and each part of it ("Priya", "Priya S").
function nameParts(name) {
  const full = String(name || '').trim();
  if (!full) return [];
  return [...new Set([full, ...full.split(/\s+/).filter(w => w.length > 1)])].sort((a, b) => b.length - a.length);
}

// Pasted text with their name(s) as [them] and yours as [you].
export function hideNames(text, { theirName, yourName }) {
  let out = String(text || '');
  [[nameParts(theirName), THEM], [nameParts(yourName), YOU]].forEach(([parts, token]) => {
    parts.forEach(part => { out = out.replace(new RegExp(`(?<![\\p{L}\\d])${escapeRe(part)}(?![\\p{L}\\d])`, 'giu'), token); });
  });
  return out;
}

// Their first name back into everything Claude wrote ([them] -> Priya,
// [you] -> you), throughout the answer.
export function restoreNames(value, theirName) {
  const first = String(theirName || '').trim().split(/\s+/)[0] || 'them';
  const swap = (s) => s.replace(/\[them\]/gi, first).replace(/\[you\]/gi, 'you');
  if (typeof value === 'string') return swap(value);
  if (Array.isArray(value)) return value.map(v => restoreNames(v, theirName));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, restoreNames(v, theirName)]));
  return value;
}

// The request for the main process: { system, content, schema }. images:
// [{ mediaType, data }] (base64, already shrunk); text: pasted, names hidden.
export function analysisRequest({ person, yourName, text, images = [] }) {
  const pasted = String(text || '').trim();
  const content = [
    ...images.slice(0, MAX_SCREENSHOTS).map(im => ({ type: 'image', source: { type: 'base64', media_type: im.mediaType, data: im.data } })),
    { type: 'text', text: pasted ? `The chat:\n\n${hideNames(pasted, { theirName: person.name, yourName })}` : `The chat is in the ${images.length === 1 ? 'screenshot' : 'screenshots'} above.` },
  ];
  return { system: analysisSystem(person.layer), content, schema: ANALYSIS_SCHEMA };
}

// The answer, checked and made safe to show: a "scenario" like the samples.
export function analysisResult(raw, person) {
  const r = restoreNames(raw || {}, person.name);
  const clamp = (n, hi = 100) => Math.max(0, Math.min(hi, Math.round(Number(n) || 0)));
  const g = r.grading || {};
  const list = (x) => (Array.isArray(x) ? x : []);
  const tone = (t) => (t && typeof t.text === 'string' ? { text: t.text, natural: String(t.natural || ''), playful: String(t.playful || ''), deeper: String(t.deeper || '') } : null);
  return {
    key: 'own', title: 'Your chat', own: true,
    transcript: list(r.transcript).filter(m => m && (m.who === 'you' || m.who === 'them') && typeof m.text === 'string'),
    conversationState: CONV_STATES[r.conversationState] ? r.conversationState : 'unclear',
    recommendation: typeof r.recommendation === 'string' && r.recommendation.trim() ? r.recommendation : null,
    grading: { overall: clamp(g.overall), depth: clamp(g.depth), activeListening: clamp(g.activeListening), reciprocity: clamp(g.reciprocity), naturalness: clamp(g.naturalness), goalImpact: clamp(g.goalImpact, 15) },
    wentWell: list(r.wentWell).filter(x => typeof x === 'string'),
    opportunity: typeof r.opportunity === 'string' ? r.opportunity : '',
    tryNextTime: typeof r.tryNextTime === 'string' ? r.tryNextTime : '',
    encourager: r.encourager && typeof r.encourager.line === 'string' ? { type: r.encourager.type === 'good' ? 'good' : 'improve', line: r.encourager.line, why: String(r.encourager.why || '') } : null,
    emotionalCues: list(r.emotionalCues).filter(x => x && typeof x.text === 'string').slice(0, 3),
    extractedInfo: list(r.extractedInfo).filter(x => x && typeof x.text === 'string' && CATEGORIES.some(c => c.key === x.category)),
    next: { continueTopic: tone(r.next && r.next.continueTopic), shareYourself: tone(r.next && r.next.shareYourself), changeTopic: tone(r.next && r.next.changeTopic), dontMessage: tone(r.next && r.next.dontMessage) },
  };
}

// "about US$0.02", from the tokens it used.
export function analysisCost({ input = 0, output = 0 } = {}) {
  const dollars = (input * PRICE.input + output * PRICE.output) / 1e6;
  return dollars < 0.01 ? 'under US$0.01' : `about US$${dollars.toFixed(2)}`;
}
