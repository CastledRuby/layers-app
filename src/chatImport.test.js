// Chats from your exports (lib/chatImport.js): WhatsApp's export as iOS and
// Android write it, Instagram's download, conversations split at long
// pauses, who's who, and the text sent for analysis.
import { describe, expect, it } from 'vitest';
import { chatPeople, chatsFromExport, conversationLabel, conversationText, everywhereName, fixMetaText, mergeChats, ownerOf, parseInstagram, parseWhatsApp, splitConversations } from './lib/chatImport.js';

const LRM = String.fromCharCode(0x200e);
const NNBSP = String.fromCharCode(0x202f);
const when = (ms) => { const d = new Date(ms); return [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()]; };

const IOS = [
  `${LRM}[6/10/26, 9:41:03${NNBSP}pm] Amelie: ${LRM}Messages and calls are end-to-end encrypted. Only people in this chat can read them.`,
  `[6/10/26, 9:41:03${NNBSP}pm] Amelie: I got the job!!`,
  'so happy',
  `[6/10/26, 9:42:10${NNBSP}pm] Liam: No way, congrats! I left work early today`,
  `${LRM}[6/10/26, 9:43:00${NNBSP}pm] Amelie: ${LRM}image omitted`,
  `[6/10/26, 9:44:00${NNBSP}pm] Amelie: This message was deleted`,
  `[13/10/26, 8:00:00${NNBSP}am] Liam: how was day one?`,
].join('\n');

describe('WhatsApp exports', () => {
  it("reads iOS's export: names, times, messages over several lines, photos, and no notices", () => {
    const msgs = parseWhatsApp(IOS);
    expect(msgs.map(m => [when(m.at), m.sender, m.text])).toEqual([
      [[2026, 10, 6, 21, 41], 'Amelie', 'I got the job!!\nso happy'],
      [[2026, 10, 6, 21, 42], 'Liam', 'No way, congrats! I left work early today'],
      [[2026, 10, 6, 21, 43], 'Amelie', '(photo)'],
      [[2026, 10, 13, 8, 0], 'Liam', 'how was day one?'],
    ]);
  });

  it("reads Android's, 24-hour times, and month-first dates when that's the only way they work", () => {
    const android = ['6/10/26, 21:41 - Messages and calls are end-to-end encrypted.', '6/10/26, 21:41 - Amelie: hey', '6/10/26, 21:45 - Liam: <Media omitted>', '6/10/26, 21:46 - Amelie: nice <This message was edited>'].join('\n');
    expect(parseWhatsApp(android, { dayFirst: true }).map(m => [when(m.at), m.sender, m.text])).toEqual([
      [[2026, 10, 6, 21, 41], 'Amelie', 'hey'], [[2026, 10, 6, 21, 45], 'Liam', '(photo or video)'], [[2026, 10, 6, 21, 46], 'Amelie', 'nice'],
    ]);
    const us = '[10/13/26, 8:00:00 AM] Liam: hi\n[10/6/26, 9:00:00 PM] Amelie: yo';
    expect(parseWhatsApp(us, { dayFirst: true }).map(m => when(m.at))).toEqual([[2026, 10, 13, 8, 0], [2026, 10, 6, 21, 0]]);
    expect(parseWhatsApp('[1/2/26, 9:00 am] A: x', { dayFirst: true }).map(m => when(m.at)[1])).toEqual([2]);
    expect(parseWhatsApp('[1/2/26, 9:00 am] A: x', { dayFirst: false }).map(m => when(m.at)[1])).toEqual([1]);
  });

  it("works out which way round dates are from the export itself when they could be either", () => {
    // 7/10/26: exported on 7 October, so it's 7 October, not 10 July, whatever this computer's settings.
    const exported = new Date(2026, 9, 7, 21, 5).getTime();
    expect(parseWhatsApp('[7/10/26, 9:00 pm] A: hi', { dayFirst: false, near: exported }).map(m => when(m.at))).toEqual([[2026, 10, 7, 21, 0]]);
    // ...or, exported in July, 10 July.
    expect(parseWhatsApp('[7/10/26, 9:00 pm] A: hi', { dayFirst: true, near: new Date(2026, 6, 10, 22, 0).getTime() }).map(m => when(m.at))).toEqual([[2026, 7, 10, 21, 0]]);
    // Messages are in order: 12/10 then 1/11 is October to November, not December to January.
    expect(parseWhatsApp(['[12/10/26, 9:00 am] A: a', '[1/11/26, 9:00 am] A: b'].join('\n'), { dayFirst: false }).map(m => when(m.at).slice(0, 3))).toEqual([[2026, 10, 12], [2026, 11, 1]]);
    // Never in the future.
    expect(parseWhatsApp('[3/11/26, 9:00 am] A: a', { dayFirst: true, near: new Date(2026, 2, 12).getTime() }).map(m => when(m.at).slice(0, 3))).toEqual([[2026, 3, 11]]);
  });

  it('is one chat per export, named after the file', () => {
    const [chat] = chatsFromExport({ name: 'WhatsApp Chat - Amelie.zip' }, { kind: 'whatsapp', title: 'Amelie', files: [{ path: '_chat.txt', text: IOS }] });
    expect(chat).toMatchObject({ key: 'whatsapp:amelie', source: 'whatsapp', title: 'Amelie', participants: ['Amelie', 'Liam'] });
    expect(chatsFromExport({ name: 'x.zip' }, { error: 'nope' })).toEqual([]);
  });
});

