// Unit tests for relationship progression, skills and the date helpers the
// 1.0.27 fixes added (see docs/roadmap.md, Batch 1).
import { describe, expect, it } from 'vitest';
import { INITIAL_PEOPLE, INITIAL_SKILLS } from './data/seed.js';
import { backfillSkillDates, newestFirst, sortByDay, sortHistory } from './lib/dates.js';
import { bumpSkills, chartDay, computeOverall, dimBumps, dimsEqual, goalBumpFor, keepDimsInLayer, layerDimBounds, makePerson, migrateDimsToLayers, movePerson, placeOnLayers, progressDelta, scaleDimsToSum } from './lib/progress.js';

const NOW = new Date(2026, 9, 3, 12); // Oct 3 2026, local noon

describe('placeOnLayers', () => {
  it('maps the dimension average onto 25-point bands, each its own 0-100% meter', () => {
    expect(placeOnLayers(0)).toEqual({ layer: 1, overall: 0 });
    expect(placeOnLayers(18)).toEqual({ layer: 1, overall: 72 });
    expect(placeOnLayers(25)).toEqual({ layer: 2, overall: 0 });
    expect(placeOnLayers(68)).toEqual({ layer: 3, overall: 72 });
    expect(placeOnLayers(100)).toEqual({ layer: 4, overall: 100 });
  });
});

describe('the sample people', () => {
  it('sit exactly where Adjust would place them, so saving Adjust unchanged moves nobody', () => {
    INITIAL_PEOPLE.forEach(p => {
      expect({ name: p.name, ...placeOnLayers(computeOverall(p.dims)) }).toEqual({ name: p.name, layer: p.layer, overall: p.overall });
    });
  });
});

describe('progressDelta', () => {
  it('counts each layer as 100%, so a level-up is a gain', () => {
    expect(progressDelta({ layer: 2, overall: 90 }, { layer: 3, overall: 4 })).toBe(14);
    expect(progressDelta({ layer: 3, overall: 10 }, { layer: 2, overall: 80 })).toBe(-30);
    expect(progressDelta({ layer: 1, overall: 10 }, { layer: 1, overall: 25 })).toBe(15);
  });
});

describe('dimsEqual', () => {
  it('compares all six dimensions', () => {
    const p = makePerson({ name: 'A', emoji: '🙂', layer: 2 });
    expect(dimsEqual(p.dims, { ...p.dims })).toBe(true);
    expect(dimsEqual(p.dims, { ...p.dims, trust: p.dims.trust + 1 })).toBe(false);
  });
});

describe('movePerson', () => {
  const base = { ...makePerson({ name: 'Ana', emoji: '🙂', layer: 2 }), overall: 90, history: [{ date: 'Oct 1', at: '2026-10-01', value: 90, layer: 2 }], timeline: [{ label: 'First met', at: '2026-09-01' }] };

  it('adds a dated timeline step when the layer changes', () => {
    const next = movePerson(base, { layer: 3, overall: 4, at: '2026-10-03', why: ['x'] });
    expect(next.timeline).toEqual([{ label: 'First met', at: '2026-09-01' }, { label: 'Reached Layer 3: Personal', at: '2026-10-03' }]);
    expect(next.justLeveledUp).toBe(true);
    expect(next.lastChange).toEqual({ before: 90, after: 4, beforeLayer: 2, afterLayer: 3, why: ['x'] });
  });

  it('records moving down a layer too, without a level-up', () => {
    const next = movePerson(base, { layer: 1, overall: 50, at: '2026-10-03', why: [] });
    expect(next.timeline[1]).toEqual({ label: 'Moved to Layer 1: Orientation', at: '2026-10-03' });
    expect(next.justLeveledUp).toBe(false);
  });

  it('leaves the timeline alone when the layer stays the same', () => {
    expect(movePerson(base, { layer: 2, overall: 95, at: '2026-10-03', why: [] }).timeline).toHaveLength(1);
  });

  it('records a chart point with its layer', () => {
    const next = movePerson(base, { layer: 3, overall: 4, at: '2026-10-03', why: [] });
    expect(next.history[next.history.length - 1]).toMatchObject({ at: '2026-10-03', value: 4, layer: 3 });
  });

  it('puts a backdated change on the newest chart day instead of rewriting an old one', () => {
    const next = movePerson(base, { layer: 2, overall: 95, at: '2026-09-20', why: [] });
    expect(sortHistory(next.history).map(h => [h.at, h.value])).toEqual([['2026-10-01', 95]]);
  });
});

