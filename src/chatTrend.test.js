// Skills over time from analysed chats (lib/chatTrend.js).
import { describe, expect, it } from 'vitest';
import { chatTrend, trendChange } from './lib/chatTrend.js';

const g = (overall, activeListening, depth, reciprocity, naturalness) => ({ grading: { overall, activeListening, depth, reciprocity, naturalness }, conversationState: 'engaged' });
const NOW = new Date(2026, 9, 7);

describe('skills over time', () => {
  const journal = [
    { personId: 'a', at: '2026-10-01', analysis: g(60, 60, 40, 50, 70) },
    { personId: 'a', at: '2026-10-05', analysis: g(70, 70, 50, 60, 80) },
    { personId: 'a', at: '2026-10-05', analysis: g(80, 80, 60, 70, 90) },
    { personId: 'c', at: '2026-10-05', analysis: g(80, 80, 60, 70, 90) }, // the same group chat, logged for Chloe too
    { personId: 'c', at: '2026-10-06', analysis: { conversationState: 'engaged' } }, // no scores
    { personId: 'a', at: '2026-10-06', type: 'talked' },
  ];

  it("charts one person's analysed chats, a day's averaged", () => {
    expect(chatTrend(journal, 'a', NOW)).toEqual([
      { at: '2026-10-01', date: 'Oct 1', listening: 60, depth: 40, balance: 50, naturalness: 70, overall: 60, chats: 1 },
      { at: '2026-10-05', date: 'Oct 5', listening: 75, depth: 55, balance: 65, naturalness: 85, overall: 75, chats: 2 },
    ]);
  });

  it('charts everyone, counting a group chat once', () => {
    expect(chatTrend(journal, null, NOW).map(p => p.chats)).toEqual([1, 2]);
    expect(chatTrend([], null, NOW)).toEqual([]);
  });

  it('says how each has moved since the first', () => {
    expect(trendChange(chatTrend(journal, 'a', NOW))).toEqual({ listening: 15, depth: 15, balance: 15, naturalness: 15 });
    expect(trendChange(chatTrend(journal, 'c', NOW))).toBeNull();
  });
});
