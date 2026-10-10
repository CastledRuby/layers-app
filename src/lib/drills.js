// Practice drills (decided 2026-10-10, docs/roadmap.md): one tricky message,
// you reply, and Claude scores it and shows a reply that lands better, in your
// style. A drill a day on Today until you've done one, and more in Coach →
// Practise beside the role-play. The messages are written here, so picking one
// is free; only your reply goes to Claude (anyone in your circle named in it
// hidden), through the same main-process call as Analyse (analysis-run).
import { analysisModel, DEFAULT_ANALYSIS_MODEL } from './analysis.js';
import { hideCircle, styleNotes } from './replies.js';
import { parseISODay } from './dates.js';

// name: who sent it (made up); who: how they are to you; text: their message;
// aim: what a good reply does.
export const DRILLS = [
  { key: 'dry-haha', name: 'Theo', who: 'a friend', text: 'haha', aim: "keep it going after a dry reply to your long message, without over-explaining or sulking" },
  { key: 'bad-news', name: 'Maya', who: 'a close friend', text: "didn't get the job. kinda gutted tbh", aim: 'acknowledge how she feels, without rushing to fix it or find a silver lining' },
  { key: 'vague-plan', name: 'Kai', who: 'a friend', text: 'we should hang out sometime!', aim: 'turn it into a real plan: something to do and when' },
  { key: 'compliment', name: 'Jess', who: 'someone from your course', text: "you're honestly so good at presenting, how do you do it", aim: 'take the compliment warmly, without brushing it off, and keep the chat going' },
  { key: 'favour', name: 'Ben', who: 'a friend', text: 'any chance you could help me move house all saturday?', aim: "say no clearly and kindly (you can't), perhaps offering something else" },
  { key: 'late-reply', name: 'Rory', who: "a friend you haven't talked to in a while", text: 'sorry for the late reply, been a crazy few weeks', aim: 'let it go easily, with no guilt, and pick things back up' },
  { key: 'good-news', name: 'Zoe', who: 'a friend', text: 'I GOT IN!!!', aim: 'celebrate with her, and ask about it' },
  { key: 'one-word', name: 'Sam', who: 'a friend', text: 'good', aim: 'they answered "how was your week?" with one word: reopen it with something specific, without pushing' },
  { key: 'weekend', name: 'Ana', who: 'a friend', text: 'what are you up to this weekend?', aim: 'answer for real, and ask back or invite them' },
  { key: 'raincheck', name: 'Leo', who: 'a friend', text: "so sorry, can we raincheck tonight? something came up", aim: 'be gracious, and suggest another time' },
  { key: 'vent', name: 'Priya', who: 'a close friend', text: 'ugh my flatmate left the dishes AGAIN', aim: 'be on her side, lightly, without making it bigger' },
  { key: 'advice', name: 'Noah', who: 'a friend', text: 'do you think I should text her back?', aim: 'help him think it through, rather than just deciding for him' },
  { key: 'quiet-check', name: 'Ella', who: 'a close friend', text: "did I do something wrong? you've been quiet", aim: "reassure her honestly, and say what's been going on" },
  { key: 'party', name: 'Mia', who: 'a newer friend', text: "want to come to my cousin's party saturday? you won't know anyone lol", aim: "answer honestly and warmly, whether it's a yes or a no" },
  { key: 'fine', name: 'Jamie', who: 'a close friend', text: "I'm fine.", aim: "check in gently: it doesn't sound fine" },
  { key: 'been-forever', name: 'Alex', who: "an old friend you haven't seen in a year", text: "omg hi!! it's been forever", aim: 'be warm and specific, and give them something to reply to' },
  { key: 'personal-q', name: 'Jess', who: "someone you're getting to know", text: 'so are you seeing anyone?', aim: "answer at your own comfort, and turn it back to them" },
  { key: 'disagree', name: 'Theo', who: 'a friend', text: 'honestly that movie was terrible', aim: 'disagree (you loved it) playfully, without starting a fight' },
  { key: 'for-fun', name: 'Kai', who: "someone you've just met", text: 'so what do you do for fun?', aim: 'give a real answer with something they can ask about, and ask back' },
  { key: 'lol-same', name: 'Sam', who: 'a friend', text: 'lol same', aim: 'the chat is fizzling out: open a new thread naturally' },
  { key: 'when-works', name: 'Ana', who: 'a friend', text: 'sure! when works for you?', aim: 'suggest a concrete time and place, instead of "whenever"' },
  { key: 'nervous', name: 'Maya', who: 'a close friend', text: 'big presentation tomorrow, kinda freaking out', aim: "encourage her specifically, not just \"you'll be fine\"" },
  { key: 'teased', name: 'Leo', who: 'a friend', text: "you're literally always late haha", aim: 'own it with humour, without getting defensive' },
  { key: 'apology', name: 'Priya', who: 'a close friend', text: 'sorry about yesterday, I was in a bad mood', aim: 'accept it, and show you care how she is' },
  { key: 'passing', name: 'Noah', who: 'a friend', text: "anyway gotta go, taking mum to her hospital appointment", aim: 'notice what he mentioned in passing, and ask about it kindly' },
  { key: 'how-are-you', name: 'Ella', who: 'a friend', text: 'hey how are you?', aim: 'answer with something real they can respond to, not just "good u?"' },
  { key: 'tips', name: 'Mia', who: 'a friend', text: 'any tips for my first half marathon?', aim: "help a little, and show interest in her and the race" },
  { key: 'meme', name: 'Jamie', who: 'a friend', text: '[sends a meme] this is literally you', aim: 'play along with the joke, and keep the banter going' },
];
export const drillByKey = (key) => DRILLS.find(d => d.key === key) || null;