describe('chartDay', () => {
  it('never returns a day before the latest point', () => {
    expect(chartDay([{ at: '2026-10-01', value: 1 }], '2026-09-01')).toBe('2026-10-01');
    expect(chartDay([{ at: '2026-10-01', value: 1 }], '2026-10-03')).toBe('2026-10-03');
    expect(chartDay([], '2026-09-01')).toBe('2026-09-01');
  });
});

describe('bumpSkills', () => {
  const skills = { activeListening: { label: 'Active listening', current: 0, history: [] }, followUp: { label: 'Follow-up', current: 99, history: [] } };

  it('raises skills and records one chart point per day', () => {
    let next = bumpSkills(skills, { activeListening: 2 }, '2026-10-03');
    next = bumpSkills(next, { activeListening: 3 }, '2026-10-03');
    expect(next.activeListening.current).toBe(5);
    expect(next.activeListening.history).toEqual([{ date: 'Oct 3', at: '2026-10-03', value: 5 }]);
    next = bumpSkills(next, { activeListening: 1 }, '2026-10-04');
    expect(next.activeListening.history.map(h => h.value)).toEqual([5, 6]);
  });

  it('ignores zero, negative and unknown bumps, and caps at 100', () => {
    const next = bumpSkills(skills, { activeListening: 0, followUp: 5, nope: 3 }, '2026-10-03');
    expect(next.activeListening).toBe(skills.activeListening);
    expect(next.followUp.current).toBe(100);
    expect(next.nope).toBeUndefined();
  });
});

describe('backfillSkillDates', () => {
  it('dates bare month labels walking back from now, across the year boundary', () => {
    const out = backfillSkillDates(INITIAL_SKILLS, NOW);
    expect(out.activeListening.history.map(h => [h.date, h.at])).toEqual([
      ['Sep', '2025-09-01'], ['Oct', '2025-10-01'], ['Nov', '2025-11-01'], ['Dec', '2025-12-01'], ['Jan', '2026-01-01'],
    ]);
  });

  it('keeps the sample order when the chart sorts it, so new points land after it', () => {
    const out = bumpSkills(backfillSkillDates(INITIAL_SKILLS, NOW), { activeListening: 1 }, '2026-10-03');
    expect(sortHistory(out.activeListening.history).map(h => h.value)).toEqual([64, 70, 75, 79, 82, 83]);
  });

  it('leaves already-dated history alone', () => {
    const skills = { a: { current: 1, history: [{ date: 'Oct 1', at: '2026-10-01', value: 1 }] } };
    expect(backfillSkillDates(skills, NOW).a).toBe(skills.a);
  });
});

describe('newestFirst', () => {
  it('orders by the logged day, keeping same-day order', () => {
    const journal = [{ id: 'backdated', at: '2026-09-01' }, { id: 'today-2', at: '2026-10-03' }, { id: 'today-1', at: '2026-10-03' }, { id: 'yesterday', at: '2026-10-02' }];
    expect(newestFirst(journal, NOW).map(j => j.id)).toEqual(['today-2', 'today-1', 'yesterday', 'backdated']);
  });
});

describe('sortByDay', () => {
  it('sorts timeline steps by date, undated ones last', () => {
    const steps = [{ label: 'b', at: '2026-10-02' }, { label: 'none' }, { label: 'a', at: '2026-09-01' }];
    expect(sortByDay(steps, NOW).map(s => s.label)).toEqual(['a', 'b', 'none']);
  });
});

