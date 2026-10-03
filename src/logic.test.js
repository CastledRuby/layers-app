import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { clamp } from './lib/util.js';
import { computeOverall, layerForOverall, makePerson } from './lib/progress.js';
import { summaryFor, homeGoalTitle, updateStatusText, getCheckInSuggestions, generateSuggestions, checkInReminder } from './lib/text.js';
import {
  parseDaysAgo,
  journalDaysAgo,
  journalDateLabel,
  isJournalThisWeek,
  backfillJournalDates,
  infoItemDaysAgo,
  infoItemDateLabel,
  timelineDateLabel,
  backfillPeopleDates,
} from './lib/dates.js';

// Local-time dates, mid-afternoon so a test never sits on a day boundary.
const day = (y, m, d) => new Date(y, m - 1, d, 15, 30);
const NOW = day(2026, 10, 3);

describe('clamp', () => {
  it('keeps values inside the range unchanged', () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });
  it('clamps values below the minimum', () => {
    expect(clamp(-10, 0, 100)).toBe(0);
  });
  it('clamps values above the maximum', () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });
});

describe('computeOverall', () => {
  it('averages the six relationship dimensions', () => {
    const dims = { depth: 50, trust: 50, reciprocity: 50, interaction: 50, sharedExperiences: 50, listening: 50 };
    expect(computeOverall(dims)).toBe(50);
  });
  it('rounds to the nearest whole number', () => {
    const dims = { depth: 10, trust: 20, reciprocity: 30, interaction: 40, sharedExperiences: 50, listening: 60 };
    // sum 210 / 6 = 35 exactly
    expect(computeOverall(dims)).toBe(35);
  });
});

describe('layerForOverall', () => {
  it('maps 0-24 to layer 1 (Orientation)', () => {
    expect(layerForOverall(0)).toBe(1);
    expect(layerForOverall(24)).toBe(1);
  });
  it('maps 25-49 to layer 2 (Exploratory)', () => {
    expect(layerForOverall(25)).toBe(2);
    expect(layerForOverall(49)).toBe(2);
  });
  it('maps 50-74 to layer 3 (Personal)', () => {
    expect(layerForOverall(50)).toBe(3);
    expect(layerForOverall(74)).toBe(3);
  });
  it('maps 75-100 to layer 4 (Close)', () => {
    expect(layerForOverall(75)).toBe(4);
    expect(layerForOverall(100)).toBe(4);
  });
});

describe('parseDaysAgo', () => {
  it('parses "Today" and "Just now" as 0 days', () => {
    expect(parseDaysAgo('Today')).toBe(0);
    expect(parseDaysAgo('Just now')).toBe(0);
  });
  it('parses "Yesterday" as 1 day', () => {
    expect(parseDaysAgo('Yesterday')).toBe(1);
  });
  it('parses "N days ago"', () => {
    expect(parseDaysAgo('5 days ago')).toBe(5);
  });
  it('parses "N weeks ago" as N*7 days', () => {
    expect(parseDaysAgo('2 weeks ago')).toBe(14);
  });
  it('parses "N months ago" as N*30 days', () => {
    expect(parseDaysAgo('1 month ago')).toBe(30);
  });
  it('falls back to a large number for unrecognised strings', () => {
    expect(parseDaysAgo('Aug 20')).toBe(999);
    expect(parseDaysAgo(undefined)).toBe(999);
  });
});

describe('summaryFor', () => {
  it('uses an explicit summary when present', () => {
    expect(summaryFor({ summary: 'Custom summary', type: 'talked', meaningfulness: 1 })).toBe('Custom summary');
  });
  it('uses the high-meaningfulness phrasing at 4+', () => {
    expect(summaryFor({ type: 'talked', meaningfulness: 4 })).toBe('Had a meaningful conversation');
  });
  it('uses the low-meaningfulness phrasing below 4', () => {
    expect(summaryFor({ type: 'talked', meaningfulness: 2 })).toBe('Talked for a bit');
  });
  it('falls back to the "other" type for unknown types', () => {
    expect(summaryFor({ type: 'not-a-real-type', meaningfulness: 5 })).toBe('Logged a meaningful interaction');
  });
});