describe('Instagram downloads', () => {
  // Instagram writes each non-English character as its UTF-8 bytes.
  const meta = (s) => String.fromCharCode(...new TextEncoder().encode(s));
  const files = [
    { path: 'your_instagram_activity/messages/inbox/amelie_123/message_1.json', text: JSON.stringify({
      title: meta('Amélie'), participants: [{ name: meta('Amélie') }, { name: 'Liam' }],
      messages: [
        { sender_name: 'Liam', timestamp_ms: 3000, content: meta('see you there 😂') },
        { sender_name: meta('Amélie'), timestamp_ms: 2000, content: 'Liked a message' },
        { sender_name: meta('Amélie'), timestamp_ms: 1000, photos: [{ uri: 'x.jpg' }] },
        { sender_name: meta('Amélie'), timestamp_ms: 1500, share: { link: 'https://x' }, content: 'look' },
      ] }) },
    { path: 'your_instagram_activity/messages/inbox/amelie_123/message_2.json', text: JSON.stringify({ messages: [{ sender_name: 'Liam', timestamp_ms: 500, content: 'hi' }] }) },
    { path: 'messages/inbox/chloe_9/message_1.json', text: JSON.stringify({ title: 'Chloe', participants: [{ name: 'Chloe' }, { name: 'Liam' }], messages: [{ sender_name: 'Chloe', timestamp_ms: 10, content: 'yo' }] }) },
    { path: 'messages/inbox/broken_1/message_1.json', text: '{nope' },
  ];

  it('reads every chat, fixing the lettering, in order, without likes and reactions', () => {
    const [a, c] = parseInstagram(files);
    expect(a).toMatchObject({ id: 'amelie_123', title: 'Amélie', participants: ['Amélie', 'Liam'] });
    expect(a.messages.map(m => [m.at, m.sender, m.text])).toEqual([[500, 'Liam', 'hi'], [1000, 'Amélie', '(photo)'], [1500, 'Amélie', 'look (shared a post)'], [3000, 'Liam', 'see you there 😂']]);
    expect(c.title).toBe('Chloe');
    expect(fixMetaText('plain')).toBe('plain');
    expect(fixMetaText('already é')).toBe('already é');
  });

  it("knows you're the one in every chat", () => {
    const chats = chatsFromExport({ name: 'instagram.zip' }, { kind: 'instagram', files });
    expect(chats.map(c => c.key)).toEqual(['instagram:amelie_123', 'instagram:chloe_9']);
    expect(everywhereName(chats)).toEqual(['Liam']);
    expect(ownerOf(chats[0], { yourName: 'Sam', everywhere: ['Liam'] })).toBe('Liam');
  });
});

