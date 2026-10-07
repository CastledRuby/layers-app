import { describe, it, expect } from 'vitest';
import { createBackup, validateBackup, BACKUP_VERSION } from './lib/backup.js';
import { INITIAL_PEOPLE, INITIAL_JOURNAL, INITIAL_GENERAL_GOALS, INITIAL_SKILLS } from './data/seed.js';
import { backfillPeopleDates, backfillJournalDates } from './lib/dates.js';

const NOW = new Date(2026, 9, 3, 15, 30);
const sampleState = () => ({
  people: backfillPeopleDates(INITIAL_PEOPLE, NOW),
  journal: backfillJournalDates(INITIAL_JOURNAL, NOW),
  generalGoals: INITIAL_GENERAL_GOALS,
  events: [{ id: 'e1', title: 'Football', personIds: ['alex'], kind: 'recurring', weekdays: [2, 4], time: 1080, defaultMeaningfulness: 3, createdAt: 'Today' }],
  skills: INITIAL_SKILLS,
  profile: { name: 'Tester', focus: 'mix' },
});
const person = (overrides) => ({ id: 'p1', name: 'Riley', emoji: '🧑', layer: 2, overall: 40, dims: { depth: 30, trust: 30, reciprocity: 30, interaction: 30, sharedExperiences: 30, listening: 30 }, interests: [], preferences: [], plans: [], experiences: [], important: [], goals: [], history: [], timeline: [], ...overrides });

describe('createBackup / validateBackup round trip', () => {
  it('accepts a backup the app itself exported, unchanged', () => {
    const backup = JSON.parse(JSON.stringify(createBackup(sampleState(), NOW)));
    const result = validateBackup(backup);
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
    const { exportedAt, ...data } = result.data;
    expect(exportedAt).toBe(NOW.toISOString());
    expect(data).toEqual({ ...JSON.parse(JSON.stringify(sampleState())), achievements: {}, deleted: [] });
  });
  it('keeps recorded achievements, dropping unknown ones and bad dates', () => {
    const backup = { ...createBackup(sampleState(), NOW), achievements: { firstMeaningful: '2026-09-01', nope: '2026-09-01', activeListener: 'yesterday' } };
    expect(validateBackup(backup).data.achievements).toEqual({ firstMeaningful: '2026-09-01' });
  });
  it('treats a backup from before achievements were recorded as having none recorded', () => {
    const backup = createBackup(sampleState(), NOW);
    delete backup.achievements;
    expect(validateBackup(backup).data.achievements).toBeNull();
  });
  it('summarises what will be imported', () => {
    const { summary } = validateBackup(createBackup(sampleState(), NOW));
    expect(summary.text).toBe('5 people, 7 journal entries, 10 goals, 1 event');
  });
  it('stamps the current format version', () => {
    expect(createBackup(sampleState(), NOW).version).toBe(BACKUP_VERSION);
  });
});

describe('validateBackup refuses files that would wipe or break your data', () => {
  it.each([
    ['plain text parsed as a string', 'hello'],
    ['an array', []],
    ['null', null],
    ['another app\'s JSON', { name: 'package', version: '1.0.0' }],
  ])('%s', (_label, raw) => {
    const result = validateBackup(raw);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/isn't a Layers backup/);
  });
  it('a backup from a newer version of the app', () => {
    expect(validateBackup({ version: BACKUP_VERSION + 1, people: [] }).error).toMatch(/newer version of Layers/);
  });
  it('a damaged top-level list instead of silently emptying it', () => {
    expect(validateBackup({ version: 1, people: [], journal: 'oops' }).error).toMatch(/journal list is unreadable/);
    expect(validateBackup({ version: 1, people: {} }).error).toMatch(/people list is unreadable/);
    expect(validateBackup({ version: 1, people: [], skills: [] }).error).toMatch(/skills are unreadable/);
  });
  it('a backup where no person can be read', () => {
    expect(validateBackup({ version: 1, people: [{ name: 'No id' }, 42] }).error).toMatch(/none of its people/);
  });
});

