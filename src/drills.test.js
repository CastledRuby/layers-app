/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { DRILLS, drillByKey, drillFor, drillRequest, drillResult, nextDrill, readDrills, saveDrill } from './lib/drills.js';
import { addPractice, readPractice } from './lib/practice.js';

afterEach(() => { ['layers-drills', 'layers-practice'].forEach(k => window.localStorage.removeItem(k)); });

describe('picking a drill', () => {
  it("is the same all day, turns over the next, and skips ones done lately", () => {
    const a = drillFor('2026-10-10');
    expect(drillFor('2026-10-10')).toBe(a);
    expect(drillFor('2026-10-11')).not.toBe(a);
    expect(drillFor('2026-10-10', [a.key]).key).not.toBe(a.key);
    expect(drillFor('2026-10-10', DRILLS.map(d => d.key))).toBeTruthy(); // all done lately: any
  });

  it('Another moves on to one not done lately', () => {
    const [first, second, third] = DRILLS;
    expect(nextDrill(first.key).key).toBe(second.key);
    expect(nextDrill(first.key, [second.key]).key).toBe(third.key);
    expect(nextDrill(DRILLS.at(-1).key).key).toBe(first.key);
  });

  it('has a message, who sent it and an aim for each, with no key twice', () => {
    expect(new Set(DRILLS.map(d => d.key)).size).toBe(DRILLS.length);
    DRILLS.forEach(d => expect(d.name && d.who && d.text && d.aim).toBeTruthy());
  });
});

describe('the request and the answer', () => {
  const drill = drillByKey('vague-plan');
  const sam = { id: 's', name: 'Sam Lee', layer: 3 };

  it('sends their message, the aim and your reply, anyone in your circle hidden, and how you write', () => {
    const req = drillRequest({ drill, reply: 'yes!! maybe the climbing gym with Sam?', everyone: [sam], yourName: 'Liam', samples: ['haha yeah'], style: 'lowercase, lots of haha' });
    expect(req.content[0].text).toContain('Kai, a friend, texts:\n"we should hang out sometime!"');
    expect(req.content[0].text).toContain('turn it into a real plan');
    expect(req.content[0].text).toContain('"yes!! maybe the climbing gym with [someone]?"');
    expect(req.system).toContain('- haha yeah');
    expect(req.system).toContain('"lowercase, lots of haha"');
    expect(JSON.stringify(req)).not.toMatch(/Sam|Liam/);
    expect(req.schema.required).toEqual(['score', 'worked', 'better', 'why']);
    expect(req.model).toBe('claude-haiku-5-5');
  });

  it('tidies the answer: a whole score from 0 to 100, no quotes, and you for [you]', () => {
    expect(drillResult({ score: 72.6, worked: 'Warm, and [you] named a place.', better: '"climbing sat arvo? 2pm?"', why: 'A time makes it real.' }))
      .toEqual({ score: 73, worked: 'Warm, and you named a place.', better: 'climbing sat arvo? 2pm?', why: 'A time makes it real.' });
    expect(drillResult({ score: 140, better: 'x' }).score).toBe(100);
    expect(drillResult({ score: 'high', better: 'x' }).score).toBeNull();
    expect(drillResult({ score: 50, better: '' })).toBeNull();
  });
});

describe('kept on this laptop', () => {
  it('remembers the latest done today and the recent ones, newest last', () => {
    expect(readDrills()).toEqual({ recent: [], today: null });
    saveDrill('2026-10-10', 'vague-plan', 'sure!', { score: 60, worked: 'w', better: 'b', why: 'y' });
    const saved = saveDrill('2026-10-10', 'haha-nope', 'x', { score: 1, worked: '', better: 'b', why: '' }); // unknown drill: not kept as recent
    expect(saved.recent).toEqual(['vague-plan', 'haha-nope']);
    expect(readDrills()).toEqual({ recent: ['vague-plan'], today: null });
    saveDrill('2026-10-10', 'fine', 'you ok?', { score: 80, worked: 'w', better: 'b', why: 'y' });
    expect(readDrills().today).toEqual({ day: '2026-10-10', key: 'fine', reply: 'you ok?', score: 80, worked: 'w', better: 'b', why: 'y' });
    window.localStorage.setItem('layers-drills', '{not json');
    expect(readDrills()).toEqual({ recent: [], today: null });
  });

  it("keeps a drill's score as practice, with its key", () => {
    addPractice({ at: '2026-10-10', situation: 'drill', drill: 'fine', grading: { overall: 81 } });
    addPractice({ at: '2026-10-10', situation: 'nope', grading: { overall: 50 } });
    expect(readPractice().map(r => [r.situation, r.drill, r.grading.overall])).toEqual([['drill', 'fine', 81], ['chat', undefined, 50]]);
  });
});
