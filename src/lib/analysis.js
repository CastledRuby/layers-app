// Real conversation analysis (docs/roadmap.md, "The plan from here", step 6):
// who a chat is with (read from the names on its messages, here), what Claude
// is asked to look for, the shape of its answer (like the sample chats in
// data/scenarios.js, so Coach shows both the same way, plus a log filled in
// on Layers' own scales), and keeping names out of pasted text. The main
// process sends it (electron/analysis.cjs), only when you press Analyse.

import { AL_ITEMS, CATEGORIES, CONV_STATES, DIM_ORDER, LAYERS } from '../data/constants.js';
import { parseISODay, toISODate } from './dates.js';

// The models you can try it with, cheapest first. Haiku 4.5 is the cheapest
// Claude and the one used unless you pick another (each time Layers starts,
// it's Haiku again); the others think before answering, which is slower and
// costs more. Prices are US$ per million tokens, for "this one cost about".
// electron/analysis.cjs allows exactly these.
export const ANALYSIS_MODELS = [
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', short: 'Haiku 4.5', price: { input: 1, output: 5 }, thinks: false },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', short: 'Sonnet 5.5', price: { input: 2, output: 10 }, thinks: true },
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', short: 'Opus 5.5', price: { input: 4, output: 20 }, thinks: true },
  { id: 'claude-fable-5-1', name: 'Claude Fable 5.1', short: 'Fable 5.1', price: { input: 10, output: 50 }, thinks: true },
];
export const DEFAULT_ANALYSIS_MODEL = ANALYSIS_MODELS[0].id;
export const analysisModel = (id) => ANALYSIS_MODELS.find(m => m.id === id) || ANALYSIS_MODELS[0];
export const MAX_SCREENSHOTS = 6;
export const THEM = '[them]';
export const YOU = '[you]';

// How the people in a chat are called in what's sent: "them" for one, and
// "them 1", "them 2"… in a group chat. In text they're in brackets: [them 1].
export function tokensFor(count) {
  return count <= 1 ? ['them'] : Array.from({ length: count }, (_, i) => `them ${i + 1}`);
}

// --- Who it's with -----------------------------------------------------------
// A message line's timestamp, as WhatsApp exports and copies write it:
// "[7/10/26, 3:45:12 pm] " or "7/10/26, 3:45 pm - ".
const STAMP = /^\s*(?:\[[^\]\n]{4,40}\]\s*|\d{1,4}[/.-]\d{1,2}[/.-]\d{2,4},?\s+\d{1,2}[:.]\d{2}(?:[:.]\d{2})?\s*(?:[ap]\.?\s?m\.?)?\s*[-–]\s*)?/i;

