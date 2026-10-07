// Chats from your exports, for Coach's Analyse (docs/renderer/state-and-data.md,
// "Chats from your exports"): WhatsApp's "Export chat" (a .txt, usually in a
// zip) and Instagram's "Download your information" (Messages, as JSON), saved
// in the Layers chats folder, which the main process reads
// (electron/chatfiles.cjs). Here each chat is read into messages, split into
// conversations, matched to your people, and written out as text for
// analysis. Where you got up to in each chat is kept on this computer.

import { isYou, personNamed } from './analysis.js';

// A pause this long starts a new conversation.
export const CONVERSATION_GAP_HOURS = 3;
// The most of one conversation sent (the main process takes 60,000 characters).
const MAX_TEXT = 50000;
const PROGRESS_KEY = 'layers-chat-progress';

// --- WhatsApp ----------------------------------------------------------------
// iOS: "[6/10/26, 9:41:03 pm] Amelie: hi"; Android: "6/10/26, 9:41 pm - Amelie: hi".
// Either way the date may be day first or month first, and the time 12 or 24 hour.
const STAMP = String.raw`(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4}),?\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*([ap]\.?\s?m\.?)?`;
const IOS_LINE = new RegExp(`^\\[${STAMP}\\]\\s*(.*)$`, 'i');
const ANDROID_LINE = new RegExp(`^${STAMP}\\s*[-–]\\s*(.*)$`, 'i');
const ch = (...codes) => String.fromCharCode(...codes);
// Direction marks WhatsApp puts around names, attachments and notices
// (U+200E, U+200F, U+202A to U+202E, U+2066 to U+2069) and a byte-order mark;
// iOS marks an attachment or notice with one just after the name; and the
// narrow and no-break spaces in its times.
const MARKS = new RegExp(`[${ch(0x200e, 0x200f)}${ch(0x202a)}-${ch(0x202e)}${ch(0x2066)}-${ch(0x2069)}${ch(0xfeff)}]`, 'g');
const MARKED = new RegExp(`:\\s?[${ch(0x200e, 0x200f)}]`);
const ODD_SPACES = new RegExp(`[${ch(0x202f, 0xa0)}]`, 'g');
const SYSTEM = /end-to-end encrypted|created (this )?group|\badded\b|\bremoved\b|\bleft\b|changed (the|this|their|your) |security code|disappearing messages|joined using|pinned a message|now an admin|changed to|is a contact|blocked this contact|unblocked this contact/i;

// An attachment or notice in place of a message's text: what to show for it
// ('' to leave the message out), or null if it's an ordinary message.
function standIn(text, marked) {
  const t = text.trim();
  if (/^(this message was deleted|you deleted this message)\.?$/i.test(t) || t === 'null') return '';
  if (/^<media omitted>$/i.test(t)) return '(photo or video)';
  if (!marked && !/^<attached: /i.test(t)) return null;
  if (/image omitted|\.(jpe?g|png|webp|heic)>?$/i.test(t)) return '(photo)';
  if (/video omitted|\.(mp4|mov)>?$/i.test(t)) return '(video)';
  if (/audio omitted|\.(opus|m4a|mp3)>?$/i.test(t)) return '(voice message)';
  if (/sticker omitted|\.webp>?$/i.test(t)) return '(sticker)';
  if (/gif omitted/i.test(t)) return '(GIF)';
  if (/contact card omitted|\.vcf>?$/i.test(t)) return '(contact)';
  if (/document omitted|^<attached: /i.test(t)) return '(file)';
  if (/(missed )?(voice|video|group) call/i.test(t)) return '(call)';
  if (SYSTEM.test(t)) return '';
  return null;
}

function stampOf(m, dayFirst) {
  const [a, b, c, h, min] = [1, 2, 3, 4, 5].map(i => Number(m[i]));
  const sec = Number(m[6]) || 0;
  const ampm = m[7];
  let year; let month; let day;
  if (String(m[1]).length === 4) [year, month, day] = [a, b, c];
  else { year = c < 100 ? 2000 + c : c; [day, month] = dayFirst ? [a, b] : [b, a]; }
  let hour = h;
  if (ampm) { const pm = /^p/i.test(ampm); if (pm && hour < 12) hour += 12; if (!pm && hour === 12) hour = 0; }
  return new Date(year, month - 1, day, hour, min, sec).getTime();
}

// Whether this computer writes dates day first (31/12), as New Zealand does.
function writesDayFirst() {
  try { return new Date(2006, 10, 22).toLocaleDateString().trim().startsWith('22'); } catch { return true; }
}