describe('chats', () => {
  const people = [{ id: 'a', name: 'Amelie' }, { id: 'c', name: 'Chloe' }];
  const chat = (over) => ({ key: 'whatsapp:x', source: 'whatsapp', title: 'Amelie', participants: ['Amelie', 'Liam W'], messages: [{ at: 1, sender: 'Amelie', text: 'hi' }, { at: 2, sender: 'Liam W', text: 'yo' }], ...over });

  it('finds which name is you', () => {
    expect(ownerOf(chat(), { yourName: 'Liam' })).toBe('Liam W');
    expect(ownerOf(chat(), { yourName: 'Sam' })).toBe('Liam W'); // two people, and Amelie is the chat
    expect(ownerOf(chat({ title: 'Mel' }), { yourName: 'Sam' })).toBeNull();
    expect(ownerOf(chat({ title: 'Mel' }), { yourName: 'Sam', picked: 'Amelie' })).toBe('Amelie');
  });

  it("matches the others to your people, under their names in Layers", () => {
    const group = chat({ participants: ['Amelie R 🌸', 'Chloe', 'Jess', 'Liam'], messages: [{ at: 1, sender: 'Amelie R 🌸', text: 'hi' }] });
    const { ids, nameFor } = chatPeople(group, people, 'Liam');
    expect(ids).toEqual(['a', 'c']);
    expect([nameFor('Amelie R 🌸'), nameFor('Jess')]).toEqual(['Amelie', 'Jess']);
    // A two-person WhatsApp chat named after them, though their own name on it differs.
    expect(chatPeople(chat({ participants: ['Mel', 'Liam'], messages: [{ at: 1, sender: 'Mel', text: 'x' }] }), people, 'Liam').ids).toEqual(['a']);
  });

  it('joins later exports of the same chat, every message once', () => {
    const one = chat({ messages: [{ at: 1, sender: 'Amelie', text: 'hi' }] });
    const two = chat({ messages: [{ at: 1, sender: 'Amelie', text: 'hi' }, { at: 5, sender: 'Liam W', text: 'new' }] });
    expect(mergeChats([two, one]).map(c => c.messages.map(m => m.at))).toEqual([[1, 5]]);
  });

  it('splits a chat into conversations at pauses of three hours or more', () => {
    const h = 3600 * 1000;
    const t0 = new Date(2026, 9, 6, 21, 41).getTime();
    const msgs = [0, 0.5, 2.5, 6, 6.1, 30].map((x, i) => ({ at: t0 + x * h, sender: i % 2 ? 'Liam' : 'Amelie', text: `m${i}` }));
    const convs = splitConversations(msgs);
    expect(convs.map(c => c.messages.length)).toEqual([3, 2, 1]);
    expect(conversationLabel(convs[0])).toBe('Tue 6 Oct · 9:41 pm to Wed 12:11 am · 3 messages');
    expect(conversationLabel(convs[1])).toBe('Wed 7 Oct · 3:41–3:47 am · 2 messages');
    expect(conversationLabel(convs[2])).toBe('Thu 8 Oct · 3:41 am · 1 message');
  });

  it("writes a conversation out with exact times, you under your name, and keeps the end of a very long one", () => {
    const t0 = new Date(2026, 9, 6, 21, 41).getTime();
    const conv = { start: t0, end: t0 + 60000, messages: [{ at: t0, sender: 'Amelie R', text: 'I got it\nthe job' }, { at: t0 + 60000, sender: 'Liam W', text: 'congrats' }] };
    expect(conversationText(conv, { owner: 'Liam W', yourName: 'Liam', nameFor: () => 'Amelie' })).toBe('[2026-10-06 21:41] Amelie: I got it / the job\n[2026-10-06 21:42] Liam: congrats');
    const long = { messages: Array.from({ length: 2000 }, (_, i) => ({ at: t0 + i * 1000, sender: 'Amelie', text: `message number ${i} ${'x'.repeat(20)}` })) };
    const text = conversationText(long, { owner: 'Liam' });
    expect(text.length).toBeLessThan(51000);
    expect(text.startsWith('(Earlier messages in this conversation left out.)')).toBe(true);
    expect(text.endsWith(`message number 1999 ${'x'.repeat(20)}`)).toBe(true);
  });
});
