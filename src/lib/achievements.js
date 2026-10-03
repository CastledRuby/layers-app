// Achievements (Me tab). Progress is worked out from your data; once an
// achievement is reached it's recorded with the day (LayersApp's
// `achievements`, saved and backed up), so it stays unlocked even if the
// data later changes, for example after removing a person. They used to be
// recalculated on every render, so they could lock again.
import { ACHIEVEMENTS, CATEGORIES } from '../data/constants.js';

// { key: { done, have, need, unit } } for every achievement.
export function achievementProgress(people, journal, skills) {
  const savedInfo = people.reduce((sum, p) => sum + CATEGORIES.reduce((s, c) => s + (p[c.key] || []).length, 0), 0);
  const listened = journal.filter(j => (j.activeListening || []).length > 0).length;
  const meaningful = journal.filter(j => j.meaningfulness >= 4).length;
  const closer = people.filter(p => p.layer >= 3).length;
  const reciprocity = skills && skills.reciprocity ? skills.reciprocity.current : 0;
  const rows = {
    firstMeaningful: [meaningful, 1, 'conversation'],
    activeListener: [listened, 5, 'conversations'],
    remembered10: [savedInfo, 10, 'things'],
    reciprocityMaster: [reciprocity, 75, '%'],
    relationshipBuilder: [closer, 2, 'relationships'],
  };
  return Object.fromEntries(ACHIEVEMENTS.map(a => {
    const [have, need, unit] = rows[a.key];
    return [a.key, { done: have >= need, have: Math.min(have, need), need, unit }];
  }));
}

// Achievements reached now that aren't recorded yet.
export function newlyUnlocked(progress, recorded) {
  return ACHIEVEMENTS.filter(a => progress[a.key] && progress[a.key].done && !(recorded && recorded[a.key])).map(a => a.key);
}

// "3 of 5 conversations", "40% of 75%".
export function progressText({ have, need, unit }) {
  return unit === '%' ? `${have}% of ${need}%` : `${have} of ${need} ${unit}`;
}