// Which way round an export's dates are when every one could be either
// (6/10 is 6 October or 10 June): the reading that keeps the messages in
// order, isn't in the future, and ends nearest when the file was made
// (\`near\`, ms). Null if they're the same either way.
function guessDayFirst(parsed, near) {
  const look = (dayFirst) => {
    const times = parsed.map(p => stampOf(p.stamp, dayFirst));
    const last = Math.max(...times);
    return {
      backwards: times.filter((t, i) => i > 0 && t < times[i - 1] - 60000).length,
      future: near && last > near + 36 * 3600 * 1000 ? 1 : 0,
      distance: near ? Math.abs(near - last) : 0,
    };
  };
  const a = look(true);
  const b = look(false);
  if (a.future !== b.future) return a.future < b.future;
  if (a.backwards !== b.backwards) return a.backwards < b.backwards;
  if (!(a.future && b.future) && a.distance !== b.distance) return a.distance < b.distance; // unless `near` can't be right
  return null;
}

// A WhatsApp export's text, as messages in order: [{ at (ms), sender, text }].
// System notices are left out and attachments become "(photo)" and the
// like; a message over several lines stays one message. \`near\`: when the
// export was made (its file's time), to tell which way round its dates are
// when they could be either; then \`dayFirst\`, then this computer's way.
export function parseWhatsApp(text, { dayFirst, near } = {}) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const parsed = [];
  let last = null;
  lines.forEach(raw => {
    const line = raw.replace(ODD_SPACES, ' ');
    const plain = line.replace(MARKS, '');
    const m = plain.match(IOS_LINE) || plain.match(ANDROID_LINE);
    if (!m) { if (last && plain.trim()) last.text += `\n${plain}`; return; }
    const rest = m[8];
    const colon = rest.indexOf(': ');
    if (colon < 1) { last = null; return; } // a notice with no sender (Android)
    const marked = MARKED.test(line);
    last = { stamp: m, sender: rest.slice(0, colon).trim(), text: rest.slice(colon + 2).replace(/\s*<This message was edited>$/i, ''), marked };
    parsed.push(last);
  });
  // A date that only works one way round decides it; otherwise the export's own times.
  const first = parsed.map(p => Number(p.stamp[1]));
  const second = parsed.map(p => Number(p.stamp[2]));
  const order = first.some(n => n > 12 && n < 32) ? true : second.some(n => n > 12) ? false
    : (parsed.length ? guessDayFirst(parsed, near) : null) ?? dayFirst ?? writesDayFirst();
  return parsed.map(p => {
    const sub = standIn(p.text, p.marked);
    return sub === '' ? null : { at: stampOf(p.stamp, order), sender: p.sender, text: sub ?? p.text.trim() };
  }).filter(m => m && m.text && m.sender);
}

// --- Instagram -----------------------------------------------------------------
// Instagram's JSON spells every non-English character as its UTF-8 bytes
// ("Ã©" for "é"); this undoes it.
export function fixMetaText(s) {
  if (typeof s !== 'string') return '';
  const codes = Array.from(s, c => c.charCodeAt(0));
  if (!codes.some(n => n >= 0x80) || codes.some(n => n > 0xff)) return s;
  try { return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(codes)); } catch { return s; }
}

function instagramText(msg) {
  const content = fixMetaText(msg.content || '');
  if (/^(liked a message|reacted .+ to (your|a) message|.+ sent an attachment\.)$/i.test(content)) return '';
  if (msg.photos) return content || '(photo)';
  if (msg.videos) return content || '(video)';
  if (msg.audio_files) return '(voice message)';
  if (msg.sticker) return '(sticker)';
  if (msg.share) return content ? `${content} (shared a post)` : '(shared a post)';
  if (typeof msg.call_duration === 'number') return '(call)';
  return content;
}

// Instagram's messages files ({ path, text }), as chats: [{ id, title,
// participants, messages }], each chat's messages in order.
export function parseInstagram(files = []) {
  const threads = new Map();
  files.forEach(({ path, text }) => {
    const m = String(path).match(/messages\/inbox\/([^/]+)\/message_\d+\.json$/);
    if (!m) return;
    let data = null;
    try { data = JSON.parse(text); } catch { return; }
    const t = threads.get(m[1]) || { id: m[1], title: '', participants: [], messages: [] };
    t.title = fixMetaText(data.title || '') || t.title;
    (data.participants || []).forEach(p => { const n = fixMetaText(p && p.name); if (n && !t.participants.includes(n)) t.participants.push(n); });
    (data.messages || []).forEach(msg => {
      const textOf = msg && typeof msg.timestamp_ms === 'number' ? instagramText(msg) : '';
      if (textOf) t.messages.push({ at: msg.timestamp_ms, sender: fixMetaText(msg.sender_name), text: textOf });
    });
    threads.set(m[1], t);
  });
  return [...threads.values()].map(t => ({ ...t, messages: t.messages.sort((a, b) => a.at - b.at) })).filter(t => t.messages.length);
}

