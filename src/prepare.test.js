// Prepare's personal hooks (P5): drawn from everything saved about a person,
// with personal topics held back until the relationship is personal.
import { describe, expect, it } from 'vitest';
import { makePerson } from './lib/progress.js';
import { buildPotentialHooks } from './lib/text.js';

const NOW = new Date(2026, 9, 4, 12);
const item = (text, at, extra = {}) => ({ id: text, emoji: '•', text, at, temporary: false, archived: false, ...extra });

function personWith(overrides) {
  return { ...makePerson({ name: 'Ana', emoji: '🙂', layer: 2 }), ...overrides };
}

describe('buildPotentialHooks', () => {
  it('returns nothing for someone with nothing saved', () => {
    expect(buildPotentialHooks(personWith({}), [], NOW)).toEqual([]);
  });

  it('lists up to three interests, most recently mentioned first', () => {
    const p = personWith({ interests: [item('Chess', '2026-09-01'), item('Football', '2026-10-03'), item('Anime', '2026-09-20'), item('Golf', '2026-08-01'), item('Old', '2026-10-01', { archived: true })] });
    const hook = buildPotentialHooks(p, [], NOW).find(h => h.key === 'interest');
    expect(hook.text).toContain("They're into Football, Anime and Chess (and 1 more)");
  });

  it('puts "ask how it went" first, and names what you last talked about', () => {
    const p = personWith({ important: [item('An exam', '2026-10-01', { temporary: true })] });
    const journal = [{ id: 'j1', personId: p.id, at: '2026-10-02', type: 'talked', meaningfulness: 3, added: ['Football', 'Moving house'], activeListening: [], reflection: 'They seemed stressed about the move' }];
    const hooks = buildPotentialHooks(p, journal, NOW);
    expect(hooks[0]).toMatchObject({ key: 'followup', label: 'Ask how it went' });
    expect(hooks.find(h => h.key === 'recent').text).toContain('You talked about Football and Moving house');
    expect(hooks.find(h => h.key === 'reflection').text).toBe('"They seemed stressed about the move"');
  });

  it('keeps personal experiences for Layer 3 and closer', () => {
    const experiences = [item('Changed schools last year', '2026-09-01')];
    expect(buildPotentialHooks(personWith({ layer: 2, experiences }), [], NOW).map(h => h.key)).not.toContain('experience');
    expect(buildPotentialHooks(personWith({ layer: 3, experiences }), [], NOW).map(h => h.key)).toContain('experience');
  });

  it('includes plans and preferences, and never more than six hooks', () => {
    const p = personWith({
      layer: 4,
      interests: [item('Chess', '2026-09-01')],
      plans: [item('Trip to Japan', '2026-09-01')],
      preferences: [item('Prefers coffee catch-ups', '2026-09-01')],
      experiences: [item('Changed schools', '2026-09-01')],
      important: [item('An exam', '2026-09-01')],
    });
    const journal = [{ id: 'j1', personId: p.id, at: '2026-10-02', type: 'talked', meaningfulness: 3, added: [], activeListening: [], reflection: 'Good chat' }];
    const hooks = buildPotentialHooks(p, journal, NOW);
    expect(hooks).toHaveLength(6);
    expect(hooks.map(h => h.key)).toEqual(['followup', 'recent', 'reflection', 'interest', 'plan', 'preference']);
  });
});
