/** @vitest-environment jsdom */
// Practise (lib/practice.js): a turn's request for a made-up person or one of
// yours (names hidden; their saved details and how they write), their reply
// with names back, the practice as a chat for Analyse's feedback, and the
// scores kept on this laptop for Me's chart.
import { afterEach, describe, expect, it } from 'vitest';
import { addPractice, practiceText, practiceTrend, readPractice, situation, SITUATIONS, theirSamples, TURN_SCHEMA, turnRequest, turnResult } from './lib/practice.js';

const amelie = { id: 'a', name: 'Amelie Smith', layer: 4, aka: ['Mel'] };
const chloe = { id: 'c', name: 'Chloe', layer: 3 };
afterEach(() => window.localStorage.removeItem('layers-practice'));

describe('a turn', () => {
  it('with a made-up person: who they are, your aim, and the first message theirs when they start', () => {
    const r = turnRequest({ situationKey: 'bad-news', everyone: [amelie, chloe], yourName: 'Liam', messages: [] });
    expect(r.system).toContain("You are Maya, a close friend who just found out she didn't get the job");
    expect(r.system).toContain("support her: listen, acknowledge how she feels, don't rush to fix it");
    expect(r.content[0].text).toBe('Start the conversation with the first message from Maya.');
    expect(TURN_SCHEMA.required).toEqual(['reply']);
    const next = turnRequest({ situationKey: 'bad-news', everyone: [amelie, chloe], yourName: 'Liam', messages: [{ who: 'them', text: 'didnt get it' }, { who: 'you', text: 'oh no, Amelie said you were sure. so sorry' }] });
    expect(next.content[0].text).toBe("The conversation so far:\n\nMaya: didnt get it\n[you]: oh no, [someone] said you were sure. so sorry\n\nWrite Maya's next message.");
    expect(JSON.stringify(next)).not.toMatch(/Amelie|Liam/);
  });

  it('with one of your people: their layer, what you know and how they write, every name hidden, and theirs put back', () => {
    const r = turnRequest({ situationKey: 'hangout', person: amelie, everyone: [amelie, chloe], yourName: 'Liam', details: ['Plays netball with Chloe'], samples: ['omg yesss'], messages: [{ who: 'you', text: 'hey Mel' }] });
    expect(r.system).toMatch(/You are \[them\], in Layer 4/);
    expect(r.system).toContain('- Plays netball with [someone]');
    expect(r.system).toContain('- omg yesss');
    expect(r.content[0].text).toContain('[you]: hey [them]');
    expect(JSON.stringify(r)).not.toMatch(/Amelie|Mel\b|Chloe|Liam/);
    expect(turnResult({ reply: ' haha [them] here, yes!! ' }, amelie)).toBe('haha Amelie here, yes!!');
    expect(turnResult({ reply: 'sure' })).toBe('sure');
    expect(turnResult(null)).toBe('');
  });

  it("takes their own lines from chats you've logged with them", () => {
    const journal = [{ id: 'j', personId: 'a', at: '2026-10-01', analysis: { chat: 'Mel: omg yesss\nLiam: haha\nAmelie: see u there\nChloe: me too' } }];
    expect(theirSamples(journal, amelie, 'Liam')).toEqual(['see u there', 'omg yesss']);
  });

  it('has the situations you picked, each with someone to play and an aim', () => {
    expect(SITUATIONS.map(s => s.key)).toEqual(['chat', 'new', 'hangout', 'quiet', 'bad-news', 'say-no', 'mixup']);
    SITUATIONS.forEach(s => { expect(s.name).toBeTruthy(); expect(s.aim).toBeTruthy(); expect(['you', 'them']).toContain(s.starts); });
    expect(situation('nope').key).toBe('chat');
  });
});

describe('feedback and kept scores', () => {
  it('writes the practice as a chat for Analyse, you under your name', () => {
    expect(practiceText([{ who: 'them', text: 'hi' }, { who: 'you', text: 'hey' }], { situationKey: 'new', yourName: 'Liam' })).toBe('Jess: hi\nLiam: hey');
    expect(practiceText([{ who: 'you', text: 'hey' }], { situationKey: 'new', person: amelie, yourName: 'Liam' })).toBe('Liam: hey');
  });
  it('keeps the scores (cleaned), and charts each day', () => {
    addPractice({ at: '2026-10-08', situation: 'new', grading: { overall: 60.4, depth: 50, activeListening: 70, reciprocity: 55, naturalness: 140 } });
    addPractice({ at: '2026-10-09', situation: 'odd', personId: 'a', grading: { overall: 70 } });
    addPractice({ at: '2026-10-09', situation: 'chat', grading: { overall: 80 } });
    const kept = readPractice();
    expect(kept[0]).toEqual({ at: '2026-10-08', situation: 'new', grading: { overall: 60, depth: 50, activeListening: 70, reciprocity: 55, naturalness: 100 } });
    expect(kept[1]).toMatchObject({ situation: 'chat', personId: 'a' });
    expect(practiceTrend(kept, new Date(2026, 9, 10)).map(p => [p.date, p.practice])).toEqual([['Oct 8', 60], ['Oct 9', 75]]);
    window.localStorage.setItem('layers-practice', 'oops');
    expect(readPractice()).toEqual([]);
  });
});
