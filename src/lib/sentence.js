// Reads a typed sentence into a plan or a log, for the quick-add box
// (Ctrl+Shift+L) and Ctrl+K: "coffee w priya fri 10am", "dinner with sam
// and alex tomorrow 7pm 2h", "gym every mon wed fri 7am", "log sam deep",
// "talked to alex yesterday". "w" (or "w/") is short for "with". Dates are read day first ("12/10" is 12
// October), as in New Zealand. Nothing is saved here: readSentence returns
// what it understood, and the caller shows it before saving.
//
// readSentence(text, { people, today, now }) returns null for an empty
// sentence, or one of:
//   { kind: 'plan', title, template, personIds, unknown, day, allDay, time,
//     duration, repeat: 'once' | 'daily' | 'weekly', weekdays, missing }
//   { kind: 'log', personIds, unknown, type, meaningfulness, day, note,
//     missing }
// `unknown` is the names after "with" that aren't anyone in Layers;
// `missing` lists what still has to be said: 'when' (a plan with no day,
// time or kind), 'who' and 'rating' (a log).

import { templateFor } from './calendar.js';
import { parseISODay, toISODate } from './dates.js';

const WEEKDAYS = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 };
const MONTHS = { jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11 };
export const RATING_WORDS = { brief: 1, casual: 2, good: 3, personal: 4, deep: 5 };
// The word that picks a template, and the time a meal word means.
const TEMPLATE_WORDS = {
  coffee: 'coffee', call: 'call', phone: 'call', ring: 'call', facetime: 'call',
  hangout: 'hangout', chill: 'hangout',
  dinner: 'meal', lunch: 'meal', breakfast: 'meal', brunch: 'meal', meal: 'meal',
  activity: 'activity', game: 'activity', games: 'activity', movie: 'activity', movies: 'activity', film: 'activity',
  study: 'study', revise: 'study', revision: 'study', homework: 'study',
  checkin: 'checkin',
};
const MEAL_TIMES = { breakfast: 9 * 60, brunch: 10 * 60 + 30, lunch: 12 * 60 + 30 };
const PART_TIMES = { morning: 9 * 60, noon: 12 * 60, midday: 12 * 60, afternoon: 15 * 60, evening: 19 * 60, tonight: 19 * 60 };
// Past-tense words that make it a log, and the interaction type they mean.
const LOG_VERBS = {
  talked: 'talked', chatted: 'talked', spoke: 'talked', caughtup: 'talked',
  called: 'called', phoned: 'called', rang: 'called',
  messaged: 'messaged', texted: 'messaged', dmed: 'messaged',
  hung: 'hangout', met: 'hangout', saw: 'hangout', had: 'hangout', visited: 'hangout',
  played: 'activity', studied: 'activity', went: 'activity',
};
const LOG_NOUNS = { call: 'called', phone: 'called', message: 'messaged', text: 'messaged', hangout: 'hangout', coffee: 'hangout', lunch: 'hangout', dinner: 'hangout', breakfast: 'hangout', brunch: 'hangout', game: 'activity', games: 'activity', movie: 'activity', study: 'activity', gym: 'activity' };
const FILLERS = new Set(['with', 'and', 'to', 'at', 'on', 'in', 'for', 'the', 'a', 'an', 'me', 'my', 'from', 'by', 'next', 'this', 'every', '&', '+']);
const PREPOSITIONS = new Set(['at', 'on', 'in', 'for', 'next', 'this', 'every', 'from', 'by', 'to']);

