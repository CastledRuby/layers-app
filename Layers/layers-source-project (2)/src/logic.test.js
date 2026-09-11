import { describe, it, expect } from 'vitest';
import {
  clamp,
  computeOverall,
  layerForOverall,
  parseDaysAgo,
  summaryFor,
  homeGoalTitle,
  updateStatusText,
  getCheckInSuggestions,
  makePerson,
  generateSuggestions,
} from './App.jsx';

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
});