describe('dimBumps (per-dimension ratings)', () => {
  it('uses each rating for its own dimension and the overall score for the rest', () => {
    const plain = dimBumps({ meaningfulness: 3, activeListening: [], type: 'talked' });
    const rated = dimBumps({ meaningfulness: 3, ratings: { trust: 5, reciprocity: 1 }, activeListening: [], type: 'talked' });
    expect(rated.trust).toBe(11);
    expect(rated.reciprocity).toBe(2);
    expect(rated.depth).toBe(plain.depth);
    expect(rated.interaction).toBe(plain.interaction);
  });
  it('keeps the active-listening bonus on reciprocity and listening', () => {
    expect(dimBumps({ meaningfulness: 3, ratings: { listening: 4 }, activeListening: ['followup', 'listened'], type: 'talked' }).listening).toBe(Math.round(4 * 2.2 + 2 * 3.5));
  });
});

describe('goalBumpFor', () => {
  it('moves a dimension goal by that rating, others by meaningfulness', () => {
    expect(goalBumpFor({ type: 'deeper' }, 2, { depth: 5 })).toBe(16);
    expect(goalBumpFor({ type: 'deeper' }, 2, {})).toBe(6);
    expect(goalBumpFor({ type: 'custom' }, 2, { depth: 5 })).toBe(6);
  });
});

describe('keeping dimensions inside the layer (P3 option C)', () => {
  const flat = (v) => ({ depth: v, trust: v, reciprocity: v, interaction: v, sharedExperiences: v, listening: v });
  const avg = (d) => Math.round(Object.values(d).reduce((a, b) => a + b, 0) / 6);

  it('bands match placeOnLayers at every edge', () => {
    [1, 2, 3, 4].forEach(layer => {
      const { min, max } = layerDimBounds(layer);
      expect(placeOnLayers(Math.round(min / 6)).layer).toBe(layer);
      expect(placeOnLayers(Math.round(max / 6)).layer).toBe(layer);
    });
  });

  it('scales growth down at the top of the band, keeping the dimensions that grew most ahead', () => {
    const out = keepDimsInLayer(flat(20), { ...flat(30), trust: 40 }, 1);
    expect(placeOnLayers(avg(out)).layer).toBe(1);
    expect(out.trust).toBeGreaterThan(out.depth);
    expect(out.depth).toBeGreaterThanOrEqual(20);
  });

  it('lifts the dimensions into a new layer on level-up', () => {
    const out = keepDimsInLayer(flat(20), flat(22), 2);
    expect(placeOnLayers(avg(out)).layer).toBe(2);
  });

  it('leaves growth that stays in the band alone', () => {
    expect(keepDimsInLayer(flat(30), { ...flat(30), trust: 40 }, 2)).toEqual({ ...flat(30), trust: 40 });
  });

  it('scaleDimsToSum keeps whole numbers, the shape and the exact total', () => {
    const out = scaleDimsToSum({ depth: 10, trust: 20, reciprocity: 30, interaction: 40, sharedExperiences: 50, listening: 60 }, 105);
    expect(Object.values(out).reduce((a, b) => a + b, 0)).toBe(105);
    expect(out.listening).toBeGreaterThan(out.depth);
    expect(Object.values(out).every(Number.isInteger)).toBe(true);
  });

  it('migrates only people outside their band, to where their meter is', () => {
    const inBand = { name: 'In', layer: 2, overall: 50, dims: flat(35) };
    const ahead = { name: 'Ahead', layer: 3, overall: 72, dims: flat(80) };
    const { people, changed } = migrateDimsToLayers([inBand, ahead]);
    expect(changed).toEqual(['Ahead']);
    expect(people[0]).toBe(inBand);
    expect(avg(people[1].dims)).toBe(68);
  });
});
