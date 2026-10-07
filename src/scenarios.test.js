// Analyse's sample chats (data/scenarios.js): every suggestion of what to say
// next comes in three tones, even "don't message yet" (a light close, if you
// still want to say something).
import { describe, expect, it } from 'vitest';
import { SCENARIOS } from './data/scenarios.js';

describe('Analyse suggestions', () => {
  it('each one has a natural, a playful and a deeper version', () => {
    const missing = [];
    Object.values(SCENARIOS).forEach(sc => Object.entries(sc.next).forEach(([kind, item]) => {
      if (!item) return;
      ['natural', 'playful', 'deeper'].forEach(tone => { if (!(typeof item[tone] === 'string' && item[tone].trim())) missing.push(`${sc.key}.${kind}.${tone}`); });
    }));
    expect(missing).toEqual([]);
  });
});