// The names messages are signed with in a pasted chat ("Amelie: hi"), in the
// order they first speak.
export function chatSpeakers(text) {
  const out = [];
  String(text || '').split(/\r?\n/).forEach(line => {
    const m = line.replace(STAMP, '').match(/^([^:\n]{1,40}?):(?:\s|$)/);
    if (!m || /\d/.test(m[1])) return; // "10:30" is a time, not a name
    const name = m[1].replace(/[^\p{L}\p{M}\s'.-]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (!name || name.split(' ').length > 4) return;
    if (!out.some(n => n.toLowerCase() === name.toLowerCase())) out.push(name);
  });
  return out;
}

// The people in your circle a pasted chat is with: whoever its messages are
// signed with, matched by full name or, when only one person has it, first
// name ("Amelie R" is Amelie). You (your name, "you", "me") aren't counted.
// Read here, on this computer; nothing is sent.
export function detectPeople(text, people = [], yourName = '') {
  const me = String(yourName || '').trim().toLowerCase();
  const first = (s) => s.trim().split(/\s+/)[0].toLowerCase();
  const ids = [];
  chatSpeakers(text).forEach(speaker => {
    const s = speaker.toLowerCase();
    if (s === 'you' || s === 'me' || (me && (s === me || first(s) === first(me)))) return;
    const full = people.filter(p => p.name.trim().toLowerCase() === s);
    const byFirst = people.filter(p => first(p.name) === first(s));
    const match = full.length === 1 ? full[0] : byFirst.length === 1 ? byFirst[0] : null;
    if (match && !ids.includes(match.id)) ids.push(match.id);
  });
  return ids;
}

// --- What Claude is asked -------------------------------------------------------
const str = { type: 'string' };
const int = { type: 'integer' };
const obj = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const orNull = (schema) => ({ anyOf: [schema, { type: 'null' }] });
const list = (items) => ({ type: 'array', items });
const tones = obj({ text: str, natural: str, playful: str, deeper: str });

// The answer, as JSON (structured outputs keep Claude to it). The reading
// comes before the scores, so the scores follow from it. `tokens`: who's in
// the chat besides you (tokensFor).
export function analysisSchema(tokens = ['them']) {
  const info = { category: { type: 'string', enum: CATEGORIES.map(c => c.key) }, text: str, temporary: { type: 'boolean' } };
  if (tokens.length > 1) info.about = { type: 'string', enum: tokens };
  return obj({
    transcript: list(obj({ who: { type: 'string', enum: ['you', ...tokens] }, text: str })),
    conversationState: { type: 'string', enum: Object.keys(CONV_STATES) },
    wentWell: list(str),
    opportunity: str,
    tryNextTime: str,
    encourager: orNull(obj({ type: { type: 'string', enum: ['good', 'improve'] }, line: str, why: str })),
    emotionalCues: list(obj({ emoji: str, text: str })),
    grading: obj({ overall: int, depth: int, activeListening: int, reciprocity: int, naturalness: int }),
    recommendation: orNull(str),
    extractedInfo: list(obj(info)),
    next: obj({ continueTopic: orNull(tones), shareYourself: orNull(tones), changeTopic: orNull(tones), dontMessage: orNull(tones) }),
    log: obj({
      meaningfulness: int,
      ratings: obj(Object.fromEntries(DIM_ORDER.map(k => [k, int]))),
      activeListening: list({ type: 'string', enum: AL_ITEMS.map(a => a.key) }),
      summary: str,
      chatDate: orNull(str),
    }),
  });
}
export const ANALYSIS_SCHEMA = analysisSchema();

// Whether this computer writes dates day first (31/12), as New Zealand does.
function writesDayFirst() {
  try { return new Date(2006, 10, 22).toLocaleDateString().trim().startsWith('22'); } catch { return false; }
}
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// What Claude is told: who's who (only how close each person is, from their
// layer), what to look for and how to score it, and what to write. Nothing
// else about anyone is sent.
export function analysisSystem({ layers = [1], today = new Date(), dayFirst = writesDayFirst() } = {}) {
  const tokens = tokensFor(layers.length);
  const group = tokens.length > 1;
  const them = tokens.map((t, i) => {
    const l = LAYERS.find(x => x.id === layers[i]) || LAYERS[0];
    return `[${t}], in Layer ${l.id} (${l.fullName}) of the user's relationships: ${l.desc}`;
  }).join('; ');
  return [
    'You are the conversation coach inside Layers, a private app that helps someone be more intentional about their relationships and get better at conversation. You are coaching the user, [you]. Be warm, specific and honest, like a perceptive friend; never preachy, and never judge the other person.',

    `THE CHAT. One conversation between [you] and ${group ? `a group: ${them}` : them}. Real names have been swapped for these tags. Refer to people only by their tags and to the user as "you", even if a screenshot shows a name. In pasted text, a line starting with a tag (perhaps after a timestamp) is that person's message. In screenshots, bubbles on the right are usually the user's. If it's unclear who sent something, decide from the context. Today is ${WEEKDAYS[today.getDay()]} ${toISODate(today)}${dayFirst ? '; dates in the chat are probably written day first (31/12)' : ''}.`,

    `WHAT TO LOOK FOR. Read the whole chat and work through these before scoring, pointing at specific messages in what you write:
1. Depth: is it logistics and small talk, opinions and plans, or feelings, worries and hopes? When someone opened up, did the other meet it (share back, ask more) or move past it?
2. Listening: does the user answer what was actually said? Look for follow-up questions about their words, coming back to details, naming a feeling ("that sounds stressful"), clarifying. Watch for shift responses (turning to themselves too soon: "same, I…") and missed bids (a question, news or feeling the user skipped).
3. Reciprocity: who asks, who shares, who starts topics, and how long each side's messages are. Balanced, or one side carrying it (an interview, or a monologue)?
4. Naturalness: does the user match their energy, length, tone, emoji and humour? Too formal, too eager, walls of text, question after question, or double-texting without a reply?
5. Their engagement: are their replies getting longer or shorter; do they ask back, bring topics, show enthusiasm (!, emoji, laughter) or go flat ("ok", "lol", one word)? If there are times, how quickly do they reply, and who sent the last message?`,

    `HOW TO SCORE (whole numbers).
grading, each 0-100: overall, depth, activeListening, reciprocity, naturalness. 50 is an ordinary, fine chat; 70 is good; 85 or more is excellent and rare; under 35 means clear problems. A short practical chat can be natural and fine while low on depth: don't punish brevity that suits the moment. overall is your judgement of how well the user did, not an average.
log, for the user's journal, on Layers' own scales:
- meaningfulness 1-5: 1 very brief, 2 casual, 3 good conversation, 4 personal, 5 deep conversation.
- ratings, each 1-5 (1 barely, 3 some, 5 a lot): depth (how deep it went), trust (openness and trust shown, such as sharing something personal or asking for help), reciprocity (how evenly you both gave and asked), interaction (how engaged you both were), sharedExperiences (how much was done or lived together: plans made, a moment or activity shared, inside jokes; a plain chat is usually 1 or 2), listening (how well you listened to each other).
- activeListening: only what the user clearly did: followup (asked follow-up questions about what they said), paraphrase (paraphrased, clarified or reflected back), listened (let them finish a story without cutting in or redirecting), remembered (brought up something they'd mentioned before this chat).
- summary: what the chat was about, under 12 words, as a journal note (e.g. "Her new job and nerves about Monday").
- chatDate: the day of the last message as YYYY-MM-DD, if the chat shows dates or times (count "Yesterday", weekday names and times, worked out from today); null if it doesn't.`,

    `WHAT TO WRITE.
transcript: the chat as you read it, in order, with who sent each message. Leave out what you can't read rather than guess.
conversationState: how ${group ? 'the others seem' : 'they seem'} overall, especially toward the end: ${Object.entries(CONV_STATES).map(([k, v]) => `${k} (${v.desc})`).join('; ')}.
wentWell: two to four specific things the user did well, each pointing at a moment. opportunity: the single most useful thing they missed or could do better, and where. tryNextTime: one concrete habit to practise, in one or two sentences.
encourager: short replies that invite more ("no way!", "wait what happened?", "then what?") versus ones that close a topic ("nice", "lol", "ok"). Quote the user's most telling one: good if it invited more, improve if it closed things down; null if there were none.
emotionalCues: up to three things ${group ? 'the others' : 'they'} may be feeling, each with one emoji and the evidence ("lots of exclamation marks about the job"). Possibilities, not facts; never diagnose.
recommendation: one sentence when the best move is to let it rest (it ended naturally, they're winding down, or the user sent the last messages without a reply); otherwise null.
extractedInfo: things worth remembering about ${group ? 'the others (about: whose it is)' : 'them'}, said by them rather than the user: interests (things they enjoy), preferences (likes, dislikes, how they like to do things), plans (things coming up), experiences (things that have happened to them), important (time-sensitive things to follow up, like an exam, an interview, being unwell or a worry; temporary true). Short and specific ("Starts a new job at the library on Monday"), only what was actually said, nothing trivial. Very sensitive things (health, sexuality, religion, family trouble) only if clearly shared and worth remembering, worded kindly.
next: ideas for the user's next message, in the slots that fit (null for the rest): continueTopic, shareYourself, changeTopic, dontMessage. Each has text (a one-line idea) and three ready-to-send messages written exactly in the user's own style from this chat (their length, capitals, punctuation, emoji and slang): natural, playful, deeper. Mention something specific from the chat; never generic. Use dontMessage when the chat has wound down or a moment should be left to sit; its three messages are then light, closing ones, in case they still want to say something.`,
  ].join('\n\n');
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Every way a name appears: in full, and each part of it ("Priya", "Priya S").
function nameParts(name) {
  const full = String(name || '').trim();
  if (!full) return [];
  return [...new Set([full, ...full.split(/\s+/).filter(w => w.length > 1)])];
}

// Pasted text with each person's name(s) as their tag ([them], or [them 1],
// [them 2]… for `names`) and yours as [you]. Whole words, any case; longer
// names first, and a part two people share goes to the first.
export function hideNames(text, { names, theirName, yourName }) {
  const theirs = names || (theirName ? [theirName] : []);
  const tokens = tokensFor(theirs.length);
  const pairs = [...theirs.flatMap((n, i) => nameParts(n).map(part => [part, `[${tokens[i]}]`])), ...nameParts(yourName).map(part => [part, YOU])]
    .sort((a, b) => b[0].length - a[0].length);
  const done = new Set();
  let out = String(text || '');
  pairs.forEach(([part, tag]) => {
    if (done.has(part.toLowerCase())) return;
    done.add(part.toLowerCase());
    out = out.replace(new RegExp(`(?<![\\p{L}\\d])${escapeRe(part)}(?![\\p{L}\\d])`, 'giu'), tag);
  });
  return out;
}

// First names back into everything Claude wrote ([them] or [them 2] -> the
// name, [you] -> you), throughout the answer. `names`: one name, or a list.
export function restoreNames(value, names) {
  const firsts = (Array.isArray(names) ? names : [names]).map(n => String(n || '').trim().split(/\s+/)[0] || 'them');
  const swap = (s) => s
    .replace(/\[them(?: (\d+))?\]/gi, (tag, n) => (n ? firsts[Number(n) - 1] || 'them' : firsts.length === 1 ? firsts[0] : 'them'))
    .replace(/\[you\]/gi, 'you');
  if (typeof value === 'string') return swap(value);
  if (Array.isArray(value)) return value.map(v => restoreNames(v, names));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, restoreNames(v, names)]));
  return value;
}

