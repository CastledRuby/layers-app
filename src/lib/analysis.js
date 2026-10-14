// Real conversation analysis (docs/roadmap.md, "The plan from here", step 6):
// who a chat is with (read from the names on its messages, here), what Claude
// is asked to look for, the shape of its answer (like the sample chats in
// data/scenarios.js, so Coach shows both the same way, plus a log filled in
// on Layers' own scales), and keeping names out of pasted text. The main
// process sends it (electron/analysis.cjs) when the page asks.

import { AL_ITEMS, CATEGORIES, CONV_STATES, DIM_ORDER, LAYERS } from '../data/constants.js';
import { parseISODay, toISODate } from './dates.js';
import { chatNumbers, numbersFacts } from './chatNumbers.js';

// The models you can try it with, cheapest first. Haiku 5.5 is the cheapest
// Claude and the one used unless you pick another (each time Layers starts,
// it's Haiku 5.5 again). It replaced Haiku 4.5 as the default on 2026-10-12:
// newer and a tenth of the price. Haiku 4.5 stays, so spending and reviews
// saved with it keep its name. All but Haiku 4.5 think before answering
// (thinking is charged as output); the bigger ones are slower and cost more.
// Prices are US$ per million tokens, for "this one cost about" (Haiku 5.5's
// are for prompts up to 100K tokens; a chat here is far smaller).
// electron/analysis.cjs allows exactly these.
export const ANALYSIS_MODELS = [
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', short: 'Haiku 5.5', price: { input: 0.1, output: 0.5 }, thinks: true },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', short: 'Haiku 4.5', price: { input: 1, output: 5 }, thinks: false },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', short: 'Sonnet 5.5', price: { input: 2, output: 10 }, thinks: true },
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', short: 'Opus 5.5', price: { input: 4, output: 20 }, thinks: true },
  { id: 'claude-fable-5-1', name: 'Claude Fable 5.1', short: 'Fable 5.1', price: { input: 10, output: 50 }, thinks: true },
];
export const DEFAULT_ANALYSIS_MODEL = ANALYSIS_MODELS[0].id;
export const analysisModel = (id) => ANALYSIS_MODELS.find(m => m.id === id) || ANALYSIS_MODELS[0];
export const MAX_SCREENSHOTS = 6;
// Most text one request's message carries; the main process takes 60,000.
export const MAX_SENT = 58000;
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

