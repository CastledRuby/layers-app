import { describe, expect, it } from 'vitest';
import { chatNumbers, minutesText, numbersFacts, placeMoments } from './lib/chatNumbers.js';

const chat = [
  '[2026-10-06 20:00] Sam Lee: got the job!!',
  '[2026-10-06 20:04] Liam: no way! how are you feeling?',
  '[2026-10-06 20:05] Liam: so proud',
  'of you',
  '[2026-10-06 20:20] Sam Lee: nervous haha',
  '[2026-10-06 20:21] Liam: that makes sense',
].join('\n');

describe('the numbers', () => {
  it('counts each side, a run in a row, questions and reply times, with a line carrying on the one before', () => {
    expect(chatNumbers(chat, { yourName: 'Liam' })).toEqual({
      you: { messages: 3, words: 13, questions: 1, inARow: 2, replyMins: 4 },
      them: { messages: 2, words: 5, questions: 0, inARow: 1, replyMins: 15 },
      started: 'them', ended: 'you',
    });
  });

  it('works without times, and counts a group as you and the others', () => {
    const n = chatNumbers('Ana: hi\nBen: hey\nMe: hi both, how was it?\nAna: good!', { yourName: 'Liam' });
    expect(n.you).toEqual({ messages: 1, words: 5, questions: 1, inARow: 1, replyMins: null });
    expect(n.them.messages).toBe(3);
  });

  it('is nothing for fewer than four messages, or one side only', () => {
    expect(chatNumbers('Sam: hi\nLiam: hey', { yourName: 'Liam' })).toBeNull();
    expect(chatNumbers('Sam: a\nSam: b\nSam: c\nSam: d', { yourName: 'Liam' })).toBeNull();
    expect(chatNumbers('', {})).toBeNull();
  });

  it('reads as facts for Claude, with tags', () => {
    const facts = numbersFacts(chatNumbers(chat, { yourName: 'Liam' }));
    expect(facts).toBe('[you] sent 3 messages (13 words, 1 with a question; at most 2 in a row); [them] sent 2 messages (5 words, 0 with a question; at most 1 in a row). [you] usually answered within 4 min, [them] within 15 min. [them] started, and [you] sent the last message.');
    expect(numbersFacts(null)).toBe('');
    expect([minutesText(0), minutesText(45), minutesText(150), minutesText(null)]).toEqual(['under a minute', '45 min', '3 h', null]);
  });
});

describe('placing moments', () => {
  const transcript = [{ who: 'them', text: 'I got the job!!' }, { who: 'you', text: 'No way, congrats! How do you feel?' }, { who: 'you', text: 'haha same' }];
  it('puts each on the line holding its quote, ignoring case and punctuation; the rest are left over', () => {
    const { byLine, left } = placeMoments(transcript, [
      { quote: 'how do you feel', kind: 'good' }, { quote: 'HAHA SAME', kind: 'missed' }, { quote: 'not in the chat', kind: 'good' },
    ]);
    expect([...byLine.keys()]).toEqual([1, 2]);
    expect(byLine.get(2).kind).toBe('missed');
    expect(left.map(m => m.quote)).toEqual(['not in the chat']);
  });
});
