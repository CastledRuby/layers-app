// The numbers first (decided 2026-10-11): facts about a chat counted here,
// free, before Claude reads it. Claude gets them as facts (lib/analysis.js,
// analysisRequest), so reciprocity and balance rest on numbers, and Coach shows
// them ("The numbers", components/AnalysisExtras.jsx). Lines are "Name: text",
// perhaps after a [YYYY-MM-DD HH:MM] time, as Layers writes chats from your
// exports; a line without a name carries on the message before it.
import { isYou } from './analysis.js';

const LINE = /^\s*(?:\[([^\]\n]{4,40})\]\s*)?([^:\n]{1,40}?):\s+(.+)$/;
const TIME = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/;
const timeOf = (s) => {
  const m = TIME.exec(String(s || ''));
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime() : null;
};
const words = (t) => (String(t).match(/\S+/g) || []).length;
const median = (list) => {
  if (!list.length) return null;
  const s = [...list].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

// { you, them: { messages, words, questions, inARow (the most in a row),
// replyMins (median minutes to answer the other side, or null) }, started,
// ended: 'you' | 'them' }, or null for fewer than four messages or one side
// only. "them" is everyone else in a group.
export function chatNumbers(text, { yourName = '' } = {}) {
  const msgs = [];
  String(text || '').split(/\r?\n/).forEach(line => {
    const m = LINE.exec(line);
    if (m) msgs.push({ side: isYou(m[2].trim(), yourName) ? 'you' : 'them', at: timeOf(m[1]), text: m[3].trim() });
    else if (line.trim() && msgs.length) msgs[msgs.length - 1].text += `\n${line.trim()}`;
  });
  if (msgs.length < 4 || !msgs.some(m => m.side === 'you') || !msgs.some(m => m.side === 'them')) return null;
  const side = (who) => {
    const mine = msgs.filter(m => m.side === who);
    let run = 0; let inARow = 0; const replies = [];
    msgs.forEach((m, i) => {
      run = m.side === who ? (msgs[i - 1] && msgs[i - 1].side === who ? run + 1 : 1) : 0;
      inARow = Math.max(inARow, run);
      const before = msgs[i - 1];
      if (m.side === who && before && before.side !== who && m.at !== null && before.at !== null) {
        const gap = (m.at - before.at) / 60000;
        if (gap >= 0 && gap < 24 * 60) replies.push(gap);
      }
    });
    return {
      messages: mine.length,
      words: mine.reduce((s, m) => s + words(m.text), 0),
      questions: mine.filter(m => m.text.includes('?')).length,
      inARow,
      replyMins: replies.length ? Math.round(median(replies)) : null,
    };
  };
  return { you: side('you'), them: side('them'), started: msgs[0].side, ended: msgs[msgs.length - 1].side };
}

// "5 min", "2 h", "under a minute".
export function minutesText(mins) {
  if (mins === null || mins === undefined) return null;
  if (mins < 1) return 'under a minute';
  if (mins < 90) return `${mins} min`;
  return `${Math.round(mins / 60)} h`;
}

// The numbers as Claude reads them: tags, not names.
export function numbersFacts(n, { group = false } = {}) {
  if (!n) return '';
  const them = group ? 'the others' : '[them]';
  const one = (who, s) => `${who} sent ${s.messages} ${s.messages === 1 ? 'message' : 'messages'} (${s.words} words, ${s.questions} with a question; at most ${s.inARow} in a row)`;
  const replies = [n.you.replyMins !== null && `[you] usually answered within ${minutesText(n.you.replyMins)}`, n.them.replyMins !== null && `${them} within ${minutesText(n.them.replyMins)}`].filter(Boolean);
  return [
    `${one('[you]', n.you)}; ${one(them, n.them)}.`,
    replies.length ? `${replies.join(', ')}.` : '',
    `${n.started === 'you' ? '[you]' : them} started, and ${n.ended === 'you' ? '[you] sent the last message' : `${them} sent the last message`}.`,
  ].filter(Boolean).join(' ');
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}?!' ]+/gu, ' ').replace(/\s+/g, ' ').trim();

// Each moment's line in the transcript (the first whose text holds its
// quote, or the quote holds the line): { byLine: Map(index -> moment), left:
// moments on no line }.
export function placeMoments(transcript = [], moments = []) {
  const byLine = new Map();
  const left = [];
  moments.forEach(m => {
    const q = norm(m.quote);
    const i = transcript.findIndex((line, k) => !byLine.has(k) && q && (norm(line.text).includes(q) || (norm(line.text).length > 8 && q.includes(norm(line.text)))));
    if (i >= 0) byLine.set(i, m); else left.push(m);
  });
  return { byLine, left };
}
