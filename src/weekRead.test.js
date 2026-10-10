/** @vitest-environment jsdom */
// The big picture (lib/weekRead.js): the week's logs and who's gone quiet,
// every name a tag, Claude's read with names back, and the reads kept.
import { afterEach, describe, expect, it } from 'vitest';
import { readWeekReads, saveWeekRead, WEEK_SCHEMA, weekReadRequest, weekReadResult } from './lib/weekRead.js';

const amelie = { id: 'a', name: 'Amelie Smith', layer: 4 };
const chloe = { id: 'c', name: 'Chloe', layer: 3 };
const noah = { id: 'n', name: 'Noah', layer: 2 };
const people = [amelie, chloe, noah];
const journal = [
  { id: 'j1', personId: 'a', at: '2026-10-06', type: 'messaged', meaningfulness: 4, summary: 'Her interview, and Noah\'s party', analysis: { grading: { overall: 72, depth: 60, activeListening: 80, reciprocity: 55, naturalness: 70 }, review: { wentWell: ['You cheered Amelie on'], opportunity: 'Liam asked lots of questions' } } },
  { id: 'j2', personId: 'c', at: '2026-10-08', type: 'talked', meaningfulness: 3, reflection: 'Felt easy' },
  { id: 'j3', personId: 'a', at: '2026-09-30', type: 'talked', meaningfulness: 3 }, // last week
];
afterEach(() => window.localStorage.removeItem('layers-week-reads'));

describe("Claude's read of the week", () => {
  it("sends the week's logs and who's gone quiet, every name a tag", () => {
    const { request, who } = weekReadRequest({ from: '2026-10-05', to: '2026-10-11', people, journal, quiet: [{ person: noah, days: 30 }], yourName: 'Liam' });
    expect(who.map(p => p.id)).toEqual(['a', 'c', 'n']);
    const text = request.content[0].text;
    expect(text).toContain("Tue 2026-10-06: Messaged with [them 1], Personal (4 of 5); note: \"Her interview, and [them 3]'s party\"; Claude's scores: overall 72, listening 80, depth 60, balance 55, naturalness 70; went well: You cheered [them 1] on; missed: [you] asked lots of questions");
    expect(text).toContain('Thu 2026-10-08: Talked with [them 2], Good conversation (3 of 5); how it felt: "Felt easy"');
    expect(text).toContain('- [them 3], not seen for 30 days (Layer 2)');
    expect(text).not.toContain('2026-09-30');
    expect(JSON.stringify(request)).not.toMatch(/Amelie|Chloe|Noah|Liam/);
    expect(Object.keys(WEEK_SCHEMA.properties)).toEqual(['headline', 'wentWell', 'pattern', 'tryThisWeek', 'reachOut']);
    expect(JSON.stringify(WEEK_SCHEMA)).not.toContain('anyOf');
  });

  it("is nothing for a week with nothing logged, and puts names back in Claude's read", () => {
    expect(weekReadRequest({ from: '2026-10-12', to: '2026-10-18', people, journal })).toBeNull();
    expect(weekReadResult({ headline: 'A warm week with [them 1]', reachOut: 'Message [them 3]', pattern: 3 }, [amelie, chloe, noah])).toEqual({ headline: 'A warm week with Amelie', wentWell: '', pattern: '', tryThisWeek: '', reachOut: 'Message Noah' });
  });

  it('keeps each week\'s read, the newest 26', () => {
    for (let i = 0; i < 28; i++) saveWeekRead(`2026-${String(1 + Math.floor(i / 4)).padStart(2, '0')}-${String(1 + (i % 4) * 7).padStart(2, '0')}`, { headline: `week ${i}` }, i);
    const kept = readWeekReads();
    expect(Object.keys(kept)).toHaveLength(26);
    expect(kept['2026-07-22'].read.headline).toBe('week 27');
    expect(kept['2026-01-01']).toBeUndefined();
  });
});
