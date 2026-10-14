// Know what to say (decided 2026-10-10, docs/roadmap.md): reply ideas for
// their latest messages, and the daily nudge's opener, both written by Claude
// in your own style. As with Analyse (lib/analysis.js), names are swapped for
// tags before anything is sent and put back in the answer; only what's built
// here is sent, through the same main-process call (analysis-run).
import { LAYERS } from '../data/constants.js';
import { analysisModel, DEFAULT_ANALYSIS_MODEL, hideNames, isPhone, isYou, maskNumbers, namesOf, othersFor, restoreNames, tokensFor } from './analysis.js';
import { chatPeople, everywhereNames, loadedChats, ownerOf, readChatProgress } from './chatImport.js';

const str = { type: 'string' };
const obj = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
export const STYLE_MAX = 200;

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
      const lines = j.analysis.chat.split(/\r?\n/).map(l => l.match(LINE)).filter(Boolean);
      const theirs = nameWords(lines.map(m => m[1].trim()).filter(n => !isYou(n, yourName)));
      // The same care as for your chats (audit 2026-10-14): no names, links or numbers.
      const mine = lines.filter(m => isYou(m[1], yourName)).map(m => m[2].trim()).filter(t => usable(t, theirs));
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
// Words a message often starts with, capitalised by the phone: any other
// capitalised word at the start of a sentence may be a name (audit
// 2026-10-14: "Kate is coming" used to get through).
const STARTERS = new Set(`yes yeah yep yup ye ya no nah nope sure thanks thank ty thx ok okay k nice cool fair perfect same maybe sorry lol lmao haha hahaha what why how when where who whose which hello hi hey heyy yo bye cya true wait really done great good fine lucky exactly definitely probably congrats damn oh ah aw aww hmm omg idk tbh ngl btw imo bro dude mate man
i im ive ill id me my mine we our us you your youre yours they their them he his him she her hers it its itll this that these those there here then now so but and or if as at in on to of for from with without about after before since until while because cause coz cos also just only even still already again soon later never always sometimes maybe perhaps
the a an some any all every each no not none both either neither much many more most less few lots lot one two three four five first last next other another
do does did dont doesnt didnt can cant could couldnt would wouldnt should shouldnt will wont was wasnt were werent is isnt are arent am be been being have has had havent hasnt get got gonna wanna gotta let lets need want like love hate hope think thought know knew see saw look looking come came go going went text call send tell told ask asked check make made take took bring brought give gave keep put say said feel felt try tried
happy sad tired bored hungry busy free funny weird crazy awesome amazing insane mad fun big little small old new hot cold long short early late quick slow hard easy bad worse best better well very pretty kinda sorta super too such honestly actually literally basically anyway anyways apparently obviously totally seriously please pls merry cheers welcome excited stoked gutted keen sweet strict joking
sounds sound sounded thats whats hows wheres whos theres heres its lets gotcha sup wyd wbu hbu imma omw otw brb gtg ttyl np nvm ikr smh fr rn bet word facts legit yay woo woohoo ugh oops whoa wow lmk hmu gn gm morning night tonight today tomorrow yesterday plus though although unless whatever whenever nothing something everything anything someone anyone everyone nobody somebody anybody everybody home work school class dinner lunch breakfast coffee food game games movie party gym practice time day week weekend month year place thing things stuff yours ours`.split(/\s+/));
const SENTENCE_END = /[.?!]["”')]*$/;
const NOT_AN_END = /^(mr|mrs|ms|dr|st|mt)\.$/i; // "Mrs. Patel" goes on the same sentence
function namesSomeone(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const bare = (w) => w.replace(/[^A-Za-z]/g, '');
  return words.some((w, i) => {
    const b = bare(w);
    if (!/^[A-Z][a-z]+$/.test(b) || COMMON_CAPS.has(b)) return false;
    const starts = i === 0 || (SENTENCE_END.test(words[i - 1]) && !NOT_AN_END.test(words[i - 1]));
    return !starts || !STARTERS.has(b.toLowerCase());
  });
}
const ADDRESS = /\b\d{1,5}[a-z]?\s+([a-z]+\s+){1,3}(road|rd|street|st|avenue|ave|drive|dr|lane|ln|place|pl|crescent|cres|terrace|tce|way|close|court|ct|grove|parade|highway|hwy|boulevard|blvd)\b/i;
// A line that's yours to send as a sample: words of your own, naming nobody,
// with no link, email, phone number or address. `theirs`: the words of the
// chat's other people's names, so their names count in lower case too.
const usable = (t, theirs = new Set()) => t.length > 1
  && !/^\(.*\)$/.test(t) // "(photo)" and the like
  && !/^(liked|loved|laughed at|emphasi[sz]ed|disliked|questioned|reacted)\b/i.test(t) // iMessage reactions
  && !/https?:\/\/|www\.|\S+@\S+\.\S+|\d{5,}/i.test(t)
  && maskNumbers(t) === t && !ADDRESS.test(t)
  && !namesSomeone(t)
  && !t.toLowerCase().split(/[^a-z']+/).some(w => theirs.has(w));
const nameWords = (names) => new Set(names.filter(n => !isPhone(n)).flatMap(n => String(n).toLowerCase().split(/[^a-z']+/)).filter(w => w.length > 2));
export function chatStyleSamples(chats = [], { people = [], yourName = '', layer = 1, progress = {}, max = 12 } = {}) {
  const band = layer >= 3 ? [3, 4] : [1, 2];
  const layerOf = (id) => (people.find(p => p.id === id) || {}).layer || 0;
  const everywhere = everywhereNames(chats);
  const pools = chats.map(chat => {
    const owner = ownerOf(chat, { yourName, picked: (progress[chat.key] || {}).me, everywhere });
    if (!owner || !chat.messages.length) return null;
    const { ids } = chatPeople(chat, people, owner);
    if (!band.includes(Math.max(0, ...ids.map(layerOf)))) return null;
    const theirs = nameWords([...chat.participants, ...chat.messages.map(m => m.sender)].filter(n => n !== owner));
    const mine = chat.messages.filter(m => m.sender === owner).map(m => String(m.text || '').trim()).filter(t => usable(t, theirs)).reverse();
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

// Names hidden in text: the people it's about as their tags, yours as [you],
// and everyone else (anyone else signing the messages, the rest of your
// circle by every name they go by) as [someone 1], [someone 2]… (audit
// 2026-10-14: numbered, so the answer gets their names back from the same
// list, othersFor), with phone numbers masked.
function hide(text, { people = [], everyone = [], yourName, others }) {
  return hideNames(String(text || ''), { names: people.map(namesOf), yourName, others: others || othersFor({ people, everyone, yourName }) });
}

// For other features that send text about your people (Practise).
export const hideCircle = hide;

export function styleNotes({ samples = [], style = '', yourName, everyone = [], people = [], others }) {
  const lines = [];
  if (samples.length) lines.push(`Some of the user's own messages from other chats, for their style:\n${samples.map(s => `- ${hide(s, { people, everyone, yourName, others })}`).join('\n')}`);
  if (cleanStyle(style)) lines.push(`How the user describes their texting style: "${cleanStyle(style)}"`);
  return lines.join('\n\n');
}

const closeness = (layer) => { const l = LAYERS.find(x => x.id === layer) || LAYERS[0]; return `Layer ${l.id} (${l.fullName}) of the user's relationships: ${l.desc}`; };
const VOICE = "Write exactly in the user's own style: their usual length, capitals, punctuation, emoji and slang. One message each, ready to send as it is: no quotes around it and no explanation. Mention something specific; never generic, never pushy.";

// --- Reply ideas -------------------------------------------------------------------
export const REPLY_SCHEMA = obj({ read: str, natural: str, playful: str, deeper: str });
// The request: { system, content, schema, model }. people: who the chat's
// with; everyone: your whole circle (their names hidden too); text: the latest
// messages (pasted, or from your chats); samples, style: your style. others:
// who's hidden as [someone 1]… (othersFor with the text; replyResult takes
// the same list), worked out here if not given.
export function replyRequest({ people, everyone = people, yourName, text, samples = [], style = '', model = DEFAULT_ANALYSIS_MODEL, others: given }) {
  const others = given || othersFor({ people, everyone, text, yourName });
  const tokens = tokensFor(people.length);
  const who = people.map((p, i) => `[${tokens[i]}], in ${closeness(p.layer)}`).join('; ');
  return {
    system: [
      'You help the user, [you], reply in a text conversation, inside Layers, a private app for being more intentional about relationships. Real names have been swapped for tags; refer to people only by their tags.',
      `The conversation is with ${who}. A line starting with a tag (perhaps after a timestamp) is that person's message.`,
      `Write three replies the user could send now, answering the latest message(s) from ${people.length > 1 ? 'the others' : '[them]'}: natural (what they'd usually say), playful (lighter or teasing) and deeper (more interest in them, or sharing something real). ${VOICE} read: one short line on what ${people.length > 1 ? 'they seem' : '[them] seems'} to want or feel right now, as a possibility, not a fact.`,
      styleNotes({ samples, style, yourName, everyone, people, others }),
    ].filter(Boolean).join('\n\n'),
    content: [{ type: 'text', text: `The latest messages:\n\n${hide(String(text || '').trim(), { people, everyone, yourName, others })}` }],
    schema: REPLY_SCHEMA,
    model: analysisModel(model).id,
  };
}
// Claude's answer, names back: { read, natural, playful, deeper } (empty
// strings for anything missing). others: the request's list.
export function replyResult(raw, people, others = []) {
  const r = restoreNames(raw || {}, people.map(p => p.name), others);
  const s = (v) => (typeof v === 'string' ? v.trim() : '');
  return { read: s(r.read), natural: s(r.natural), playful: s(r.playful), deeper: s(r.deeper) };
}

// --- The daily nudge's opener ------------------------------------------------------
export const OPENER_SCHEMA = obj({ opener: str });
// reason: why message them today (the nudge's words); details: what you know
// about them (their saved details' text); recent: your latest logs' notes.
export function openerRequest({ person, everyone = [person], yourName, reason, details = [], recent = [], samples = [], style = '', model = DEFAULT_ANALYSIS_MODEL, others: given }) {
  const others = given || othersFor({ people: [person], everyone, yourName });
  const h = (t) => hide(t, { people: [person], everyone, yourName, others });
  return {
    system: [
      'You help the user, [you], start a text conversation, inside Layers, a private app for being more intentional about relationships. Real names have been swapped for tags; refer to people only by their tags.',
      `The message is to [them], in ${closeness(person.layer)}.`,
      `Write one opener the user could send today, from why they're messaging and what they know about [them]. Easy to reply to, and about [them] rather than the user. ${VOICE}`,
      styleNotes({ samples, style, yourName, everyone, people: [person], others }),
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
// The opener, their name back ('' if there's none). others: the request's list.
export function openerResult(raw, person, others = []) {
  const r = restoreNames(raw || {}, person.name, others);
  return typeof r.opener === 'string' ? r.opener.trim() : '';
}
