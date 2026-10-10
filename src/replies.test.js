// Know what to say (lib/replies.js): your style from your own messages in
// logged chats, and the requests for reply ideas and the daily opener, with
// every name in your circle hidden and theirs put back in the answer.
import { describe, expect, it } from 'vitest';
import { cleanStyle, openerRequest, REPLY_SCHEMA, replyRequest, replyResult, openerResult, styleSamples } from './lib/replies.js';

const amelie = { id: 'a', name: 'Amelie Smith', layer: 4, aka: ['Mel'] };
const chloe = { id: 'c', name: 'Chloe', layer: 3 };
const noah = { id: 'n', name: 'Noah', layer: 2 };
const everyone = [amelie, chloe, noah];
const logged = (id, at, chat) => ({ id, personId: 'a', at, type: 'messaged', analysis: { grading: { overall: 70 }, chat } });

describe('your style', () => {
  const journal = [
    logged('j1', '2026-10-01', '[2026-10-01 09:00] Amelie: hi\n[2026-10-01 09:01] Liam: heyy whats up\n[2026-10-01 09:02] Liam: (photo)\n[2026-10-01 09:03] Liam: k'),
    logged('j2', '2026-10-05', 'Chloe: pizza?\nYou: omg yes 🍕 noah coming too?\nLiam C: see u at 7'),
    { ...logged('j3', '2026-10-05', 'Chloe: pizza?\nYou: omg yes 🍕 noah coming too?\nLiam C: see u at 7'), personId: 'c' }, // the same group chat on someone else's entry
    { id: 'j4', personId: 'a', at: '2026-10-06', type: 'talked' },
  ];
  it('takes your own lines from logged chats, newest first, each chat once, leaving out photos and one-letter replies', () => {
    expect(styleSamples(journal, 'Liam')).toEqual(['see u at 7', 'omg yes 🍕 noah coming too?', 'heyy whats up']);
    expect(styleSamples(journal, 'Liam', 2)).toHaveLength(2);
    expect(styleSamples([], 'Liam')).toEqual([]);
  });
  it('tidies the line you wrote in Me', () => {
    expect(cleanStyle('  lowercase,\n  lots of emoji ')).toBe('lowercase, lots of emoji');
    expect(cleanStyle('x'.repeat(300))).toHaveLength(200);
  });
});

describe('reply ideas', () => {
  const request = replyRequest({ people: [amelie], everyone, yourName: 'Liam', text: 'Mel: are you coming sat?? chloe said noah is\nLiam: maybe', samples: ['omg yes noah coming too?'], style: 'lowercase, lots of emoji' });
  it("hides every name in your circle: theirs as [them], yours as [you], anyone else's as [someone]", () => {
    const sent = JSON.stringify(request);
    expect(sent).not.toMatch(/Amelie|Mel\b|Liam|Chloe|chloe|Noah|noah/);
    expect(request.content[0].text).toBe('The latest messages:\n\n[them]: are you coming sat?? [someone] said [someone] is\n[you]: maybe');
    expect(request.system).toContain('- omg yes [someone] coming too?');
    expect(request.system).toContain('How the user describes their texting style: "lowercase, lots of emoji"');
    expect(request.system).toMatch(/Layer 4/);
    expect(request.model).toBe('claude-haiku-4-5');
  });
  it('asks for three replies and a read, in a format with no either-or fields', () => {
    expect(Object.keys(REPLY_SCHEMA.properties)).toEqual(['read', 'natural', 'playful', 'deeper']);
    expect(JSON.stringify(REPLY_SCHEMA)).not.toContain('anyOf');
    expect(request.system).toMatch(/natural .* playful .* deeper/s);
  });
  it('tags each person in a group, and puts first names back in the answer', () => {
    const group = replyRequest({ people: [amelie, chloe], everyone, yourName: 'Liam', text: 'Amelie: hi\nChloe: yo' });
    expect(group.content[0].text).toBe('The latest messages:\n\n[them 1]: hi\n[them 2]: yo');
    expect(replyResult({ read: '[them 2] wants a plan', natural: 'yes [them 1]!', playful: 7, deeper: '' }, [amelie, chloe])).toEqual({ read: 'Chloe wants a plan', natural: 'yes Amelie!', playful: '', deeper: '' });
  });
});

describe("the daily nudge's opener", () => {
  it('sends why, what you know and your latest times together, names hidden, and gets one opener back', () => {
    const request = openerRequest({ person: amelie, everyone, yourName: 'Liam', reason: 'Ask how "Amelie starts at the library" went', details: ['Her sister Mia is visiting', 'Loves Noah\'s band'], recent: ['Pizza with Chloe'], style: 'short' });
    const text = request.content[0].text;
    expect(text).toContain('Why message today: Ask how "[them] starts at the library" went');
    expect(text).toContain("- Loves [someone]'s band");
    expect(text).toContain('- Pizza with [someone]');
    expect(JSON.stringify(request)).not.toMatch(/Amelie|Liam|Chloe|Noah/);
    expect(openerResult({ opener: ' how was day one at the library [them]?? ' }, amelie)).toBe('how was day one at the library Amelie??');
    expect(openerResult(null, amelie)).toBe('');
  });
});
