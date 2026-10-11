// The log's questions, written for each person (lib/logQuestions.js): their
// name and layer, their goals' parts first, their weakest part marked, and
// what's saved about them worth asking after.
import { describe, expect, it } from 'vitest';
import { DIM_ORDER } from './data/constants.js';
import { dimQuestion, followUps, rateRows } from './lib/logQuestions.js';

const level = (n) => Object.fromEntries(DIM_ORDER.map(k => [k, n]));

describe('the questions for each person', () => {
  it('use their first name, in the words of where you are with them', () => {
    expect(dimQuestion('depth', { name: 'Sam Lee', layer: 1 })).toBe('How far past small talk did you get with Sam?');
    expect(dimQuestion('depth', { name: 'Ana', layer: 4 })).toBe('How much did you and Ana talk about what really matters?');
    expect(dimQuestion('trust', { name: 'Ana', layer: 3 })).toBe('How much did Ana open up about something personal?');
    // Every part has a different question at every layer.
    for (const dim of DIM_ORDER) expect(new Set([1, 2, 3, 4].map(layer => dimQuestion(dim, { name: 'Ana', layer }))).size).toBe(4);
  });

  it("ask the parts their goals are about first, saying which goal, and mark the weakest once they're not level", () => {
    const sam = { name: 'Sam', layer: 2, dims: { ...level(40), trust: 30 }, goals: [
      { id: 'g1', type: 'deeper', title: 'Have deeper conversations', progress: 20 },
      { id: 'g2', type: 'together', title: 'Spend more time together', progress: 100 }, // done: not first
    ] };
    const rows = rateRows(sam);
    expect(rows.map(r => r.dim)).toEqual(['depth', 'trust', 'reciprocity', 'interaction', 'sharedExperiences', 'listening']);
    expect(rows[0]).toMatchObject({ dim: 'depth', goal: 'Have deeper conversations' });
    expect(rows.find(r => r.dim === 'trust').weakest).toBe(true);
    expect(rows.filter(r => r.weakest)).toHaveLength(1);

    const ana = { name: 'Ana', layer: 1, dims: level(5), goals: [{ id: 'g', type: 'learn', title: 'Learn more about her', progress: 0 }] };
    expect(rateRows(ana).map(r => r.dim)).toEqual(['listening', 'depth', 'trust', 'reciprocity', 'interaction', 'sharedExperiences']);
    expect(rateRows(ana).some(r => r.weakest)).toBe(false); // someone just added: all level
  });

  it("ask after what's important now and plans that have just been, the newest two, never archived or old ones", () => {
    const riley = { name: 'Riley Ng', important: [
      { id: 'i1', text: 'Big exam on Friday', at: '2026-10-08', when: '2026-10-16' },
      { id: 'i2', text: 'Was unwell', at: '2026-10-10' },
      { id: 'i3', text: 'Old worry', at: '2026-07-01' },
      { id: 'i4', text: 'Sorted now', at: '2026-10-11', archived: true },
    ], plans: [
      { id: 'p1', text: 'Concert on Saturday', at: '2026-10-01', when: '2026-10-10' },
      { id: 'p2', text: 'Trip next month', at: '2026-10-01', when: '2026-11-20' }, // hasn't happened
    ] };
    expect(followUps(riley, '2026-10-12')).toEqual([
      { id: 'i1', text: 'Big exam on Friday', question: 'Did you ask Riley about "Big exam on Friday"?' },
      { id: 'i2', text: 'Was unwell', question: 'Did you ask Riley about "Was unwell"?' },
    ]);
    expect(followUps({ name: 'Riley', plans: riley.plans }, '2026-10-12').map(f => f.id)).toEqual(['p1']);
    expect(followUps({ name: 'Zoe' }, '2026-10-12')).toEqual([]);
  });
});