// The drill for `day`: one you haven't done lately (recent: keys, newest
// last), turning over with the day, so it stays the same all day.
export function drillFor(day, recent = []) {
  const fresh = DRILLS.filter(d => !recent.includes(d.key));
  const list = fresh.length ? fresh : DRILLS;
  const n = Math.floor(parseISODay(day).getTime() / 86400000);
  return list[((n % list.length) + list.length) % list.length];
}
// The next one after `key`, for "Another" in Practise.
export function nextDrill(key, recent = []) {
  const fresh = DRILLS.filter(d => d.key === key || !recent.includes(d.key));
  const list = fresh.length > 1 ? fresh : DRILLS;
  const i = list.findIndex(d => d.key === key);
  return list[(i + 1) % list.length];
}

// --- Feedback --------------------------------------------------------------------
export const DRILL_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['score', 'worked', 'better', 'why'],
  properties: { score: { type: 'integer' }, worked: { type: 'string' }, better: { type: 'string' }, why: { type: 'string' } },
};
// The request: { system, content, schema, model }. everyone: your people, so
// any of them named in your reply are hidden; samples and style: how you
// write (lib/replies.js), for the better reply.
export function drillRequest({ drill, reply, everyone = [], yourName = '', samples = [], style = '', model = DEFAULT_ANALYSIS_MODEL }) {
  return {
    system: [
      'You coach the user, [you], on texting, inside Layers, a private app for getting better at conversation. [you] is practising one tricky message with a made-up person. Names of people the user knows have been swapped for tags.',
      'Score the reply from 0 to 100 for how well it does what it should here, the way a warm, socially skilled friend would judge it: natural, kind, specific, and keeping the conversation open. Most decent replies land between 50 and 80; save 90+ for ones you would not change.',
      'worked: one short sentence on what the reply does well (or the closest it gets). better: a reply [you] could send instead, one text message in their own style (their usual length, capitals, punctuation, emoji and slang), ready to send, no quotes. why: one short sentence on why that lands better. Speak to the user as "you".',
      styleNotes({ samples, style, yourName, everyone }),
    ].filter(Boolean).join('\n\n'),
    content: [{ type: 'text', text: `${drill.name}, ${drill.who}, texts:\n"${drill.text}"\n\nWhat a good reply does here: ${drill.aim}.\n\nThe user's reply:\n"${hideCircle(String(reply || '').trim(), { everyone, yourName })}"` }],
    schema: DRILL_SCHEMA,
    model: analysisModel(model).id,
  };
}
// Claude's answer, tidied: { score, worked, better, why }, or null without a better reply.
export function drillResult(raw) {
  const r = raw || {};
  const text = (s) => (typeof s === 'string' ? s.replace(/\[you\]/gi, 'you').trim() : '');
  const better = text(r.better).replace(/^"(.*)"$/s, '$1');
  if (!better) return null;
  const score = typeof r.score === 'number' && Number.isFinite(r.score) ? Math.max(0, Math.min(100, Math.round(r.score))) : null;
  return { score, worked: text(r.worked), better, why: text(r.why) };
}

// --- Done on this laptop ---------------------------------------------------------
// { recent: [keys, newest last, up to 20], today: { day, key, reply, score,
// worked, better, why } | null: the latest done, for Today }.
const KEY = 'layers-drills';
const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
export function readDrills() {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) || 'null') || {};
    const recent = (Array.isArray(v.recent) ? v.recent : []).filter(k => drillByKey(k)).slice(-20);
    const t = v.today;
    const today = t && isDay(t.day) && drillByKey(t.key) && typeof t.better === 'string'
      ? { day: t.day, key: t.key, reply: String(t.reply || ''), score: typeof t.score === 'number' ? t.score : null, worked: String(t.worked || ''), better: t.better, why: String(t.why || '') }
      : null;
    return { recent, today };
  } catch { return { recent: [], today: null }; }
}
export function saveDrill(day, key, reply, result) {
  const was = readDrills();
  const next = { recent: [...was.recent.filter(k => k !== key), key].slice(-20), today: { day, key, reply, ...result } };
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* this session only */ }
  return next;
}