// A phone number, as an unsaved contact signs their messages ("+64 21 555
// 9876") or as written in a message: seven digits or more.
const digitsIn = (s) => (String(s).match(/\d/g) || []).length;
export const isPhone = (s) => /^\+?[\d\s().-]+$/.test(String(s || '').trim()) && digitsIn(s) >= 7;
// Phone numbers in text as [number] (audit 2026-10-14): nothing sent to
// Claude needs them. Dates and times are left alone.
export function maskNumbers(text) {
  return String(text || '').replace(/\+?\(?\d[\d\s().-]{5,}\d/g, (m) => {
    if (/\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[-.]\d{1,2}[-.]\d{2,4}/.test(m) || /^\d{4}\s*-\s*\d{2,4}$/.test(m.trim()) || digitsIn(m) < 7) return m;
    return '[number]';
  });
}

// The names messages are signed with in a pasted chat ("Amelie: hi"), in the
// order they first speak. An unsaved contact's phone number counts, so they
// can be hidden like anyone else.
export function chatSpeakers(text) {
  const out = [];
  String(text || '').split(/\r?\n/).forEach(line => {
    const m = line.replace(STAMP, '').match(/^([^:\n]{1,40}?):(?:\s|$)/);
    if (m && isPhone(m[1])) { const n = m[1].trim(); if (!out.includes(n)) out.push(n); return; }
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
  const ids = [];
  chatSpeakers(text).forEach(speaker => {
    if (isYou(speaker, yourName)) return;
    const match = personNamed(speaker, people);
    if (match && !ids.includes(match.id)) ids.push(match.id);
  });
  return ids;
}

const firstName = (s) => String(s || '').trim().split(/\s+/)[0].toLowerCase();
// Whether a name on a message can be someone called `full` (audit
// 2026-10-14): the same first name, and no other part that differs ("Sam"
// and "Sam L" are Sam Lee, so is "Amelie Rose" for an Amelie with no surname
// saved; "Sam Tan" isn't Sam Lee). An initial matches the part it starts.
export function nameFits(name, full) {
  const a = String(name || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const b = String(full || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!a.length || !b.length || a[0] !== b[0]) return false;
  return a.every((w, i) => i >= b.length || w === b[i] || (w.replace(/\.$/, '').length === 1 && b[i].startsWith(w[0])));
}
// Whether a name on a message is you: your name, or a shorter form of it
// ("Liam" for Liam Wong, but not "Liam Smith"), "you", "me".
export function isYou(name, yourName = '') {
  const s = String(name || '').trim().toLowerCase();
  return s === 'you' || s === 'me' || (!!String(yourName || '').trim() && nameFits(name, yourName));
}
// Everything a person is called: their name, then any nicknames ("Also
// known as" on their profile).
export const namesOf = (p) => [p.name, ...(Array.isArray(p.aka) ? p.aka : [])];

// Everyone else who signs messages in a chat: not one of `people` (by any of
// their names) and not you. In a group chat with someone who isn't in Layers,
// they're hidden as [someone 1], [someone 2]… like everyone else.
// Someone who only shares a first name with them, or with you, is someone
// else ("Sam Tan" in a chat with Sam Lee).
export function otherSpeakers(text, people = [], yourName = '') {
  return chatSpeakers(text).filter(n => !isYou(n, yourName) && !people.some(p => namesOf(p).some(full => nameFits(n, full))));
}
// Everyone a request hides as [someone 1], [someone 2]… (audit 2026-10-14):
// whoever else signs the chat's messages, then everyone else in your circle by
// every name they go by. The answer gets them back from the same list
// (analysisResult's `others`).
export function othersFor({ people = [], everyone = [], text = '', yourName = '' } = {}) {
  const circle = everyone.filter(p => !people.some(x => x.id === p.id));
  const speakers = text ? otherSpeakers(text, people, yourName).filter(n => !circle.some(p => namesOf(p).some(full => nameFits(n, full)))) : [];
  return [...speakers, ...circle.flatMap(namesOf)];
}

// The person a chat name means: the same full name or nickname, or the same
// first name when only one person has it ("Amelie R" is Amelie, "Mel" is
// Amelie if she's also known as Mel). Emoji and symbols around it don't
// count. Null if it's nobody, or can't be told.
export function personNamed(name, people = []) {
  const s = String(name || '').replace(/[^\p{L}\p{M}\s'.-]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!s) return null;
  const full = people.filter(p => namesOf(p).some(n => n.trim().toLowerCase() === s));
  const byFirst = people.filter(p => namesOf(p).some(n => firstName(n) === firstName(s)));
  return full.length === 1 ? full[0] : byFirst.length === 1 ? byFirst[0] : null;
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
// the chat besides you (tokensFor). Days are plain text, empty when there's
// none: each either-or (orNull) field makes the format Claude compiles much
// bigger, and one more made it "too complex for compilation" (2026-10-09), so
// keep them to the few there are.
// In a group chat, log.each rates how it went with each of the others on
// their own (decided 2026-10-12), so one person's warm reply isn't
// everyone's.
export function analysisSchema(tokens = ['them']) {
  const info = { category: { type: 'string', enum: CATEGORIES.map(c => c.key) }, text: str, temporary: { type: 'boolean' }, when: str };
  if (tokens.length > 1) info.about = { type: 'string', enum: tokens };
  const ratings = obj(Object.fromEntries(DIM_ORDER.map(k => [k, int])));
  const log = {
    meaningfulness: int,
    ratings,
    activeListening: list({ type: 'string', enum: AL_ITEMS.map(a => a.key) }),
    summary: str,
    chatDate: str,
  };
  if (tokens.length > 1) log.each = list(obj({ about: { type: 'string', enum: tokens }, meaningfulness: int, ratings }));
  return obj({
    transcript: list(obj({ who: { type: 'string', enum: ['you', ...tokens] }, text: str })),
    conversationState: { type: 'string', enum: Object.keys(CONV_STATES) },
    wentWell: list(str),
    opportunity: str,
    tryNextTime: str,
    tipFollowed: str,
    moments: list(obj({ quote: str, kind: { type: 'string', enum: ['good', 'missed'] }, note: str })),
    encourager: orNull(obj({ type: { type: 'string', enum: ['good', 'improve'] }, line: str, why: str })),
    emotionalCues: list(obj({ emoji: str, text: str })),
    grading: obj({ overall: int, depth: int, activeListening: int, reciprocity: int, naturalness: int }),
    recommendation: orNull(str),
    extractedInfo: list(obj(info)),
    next: obj({ continueTopic: orNull(tones), shareYourself: orNull(tones), changeTopic: orNull(tones), dontMessage: orNull(tones) }),
    log: obj(log),
  });
}
export const ANALYSIS_SCHEMA = analysisSchema();

// Whether this computer writes dates day first (31/12), as New Zealand does.
function writesDayFirst() {
  try { return new Date(2006, 10, 22).toLocaleDateString().trim().startsWith('22'); } catch { return false; }
}
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// A conversation in person (decided 2026-10-14): your notes, written after,
// under these headings ([them] is the person, or "they" in a group), read
// like a chat. Which kind it was is the log's type.
export const NOTE_FIELDS = [
  ['talked', 'What did you talk about?', 'What you talked about'],
  ['theyShared', 'What did they share?', 'What they shared'],
  ['youShared', 'What did you share?', 'What you shared'],
  ['ended', 'How did it end?', 'How it ended'],
];
const IN_PERSON = { talked: 'face to face', hangout: 'while hanging out', activity: 'while doing something together', called: 'on a call' };
export const IN_PERSON_KINDS = Object.keys(IN_PERSON);
export const hasNotes = (notes) => NOTE_FIELDS.some(([k]) => String((notes || {})[k] || '').trim());
// Your notes as one text, to keep on the log (the Journal's review).
export function notesText(notes = {}) {
  return NOTE_FIELDS.filter(([k]) => String(notes[k] || '').trim()).map(([k, , label]) => `${label}:\n${String(notes[k]).trim()}`).join('\n\n');
}

// What Claude is told: who's who (only how close each person is, from their
// layer), what to look for and how to score it, and what to write. Nothing
// else about anyone is sent. inPerson: the kind of conversation in person
// ('talked', 'hangout', 'activity', 'called') when it's your notes, not a chat.
export function analysisSystem({ layers = [1], today = new Date(), dayFirst = writesDayFirst(), inPerson = null } = {}) {
  const tokens = tokensFor(layers.length);
  const group = tokens.length > 1;
  const them = tokens.map((t, i) => {
    const l = LAYERS.find(x => x.id === layers[i]) || LAYERS[0];
    return `[${t}], in Layer ${l.id} (${l.fullName}) of the user's relationships: ${l.desc}`;
  }).join('; ');
  return [
    'You are the conversation coach inside Layers, a private app that helps someone be more intentional about their relationships and get better at conversation. You are coaching the user, [you]. Be warm, specific and honest, like a perceptive friend; never preachy, and never judge the other person.',

    inPerson ? `THE CONVERSATION. One conversation ${IN_PERSON[inPerson] || IN_PERSON.talked} between [you] and ${group ? `a group: ${them}` : them}, not a text chat. All you have is the user's own notes, written afterwards under four headings: what they talked about, what ${group ? 'the others' : '[them]'} shared, what the user shared, and how it ended. Real names have been swapped for these tags. Refer to people only by their tags and to the user as "you". The notes are partial and in the user's own words: judge from what's there, say so when something isn't clear, and never invent what anyone said. Today is ${WEEKDAYS[today.getDay()]} ${toISODate(today)}.`
      : `THE CHAT. One conversation between [you] and ${group ? `a group: ${them}` : them}. Real names have been swapped for these tags. Refer to people only by their tags and to the user as "you", even if a screenshot shows a name. In pasted text, a line starting with a tag (perhaps after a timestamp) is that person's message. In screenshots, bubbles on the right are usually the user's. If it's unclear who sent something, decide from the context. Today is ${WEEKDAYS[today.getDay()]} ${toISODate(today)}${dayFirst ? '; dates in the chat are probably written day first (31/12)' : ''}.`,

    'BEFORE THE CHAT the message may give WHAT LAYERS ALREADY KNOWS (details saved before this chat, the user\'s goals with them, and LAST TIME\'S TIP) and THE NUMBERS (counted exactly from the chat). Use them: build on what is known, judge the tip, and let the numbers anchor reciprocity and balance.',

    inPerson ? `WHAT TO LOOK FOR. Read the notes and work through these before scoring, pointing at what the notes say:
1. Depth: small talk and logistics, opinions and plans, or feelings, worries and hopes? When someone opened up, did the other meet it (share back, ask more) or move past it?
2. Listening: did the user ask follow-up questions, come back to something from before, notice how they felt? Or turn to themselves too soon, or let something they said go by?
3. Reciprocity: compare what they shared with what the user shared. Even, or one side carrying it (an interview, or a monologue)?
4. How it flowed: relaxed or awkward, who brought up topics, any silences or rushed moments, as far as the notes say.
5. How it ended: warmly, with a plan to meet again, or trailing off?`
      : `WHAT TO LOOK FOR. Read the whole chat and work through these before scoring, pointing at specific messages in what you write:
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
${group ? `- each: one for every one of the others (about: their tag), with their own meaningfulness and ratings on the same scales, for the user's part of the chat with that person: how deep it went with them, how much they opened up, how evenly the two of them gave and asked, how engaged they were, what the two of them shared, how well the user listened to them. People in a group rarely get the same: someone who barely spoke is low, someone the user really talked with is higher. The shared meaningfulness and ratings above are for the chat as a whole.\n` : ''}- summary: what the chat was about, under 12 words, as a journal note (e.g. "Her new job and nerves about Monday").
- chatDate: the day of the last message as YYYY-MM-DD, if the chat shows dates or times (count "Yesterday", weekday names and times, worked out from today); empty if it doesn't.`,

    `WHAT TO WRITE.
transcript: the chat as you read it, in order, with who sent each message. Leave out what you can't read rather than guess.
conversationState: how ${group ? 'the others seem' : 'they seem'} overall, especially toward the end: ${Object.entries(CONV_STATES).map(([k, v]) => `${k} (${v.desc})`).join('; ')}.
wentWell: two to four specific things the user did well, each pointing at a moment. opportunity: the single most useful thing they missed or could do better, and where. tryNextTime: one concrete habit to practise, in one or two sentences.
tipFollowed: if the message gives LAST TIME'S TIP, one sentence on whether the user did it in this chat (and where), or that it didn't come up; otherwise empty.
moments: two to four moments that matter most, each a quote copied word for word from one message (up to 15 words), kind good (it landed: a great follow-up, sharing back, a warm reply) or missed (a question skipped, a bid passed over, a closer), and a one-line note on why.
encourager: short replies that invite more ("no way!", "wait what happened?", "then what?") versus ones that close a topic ("nice", "lol", "ok"). Quote the user's most telling one: good if it invited more, improve if it closed things down; null if there were none.
emotionalCues: up to three things ${group ? 'the others' : 'they'} may be feeling, each with one emoji and the evidence ("lots of exclamation marks about the job"). Possibilities, not facts; never diagnose.
recommendation: one sentence when the best move is to let it rest (it ended naturally, they're winding down, or the user sent the last messages without a reply); otherwise null.
extractedInfo: be thorough. Go through the chat message by message and list every detail about ${group ? 'the others (about: whose it is)' : 'them'} that a good friend would remember, said or confirmed by them rather than the user. Look for: people in their life (family, friends, a partner, pets, workmates, with names and how they're related), places (where they live, work, study, go out, have been or are going), work and study (their job, course, subjects, shifts, exams), anything coming up (with when: "Job interview on Thu 15 Oct"), things that have happened to them, what they like and dislike (food, drinks, music, shows, games, sports, hobbies), how they like to do things, worries, wins, and anything they asked the user to remember. One detail per item; don't merge separate details, and don't stop at a few: a long chat often has ten or more. Leave out only what has nothing to remember (greetings, "lol", plans already done with). Categories: interests (things they enjoy), preferences (likes, dislikes, how they like to do things), plans (things coming up), experiences (things that have happened to them, and the people and places in their life), important (time-sensitive things to follow up, like an exam, an interview, being unwell or a worry; temporary true). Short and specific ("Starts a new job at the library on Mon 12 Oct"), only what was actually said. Very sensitive things (health, sexuality, religion, family trouble) only if clearly shared and worth remembering, worded kindly. when: the day it happens as YYYY-MM-DD, for something coming up or time-sensitive whose day is said or clear, worked out from when it was said (the message's date if the chat shows one, otherwise today); empty if there's no day.
next: ideas for the user's next message, in the slots that fit (null for the rest): continueTopic, shareYourself, changeTopic, dontMessage. Each has text (a one-line idea) and three ready-to-send messages written exactly in the user's own style from this chat (their length, capitals, punctuation, emoji and slang): natural, playful, deeper. Mention something specific from the chat; never generic. Use dontMessage when the chat has wound down or a moment should be left to sit; its three messages are then light, closing ones, in case they still want to say something.`,

    inPerson ? `FOR NOTES, NOT A CHAT (this overrides the above where they differ): transcript is empty. Score only what the notes show: a short note isn't a bad conversation, and naturalness is how relaxed and easy it seems. sharedExperiences counts being together in person. moments quote a few words of the notes themselves, never invented dialogue. encourager is null unless the notes give the user's exact words. conversationState is how ${group ? 'the others' : '[them]'} seemed by the end. recommendation is null unless the notes suggest giving them space. extractedInfo: every detail the notes say ${group ? 'the others' : '[them]'} shared, the same way. activeListening: only what the notes clearly show. chatDate is empty. next: ideas for a message to send ${group ? 'them' : '[them]'} after seeing them (thanks, following up on something they shared, the plan made), in the user's own style.` : '',
  ].filter(Boolean).join('\n\n');
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Every way a name appears: in full, and each part of it ("Priya", "Priya S").
function nameParts(name) {
  const full = String(name || '').trim();
  if (!full) return [];
  return [...new Set([full, ...full.split(/\s+/).filter(w => w.length > 1)])];
}

// The fuller names a chat signs someone's messages with: "Amelie Rose" for
// Amelie, so a surname that's only in the chat is hidden with her name. A
// signed name counts when it starts with all of one of theirs ("Sam Tan" isn't
// "Sam Lee").
function signedAs(names, speakers) {
  const words = (s) => String(s || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  return speakers.filter(sp => names.some(n => { const a = words(n); const b = words(sp); return a.length && a.length < b.length && a.every((w, i) => w === b[i]); }));
}

// Pasted text with each person's name(s) as their tag ([them], or [them 1],
// [them 2]… for `names`, where each is a name or a list of a person's names
// and nicknames), yours as [you] and `others` (otherSpeakers) as [someone 1],
// [someone 2]…. A fuller name the chat signs them or you with is hidden too
// (signedAs). Whole words, any case; longer names first, and a part two
// people share goes to the first.
// A name that's also an everyday word is only hidden where it's written with a
// capital ("May said", not "I may"), so the text isn't garbled.
const WORD_NAMES = new Set(['will', 'may', 'june', 'april', 'august', 'mark', 'bill', 'rose', 'grace', 'hope', 'joy', 'faith', 'sky', 'summer', 'autumn', 'dawn', 'pat', 'sue', 'frank', 'art', 'rich', 'guy', 'ray', 'max', 'amber', 'ruby', 'jade', 'pearl', 'ivy', 'holly', 'daisy', 'lily', 'violet', 'iris', 'river', 'storm', 'brook', 'drew', 'chase', 'hunter', 'grant', 'lance', 'miles', 'nick', 'gene', 'jack', 'sunny', 'honey', 'angel', 'chance', 'royal', 'cash', 'king', 'rocky', 'sandy', 'misty', 'penny', 'robin', 'wren', 'jay', 'kit', 'bo', 'al', 'ed', 'tom', 'don']);
// A phone number is hidden only as a whole; a name in its parts too.
const partsOf = (n) => (isPhone(n) ? [String(n).trim()] : nameParts(n));
export function hideNames(text, { names, theirName, yourName, others = [] }) {
  const speakers = chatSpeakers(text);
  const theirs = (names || (theirName ? [theirName] : [])).map(n => [...[].concat(n), ...signedAs([].concat(n), speakers)]);
  const yours = yourName ? [yourName, ...signedAs([yourName], speakers)] : [];
  const tokens = tokensFor(theirs.length);
  const pairs = [...theirs.flatMap((n, i) => n.flatMap(nameParts).map(part => [part, `[${tokens[i]}]`])), ...yours.flatMap(nameParts).map(part => [part, YOU]),
    ...others.flatMap((n, i) => partsOf(n).map(part => [part, `[someone ${i + 1}]`]))]
    .sort((a, b) => b[0].length - a[0].length);
  const done = new Set();
  let out = String(text || '');
  pairs.forEach(([part, tag]) => {
    if (done.has(part.toLowerCase())) return;
    done.add(part.toLowerCase());
    const word = WORD_NAMES.has(part.toLowerCase());
    const shown = word ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part;
    out = out.replace(new RegExp(`(?<![\\p{L}\\d])${escapeRe(shown)}(?![\\p{L}\\d])`, word ? 'gu' : 'giu'), tag);
  });
  return maskNumbers(out);
}

// First names back into everything Claude wrote ([them] or [them 2] -> the
// name, [you] -> you, [someone 1] -> others[0]), throughout the answer.
// `names`: one name, or a list.
export function restoreNames(value, names, others = []) {
  const firsts = (Array.isArray(names) ? names : [names]).map(n => String(n || '').trim().split(/\s+/)[0] || 'them');
  const swap = (s) => s
    .replace(/\[them(?: (\d+))?\]/gi, (tag, n) => (n ? firsts[Number(n) - 1] || 'them' : firsts.length === 1 ? firsts[0] : 'them'))
    .replace(/\[someone (\d+)\]/gi, (tag, n) => others[Number(n) - 1] || 'someone')
    .replace(/\[you\]/gi, 'you');
  if (typeof value === 'string') return swap(value);
  if (Array.isArray(value)) return value.map(v => restoreNames(v, names, others));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, restoreNames(v, names, others)]));
  return value;
}

// The request for the main process: { system, content, schema, model }.
// people: who it's with (or `person`, one); images: [{ mediaType, data }]
// (base64, already shrunk); text: pasted, names hidden; model: one of
// ANALYSIS_MODELS (the cheapest otherwise).
// What Layers already knows (decided 2026-10-11), for each person in the
// chat: saved details, goals still open, and the last tip Claude gave you
// with them ({ text, at }, from their newest analysed log). Sent with the
// chat, names hidden, so the feedback builds on it and says whether you did it.
export function analysisContext(group = [], journal = [], { max = 15 } = {}) {
  return group.map(p => {
    const details = ['important', 'plans', 'interests', 'preferences', 'experiences']
      .flatMap(k => (p[k] || []).filter(it => it && !it.archived && typeof it.text === 'string' && it.text.trim()))
      .sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))).map(it => it.text.trim()).slice(0, max);
    const goals = (p.goals || []).filter(g => g && typeof g.title === 'string' && (g.progress || 0) < 100).map(g => g.title).slice(0, 5);
    const tipped = journal.filter(j => j && j.personId === p.id && j.analysis && j.analysis.review && typeof j.analysis.review.tryNextTime === 'string' && j.analysis.review.tryNextTime.trim())
      .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))[0];
    return { details, goals, lastTip: tipped ? { text: tipped.analysis.review.tryNextTime.trim(), at: tipped.at || null } : null };
  });
}

// The last tip with anyone in the chat, for the result (analysisResult).
export const lastTipFor = (group = [], journal = []) => analysisContext(group, journal).map(c => c.lastTip).find(Boolean) || null;

// What Layers already knows, as the lines sent before the chat (or notes).
function knownFor(group, journal, hide) {
  const tokens = tokensFor(group.length);
  return analysisContext(group, journal).map((c, i) => [
    c.details.length ? `What [${tokens[i]}] has told the user before (saved already, so don't list these in extractedInfo again; notice when the user builds on them):\n${c.details.map(d => `- ${hide(d)}`).join('\n')}` : '',
    c.goals.length ? `The user's goals with [${tokens[i]}]: ${c.goals.map(hide).join('; ')}.` : '',
    c.lastTip ? `LAST TIME'S TIP for the user with [${tokens[i]}]${c.lastTip.at ? ` (${c.lastTip.at})` : ''}: "${hide(c.lastTip.text)}"` : '',
  ].filter(Boolean).join('\n')).filter(Boolean);
}

// A conversation in person: what Layers knows, then your notes under their
// headings, names hidden as in a chat (everyone else in your circle too).
function notesRequest({ group, everyone, yourName, notes, kind, model, today, journal }) {
  const others = othersFor({ people: group, everyone, yourName });
  const hide = (t) => hideNames(t, { names: group.map(namesOf), yourName, others });
  const known = knownFor(group, journal, hide);
  const theirs = group.length > 1 ? 'What they shared' : 'What [them] shared';
  const body = NOTE_FIELDS.filter(([k]) => String(notes[k] || '').trim())
    .map(([k, , label]) => `${k === 'theyShared' ? theirs : k === 'youShared' ? 'What the user shared' : label}:\n${hide(String(notes[k]).trim())}`).join('\n\n');
  const text = `${known.length ? `WHAT LAYERS ALREADY KNOWS\n${known.join('\n\n')}\n\n` : ''}THE USER'S NOTES, written after:\n\n${body}`;
  return {
    system: analysisSystem({ layers: group.map(p => p.layer), today, inPerson: IN_PERSON[kind] ? kind : 'talked' }),
    content: [{ type: 'text', text }],
    schema: analysisSchema(tokensFor(group.length)),
    model: analysisModel(model).id,
    deep: true,
  };
}

// journal: for what Layers already knows about them (analysisContext).
// notes ({ talked, theyShared, youShared, ended }) and kind: a conversation
// in person, your notes sent instead of a chat (NOTE_FIELDS). everyone: your
// whole circle, whose names are hidden too (othersFor; the answer gets them
// back from the same list).
export function analysisRequest({ people, person, everyone = [], yourName, text, images = [], model = DEFAULT_ANALYSIS_MODEL, today = new Date(), dayFirst, journal = [], notes = null, kind = 'talked' }) {
  const group = people || (person ? [person] : []);
  if (notes) return notesRequest({ group, everyone, yourName, notes, kind, model, today, journal });
  const pasted = String(text || '').trim();
  const others = othersFor({ people: group, everyone, text: pasted, yourName });
  const speaking = chatSpeakers(pasted).filter(n => others.includes(n));
  const hide = (t) => hideNames(t, { names: group.map(namesOf), yourName, others });
  const alsoIn = speaking.length ? `Also in this chat, and not who it's about: ${speaking.map(n => `[someone ${others.indexOf(n) + 1}]`).join(', ')}.\n\n` : '';
  const known = knownFor(group, journal, hide);
  const numbers = pasted ? chatNumbers(pasted, { yourName }) : null;
  const before = [
    known.length ? `WHAT LAYERS ALREADY KNOWS\n${known.join('\n\n')}` : '',
    numbers ? `THE NUMBERS, counted exactly from the chat (use them for reciprocity and balance, and don't contradict them): ${numbersFacts(numbers, { group: group.length > 1 })}` : '',
  ].filter(Boolean).join('\n\n');
  // Tags are longer than names, so a long chat can pass what the main process
  // takes (60,000 characters): its earliest messages are left out to fit
  // (audit 2026-10-14), rather than the request being turned down.
  let hidden = pasted ? hide(pasted) : '';
  const room = MAX_SENT - before.length - alsoIn.length - 200;
  if (hidden.length > room) hidden = `(Earlier messages left out.)\n${hidden.slice(-Math.max(0, room)).replace(/^[^\n]*\n/, '')}`;
  const chat = pasted ? `${alsoIn}The chat:\n\n${hidden}` : `The chat is in the ${images.length === 1 ? 'screenshot' : 'screenshots'} above.`;
  const content = [
    ...images.slice(0, MAX_SCREENSHOTS).map(im => ({ type: 'image', source: { type: 'base64', media_type: im.mediaType, data: im.data } })),
    { type: 'text', text: before ? `${before}\n\n${chat}` : chat },
  ];
  return {
    system: analysisSystem({ layers: group.map(p => p.layer), today, ...(dayFirst === undefined ? {} : { dayFirst }) }),
    content,
    schema: analysisSchema(tokensFor(group.length)),
    model: analysisModel(model).id,
    deep: true, // high effort on the thinking models (electron/analysis.cjs)
  };
}

// The answer, checked and made safe to show: a "scenario" like the samples,
// with each saved detail's person (personId), and `log`, a log on Layers'
// own scales ready to save: { personIds, meaningfulness, ratings, each?,
// activeListening, summary, date } (date: the chat's day from its times, or
// null; each: a group chat's rating for each person). Details already on
// their profile are left out.
// `others`: the names hidden as [someone 1]… (otherSpeakers of the chat sent).
// `numbers` (lib/chatNumbers.js) and `lastTip` (analysisContext) are worked
// out here, not by Claude, and shown with it. inPerson: the kind of
// conversation in person when it was your notes; the result says so
// (inPerson), has no chat (transcript), and its log has that type.
export function analysisResult(raw, people, { today = new Date(), others = [], numbers = null, lastTip = null, inPerson = null } = {}) {
  const group = Array.isArray(people) ? people : [people];
  const names = group.map(p => p.name);
  const tokens = tokensFor(group.length);
  const r = restoreNames(raw || {}, names, others);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));
  const listOf = (x) => (Array.isArray(x) ? x : []);
  const g = r.grading || {};
  const tone = (t) => (t && typeof t.text === 'string' ? { text: t.text, natural: String(t.natural || ''), playful: String(t.playful || ''), deeper: String(t.deeper || '') } : null);
  const personFor = (token) => group[Math.max(0, tokens.indexOf(token))] || group[0];
  const first = (p) => p.name.trim().split(/\s+/)[0];
  const known = (p, category, text) => listOf(p[category]).some(it => it && String(it.text || '').trim().toLowerCase() === text.trim().toLowerCase());
  const lg = r.log || {};
  const ratingsIn = lg.ratings || {};
  const ratingsOf = (x) => Object.fromEntries(DIM_ORDER.filter(k => Number((x || {})[k]) >= 1).map(k => [k, clamp(x[k], 1, 5)]));
  // A group chat's own rating for each person ({ [personId]: { meaningfulness,
  // ratings } }), only for tags that are in it, the first answer for each.
  const each = {};
  if (group.length > 1) listOf(lg.each).forEach(x => {
    const i = x && tokens.indexOf(x.about);
    if (i >= 0 && group[i] && !each[group[i].id]) each[group[i].id] = { meaningfulness: clamp(x.meaningfulness || lg.meaningfulness || 3, 1, 5), ratings: ratingsOf(x.ratings) };
  });
  const day = typeof lg.chatDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(lg.chatDate) ? parseISODay(lg.chatDate) : null;
  const yearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  // A detail's day (an interview on Thursday), within a year either way.
  const yearAhead = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
  const whenOf = (s) => { const d = parseISODay(s); return d && d >= yearAgo && d <= yearAhead ? toISODate(d) : null; };
  const kind = IN_PERSON[inPerson] ? inPerson : null;
  return {
    key: 'own', title: kind ? 'Your conversation' : 'Your chat', own: true,
    ...(kind ? { inPerson: kind } : {}),
    personIds: group.map(p => p.id),
    transcript: kind ? [] : listOf(r.transcript).filter(m => m && typeof m.text === 'string' && (m.who === 'you' || tokens.includes(m.who)))
      .map(m => (m.who === 'you' ? { who: 'you', text: m.text } : { who: 'them', text: m.text, ...(group.length > 1 ? { name: first(personFor(m.who)) } : {}) })),
    conversationState: CONV_STATES[r.conversationState] ? r.conversationState : 'unclear',
    recommendation: typeof r.recommendation === 'string' && r.recommendation.trim() ? r.recommendation : null,
    grading: { overall: clamp(g.overall, 0, 100), depth: clamp(g.depth, 0, 100), activeListening: clamp(g.activeListening, 0, 100), reciprocity: clamp(g.reciprocity, 0, 100), naturalness: clamp(g.naturalness, 0, 100), goalImpact: null },
    wentWell: listOf(r.wentWell).filter(x => typeof x === 'string'),
    opportunity: typeof r.opportunity === 'string' ? r.opportunity : '',
    tryNextTime: typeof r.tryNextTime === 'string' ? r.tryNextTime : '',
    lastTip: lastTip || null,
    tipFollowed: lastTip && typeof r.tipFollowed === 'string' ? r.tipFollowed.trim() : '',
    moments: listOf(r.moments).filter(m => m && typeof m.quote === 'string' && m.quote.trim() && ['good', 'missed'].includes(m.kind))
      .slice(0, 4).map(m => ({ quote: m.quote.trim().replace(/^["“]|["”]$/g, ''), kind: m.kind, note: typeof m.note === 'string' ? m.note.trim() : '' })),
    numbers: kind ? null : numbers || null,
    encourager: r.encourager && typeof r.encourager.line === 'string' ? { type: r.encourager.type === 'good' ? 'good' : 'improve', line: r.encourager.line, why: String(r.encourager.why || '') } : null,
    emotionalCues: listOf(r.emotionalCues).filter(x => x && typeof x.text === 'string').slice(0, 3),
    extractedInfo: listOf(r.extractedInfo)
      .filter(x => x && typeof x.text === 'string' && x.text.trim() && CATEGORIES.some(c => c.key === x.category))
      .map(x => { const p = personFor(x.about); const when = whenOf(x.when); return { category: x.category, text: x.text.trim(), temporary: !!x.temporary, ...(when ? { when } : {}), personId: p.id, ...(group.length > 1 ? { name: first(p) } : {}) }; })
      .filter(x => !known(group.find(p => p.id === x.personId), x.category, x.text)),
    next: { continueTopic: tone(r.next && r.next.continueTopic), shareYourself: tone(r.next && r.next.shareYourself), changeTopic: tone(r.next && r.next.changeTopic), dontMessage: tone(r.next && r.next.dontMessage) },
    log: {
      personIds: group.map(p => p.id),
      ...(kind ? { type: kind } : {}),
      meaningfulness: clamp(lg.meaningfulness || 3, 1, 5),
      ratings: ratingsOf(ratingsIn),
      ...(Object.keys(each).length ? { each } : {}),
      activeListening: [...new Set(listOf(lg.activeListening))].filter(k => AL_ITEMS.some(a => a.key === k)),
      summary: typeof lg.summary === 'string' ? lg.summary.trim().slice(0, 120) : '',
      date: !kind && day && day <= today && day >= yearAgo ? toISODate(day) : null,
    },
  };
}

