// Analyse all new (decided 2026-10-09, docs/roadmap.md): every new
// conversation in the Layers chats folder sent to Claude one after another,
// a day with someone at a time, and the answers kept in a queue to review in
// Coach. LayersApp runs it (useChatBatch in lib/hooks.js) so it carries on
// while you use the rest of Layers; this file is the part without React.
import { analysisDollars, analysisModel, KEPT_CHAT } from './analysis.js';
import { chatPeople, chatRows, conversationText, isoDayOf } from './chatImport.js';

// Fewer messages than this, or only one side talking, isn't worth a log: it's
// marked as seen without being sent.
export const TINY = 4;

// What there is to analyse: { items, people (ids), noPeople, noOwner }. Each
// item is one chat's new conversations on one day, merged, oldest first
// within each chat: { id, chatKey, title, source, day, end, ids, text, tiny,
// messages }. Chats with nobody in Layers, or where it isn't known which name
// is you, are left out (their titles listed).
export function batchPlan(chats = [], { people = [], yourName = '', progress = {}, now = Date.now() } = {}) {
  const rows = chatRows(chats, { people, yourName, progress, now }).filter(r => r.fresh.length);
  const items = [];
  const noPeople = [];
  const noOwner = [];
  const who = new Set();
  rows.forEach(({ chat, owner, ids, fresh }) => {
    if (!ids.length) { noPeople.push(chat.title); return; }
    if (!owner) { noOwner.push(chat.title); return; }
    const { nameFor } = chatPeople(chat, people, owner);
    const days = new Map();
    fresh.slice().reverse().forEach(conv => {
      const day = isoDayOf(conv.end);
      const same = days.get(day);
      if (same) { same.messages.push(...conv.messages); same.end = conv.end; }
      else days.set(day, { start: conv.start, end: conv.end, messages: [...conv.messages] });
    });
    days.forEach((conv, day) => {
      const tiny = conv.messages.length < TINY || new Set(conv.messages.map(m => m.sender)).size < 2;
      if (!tiny) ids.forEach(id => who.add(id));
      items.push({
        id: `${chat.key}|${day}|${conv.start}`, chatKey: chat.key, title: chat.title, source: chat.source, day, end: conv.end, ids,
        text: conversationText(conv, { owner, yourName, nameFor }), tiny, messages: conv.messages.length,
      });
    });
  });
  return { items, people: [...who], noPeople, noOwner };
}

// Roughly what sending these costs, in US$: the instructions and the chat in,
// the answer out (thinking models write more). Tiny ones aren't sent.
export function batchDollars(items, model) {
  const thinks = analysisModel(model).thinks;
  return items.filter(i => !i.tiny).reduce((sum, i) => sum + analysisDollars({ input: 3000 + Math.ceil(String(i.text || '').length / 3.5), output: thinks ? 6000 : 2800 }, model), 0);
}

// --- The queue (this laptop only) ------------------------------------------------
// Answers wait here until they're logged or skipped, even if Layers closes,
// since they've been paid for. They aren't synced or backed up until logged.
// [{ id, chatKey, title, source, day, personIds, model, result, chat, cost }
//  | { ..., error }], plus once dealt with: doneAt (ms) and loggedIds (the
// Journal entries made, so Undo, which removes them, brings the item back).
const QUEUE_KEY = 'layers-analysis-queue';
const isText = (s) => typeof s === 'string' && s.length > 0;
function cleanItem(it) {
  if (!it || typeof it !== 'object' || !isText(it.id) || !/^\d{4}-\d{2}-\d{2}$/.test(String(it.day)) || !Array.isArray(it.personIds)) return null;
  const answered = it.result && typeof it.result === 'object' && it.result.log && it.result.grading && Array.isArray(it.result.extractedInfo);
  if (!answered && !isText(it.error)) return null;
  return { ...it, chat: String(it.chat || '').slice(-KEPT_CHAT) };
}
export function readQueue() {
  try {
    const v = JSON.parse(window.localStorage.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(v) ? v.map(cleanItem).filter(Boolean) : [];
  } catch { return []; }
}
export function saveQueue(queue) {
  try { window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch { /* kept for this session only */ }
}
// What's waiting: not dealt with, or logged and then undone (its entries gone).
export function waiting(queue, journal = []) {
  const ids = new Set(journal.map(j => j.id));
  return queue.filter(it => !it.doneAt || (Array.isArray(it.loggedIds) && it.loggedIds.length > 0 && !it.loggedIds.some(id => ids.has(id))));
}
// Drops items dealt with before `before` (ms): past the time Undo is offered.
export function pruneQueue(queue, before) {
  return queue.filter(it => !it.doneAt || it.doneAt >= before);
}

// --- The monthly limit ------------------------------------------------------------
// Analyse all new stops before this month's spend (lib/analysis.js,
// spendSummary) would go past it. 0 is no limit. One chat at a time isn't held
// to it.
const LIMIT_KEY = 'layers-analysis-limit';
export const LIMITS = [2, 5, 10, 20, 0];
export const DEFAULT_LIMIT = 5;
export function readLimit() {
  try {
    const v = window.localStorage.getItem(LIMIT_KEY);
    const n = v === null ? DEFAULT_LIMIT : Number(v);
    return LIMITS.includes(n) ? n : DEFAULT_LIMIT;
  } catch { return DEFAULT_LIMIT; }
}
export function saveLimit(n) {
  try { window.localStorage.setItem(LIMIT_KEY, String(LIMITS.includes(n) ? n : DEFAULT_LIMIT)); } catch { /* this session only */ }
}