// --- Chats ---------------------------------------------------------------------
// The chats in one export file ({ name, modified }) from what the main
// process read ({ kind, title, files }): [{ key, source, title, participants,
// messages }]. A WhatsApp chat's key is its name, an Instagram chat's its id,
// so later exports of the same chat join up.
export function chatsFromExport(file, read, { dayFirst } = {}) {
  if (!read || read.error) return [];
  if (read.kind === 'whatsapp') {
    const messages = parseWhatsApp((read.files[0] || {}).text, { dayFirst, near: file.modified });
    const title = read.title || String(file.name).replace(/\.(zip|txt)$/i, '');
    return messages.length ? [{ key: `whatsapp:${title.toLowerCase()}`, source: 'whatsapp', title, participants: [...new Set(messages.map(m => m.sender))], messages }] : [];
  }
  if (read.kind === 'instagram') {
    return parseInstagram(read.files).map(t => ({ key: `instagram:${t.id}`, source: 'instagram', title: t.title || t.participants.join(', '), participants: t.participants, messages: t.messages }));
  }
  return [];
}

// The same chat from several exports (WhatsApp exported again, or Instagram
// downloads of different weeks) as one, every message once.
export function mergeChats(chats) {
  const byKey = new Map();
  chats.forEach(c => {
    const had = byKey.get(c.key);
    if (!had) { byKey.set(c.key, { ...c, messages: [...c.messages] }); return; }
    const seen = new Set(had.messages.map(m => `${m.at}|${m.sender}|${m.text}`));
    c.messages.forEach(m => { if (!seen.has(`${m.at}|${m.sender}|${m.text}`)) had.messages.push(m); });
    had.participants = [...new Set([...had.participants, ...c.participants])];
    had.messages.sort((a, b) => a.at - b.at);
  });
  return [...byKey.values()];
}

// Which name in a chat is you: one you picked before, else your name (or its
// first part), else on Instagram the name in every one of your chats, else in
// a two-person chat the one who isn't the chat's name. Null if it can't tell.
export function ownerOf(chat, { yourName = '', picked, everywhere = [] } = {}) {
  const names = [...new Set([...chat.participants, ...chat.messages.map(m => m.sender)])];
  if (picked && names.includes(picked)) return picked;
  const byName = names.filter(n => isYou(n, yourName));
  if (byName.length === 1) return byName[0];
  const common = names.filter(n => everywhere.includes(n));
  if (common.length === 1) return common[0];
  if (names.length === 2 && names.includes(chat.title)) return names.find(n => n !== chat.title);
  return null;
}
// The names in every one of these chats (on Instagram, that's you), when
// there are at least two chats to tell by.
export function everywhereName(chats) {
  if (chats.length < 2) return [];
  const [firstChat, ...rest] = chats.map(c => new Set([...c.participants, ...c.messages.map(m => m.sender)]));
  return [...firstChat].filter(n => rest.every(s => s.has(n)));
}

// Who in your circle a chat is with: { ids, nameFor } (nameFor gives the
// name a message is shown with: theirs in Layers, so it's hidden properly).
export function chatPeople(chat, people, owner) {
  const ids = [];
  const map = new Map();
  const names = [...new Set([...chat.participants, ...chat.messages.map(m => m.sender)])].filter(n => n !== owner);
  names.forEach(n => { const p = personNamed(n, people); if (p) { map.set(n, p.name); if (!ids.includes(p.id)) ids.push(p.id); } });
  if (!ids.length && chat.source === 'whatsapp') { const p = personNamed(chat.title, people); if (p && names.length <= 1) { ids.push(p.id); names.forEach(n => map.set(n, p.name)); } }
  return { ids, nameFor: (sender) => map.get(sender) || sender };
}

// A chat split into conversations wherever there's a long pause: [{ start,
// end (ms), messages }], oldest first.
export function splitConversations(messages, gapHours = CONVERSATION_GAP_HOURS) {
  const out = [];
  messages.forEach(m => {
    const cur = out[out.length - 1];
    if (cur && m.at - cur.end <= gapHours * 3600 * 1000) { cur.messages.push(m); cur.end = m.at; }
    else out.push({ start: m.at, end: m.at, messages: [m] });
  });
  return out;
}

const pad = (n) => String(n).padStart(2, '0');
const isoMinute = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const isoDayOf = (ms) => isoMinute(ms).slice(0, 10);

