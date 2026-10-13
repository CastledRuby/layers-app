// Know what to say (decided 2026-10-10, docs/roadmap.md): reply ideas for
// their latest messages, and the daily nudge's opener, both written by Claude
// in your own style. As with Analyse (lib/analysis.js), names are swapped for
// tags before anything is sent and put back in the answer; only what's built
// here is sent, through the same main-process call (analysis-run).
import { LAYERS } from '../data/constants.js';
import { analysisModel, DEFAULT_ANALYSIS_MODEL, hideNames, isYou, namesOf, restoreNames, tokensFor } from './analysis.js';
import { chatPeople, everywhereName, loadedChats, ownerOf, readChatProgress } from './chatImport.js';

const str = { type: 'string' };
const obj = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
export const STYLE_MAX = 200;
const MARK = String.fromCharCode(1); // holds a tag's place while others are hidden

// --- Your style ------------------------------------------------------------------
// A few of your own messages, newest first, from chats you've analysed and
// logged (the chat is kept on those logs): lines signed with your name, "You"
// or "Me". Each chat counted once (a group's log is on everyone's entry).
const LINE = /^\s*(?:\[[^\]\n]{4,40}\]\s*)?([^:\n]{1,40}?):\s+(.+)$/;
export function styleSamples(journal = [], yourName = '', max = 12) {
  const seen = new Set();
  const out = [];
  journal.filter(j => j && j.analysis && typeof j.analysis.chat === 'string' && j.analysis.chat)
    .slice().sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
    .forEach(j => {
      if (out.length >= max || seen.has(j.analysis.chat)) return;
      seen.add(j.analysis.chat);
      const mine = j.analysis.chat.split(/\r?\n/).map(l => l.match(LINE)).filter(m => m && isYou(m[1], yourName)).map(m => m[2].trim())
        .filter(t => t.length > 1 && !/^\(.*\)$/.test(t)); // not "(photo)" and the like
      mine.slice(-4).reverse().forEach(t => { if (out.length < max && !out.includes(t)) out.push(t.slice(0, 200)); });
    });
  return out;
}