const addDays = (day, n) => { const d = parseISODay(day); return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
const weekdayOf = (day) => parseISODay(day).getDay();
// The next `weekday` from `day` (that day itself counts).
const nextWeekday = (day, weekday) => addDays(day, (weekday - weekdayOf(day) + 7) % 7);
const lastWeekday = (day, weekday) => addDays(day, -((weekdayOf(day) - weekday + 7) % 7));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const listNames = (names) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

// "7" said for a time of day: 1 to 7 are evening hours, 8 to 11 morning.
function guessHour(h) {
  if (h === 12) return 12;
  if (h >= 1 && h <= 7) return h + 12;
  return h;
}
function clock(h, m, ampm) {
  if (h > 23 || m > 59) return null;
  if (ampm === 'am') return ((h % 12) * 60) + m;
  if (ampm === 'pm') return ((h % 12) + 12) * 60 + m;
  return h * 60 + m;
}

function tokenize(text) {
  // "w/sam" is "w/ sam".
  const raw = text.trim().replace(/[,;!?]+/g, ' ').replace(/(^|\s)w\/(?=\S)/gi, '$1w/ ').split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const low = raw[i].toLowerCase().replace(/'s$/, '');
    if (low === 'w' || low === 'w/') { out.push({ raw: 'with', low: 'with' }); continue; }
    const next = (raw[i + 1] || '').toLowerCase();
    // Two-word phrases read as one.
    if ((low === 'check' && next === 'in') || (low === 'hang' && next === 'out') || ((low === 'catch' || low === 'caught') && next === 'up')) {
      out.push({ raw: `${raw[i]} ${raw[i + 1]}`, low: low === 'check' ? 'checkin' : low === 'hang' ? 'hangout' : low === 'catch' ? 'catchup' : 'caughtup' });
      i++;
      continue;
    }
    out.push({ raw: raw[i], low });
  }
  return out;
}

export function readSentence(text, { people = [], today, now = new Date() } = {}) {
  if (!text || !text.trim()) return null;
  const day0 = today || toISODate(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const t = tokenize(text);
  const used = new Array(t.length).fill(false);
  const take = (...idx) => idx.forEach(i => { used[i] = true; });
  const low = (i) => (t[i] ? t[i].low : '');

  let day = null; let time = null; let duration = null; let repeat = 'once'; let weekdays = null;
  let logWord = false; let rating = null; let partOfDay = false;
  let rollable = false; // a date said without a year ("12 oct"), which a plan reads as the next one
  let mealWord = null;

  const isLog = low(0) === 'log';
  if (isLog) take(0);

  for (let i = 0; i < t.length; i++) {
    if (used[i]) continue;
    const w = low(i);
    const n = low(i + 1);

    // Repeats: "every day", "daily", "weekdays", "every mon wed", "mondays", "weekly".
    if ((w === 'every' && n === 'day') || w === 'daily' || w === 'everyday') { repeat = 'daily'; take(i); if (w === 'every') take(i + 1); continue; }
    if (w === 'weekdays' || (w === 'every' && n === 'weekday')) { repeat = 'weekly'; weekdays = [1, 2, 3, 4, 5]; take(i); if (w === 'every') take(i + 1); continue; }
    if (w === 'weekends' || (w === 'every' && n === 'weekend')) { repeat = 'weekly'; weekdays = [0, 6]; take(i); if (w === 'every') take(i + 1); continue; }
    if ((w === 'every' && n === 'week') || w === 'weekly') { repeat = 'weekly'; take(i); if (w === 'every') take(i + 1); continue; }
    if (w === 'every' && n in WEEKDAYS) {
      const days = [];
      let j = i + 1;
      while (j < t.length && (low(j) in WEEKDAYS || ((low(j) === 'and' || low(j) === '&') && low(j + 1) in WEEKDAYS))) {
        if (low(j) in WEEKDAYS) days.push(WEEKDAYS[low(j)]);
        take(j); j++;
      }
      take(i);
      repeat = 'weekly'; weekdays = [...new Set(days)].sort((a, b) => a - b);
      i = j - 1;
      continue;
    }
    if (/s$/.test(w) && w.slice(0, -1) in WEEKDAYS && w.length > 4) { repeat = 'weekly'; weekdays = [...new Set([...(weekdays || []), WEEKDAYS[w.slice(0, -1)]])].sort((a, b) => a - b); take(i); continue; }

    // Days.
    if (w === 'today') { day = day0; take(i); continue; }
    if (w === 'tonight') { day = day0; if (time === null) { time = PART_TIMES.tonight; partOfDay = true; } take(i); continue; }
    if (w === 'tomorrow' || w === 'tmrw' || w === 'tmr' || w === 'tomoz') { day = addDays(day0, 1); take(i); continue; }
    if (w === 'yesterday') { day = addDays(day0, -1); take(i); continue; }
    if ((w === 'next' || w === 'this') && n in WEEKDAYS) {
      let d = nextWeekday(day0, WEEKDAYS[n]);
      // "next Friday" is next week's; "this Friday" the coming one.
      const daysToSunday = (7 - weekdayOf(day0)) % 7;
      if (w === 'next' && d <= addDays(day0, daysToSunday)) d = addDays(d, 7);
      day = d; take(i, i + 1); i++; continue;
    }
    if (w === 'in' && /^\d+$/.test(n) && /^(days?|weeks?)$/.test(low(i + 2))) {
      day = addDays(day0, Number(n) * (low(i + 2).startsWith('week') ? 7 : 1)); take(i, i + 1, i + 2); i += 2; continue;
    }
    if (w === 'in' && n === 'a' && low(i + 2) === 'week') { day = addDays(day0, 7); take(i, i + 1, i + 2); i += 2; continue; }
    if (w in WEEKDAYS) { day = isLog ? null : nextWeekday(day0, WEEKDAYS[w]); t[i].weekday = WEEKDAYS[w]; take(i); continue; }
    // "12/10", "12/10/2026"
    let m = w.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/);
    if (m) {
      const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null;
      const d = new Date(y || parseISODay(day0).getFullYear(), Number(m[2]) - 1, Number(m[1]));
      if (d.getDate() === Number(m[1])) { day = toISODate(d); rollable = !y; take(i); continue; }
    }
    // "12 oct", "12th october", "oct 12"
    const dayNum = (s) => { const x = s.match(/^(\d{1,2})(st|nd|rd|th)?$/); return x ? Number(x[1]) : null; };
    if (dayNum(w) && n in MONTHS) {
      const d = new Date(parseISODay(day0).getFullYear(), MONTHS[n], dayNum(w));
      if (d.getMonth() === MONTHS[n]) { day = toISODate(d); rollable = true; take(i, i + 1); i++; continue; }
    }
    if (w in MONTHS && dayNum(n)) {
      const d = new Date(parseISODay(day0).getFullYear(), MONTHS[w], dayNum(n));
      if (d.getMonth() === MONTHS[w]) { day = toISODate(d); rollable = true; take(i, i + 1); i++; continue; }
    }

    // Times: "10am", "7:30pm", "19:00", "10 am", "at 7", "noon", "evening".
    m = w.match(/^(\d{1,2})(?::(\d{2}))?(am|pm|a|p)$/);
    if (m) { const v = clock(Number(m[1]), Number(m[2] || 0), m[3].startsWith('a') ? 'am' : 'pm'); if (v !== null) { time = v; take(i); continue; } }
    m = w.match(/^(\d{1,2})(?::(\d{2}))?$/);
    if (m && (n === 'am' || n === 'pm')) { const v = clock(Number(m[1]), Number(m[2] || 0), n); if (v !== null) { time = v; take(i, i + 1); i++; continue; } }
    m = w.match(/^(\d{1,2}):(\d{2})$/);
    if (m) { const h = Number(m[1]); const v = clock(h >= 13 || h === 0 ? h : guessHour(h), Number(m[2]), null); if (v !== null) { time = v; take(i); continue; } }
    if (w === 'at' && /^\d{1,2}$/.test(n) && Number(n) >= 1 && Number(n) <= 12) { time = guessHour(Number(n)) * 60; take(i, i + 1); i++; continue; }
    if (w in PART_TIMES && w !== 'tonight') { if (time === null || partOfDay) { time = PART_TIMES[w]; partOfDay = true; } take(i); continue; }

    // How long: "2h", "90m", "1.5 hours", "for an hour", "half an hour".
    m = w.match(/^(\d+(?:\.\d+)?)(h|hr|hrs|hour|hours|m|min|mins|minutes)$/);
    if (m) { duration = Math.round(Number(m[1]) * (m[2].startsWith('m') ? 1 : 60)); take(i); continue; }
    if (/^\d+(\.\d+)?$/.test(w) && /^(h|hr|hrs|hours?|m|mins?|minutes)$/.test(n)) { duration = Math.round(Number(w) * (n.startsWith('m') ? 1 : 60)); take(i, i + 1); i++; continue; }
    if (w === 'half' && n === 'an' && low(i + 2) === 'hour') { duration = 30; take(i, i + 1, i + 2); i += 2; continue; }
    if ((w === 'an' || w === 'one') && n === 'hour') { duration = 60; take(i, i + 1); i++; continue; }

    // How it went (logs): a rating word, or 1-5 on its own.
    if (w in RATING_WORDS) { rating = RATING_WORDS[w]; take(i); continue; }
    if (/^[1-5]$/.test(w) && (isLog || logWordAt(t))) { rating = Number(w); take(i); continue; }

    if (w in LOG_VERBS || w === 'caughtup') logWord = true;
  }

  // People: full names first ("isla b"), then first names, closest first when
  // two share one. Nicknames ("Also known as") count as names.
  const byCloseness = [...people].sort((a, b) => (b.layer - a.layer) || ((b.overall || 0) - (a.overall || 0)));
  const personIds = [];
  const names = byCloseness.flatMap(p => [p.name, ...(p.aka || [])].map(n => ({ p, words: n.toLowerCase().split(/\s+/) })));
  for (let i = 0; i < t.length; i++) {
    if (used[i]) continue;
    const full = names
      .filter(({ words }) => words.every((wd, k) => !used[i + k] && low(i + k) === wd))
      .sort((a, b) => b.words.length - a.words.length)[0];
    const first = full || names.find(({ words }) => words[0] === low(i));
    if (first) {
      const len = full ? full.words.length : 1;
      for (let k = 0; k < len; k++) take(i + k);
      t[i].person = first.p;
      if (!personIds.includes(first.p.id)) personIds.push(first.p.id);
      i += len - 1;
    }
  }
  // Names after "with" that aren't in Layers ("coffee with Jo", "with Sam
  // and Jo"): the list after "with" runs on through names and "and".
  const unknown = [];
  let listing = false;
  t.forEach((tok, i) => {
    if (tok.low === 'with') { listing = true; return; }
    if (!listing) return;
    if (tok.person || tok.low === 'and' || tok.low === '&') return;
    if (used[i] || tok.low in TEMPLATE_WORDS || tok.low in LOG_VERBS || FILLERS.has(tok.low) || !/^\p{L}/u.test(tok.raw)) { listing = false; return; }
    unknown.push(cap(tok.raw));
  });

  // A plan for a date gone by this year means next year's.
  if (!isLog && !logWord && rollable && day && day < day0) {
    const d = parseISODay(day);
    day = toISODate(new Date(d.getFullYear() + 1, d.getMonth(), d.getDate()));
  }
  // A log: it says "log", has a past-tense verb, or happened before today.
  const kind = isLog || logWord || (day && day < day0) ? 'log' : 'plan';
  if (kind === 'log') {
    // A weekday in a log is the last one, not the next.
    const wd = t.find((tok, i) => used[i] && tok.weekday !== undefined);
    if (wd) day = lastWeekday(day0, wd.weekday);
    if (day && day > day0) day = day0;
    const verb = t.find(tok => tok.low in LOG_VERBS);
    const noun = t.find(tok => tok.low in LOG_NOUNS);
    const type = verb ? LOG_VERBS[verb.low] : noun ? LOG_NOUNS[noun.low] : 'talked';
    const about = t.findIndex(tok => tok.low === 'about');
    const note = about >= 0 ? t.slice(about + 1).filter((_, k) => !used[about + 1 + k]).map(tok => tok.raw).join(' ') : '';
    const missing = [];
    if (!personIds.length) missing.push('who');
    if (rating === null) missing.push('rating');
    return { kind, personIds, unknown, type, meaningfulness: rating, day: day || day0, note, missing };
  }

  // A plan: the kind from its words, then the title from what's left.
  const tWord = t.find((tok, i) => !used[i] && tok.low in TEMPLATE_WORDS);
  if (tWord && tWord.low in MEAL_TIMES) mealWord = tWord.low;
  const template = templateFor(tWord ? TEMPLATE_WORDS[tWord.low] : 'custom');
  const who = personIds.map(id => people.find(p => p.id === id).name);
  const rest = t.map((tok, i) => (used[i] && !tok.person ? null : tok)).filter(Boolean);
  // Drop prepositions left dangling by a removed day or time ("on", "at").
  const words = rest.filter((tok, k) => !(PREPOSITIONS.has(tok.low) && (!rest[k + 1] || FILLERS.has(rest[k + 1].low))));
  while (words.length && FILLERS.has(words[words.length - 1].low)) words.pop();
  while (words.length && FILLERS.has(words[0].low)) words.shift();
  const meaningful = words.filter(tok => !tok.person && !FILLERS.has(tok.low));
  let title;
  if (!meaningful.length) title = (template || templateFor('custom')).title(listNames([...who, ...unknown]));
  // A word that stands for an activity or studying ("movie", "games",
  // "revise") names it, rather than the template's general title.
  else if (meaningful.length === 1 && tWord && meaningful[0] === tWord && !mealWord && ['activity', 'study'].includes(template.key) && tWord.low !== template.key) title = [cap(tWord.raw), listNames([...who, ...unknown])].filter(Boolean).join(' with ');
  else if (meaningful.length === 1 && tWord && meaningful[0] === tWord && !mealWord) title = template.title(listNames([...who, ...unknown]));
  else title = cap(words.map(tok => (tok.person ? tok.person.name : tok.raw)).join(' '));

  const startTime = time !== null ? time : mealWord ? MEAL_TIMES[mealWord] : tWord ? template.time : null;
  let start = day;
  // With no day said, a plan starts on the first day it can still happen:
  // a time already gone today means the next one.
  const stillToday = startTime === null || startTime > nowMin;
  if (repeat === 'weekly' && weekdays === null) weekdays = [weekdayOf(day || day0)];
  if (repeat === 'weekly' && !start) start = [...Array(8).keys()].map(k => addDays(day0, k)).find(d => weekdays.includes(weekdayOf(d)) && (d > day0 || stillToday));
  if (repeat === 'daily' && !start) start = stillToday ? day0 : addDays(day0, 1);
  if (!start && startTime !== null) start = stillToday ? day0 : addDays(day0, 1);
  const missing = [];
  if (!start && !tWord) missing.push('when');
  return {
    kind, title, template: template.key, personIds, unknown,
    day: start || day0,
    allDay: startTime === null,
    time: startTime,
    duration: duration || (tWord ? template.duration : 60),
    repeat, weekdays: repeat === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : repeat === 'weekly' ? weekdays : null,
    missing,
  };
}

// Whether a lone 1-5 is a rating: only in a log-like sentence.
function logWordAt(t) { return t.some(tok => tok.low in LOG_VERBS || tok.low === 'log'); }

// What PlanSheet would save for a plan sentence (handleSavePlan's fields).
export function planFieldsOf(r, alert) {
  const kind = r.repeat === 'once' ? 'oneoff' : 'recurring';
  return {
    title: r.title, template: r.template, personIds: r.personIds, kind,
    date: kind === 'oneoff' ? r.day : null,
    weekdays: kind === 'recurring' ? r.weekdays : null,
    from: kind === 'recurring' ? r.day : undefined,
    allDay: r.allDay, time: r.allDay ? null : r.time, duration: r.allDay ? null : r.duration,
    alert, goalId: null,
  };
}