// --- What's kept with the log ------------------------------------------------
// Logging an analysed chat keeps, on the Journal entry, the scores and state,
// Claude's review and the chat itself (your choice on 2026-10-07): the chat
// as you gave it, or for screenshots Claude's reading of them, with real
// names. Only its last KEPT_CHAT characters, so saved data stays small. A
// conversation in person keeps your notes (notesText) as its chat, and which
// kind it was (inPerson).
export const KEPT_CHAT = 20000;
export function analysisToKeep(result, { model, chat = '' } = {}) {
  const text = String(chat || '').trim()
    || result.transcript.map(m => `${m.who === 'you' ? 'You' : m.name || 'Them'}: ${m.text}`).join('\n');
  return {
    grading: result.grading,
    conversationState: result.conversationState,
    ...(model ? { model } : {}),
    ...(result.inPerson ? { inPerson: result.inPerson } : {}),
    review: {
      wentWell: result.wentWell, opportunity: result.opportunity, tryNextTime: result.tryNextTime,
      ...(result.moments && result.moments.length ? { moments: result.moments } : {}),
      ...(result.lastTip && result.tipFollowed ? { lastTip: result.lastTip, tipFollowed: result.tipFollowed } : {}),
      encourager: result.encourager, emotionalCues: result.emotionalCues, recommendation: result.recommendation, next: result.next,
    },
    chat: text.length > KEPT_CHAT ? `(Earlier messages left out.)\n${text.slice(-KEPT_CHAT)}` : text,
  };
}