describe('homeGoalTitle', () => {
  it('embeds the person name for relationship goals', () => {
    const goal = { category: 'relationship', type: 'learn', title: 'Learn more about them' };
    expect(homeGoalTitle(goal, 'Alex')).toBe('Learn more about Alex');
  });
  it('defaults relationship goals without a specific case to "Get closer to"', () => {
    const goal = { category: 'relationship', type: 'becomeCloser', title: 'Become closer friends' };
    expect(homeGoalTitle(goal, 'Alex')).toBe('Get closer to Alex');
  });
  it('uses the raw title for skill goals', () => {
    const goal = { category: 'skill', type: 'activeListeningGoal', title: 'Improve active listening' };
    expect(homeGoalTitle(goal, null)).toBe('Improve active listening');
  });
});

describe('updateStatusText', () => {
  it('gives a neutral prompt when there is no status yet', () => {
    expect(updateStatusText(null)).toMatch(/check whether/i);
  });
  it('describes an available update including its version', () => {
    expect(updateStatusText({ state: 'available', version: '1.2.0' })).toContain('1.2.0');
  });
  it('describes download progress with a percentage', () => {
    expect(updateStatusText({ state: 'downloading', percent: 42 })).toContain('42%');
  });
  it('describes the not-configured state without alarming language', () => {
    expect(updateStatusText({ state: 'not-configured' })).toMatch(/set up/i);
  });
});

describe('getCheckInSuggestions', () => {
  const people = [
    { id: 'a', name: 'Alex' },
    { id: 'b', name: 'Blair' },
    { id: 'c', name: 'Casey' },
  ];

  it('flags people with no journal entry in 14+ days', () => {
    const journal = [
      { personId: 'a', date: 'Today' },
      { personId: 'b', date: '20 days ago' },
    ];
    const result = getCheckInSuggestions(people, journal);
    expect(result).toContain('Blair');
    expect(result).not.toContain('Alex');
  });

  it('does not flag people with no journal entries at all', () => {
    const journal = [{ personId: 'a', date: 'Today' }];
    const result = getCheckInSuggestions(people, journal);
    expect(result).not.toContain('Casey');
  });

  it('uses the most recent entry when there are several', () => {
    const journal = [
      { personId: 'a', date: '30 days ago' },
      { personId: 'a', date: 'Today' },
    ];
    const result = getCheckInSuggestions(people, journal);
    expect(result).not.toContain('Alex');
  });

  it('flags someone logged weeks ago even if the entry once said "Today"', () => {
    const journal = [{ personId: 'a', at: '2026-09-10', date: 'Today' }];
    expect(getCheckInSuggestions(people, journal, NOW)).toContain('Alex');
  });

  it('flags from 14 days since the last entry, by its `at` date', () => {
    expect(getCheckInSuggestions(people, [{ personId: 'a', at: '2026-09-20' }], NOW)).not.toContain('Alex');
    expect(getCheckInSuggestions(people, [{ personId: 'a', at: '2026-09-19' }], NOW)).toContain('Alex');
  });
});

describe('journalDaysAgo', () => {
  it('counts whole days from the entry\'s `at` date to now', () => {
    expect(journalDaysAgo({ at: '2026-10-03' }, NOW)).toBe(0);
    expect(journalDaysAgo({ at: '2026-10-02' }, NOW)).toBe(1);
    expect(journalDaysAgo({ at: '2026-09-19' }, NOW)).toBe(14);
  });
  it('ignores a stale stored label when `at` is present', () => {
    expect(journalDaysAgo({ at: '2026-09-10', date: 'Today' }, NOW)).toBe(23);
  });
  it('falls back to the legacy label when there is no `at`', () => {
    expect(journalDaysAgo({ date: '3 days ago' }, NOW)).toBe(3);
    expect(journalDaysAgo({ date: 'Aug 31' }, NOW)).toBe(33);
  });
  it('treats an entry with no readable date as long ago', () => {
    expect(journalDaysAgo({}, NOW)).toBe(999);
    expect(journalDaysAgo({ date: 'whenever' }, NOW)).toBe(999);
    expect(journalDaysAgo({ at: 'not-a-date' }, NOW)).toBe(999);
  });
  it('never goes negative for a future date', () => {
    expect(journalDaysAgo({ at: '2026-10-05' }, NOW)).toBe(0);
  });
});

