// Relationship progression: the six dimensions, layer progress and new people.

import { DIM_ORDER, getLayer, GOAL_DIM_PHRASES, LAYER_BASE_DIMS } from '../data/constants.js';
import { formatAbsoluteDate, toISODate } from './dates.js';
import { clamp, uid } from './util.js';

export function layerForOverall(overall) { return overall >= 75 ? 4 : overall >= 50 ? 3 : overall >= 25 ? 2 : 1; }

// New progression model: each layer is its own fresh 0-100% meter, rather
// than the old single dims-average score sliced into four fixed bands.
// Reaching 100% advances to the next layer (capped at 4) and carries any
// overflow into the new layer's starting % instead of discarding it.
export function advanceLayer(currentLayer, currentProgress, bump) {
  let layer = currentLayer;
  let progress = currentProgress + bump;
  let leveledUp = false;
  while (progress >= 100 && layer < 4) {
    layer += 1;
    progress -= 100;
    leveledUp = true;
  }
  progress = clamp(progress, 0, 100);
  return { layer, progress, leveledUp };
}

export function computeOverall(dims) {
  const vals = DIM_ORDER.map(k => dims[k]);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export function makePerson({ name, emoji, layer }) {
  const baseVal = LAYER_BASE_DIMS[layer] || 10;
  const dims = { depth: baseVal, trust: baseVal, reciprocity: baseVal, interaction: baseVal, sharedExperiences: baseVal, listening: baseVal };
  const overall = computeOverall(dims);
  return { id: uid(), name, emoji, layer: layer || 1, dims, overall, interests: [], preferences: [], plans: [], experiences: [], important: [], goals: [], history: [{ date: formatAbsoluteDate(new Date()), at: toISODate(new Date()), value: overall }], timeline: [{ label: 'First met', at: toISODate(new Date()) }] };
}

export function generateGoalDescription(preset, person) {
  if (!person || preset.category !== 'relationship' || !preset.hint) return preset.hint;
  const l = getLayer(person.layer);
  const weakestKey = Object.keys(person.dims).reduce((a, b) => person.dims[a] <= person.dims[b] ? a : b);
  return `${preset.hint} — you're at Layer ${person.layer} (${l.name}) with ${person.name}, and ${GOAL_DIM_PHRASES[weakestKey] || weakestKey} has the most room to grow right now`;
}