// What some tokens cost with a model, in US$ (thinking counts as output).
export function analysisDollars({ input = 0, output = 0 } = {}, model = DEFAULT_ANALYSIS_MODEL) {
  const { price } = analysisModel(model);
  return (input * price.input + output * price.output) / 1e6;
}
export const dollarsText = (d) => (d < 0.01 ? 'under US$0.01' : `US$${d.toFixed(2)}`);
// "about US$0.02", from the tokens it used.
export function analysisCost(usage, model = DEFAULT_ANALYSIS_MODEL) {
  const dollars = analysisDollars(usage, model);
  return dollars < 0.01 ? 'under US$0.01' : `about US$${dollars.toFixed(2)}`;
}

// --- What it has cost (this laptop) ---------------------------------------------
// Every answer Claude gives is charged, so each is added up here by month:
// { 'YYYY-MM': { dollars, chats, models: { [model]: chats } } }. Worked out
// from the tokens used at each model's price, so it's close to, not exactly,
// what Anthropic bills (console.anthropic.com has that).
const SPEND_KEY = 'layers-analysis-spend';
const monthOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export function readSpend() {
  try { const v = JSON.parse(window.localStorage.getItem(SPEND_KEY) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; }
}
// One answer added to the months' spend.
export function addSpend(all, usage, model, now = new Date()) {
  if (!usage) return all;
  const id = analysisModel(model).id;
  const m = all[monthOf(now)] || { dollars: 0, chats: 0, models: {} };
  return { ...all, [monthOf(now)]: { dollars: m.dollars + analysisDollars(usage, id), chats: m.chats + 1, models: { ...m.models, [id]: (m.models[id] || 0) + 1 } } };
}
export function recordSpend(usage, model, now = new Date()) {
  const next = addSpend(readSpend(), usage, model, now);
  try { window.localStorage.setItem(SPEND_KEY, JSON.stringify(next)); } catch { /* not counted */ }
  return next;
}
// This month and last: { thisMonth, lastMonth }, each { dollars, chats, models }.
export function spendSummary(spend = readSpend(), now = new Date()) {
  const empty = { dollars: 0, chats: 0, models: {} };
  return { thisMonth: spend[monthOf(now)] || empty, lastMonth: spend[monthOf(new Date(now.getFullYear(), now.getMonth() - 1, 1))] || empty };
}

// Roughly what a typical chat costs with a model, before sending it: a few
// thousand tokens in (mostly these instructions), the answer out (and the
// thinking, for those that think). Each screenshot adds about 1,500 in.
export function typicalCost(model) {
  return analysisCost({ input: 4000, output: analysisModel(model).thinks ? 6000 : 2500 }, model);
}
