/** @vitest-environment jsdom */
// Analyse all new (lib/chatBatch.js): what's sent, a day with someone at a
// time; tiny conversations marked seen; chats left out until it's known who's
// who; roughly what it costs; the queue kept on this laptop; the monthly limit.
import { afterEach, describe, expect, it } from 'vitest';
import { batchDollars, batchPlan, DEFAULT_LIMIT, pruneQueue, readLimit, readQueue, saveLimit, saveQueue, waiting } from './lib/chatBatch.js';

const NOW = new Date(2026, 9, 9, 12).getTime(); // Friday 9 October 2026, noon
const at = (day, h, m = 0) => new Date(2026, 9, day, h, m).getTime();
const msg = (when, sender, text) => ({ at: when, sender, text });
const chat = (key, title, messages) => ({ key, source: 'whatsapp', title, participants: [...new Set(messages.map(m => m.sender))], messages });
const amelie = { id: 'a', name: 'Amelie', layer: 4 };
const chloe = { id: 'c', name: 'Chloe', layer: 3 };

afterEach(() => { window.localStorage.removeItem('layers-analysis-queue'); window.localStorage.removeItem('layers-analysis-limit'); });

describe('what Analyse all new sends', () => {
  const amelieChat = chat('whatsapp:amelie', 'Amelie', [
    msg(at(1, 9), 'Amelie', 'old'), msg(at(1, 9, 5), 'Liam', 'news'), // before the last one analysed
    msg(at(6, 9), 'Amelie', 'morning!'), msg(at(6, 9, 2), 'Liam', 'hey'), // Tue: two conversations…
    msg(at(6, 21), 'Amelie', 'I got the job!!'), msg(at(6, 21, 1), 'Liam', 'No way, congrats!'),
    msg(at(7, 18), 'Amelie', 'running late'), msg(at(7, 18, 1), 'Amelie', '10 min'), // Wed: tiny and one-sided
    msg(at(8, 20), 'Amelie', 'how was it?'), msg(at(8, 20, 1), 'Liam', 'good'), msg(at(8, 20, 2), 'Amelie', 'yay'), msg(at(8, 20, 3), 'Liam', 'you?'),
  ]);
  const strangers = chat('whatsapp:footy', 'Footy', [msg(at(8, 10), 'Bob', 'game on'), msg(at(8, 10, 1), 'Liam', 'yes')]);
  const unsure = { ...chat('instagram:1', 'Chloe and Sam', [msg(at(8, 10), 'Chloe', 'hi'), msg(at(8, 10, 1), 'Sammy', 'yo'), msg(at(8, 10, 2), 'Chloe', 'x'), msg(at(8, 10, 3), 'Sammy', 'y')]), source: 'instagram' };
  const plan = batchPlan([amelieChat, strangers, unsure], { people: [amelie, chloe], yourName: 'Liam', progress: { 'whatsapp:amelie': { at: at(1, 9, 5) } }, now: NOW });

  it("takes each day's new conversations with someone together, oldest first", () => {
    expect(plan.items.map(i => [i.day, i.messages, i.tiny])).toEqual([['2026-10-06', 4, false], ['2026-10-07', 2, true], ['2026-10-08', 4, false]]);
    const tue = plan.items[0];
    expect(tue).toMatchObject({ chatKey: 'whatsapp:amelie', title: 'Amelie', source: 'whatsapp', ids: ['a'], end: at(6, 21, 1) });
    expect(tue.text).toBe('[2026-10-06 09:00] Amelie: morning!\n[2026-10-06 09:02] Liam: hey\n[2026-10-06 21:00] Amelie: I got the job!!\n[2026-10-06 21:01] Liam: No way, congrats!');
    expect(new Set(plan.items.map(i => i.id)).size).toBe(3);
    expect(plan.people).toEqual(['a']);
  });

  it("leaves out chats with nobody in Layers, and ones where it can't tell which name is you", () => {
    expect(plan.items.some(i => i.chatKey === 'whatsapp:footy')).toBe(false);
    expect(plan.noOwner).toEqual(['Chloe and Sam']);
    const picked = batchPlan([unsure], { people: [amelie, chloe], yourName: 'Liam', progress: { 'instagram:1': { me: 'Sammy' } }, now: NOW });
    expect(picked.items).toHaveLength(1);
    expect(picked.items[0].text).toContain('Liam: yo'); // you, under your name, so it's hidden before sending
  });

  it("counts only what's written: a day of reels and photos sent back and forth is tiny", () => {
    const note = (when, sender, text) => ({ ...msg(when, sender, text), note: true });
    const reels = chat('instagram:amelie', 'Amelie', [
      note(at(8, 9), 'Amelie', '(shared a reel: "lol")'), note(at(8, 9, 1), 'Liam', '(shared a reel)'), note(at(8, 9, 2), 'Amelie', '(photo)'),
      msg(at(8, 9, 3), 'Liam', 'haha'), msg(at(8, 9, 4), 'Amelie', 'ikr'), msg(at(8, 9, 5), 'Liam', 'same'),
    ]);
    const [item] = batchPlan([reels], { people: [amelie], yourName: 'Liam', now: NOW }).items;
    expect(item).toMatchObject({ messages: 6, tiny: true });
    const talked = chat('instagram:amelie', 'Amelie', [...reels.messages, msg(at(8, 9, 6), 'Amelie', 'see you sat?')]);
    expect(batchPlan([talked], { people: [amelie], yourName: 'Liam', now: NOW }).items[0].tiny).toBe(false);
  });

  it('costs roughly a couple of cents a conversation with Haiku, nothing for tiny ones, more with a thinking model', () => {
    const haiku = batchDollars(plan.items, 'claude-haiku-4-5');
    expect(haiku).toBeGreaterThan(0.02);
    expect(haiku).toBeLessThan(0.06);
    expect(batchDollars(plan.items.filter(i => i.tiny), 'claude-haiku-4-5')).toBe(0);
    expect(batchDollars(plan.items, 'claude-opus-5-5')).toBeGreaterThan(haiku * 4);
  });
});

