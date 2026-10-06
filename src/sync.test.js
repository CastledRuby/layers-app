// Ready for syncing (lib/sync.js): when records last changed, what was
// deleted, and merging two copies record by record.
import { describe, expect, it } from 'vitest';
import { cleanDeleted, createStamper, mergeData } from './lib/sync.js';
import { createBackup, validateBackup } from './lib/backup.js';

const T1 = '2026-10-06T01:00:00.000Z';
const T2 = '2026-10-06T02:00:00.000Z';
const T3 = '2026-10-06T03:00:00.000Z';
const goal = (id, extra = {}) => ({ id, title: id, progress: 10, ...extra });
const person = (id, extra = {}) => ({ id, name: id, goals: [], ...extra });

describe('createStamper', () => {
  it('first only remembers, then stamps just what changed', () => {
    const kai = person('kai', { goals: [goal('g1')] });
    const sam = person('sam', { updatedAt: '2026-01-01T00:00:00.000Z' });
    const s = createStamper();
    const first = s.stamp({ people: [kai, sam], journal: [], events: [], generalGoals: [] }, T1);
    expect(first.people[0]).toBe(kai); // nothing stamped on the first save
    expect(first.people[1].updatedAt).toBe('2026-01-01T00:00:00.000Z');

    const kai2 = { ...kai, dims: { depth: 30 } };
    const second = s.stamp({ people: [kai2, sam], journal: [], events: [], generalGoals: [] }, T2);
    expect(second.people[0].updatedAt).toBe(T2);
    expect(second.people[0].goals[0].updatedAt).toBeUndefined(); // the goal itself didn't change
    expect(second.people[1]).toBe(first.people[1]); // Sam didn't change
    expect(second.deleted).toEqual([]);
  });

  it('a goal that moves stamps the goal and its person; the same data again stamps nothing', () => {
    const kai = person('kai', { goals: [goal('g1'), goal('g2')] });
    const s = createStamper();
    s.stamp({ people: [kai] }, T1);
    const kai2 = { ...kai, goals: [{ ...kai.goals[0], progress: 30 }, kai.goals[1]] };
    const out = s.stamp({ people: [kai2] }, T2);
    expect(out.people[0].updatedAt).toBe(T2);
    expect(out.people[0].goals.map(g => g.updatedAt)).toEqual([T2, undefined]);
    const again = s.stamp({ people: [kai2] }, T3);
    expect(again.people[0]).toBe(out.people[0]);
  });

  it('remembers deletions, and forgets them when the record comes back (Undo)', () => {
    const e1 = { id: 'e1', title: 'Coffee' };
    const kai = person('kai', { goals: [goal('g1')] });
    const s = createStamper();
    s.stamp({ people: [kai], events: [e1] }, T1);
    const out = s.stamp({ people: [{ ...kai, goals: [] }], events: [] }, T2);
    expect(out.deleted).toEqual([{ id: 'g1', kind: 'goal', at: T2 }, { id: 'e1', kind: 'event', at: T2 }]);
    const back = s.stamp({ people: [kai], events: [e1] }, T3);
    expect(back.deleted).toEqual([]);
    expect(back.events[0].updatedAt).toBe(T3); // brought back is a change
  });

  it('keeps the deletions it was given, for 90 days', () => {
    const s = createStamper([{ id: 'old', kind: 'entry', at: '2026-06-01T00:00:00.000Z' }, { id: 'new', kind: 'entry', at: '2026-10-01T00:00:00.000Z' }]);
    expect(s.stamp({ journal: [] }, T1).deleted.map(d => d.id)).toEqual(['new']);
  });

  it('stamps the profile when it changes', () => {
    const profile = { name: 'Liam' };
    const s = createStamper();
    expect(s.stamp({ profile }, T1).profile).toBe(profile);
    expect(s.stamp({ profile: { ...profile, name: 'Liam C' } }, T2).profile).toEqual({ name: 'Liam C', updatedAt: T2 });
  });
});

