// Achievements' progress (lib/achievements.js).
import { describe, expect, it } from 'vitest';
import { achievementProgress } from './lib/achievements.js';

const entry = (id, personId, extra = {}) => ({ id, personId, at: '2026-10-14', type: 'hangout', meaningfulness: 3, activeListening: [], ...extra });

describe('achievementProgress', () => {
  it('counts conversations, not entries: a log with several people counts once (audit 2026-10-14)', () => {
    const group = ['a', 'b', 'c'].map(p => entry(`g-${p}`, p, { logId: 'L1', meaningfulness: 4, activeListening: ['followup'] }));
    const alone = entry('j1', 'a', { activeListening: ['followup'] });
    const progress = achievementProgress([], [...group, alone], null);
    expect(progress.activeListener).toMatchObject({ have: 2, need: 5, done: false });
    expect(progress.firstMeaningful).toMatchObject({ have: 1, done: true });
  });
});