describe('the queue', () => {
  const answered = { id: 'x|2026-10-06|1', day: '2026-10-06', personIds: ['a'], result: { log: {}, grading: { overall: 70 }, extractedInfo: [] }, chat: 'hi' };
  it("is kept on this laptop, and anything that isn't an answer or a problem is dropped", () => {
    saveQueue([answered, { id: 'y', day: '2026-10-07', personIds: ['a'], error: "Claude couldn't finish." }, { id: 'z', day: 'Tuesday', personIds: [] }, null, { id: 'w', day: '2026-10-07', personIds: ['a'] }]);
    expect(readQueue().map(i => i.id)).toEqual(['x|2026-10-06|1', 'y']);
    window.localStorage.setItem('layers-analysis-queue', 'not json');
    expect(readQueue()).toEqual([]);
  });
  it('shows what is waiting: not dealt with, or logged and then undone', () => {
    const queue = [answered, { ...answered, id: 'skipped', doneAt: 5, loggedIds: [] }, { ...answered, id: 'logged', doneAt: 5, loggedIds: ['j1'] }, { ...answered, id: 'undone', doneAt: 5, loggedIds: ['j2'] }];
    expect(waiting(queue, [{ id: 'j1' }]).map(i => i.id)).toEqual(['x|2026-10-06|1', 'undone']);
    expect(pruneQueue(queue, 6).map(i => i.id)).toEqual(['x|2026-10-06|1']);
    expect(pruneQueue(queue, 5)).toHaveLength(4);
  });
});

describe('the monthly limit', () => {
  it('is US$5 until changed, and only one of the choices', () => {
    expect(readLimit()).toBe(DEFAULT_LIMIT);
    expect(DEFAULT_LIMIT).toBe(5);
    saveLimit(20);
    expect(readLimit()).toBe(20);
    saveLimit(0);
    expect(readLimit()).toBe(0);
    window.localStorage.setItem('layers-analysis-limit', '7');
    expect(readLimit()).toBe(5);
  });
});