describe('journalDateLabel', () => {
  it('ages the same entry as time passes', () => {
    const entry = { at: '2026-10-01' };
    expect(journalDateLabel(entry, day(2026, 10, 1))).toBe('Today');
    expect(journalDateLabel(entry, day(2026, 10, 2))).toBe('Yesterday');
    expect(journalDateLabel(entry, day(2026, 10, 4))).toBe('3 days ago');
    expect(journalDateLabel(entry, day(2026, 10, 22))).toBe('3 weeks ago');
    expect(journalDateLabel(entry, day(2026, 12, 1))).toBe('2 months ago');
  });
  it('shows an unreadable legacy label as-is', () => {
    expect(journalDateLabel({ date: 'whenever' }, NOW)).toBe('whenever');
  });
});

describe('isJournalThisWeek', () => {
  it('covers the last 7 days, including today', () => {
    expect(isJournalThisWeek({ at: '2026-10-03' }, NOW)).toBe(true);
    expect(isJournalThisWeek({ at: '2026-09-27' }, NOW)).toBe(true);
    expect(isJournalThisWeek({ at: '2026-09-26' }, NOW)).toBe(false);
  });
  it('ignores a stale isThisWeek flag', () => {
    expect(isJournalThisWeek({ at: '2026-08-01', isThisWeek: true }, NOW)).toBe(false);
  });
});

describe('backfillJournalDates', () => {
  it('reads relative labels as of the anchor and drops the stale fields', () => {
    const [a, b] = backfillJournalDates([
      { id: 'x', personId: 'a', date: 'Today', isThisWeek: true },
      { id: 'y', personId: 'a', date: '3 days ago', isThisWeek: true },
    ], NOW);
    expect(a).toEqual({ id: 'x', personId: 'a', at: '2026-10-03' });
    expect(b).toEqual({ id: 'y', personId: 'a', at: '2026-09-30' });
  });
  it('parses absolute seed labels as their most recent past occurrence', () => {
    const out = backfillJournalDates([{ date: 'Aug 31' }, { date: 'Dec 25' }, { date: 'Aug 20, 2025' }], NOW);
    expect(out.map(j => j.at)).toEqual(['2026-08-31', '2025-12-25', '2025-08-20']);
  });
  it('leaves entries that already have `at`, or have no readable date, untouched', () => {
    const dated = { at: '2026-09-01', date: 'Today' };
    const undatable = { date: 'whenever' };
    const out = backfillJournalDates([dated, undatable], NOW);
    expect(out[0]).toBe(dated);
    expect(out[1]).toBe(undatable);
  });
  it('only dates an entry once, so a later load does not move it', () => {
    const once = backfillJournalDates([{ date: 'Today' }], NOW);
    expect(backfillJournalDates(once, day(2026, 11, 1))).toEqual(once);
    expect(journalDateLabel(once[0], day(2026, 10, 24))).toBe('3 weeks ago');
  });
  it('accepts a backup\'s exportedAt string as the anchor', () => {
    const exportedAt = day(2026, 9, 20).toISOString();
    expect(backfillJournalDates([{ date: 'Today' }], exportedAt)[0].at).toBe('2026-09-20');
  });

  describe('without a usable anchor', () => {
    beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
    afterEach(() => { vi.useRealTimers(); });

    it('falls back to now', () => {
      expect(backfillJournalDates([{ date: 'Yesterday' }])[0].at).toBe('2026-10-02');
      expect(backfillJournalDates([{ date: 'Yesterday' }], 'not a date')[0].at).toBe('2026-10-02');
    });
  });
});