describe('mergeData', () => {
  const base = { people: [], journal: [], events: [], generalGoals: [], profile: { name: 'Liam' }, skills: {}, achievements: {}, deleted: [] };

  it('keeps the copy changed last, and everything only one side has', () => {
    const mine = { ...base, events: [{ id: 'e1', title: 'Coffee', updatedAt: T1 }, { id: 'e2', title: 'Mine only' }] };
    const theirs = { ...base, events: [{ id: 'e1', title: 'Coffee at 11', updatedAt: T2 }, { id: 'e3', title: 'Theirs only' }] };
    expect(mergeData(mine, theirs, T3).events.map(e => e.title)).toEqual(['Coffee at 11', 'Mine only', 'Theirs only']);
  });

  it('a tie, or no times at all, keeps this computer’s', () => {
    const mine = { ...base, journal: [{ id: 'j1', summary: 'mine' }] };
    const theirs = { ...base, journal: [{ id: 'j1', summary: 'theirs' }] };
    expect(mergeData(mine, theirs, T3).journal[0].summary).toBe('mine');
  });

  it("merges a person's goals one by one, so changes on both sides survive", () => {
    const mine = { ...base, people: [person('kai', { notes: 'laptop', updatedAt: T2, goals: [goal('g1', { progress: 10, updatedAt: T1 })] })] };
    const theirs = { ...base, people: [person('kai', { notes: 'phone', updatedAt: T1, goals: [goal('g1', { progress: 40, updatedAt: T2 })] })] };
    const kai = mergeData(mine, theirs, T3).people[0];
    expect(kai.notes).toBe('laptop'); // the person changed last on the laptop
    expect(kai.goals[0].progress).toBe(40); // the goal changed last on the phone
  });

  it('a deletion wins over older changes, and loses to newer ones', () => {
    const mine = { ...base, events: [{ id: 'e1', updatedAt: T1 }, { id: 'e2', updatedAt: T3 }] };
    const theirs = { ...base, deleted: [{ id: 'e1', kind: 'event', at: T2 }, { id: 'e2', kind: 'event', at: T2 }] };
    const merged = mergeData(mine, theirs, T3);
    expect(merged.events.map(e => e.id)).toEqual(['e2']);
    expect(merged.deleted.map(d => d.id)).toEqual(['e1', 'e2']);
  });

  it('skills keep the copy that is further on; achievements the day first earned', () => {
    const mine = { ...base, skills: { followUp: { current: 20 } }, achievements: { firstLog: '2026-10-05' } };
    const theirs = { ...base, skills: { followUp: { current: 30 } }, achievements: { firstLog: '2026-10-01', streak: '2026-10-06' } };
    const merged = mergeData(mine, theirs, T3);
    expect(merged.skills.followUp.current).toBe(30);
    expect(merged.achievements).toEqual({ firstLog: '2026-10-01', streak: '2026-10-06' });
  });
});

describe('deletions in saved data and backups', () => {
  it('keeps only well-formed deletions', () => {
    expect(cleanDeleted([{ id: 'e1', kind: 'event', at: T1 }, { id: 'x', kind: 'nope', at: T1 }, { id: '', kind: 'event', at: T1 }, { id: 'e2', kind: 'event', at: 'soon' }, 'junk'])).toEqual([{ id: 'e1', kind: 'event', at: T1 }]);
  });

  it('a backup carries them, and reading it back keeps them', () => {
    const backup = createBackup({ people: [], journal: [], generalGoals: [], events: [], skills: {}, profile: {}, achievements: {}, deleted: [{ id: 'e1', kind: 'event', at: T1 }] });
    const result = validateBackup(JSON.parse(JSON.stringify(backup)));
    expect(result.ok).toBe(true);
    expect(result.data.deleted).toEqual([{ id: 'e1', kind: 'event', at: T1 }]);
  });
});
