// jumpResults (lib/jump.js): what Ctrl+K lists for a query.
import { describe, expect, it } from 'vitest';
import { jumpResults, matchScore } from './lib/jump.js';

const people = [{ id: 'p', name: 'Priya Shah', layer: 3, emoji: '🙂' }, { id: 's', name: 'Sam', layer: 2, emoji: '🙂' }];
const events = [
  { id: 'c', title: 'Coffee with Priya', kind: 'oneoff', date: '2026-10-09', time: 600, personIds: ['p'], template: 'coffee' },
  { id: 'old', title: 'Old plan', kind: 'oneoff', date: '2026-08-01', time: 600, personIds: [] },
  { id: 'g', title: 'Gym', kind: 'recurring', weekdays: [3], from: '2026-09-01', time: 420, personIds: [] },
];
const opts = { people, events, today: '2026-10-05', now: new Date(2026, 9, 5, 15, 30) };
const ids = (q, extra = {}) => jumpResults(q, { ...opts, ...extra }).map(r => r.id);

describe('matchScore', () => {
  it('ranks the start of the name, then a word, then initials, then anywhere', () => {
    expect(matchScore('Priya Shah', 'pri')).toBeGreaterThan(matchScore('Priya Shah', 'sha'));
    expect(matchScore('Priya Shah', 'sha')).toBeGreaterThan(matchScore('Priya Shah', 'ps'));
    expect(matchScore('Priya Shah', 'ps')).toBeGreaterThan(matchScore('Priya Shah', 'iya'));
    expect(matchScore('Priya Shah', 'zz')).toBe(0);
  });
});

describe('jumpResults', () => {
  it('empty: the next plan, recent jumps, then Log and Plan', () => {
    const recent = [{ id: 'page:me', group: 'page', label: 'Me', run: { type: 'tab', tab: 'me' } }];
    expect(ids('', { recent })).toEqual(['plan:g', 'page:me', 'act:log', 'act:plan']);
  });

  it('finds people, their plans, and pages by their other words', () => {
    expect(ids('pri').slice(0, 2)).toEqual(['person:p', 'plan:c']);
    expect(ids('settings')).toContain('page:me');
    expect(ids('old').filter(id => !id.startsWith('act:'))).toEqual([]); // the plan more than two weeks ago ("folder" is an action)
  });

  it('"plan sam" puts planning with Sam first', () => {
    expect(ids('plan sam')[0]).toBe('plan:s');
    expect(ids('prep pri')[0]).toBe('prepare:p');
  });

  it('a typed plan comes first, and one word is never a sentence', () => {
    expect(ids('coffee with sam fri 10am')[0]).toBe('sentence');
    expect(ids('coffee')).not.toContain('sentence');
  });

  it('leaves out what this build cannot do', () => {
    expect(ids('backups')).not.toContain('act:backups');
    expect(ids('backups', { has: { bridge: true } })).toContain('act:backups');
  });
});