// One conversation as text for analysis: "[2026-10-06 21:41] Amelie: hi",
// your messages under your name in Layers and theirs under theirs (so both
// are hidden before it's sent). A very long one keeps its end.
export function conversationText(conv, { owner, yourName = '', nameFor = (n) => n } = {}) {
  const lines = conv.messages.map(m => `[${isoMinute(m.at)}] ${m.sender === owner ? (yourName || 'Me') : nameFor(m.sender)}: ${m.text.replace(/\s*\n\s*/g, ' / ')}`);
  let total = 0;
  let from = lines.length;
  while (from > 0 && total + lines[from - 1].length + 1 <= MAX_TEXT) { from -= 1; total += lines[from].length + 1; }
  return `${from > 0 ? '(Earlier messages in this conversation left out.)\n' : ''}${lines.slice(from).join('\n')}`;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const clock = (d) => `${d.getHours() % 12 || 12}:${pad(d.getMinutes())}`;
// "Tue 6 Oct · 9:41–10:15 pm · 24 messages".
export function conversationLabel(conv) {
  const a = new Date(conv.start);
  const b = new Date(conv.end);
  const half = (d) => (d.getHours() < 12 ? 'am' : 'pm');
  const time = conv.start === conv.end ? `${clock(a)} ${half(a)}`
    : isoDayOf(conv.start) !== isoDayOf(conv.end) ? `${clock(a)} ${half(a)} to ${DAYS[b.getDay()]} ${clock(b)} ${half(b)}`
      : half(a) === half(b) ? `${clock(a)}–${clock(b)} ${half(b)}` : `${clock(a)} ${half(a)}–${clock(b)} ${half(b)}`;
  const n = conv.messages.length;
  return `${DAYS[a.getDay()]} ${a.getDate()} ${MONTHS[a.getMonth()]}${a.getFullYear() !== new Date().getFullYear() ? ` ${a.getFullYear()}` : ''} · ${time} · ${n} message${n === 1 ? '' : 's'}`;
}

// Each chat with its conversations and which are new, for Coach's list and
// the week review: [{ chat, owner, ids (your people in it), convs (newest
// first), fresh (the new ones), last }], chats with something new first. A
// conversation is new after the last one you analysed from that chat, or,
// for a chat Layers hasn't seen before, if it's from the last `newDays`.
export const NEW_DAYS = 14;
export function chatRows(chats, { people = [], yourName = '', progress = {}, now = Date.now(), newDays = NEW_DAYS } = {}) {
  const everywhere = everywhereName(chats.filter(c => c.source === 'instagram'));
  return chats.map(chat => {
    const mine = progress[chat.key] || {};
    const owner = ownerOf(chat, { yourName, picked: mine.me, everywhere });
    const { ids } = chatPeople(chat, people, owner);
    const convs = splitConversations(chat.messages).reverse();
    const since = mine.at || now - newDays * 86400000;
    return { chat, owner, ids, convs, fresh: convs.filter(c => c.end > since), last: chat.messages[chat.messages.length - 1].at };
  }).sort((a, b) => Number(b.fresh.length > 0) - Number(a.fresh.length > 0) || b.last - a.last);
}

// --- Where you got up to (this computer only) ------------------------------------
// { [chat key]: { at: the last message analysed (ms), me?: which name is you } }
export function readChatProgress() {
  try { const v = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; }
}
export function saveChatProgress(key, change) {
  const all = readChatProgress();
  const next = { ...all, [key]: { ...(all[key] || {}), ...change } };
  try { window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next)); } catch { /* kept for this session only */ }
  return next;
}

// --- Reading the folder --------------------------------------------------------------
// Each export read once, until its file changes.
const cache = new Map();
// Every chat in the Layers chats folder (bridge: the main process's
// listChatExports and readChatExport): { chats, problems: [{ name, error }] }.
export async function loadChatExports(bridge, { dayFirst } = {}) {
  const files = await bridge.listChatExports();
  const all = [];
  const problems = [];
  for (const f of files || []) {
    if (f.kind === 'instagram-html') { problems.push({ name: f.name, error: 'That Instagram download is in HTML. Download it again choosing JSON as the format.' }); continue; }
    const hit = cache.get(f.name);
    if (hit && hit.modified === f.modified) { all.push(...hit.chats); continue; }
    const read = await bridge.readChatExport(f.name);
    if (!read || read.error) { problems.push({ name: f.name, error: (read && read.error) || "Couldn't read that file." }); continue; }
    const chats = chatsFromExport(f, read, { dayFirst });
    cache.set(f.name, { modified: f.modified, chats });
    all.push(...chats);
  }
  return { chats: mergeChats(all), problems };
}