// The request for the main process: { system, content, schema, model }.
// people: who it's with (or `person`, one); images: [{ mediaType, data }]
// (base64, already shrunk); text: pasted, names hidden; model: one of
// ANALYSIS_MODELS (the cheapest otherwise).
export function analysisRequest({ people, person, yourName, text, images = [], model = DEFAULT_ANALYSIS_MODEL, today = new Date(), dayFirst }) {
  const group = people || (person ? [person] : []);
  const pasted = String(text || '').trim();
  const content = [
    ...images.slice(0, MAX_SCREENSHOTS).map(im => ({ type: 'image', source: { type: 'base64', media_type: im.mediaType, data: im.data } })),
    { type: 'text', text: pasted ? `The chat:\n\n${hideNames(pasted, { names: group.map(p => p.name), yourName })}` : `The chat is in the ${images.length === 1 ? 'screenshot' : 'screenshots'} above.` },
  ];
  return {
    system: analysisSystem({ layers: group.map(p => p.layer), today, ...(dayFirst === undefined ? {} : { dayFirst }) }),
    content,
    schema: analysisSchema(tokensFor(group.length)),
    model: analysisModel(model).id,
  };
}

// The answer, checked and made safe to show: a "scenario" like the samples,
// with each saved detail's person (personId), and `log`, a log on Layers'
// own scales ready to save: { personIds, meaningfulness, ratings,
// activeListening, summary, date } (date: the chat's day from its times, or
// null). Details already on their profile are left out.
export function analysisResult(raw, people, { today = new Date() } = {}) {
  const group = Array.isArray(people) ? people : [people];
  const names = group.map(p => p.name);
  const tokens = tokensFor(group.length);
  const r = restoreNames(raw || {}, names);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));
  const listOf = (x) => (Array.isArray(x) ? x : []);
  const g = r.grading || {};
  const tone = (t) => (t && typeof t.text === 'string' ? { text: t.text, natural: String(t.natural || ''), playful: String(t.playful || ''), deeper: String(t.deeper || '') } : null);
  const personFor = (token) => group[Math.max(0, tokens.indexOf(token))] || group[0];
  const first = (p) => p.name.trim().split(/\s+/)[0];
  const known = (p, category, text) => listOf(p[category]).some(it => it && String(it.text || '').trim().toLowerCase() === text.trim().toLowerCase());
  const lg = r.log || {};
  const ratingsIn = lg.ratings || {};
  const day = typeof lg.chatDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(lg.chatDate) ? parseISODay(lg.chatDate) : null;
  const yearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  return {
    key: 'own', title: 'Your chat', own: true,
    personIds: group.map(p => p.id),
    transcript: listOf(r.transcript).filter(m => m && typeof m.text === 'string' && (m.who === 'you' || tokens.includes(m.who)))
      .map(m => (m.who === 'you' ? { who: 'you', text: m.text } : { who: 'them', text: m.text, ...(group.length > 1 ? { name: first(personFor(m.who)) } : {}) })),
    conversationState: CONV_STATES[r.conversationState] ? r.conversationState : 'unclear',
    recommendation: typeof r.recommendation === 'string' && r.recommendation.trim() ? r.recommendation : null,
    grading: { overall: clamp(g.overall, 0, 100), depth: clamp(g.depth, 0, 100), activeListening: clamp(g.activeListening, 0, 100), reciprocity: clamp(g.reciprocity, 0, 100), naturalness: clamp(g.naturalness, 0, 100), goalImpact: null },
    wentWell: listOf(r.wentWell).filter(x => typeof x === 'string'),
    opportunity: typeof r.opportunity === 'string' ? r.opportunity : '',
    tryNextTime: typeof r.tryNextTime === 'string' ? r.tryNextTime : '',
    encourager: r.encourager && typeof r.encourager.line === 'string' ? { type: r.encourager.type === 'good' ? 'good' : 'improve', line: r.encourager.line, why: String(r.encourager.why || '') } : null,
    emotionalCues: listOf(r.emotionalCues).filter(x => x && typeof x.text === 'string').slice(0, 3),
    extractedInfo: listOf(r.extractedInfo)
      .filter(x => x && typeof x.text === 'string' && x.text.trim() && CATEGORIES.some(c => c.key === x.category))
      .map(x => { const p = personFor(x.about); return { category: x.category, text: x.text.trim(), temporary: !!x.temporary, personId: p.id, ...(group.length > 1 ? { name: first(p) } : {}) }; })
      .filter(x => !known(group.find(p => p.id === x.personId), x.category, x.text)),
    next: { continueTopic: tone(r.next && r.next.continueTopic), shareYourself: tone(r.next && r.next.shareYourself), changeTopic: tone(r.next && r.next.changeTopic), dontMessage: tone(r.next && r.next.dontMessage) },
    log: {
      personIds: group.map(p => p.id),
      meaningfulness: clamp(lg.meaningfulness || 3, 1, 5),
      ratings: Object.fromEntries(DIM_ORDER.filter(k => Number(ratingsIn[k]) >= 1).map(k => [k, clamp(ratingsIn[k], 1, 5)])),
      activeListening: [...new Set(listOf(lg.activeListening))].filter(k => AL_ITEMS.some(a => a.key === k)),
      summary: typeof lg.summary === 'string' ? lg.summary.trim().slice(0, 120) : '',
      date: day && day <= today && day >= yearAgo ? toISODate(day) : null,
    },
  };
}

// "about US$0.02", from the tokens it used (thinking counts as output).
export function analysisCost({ input = 0, output = 0 } = {}, model = DEFAULT_ANALYSIS_MODEL) {
  const { price } = analysisModel(model);
  const dollars = (input * price.input + output * price.output) / 1e6;
  return dollars < 0.01 ? 'under US$0.01' : `about US$${dollars.toFixed(2)}`;
}

// Roughly what a typical chat costs with a model, before sending it: a few
// thousand tokens in (mostly these instructions), the answer out (and the
// thinking, for those that think). Each screenshot adds about 1,500 in.
export function typicalCost(model) {
  return analysisCost({ input: 4000, output: analysisModel(model).thinks ? 6000 : 2500 }, model);
}