describe('makePerson', () => {
  it('creates a person whose stored layer matches the requested starting layer', () => {
    const p = makePerson({ name: 'Sam', emoji: '🧑', layer: 3 });
    expect(p.layer).toBe(3);
  });
  it('sets starting dimension/overall values consistent with that layer', () => {
    const p = makePerson({ name: 'Sam', emoji: '🧑', layer: 4 });
    expect(layerForOverall(p.overall)).toBe(4);
  });
  it('gives every new person an empty history/goals/info starting point', () => {
    const p = makePerson({ name: 'Sam', emoji: '🧑', layer: 1 });
    expect(p.goals).toEqual([]);
    expect(p.interests).toEqual([]);
    expect(p.history.length).toBe(1);
  });
  it('dates the "First met" timeline step instead of storing the word Today', () => {
    const p = makePerson({ name: 'Sam', emoji: '🧑', layer: 1 });
    expect(p.timeline).toHaveLength(1);
    expect(p.timeline[0].label).toBe('First met');
    expect(p.timeline[0].at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(p.timeline[0].date).toBeUndefined();
  });
});

describe('infoItemDaysAgo / infoItemDateLabel', () => {
  it('ages an item saved with an ISO `at` date', () => {
    const item = { text: 'a trip', at: '2026-09-25' };
    expect(infoItemDaysAgo(item, NOW)).toBe(8);
    expect(infoItemDateLabel(item, NOW)).toBe('1 week ago');
    expect(infoItemDateLabel(item, day(2026, 9, 25))).toBe('Today');
  });
  it('prefers `at` over a stale legacy `updated` label', () => {
    expect(infoItemDaysAgo({ at: '2026-09-03', updated: 'Today' }, NOW)).toBe(30);
  });
  it('falls back to the legacy label, read as of now', () => {
    expect(infoItemDaysAgo({ updated: '4 days ago' }, NOW)).toBe(4);
    expect(infoItemDateLabel({ updated: 'Yesterday' }, NOW)).toBe('Yesterday');
  });
  it('treats an item with no readable date as long ago', () => {
    expect(infoItemDaysAgo({}, NOW)).toBe(999);
    expect(infoItemDateLabel({ updated: 'whenever' }, NOW)).toBe('whenever');
  });
});

describe('timelineDateLabel', () => {
  it('always shows the calendar date, never "N weeks ago" or "Yesterday"', () => {
    expect(timelineDateLabel({ label: 'First met', at: '2026-08-04' }, NOW)).toBe('Aug 4');
    expect(timelineDateLabel({ label: 'First proper conversation', at: '2026-10-02' }, NOW)).toBe('Oct 2');
    expect(timelineDateLabel({ label: 'First met', at: '2026-10-03' }, NOW)).toBe('Oct 3');
  });
  it('adds the year for a date in another year', () => {
    expect(timelineDateLabel({ label: 'First met', at: '2025-08-04' }, NOW)).toBe('Aug 4, 2025');
  });
  it('turns a legacy relative label into a date too', () => {
    expect(timelineDateLabel({ label: 'First met', date: '2 weeks ago' }, NOW)).toBe('Sep 19');
  });
  it('keeps undated text such as the current-layer step\'s "Now"', () => {
    expect(timelineDateLabel({ label: 'Current: Close', date: 'Now', current: true }, NOW)).toBe('Now');
  });
});

describe('backfillPeopleDates', () => {
  const legacy = () => ({
    id: 'p1', name: 'Alex',
    interests: [{ id: 'i1', text: 'F1', updated: 'Today' }, { id: 'i2', text: 'Xbox', updated: '9 days ago' }],
    preferences: [], plans: [{ id: 'pl1', text: 'Japan', updated: 'whenever' }],
    experiences: [], important: [{ id: 'im1', text: 'Exam', updated: '1 day ago', temporary: true }],
    timeline: [{ label: 'First met', date: '2 months ago' }, { label: 'First proper conversation', date: '2 weeks ago' }],
  });

  it('dates info items and timeline steps, and drops the stale labels', () => {
    const [p] = backfillPeopleDates([legacy()], NOW);
    expect(p.interests.map(i => i.at)).toEqual(['2026-10-03', '2026-09-24']);
    expect(p.important[0]).toEqual({ id: 'im1', text: 'Exam', at: '2026-10-02', temporary: true });
    expect(p.timeline).toEqual([{ label: 'First met', at: '2026-08-04' }, { label: 'First proper conversation', at: '2026-09-19' }]);
    expect(p.interests[0].updated).toBeUndefined();
  });
  it('leaves undatable items and everything else untouched', () => {
    const [p] = backfillPeopleDates([legacy()], NOW);
    expect(p.plans[0]).toEqual({ id: 'pl1', text: 'Japan', updated: 'whenever' });
    expect(p.name).toBe('Alex');
  });
  it('is idempotent, so it is safe to run on every load', () => {
    const once = backfillPeopleDates([legacy()], NOW);
    expect(backfillPeopleDates(once, day(2026, 12, 1))).toEqual(once);
  });
  it('anchors a backup\'s labels to its export date', () => {
    const [p] = backfillPeopleDates([legacy()], '2026-09-20T09:00:00');
    expect(p.interests[0].at).toBe('2026-09-20');
  });
  it('copes with people missing categories or a timeline', () => {
    expect(backfillPeopleDates([{ id: 'x', name: 'New' }], NOW)).toEqual([{ id: 'x', name: 'New' }]);
  });
});

describe('generateSuggestions', () => {
  function person(overrides) {
    return {
      name: 'Alex',
      interests: [], preferences: [], plans: [], experiences: [], important: [],
      ...overrides,
    };
  }

  it('suggests a plan mentioned 3+ days ago', () => {
    const p = person({ plans: [{ text: 'a trip', updated: '5 days ago', archived: false }] });
    expect(generateSuggestions(p).length).toBeGreaterThan(0);
  });
  it('does not suggest something mentioned very recently', () => {
    const p = person({ plans: [{ text: 'a trip', updated: 'Today', archived: false }] });
    expect(generateSuggestions(p).length).toBe(0);
  });
  it('ignores archived items', () => {
    const p = person({ plans: [{ text: 'a trip', updated: '10 days ago', archived: true }] });
    expect(generateSuggestions(p).length).toBe(0);
  });
  it('returns at most two suggestions', () => {
    const p = person({
      plans: [{ text: 'a', updated: '10 days ago', archived: false }],
      important: [{ text: 'b', updated: '10 days ago', archived: false }],
      experiences: [{ text: 'c', updated: '20 days ago', archived: false }],
      interests: [{ text: 'd', updated: '20 days ago', archived: false }],
    });
    expect(generateSuggestions(p).length).toBeLessThanOrEqual(2);
  });
  it('lets a note saved "today" become a suggestion once it has aged', () => {
    const p = person({ plans: [{ text: 'a trip', at: '2026-10-03', archived: false }] });
    expect(generateSuggestions(p, NOW)).toHaveLength(0);
    expect(generateSuggestions(p, day(2026, 10, 7))).toHaveLength(1);
  });
});

describe('checkInReminder', () => {
  const people = [{ id: 'a', name: 'Alex' }, { id: 'b', name: 'Jamie' }, { id: 'c', name: 'Priya' }, { id: 'd', name: 'Noah' }];
  const journalAt = (entries) => entries.map(([personId, at]) => ({ personId, at }));

  it('says nothing when nobody is overdue', () => {
    expect(checkInReminder(people, journalAt([['a', '2026-10-01']]), null, NOW)).toBeNull();
  });
  it('names one overdue person', () => {
    const r = checkInReminder(people, journalAt([['a', '2026-09-10']]), null, NOW);
    expect(r).toEqual({ day: '2026-10-03', body: "It's been a while since you checked in with Alex." });
  });
  it('names two, then counts the rest', () => {
    const journal = journalAt([['a', '2026-09-01'], ['b', '2026-09-01'], ['c', '2026-09-01'], ['d', '2026-09-01']]);
    expect(checkInReminder(people, journal, null, NOW).body).toBe("It's been a while since you checked in with Alex and Jamie, and 2 others.");
    expect(checkInReminder(people.slice(0, 3), journal, null, NOW).body).toBe("It's been a while since you checked in with Alex and Jamie, and 1 other.");
  });
  it('fires at most once per day', () => {
    const journal = journalAt([['a', '2026-09-10']]);
    expect(checkInReminder(people, journal, '2026-10-03', NOW)).toBeNull();
    expect(checkInReminder(people, journal, '2026-10-02', NOW)).not.toBeNull();
  });
  it('fires again the next day while the app is still running', () => {
    const journal = journalAt([['a', '2026-09-10']]);
    const first = checkInReminder(people, journal, null, NOW);
    expect(checkInReminder(people, journal, first.day, day(2026, 10, 4))).toEqual({ day: '2026-10-04', body: first.body });
  });
  it('uses the local date, not UTC (it used to use toISOString)', () => {
    // 00:30 local on Oct 4 is still Oct 3 in UTC for any timezone ahead of UTC, like New Zealand.
    const justAfterMidnight = new Date(2026, 9, 4, 0, 30);
    expect(checkInReminder(people, journalAt([['a', '2026-09-10']]), '2026-10-03', justAfterMidnight).day).toBe('2026-10-04');
  });
});