describe('validateBackup repairs or skips damaged records', () => {
  it('fills missing lists and clamps numbers, so screens never meet undefined', () => {
    const { data } = validateBackup({ version: 1, people: [{ id: 'p1', name: ' Riley ', layer: 9, overall: 250, dims: { depth: -5 } }] });
    const [p] = data.people;
    expect(p.name).toBe('Riley');
    expect(p.layer).toBe(4);
    expect(p.overall).toBe(100);
    expect(p.dims.depth).toBe(0);
    expect(p.dims.trust).toBe(80);
    for (const key of ['interests', 'preferences', 'plans', 'experiences', 'important', 'goals', 'history', 'timeline']) expect(p[key]).toEqual([]);
    expect(data.journal).toEqual([]);
    expect(data.generalGoals).toEqual([]);
    expect(data.events).toEqual([]);
    expect(Object.keys(data.skills)).toHaveLength(6);
    expect(data.profile).toEqual({ name: '', focus: null });
  });
  it('skips people without a name and duplicate ids, and says so', () => {
    const result = validateBackup({ version: 1, people: [person(), person({ name: 'Copy' }), person({ id: 'p2', name: '' })] });
    expect(result.data.people.map(p => p.name)).toEqual(['Riley']);
    expect(result.warnings).toEqual(['1 person without a name', '1 duplicate person']);
  });
  it('drops journal entries and events for people who aren\'t in the backup', () => {
    const result = validateBackup({
      version: 1,
      people: [person()],
      journal: [{ id: 'j1', personId: 'p1', at: '2026-10-01', type: 'talked', meaningfulness: 4 }, { id: 'j2', personId: 'ghost', type: 'talked' }],
      events: [{ id: 'e1', title: 'Gym', kind: 'recurring', weekdays: [1, 9], personIds: ['p1', 'ghost'] }, { title: 'No date', kind: 'oneoff' }, { title: 'Bad kind', kind: 'weekly' }],
    });
    expect(result.data.journal.map(j => j.id)).toEqual(['j1']);
    expect(result.data.events).toHaveLength(1);
    expect(result.data.events[0].personIds).toEqual(['p1']);
    expect(result.data.events[0].weekdays).toEqual([1]);
    expect(result.warnings).toEqual(['1 journal entry for people not in the backup', '2 events with a missing title or date']);
  });
  it('repairs journal fields a view relies on', () => {
    const { data } = validateBackup({ version: 1, people: [person()], journal: [{ personId: 'p1', type: 'teleported', meaningfulness: 11, added: 'x' }] });
    const [j] = data.journal;
    expect(j.id).toBeTruthy();
    expect(j.type).toBe('other');
    expect(j.meaningfulness).toBe(5);
    expect(j.added).toEqual([]);
  });
  it("keeps an analysed chat's scores, review and chat on its log, tidied, and drops one without scores", () => {
    const review = { wentWell: ['You asked back', 7], opportunity: 'Ask more', tryNextTime: 3, encourager: { type: 'odd', line: 'no way' }, emotionalCues: [{ emoji: '🎉', text: 'Excited' }, 'x'], recommendation: null, next: { continueTopic: { text: 'Ask', natural: 'so?' }, changeTopic: 'nope' } };
    const { data } = validateBackup({ version: 1, people: [person()], journal: [
      { id: 'j1', personId: 'p1', type: 'messaged', analysis: { grading: { overall: 70, depth: 'deep', reciprocity: 60 }, conversationState: 'engaged', model: 'claude-haiku-4-5', review, chat: 'Riley: hi' } },
      { id: 'j2', personId: 'p1', type: 'analysed', analysis: { grading: { overall: 80 }, conversationState: 'engaged' } },
      { id: 'j3', personId: 'p1', type: 'talked', analysis: { conversationState: 'engaged' } },
      { id: 'j4', personId: 'p1', type: 'talked', analysis: { grading: { overall: 50 }, chat: 'x'.repeat(30000) } },
    ] });
    const [j1, j2, j3, j4] = data.journal;
    expect(j1.analysis).toEqual({
      grading: { overall: 70, reciprocity: 60 }, conversationState: 'engaged', model: 'claude-haiku-4-5', chat: 'Riley: hi',
      review: { wentWell: ['You asked back'], opportunity: 'Ask more', tryNextTime: '', encourager: { type: 'improve', line: 'no way', why: '' }, emotionalCues: [{ emoji: '🎉', text: 'Excited' }], recommendation: null, next: { continueTopic: { text: 'Ask', natural: 'so?', playful: '', deeper: '' }, shareYourself: null, changeTopic: null, dontMessage: null } },
    });
    expect(j2.analysis).toEqual({ grading: { overall: 80 }, conversationState: 'engaged' }); // a sample's, from before
    expect(j3).not.toHaveProperty('analysis');
    expect(j4.analysis.chat.length).toBe(20040);
  });
  it('skips goals without a title and saved details without text', () => {
    const result = validateBackup({ version: 1, people: [person({ goals: [{ id: 'g1', title: 'Hang out', progress: 140 }, { id: 'g2' }], interests: [{ text: 'Chess' }, { emoji: '⭐' }] })] });
    const [p] = result.data.people;
    expect(p.goals).toHaveLength(1);
    expect(p.goals[0]).toMatchObject({ title: 'Hang out', progress: 100, personId: 'p1', category: 'custom', history: [] });
    expect(p.interests).toHaveLength(1);
    expect(p.interests[0]).toMatchObject({ text: 'Chess', emoji: '⭐', temporary: false, archived: false });
    expect(result.warnings).toEqual(['1 goal without a title', '1 saved detail without text']);
  });
  it('accepts an old backup without a version, events or goals lists', () => {
    const result = validateBackup({ people: [person()], journal: [] });
    expect(result.ok).toBe(true);
    expect(result.data.exportedAt).toBeNull();
  });
});

describe('calendar data', () => {
  it('keeps key dates and plan settings, and drops broken ones', () => {
    const raw = {
      version: 1,
      people: [{ id: 'p', name: 'Priya', layer: 2, dates: [{ id: 'b', kind: 'birthday', date: '1998-10-05', yearly: true }, { kind: 'birthday', date: 'soon' }] }],
      events: [
        { id: 'e', title: 'Coffee', kind: 'oneoff', date: '2026-10-04', time: 600, duration: 60, alert: null, allDay: false, template: 'coffee', personIds: ['p'] },
        { id: 'f', title: 'Gym', kind: 'recurring', weekdays: [1], time: 420, from: 'never', duration: -5, alert: 'x', personIds: [] },
      ],
    };
    const { data } = validateBackup(raw);
    expect(data.people[0].dates).toEqual([{ id: 'b', kind: 'birthday', date: '1998-10-05', yearly: true }]);
    expect(data.events[0]).toMatchObject({ duration: 60, alert: null, allDay: false, template: 'coffee' });
    expect(data.events[1]).not.toHaveProperty('from');
    expect(data.events[1]).not.toHaveProperty('duration');
    expect(data.events[1]).not.toHaveProperty('alert');
  });
});