// Your own messages from all your chats (decided 2026-10-13): you text people
// you're not close to differently from close friends, so the samples come
// from chats with people as close as the one it's for: Layers 1-2 for
// someone you're not close to, 3-4 for someone close. Chats with nobody in
// Layers are left out (they mix strangers with people you're close to).
// The newest of yours from each chat in turn, so no one chat fills them. A
// line that names someone, or has a link, an email or a long number, is
// skipped, so no one else's name or details go with them.
const COMMON_CAPS = new Set([
  'I', 'Im', 'Ive', 'Ill', 'Id', 'OK', 'Ok', 'Okay', 'God', 'Lord', 'Christmas', 'Easter', 'Uber', 'Google', 'Instagram', 'Snapchat', 'Netflix', 'Spotify',
  'Mon', 'Tue', 'Tues', 'Wed', 'Thu', 'Thurs', 'Fri', 'Sat', 'Sun', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'Jan', 'Feb', 'Mar', 'Apr', 'Jun', 'Jul', 'Aug', 'Sep', 'Sept', 'Oct', 'Nov', 'Dec', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
]);
// A reply of one word that's usually capitalised by the phone, not a name.
const ONE_WORD = /^(yes|yeah|yep|yup|no|nah|nope|sure|thanks|thank|ok|okay|nice|cool|fair|perfect|same|maybe|sorry|lol|haha|what|why|how|when|where|who|hello|hi|hey|bye|cya|true|wait|really|done|great|good|fine|lucky|exactly|definitely|probably|congrats|damn|oh|ah|hmm|omg)$/i;
function namesSomeone(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const bare = (w) => w.replace(/[^A-Za-z]/g, '');
  if (words.length === 1) { const w = bare(words[0]); return /^[A-Z][a-z]+$/.test(w) && !COMMON_CAPS.has(w) && !ONE_WORD.test(w); }
  return words.some((w, i) => {
    if (i === 0 || /[.?!]["”')]*$/.test(words[i - 1])) return false; // a sentence starts with a capital anyway
    const b = bare(w);
    return /^[A-Z][a-z]+$/.test(b) && !COMMON_CAPS.has(b);
  });
}
const usable = (t) => t.length > 1
  && !/^\(.*\)$/.test(t) // "(photo)" and the like
  && !/^(liked|loved|laughed at|emphasi[sz]ed|disliked|questioned|reacted)\b/i.test(t) // iMessage reactions
  && !/https?:\/\/|www\.|\S+@\S+\.\S+|\d{5,}/i.test(t)
  && !namesSomeone(t);
export function chatStyleSamples(chats = [], { people = [], yourName = '', layer = 1, progress = {}, max = 12 } = {}) {
  const band = layer >= 3 ? [3, 4] : [1, 2];
  const layerOf = (id) => (people.find(p => p.id === id) || {}).layer || 0;
  const everywhere = everywhereName(chats.filter(c => c.source === 'instagram'));
  const pools = chats.map(chat => {
    const owner = ownerOf(chat, { yourName, picked: (progress[chat.key] || {}).me, everywhere });
    if (!owner || !chat.messages.length) return null;
    const { ids } = chatPeople(chat, people, owner);
    if (!band.includes(Math.max(0, ...ids.map(layerOf)))) return null;
    const mine = chat.messages.filter(m => m.sender === owner).map(m => String(m.text || '').trim()).filter(usable).reverse();
    return mine.length ? { last: chat.messages[chat.messages.length - 1].at, mine } : null;
  }).filter(Boolean).sort((a, b) => b.last - a.last);
  const out = [];
  for (let round = 0; out.length < max && pools.some(p => p.mine.length > round); round++) {
    pools.forEach(p => {
      const t = p.mine[round];
      if (t && out.length < max && !out.some(x => x.toLowerCase() === t.toLowerCase())) out.push(t.slice(0, 200));
    });
  }
  return out;
}
// The samples to send for someone at `layer`: from your chats when Layers
// has read them (loadedChats), topped up from your logged chats only when
// those give fewer than half.
export function yourSamples({ journal = [], yourName = '', people = [], layer = 1, chats = loadedChats(), progress = readChatProgress(), max = 12 } = {}) {
  const fromChats = chatStyleSamples(chats, { people, yourName, layer, progress, max });
  if (fromChats.length >= max / 2) return fromChats;
  return [...fromChats, ...styleSamples(journal, yourName, max).filter(t => !fromChats.includes(t))].slice(0, max);
}

// The line you wrote about how you text (Me), tidied.
export const cleanStyle = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, STYLE_MAX);

// Names hidden in text: the people it's about as their tags (keep), yours as
// [you], and anyone else in your circle (everyone) as [someone].
function hide(text, { people = [], everyone = [], yourName }) {
  const tagged = hideNames(String(text || ''), { names: people.map(namesOf), yourName }).replace(/\[(them(?: \d+)?)\]/g, (_, t) => `${MARK}${t}${MARK}`);
  const others = everyone.filter(p => !people.some(x => x.id === p.id)).flatMap(namesOf);
  const rest = others.length ? hideNames(tagged, { names: [others] }).replace(/\[them\]/g, '[someone]') : tagged;
  return rest.split(MARK).map((part, i) => (i % 2 ? `[${part}]` : part)).join('');
}

// For other features that send text about your people (Practise).
export const hideCircle = hide;

export function styleNotes({ samples = [], style = '', yourName, everyone = [] }) {
  const lines = [];
  if (samples.length) lines.push(`Some of the user's own messages from other chats, for their style:\n${samples.map(s => `- ${hide(s, { everyone, yourName })}`).join('\n')}`);
  if (cleanStyle(style)) lines.push(`How the user describes their texting style: "${cleanStyle(style)}"`);
  return lines.join('\n\n');
}

const closeness = (layer) => { const l = LAYERS.find(x => x.id === layer) || LAYERS[0]; return `Layer ${l.id} (${l.fullName}) of the user's relationships: ${l.desc}`; };
const VOICE = "Write exactly in the user's own style: their usual length, capitals, punctuation, emoji and slang. One message each, ready to send as it is: no quotes around it and no explanation. Mention something specific; never generic, never pushy.";

// --- Reply ideas -------------------------------------------------------------------
export const REPLY_SCHEMA = obj({ read: str, natural: str, playful: str, deeper: str });
// The request: { system, content, schema, model }. people: who the chat's
// with; everyone: your whole circle (their names hidden too); text: the latest
// messages (pasted, or from your chats); samples, style: your style.
export function replyRequest({ people, everyone = people, yourName, text, samples = [], style = '', model = DEFAULT_ANALYSIS_MODEL }) {
  const tokens = tokensFor(people.length);
  const who = people.map((p, i) => `[${tokens[i]}], in ${closeness(p.layer)}`).join('; ');
  return {
    system: [
      'You help the user, [you], reply in a text conversation, inside Layers, a private app for being more intentional about relationships. Real names have been swapped for tags; refer to people only by their tags.',
      `The conversation is with ${who}. A line starting with a tag (perhaps after a timestamp) is that person's message.`,
      `Write three replies the user could send now, answering the latest message(s) from ${people.length > 1 ? 'the others' : '[them]'}: natural (what they'd usually say), playful (lighter or teasing) and deeper (more interest in them, or sharing something real). ${VOICE} read: one short line on what ${people.length > 1 ? 'they seem' : '[them] seems'} to want or feel right now, as a possibility, not a fact.`,
      styleNotes({ samples, style, yourName, everyone }),
    ].filter(Boolean).join('\n\n'),
    content: [{ type: 'text', text: `The latest messages:\n\n${hide(String(text || '').trim(), { people, everyone, yourName })}` }],
    schema: REPLY_SCHEMA,
    model: analysisModel(model).id,
  };
}
// Claude's answer, names back: { read, natural, playful, deeper } (empty
// strings for anything missing).
export function replyResult(raw, people) {
  const r = restoreNames(raw || {}, people.map(p => p.name));
  const s = (v) => (typeof v === 'string' ? v.trim() : '');
  return { read: s(r.read), natural: s(r.natural), playful: s(r.playful), deeper: s(r.deeper) };
}

// --- The daily nudge's opener ------------------------------------------------------
export const OPENER_SCHEMA = obj({ opener: str });
// reason: why message them today (the nudge's words); details: what you know
// about them (their saved details' text); recent: your latest logs' notes.
export function openerRequest({ person, everyone = [person], yourName, reason, details = [], recent = [], samples = [], style = '', model = DEFAULT_ANALYSIS_MODEL }) {
  const h = (t) => hide(t, { people: [person], everyone, yourName });
  return {
    system: [
      'You help the user, [you], start a text conversation, inside Layers, a private app for being more intentional about relationships. Real names have been swapped for tags; refer to people only by their tags.',
      `The message is to [them], in ${closeness(person.layer)}.`,
      `Write one opener the user could send today, from why they're messaging and what they know about [them]. Easy to reply to, and about [them] rather than the user. ${VOICE}`,
      styleNotes({ samples, style, yourName, everyone }),
    ].filter(Boolean).join('\n\n'),
    content: [{ type: 'text', text: [
      `Why message today: ${h(reason)}`,
      details.length ? `What the user knows about [them]:\n${details.slice(0, 12).map(d => `- ${h(d)}`).join('\n')}` : '',
      recent.length ? `Their latest times together:\n${recent.slice(0, 3).map(r => `- ${h(r)}`).join('\n')}` : '',
    ].filter(Boolean).join('\n\n') }],
    schema: OPENER_SCHEMA,
    model: analysisModel(model).id,
  };
}
// The opener, their name back ('' if there's none).
export function openerResult(raw, person) {
  const r = restoreNames(raw || {}, person.name);
  return typeof r.opener === 'string' ? r.opener.trim() : '';
}
