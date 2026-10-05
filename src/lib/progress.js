// Relationship progression: the six dimensions, layer progress and new people.

import { DIM_ORDER, getLayer, GOAL_DIM_PHRASES, GOAL_PRESET_DIM, LAYER_BASE_DIMS, SKILL_GOAL_PRESETS, SKILL_GOAL_STEP } from '../data/constants.js';
import { formatAbsoluteDate, pushHistoryPoint, sortHistory, toISODate } from './dates.js';
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

export function dimsEqual(a, b) { return DIM_ORDER.every(k => a[k] === b[k]); }

// Manual "Adjust" maps the dimension average onto the four layers absolutely:
// 25-point bands (0-25 is Layer 1, 25-50 Layer 2, ...), and the position
// inside the band is that layer's 0-100% meter.
export function placeOnLayers(avg) {
  const layer = layerForOverall(avg);
  const overall = layer >= 4 && avg >= 100 ? 100 : clamp(Math.round(((avg - (layer - 1) * 25) / 25) * 100), 0, 100);
  return { layer, overall };
}

// Progress between two placements, counting each layer as 100%: Layer 2 at
// 90% -> Layer 3 at 4% is +14, not -86.
export function progressDelta(before, after) {
  return (after.layer - before.layer) * 100 + (after.overall - before.overall);
}

// A chart point never lands before the latest one: a backdated log changes
// progress now, so it's recorded on the newest day already on the chart.
// (It used to be written at the old date, where it replaced that day's point
// and made the line jump up and back down.)
export function chartDay(history, at) {
  const sorted = sortHistory(history || []);
  const last = sorted.length ? sorted[sorted.length - 1].at : null;
  return last && last > at ? last : at;
}

// Move a person to a new layer / layer percentage. Records what changed and
// why (the profile's change card), a chart point, and a dated timeline step
// whenever the layer itself changes. `extra` carries other fields to update
// (dims, goals, info items).
export function movePerson(p, { layer, overall, at, why, extra = {} }) {
  const day = chartDay(p.history, at);
  const changedLayer = layer !== p.layer;
  const step = changedLayer
    ? [{ label: layer > p.layer ? `Reached Layer ${layer}: ${getLayer(layer).name}` : `Moved to Layer ${layer}: ${getLayer(layer).name}`, at }]
    : [];
  return {
    ...p,
    ...extra,
    layer,
    overall,
    justLeveledUp: layer > p.layer || !!p.justLeveledUp,
    lastChange: { before: p.overall, after: overall, beforeLayer: p.layer, afterLayer: layer, why },
    history: pushHistoryPoint(p.history || [], { date: formatAbsoluteDate(new Date(`${day}T00:00:00`)), at: day, value: overall, layer }),
    timeline: [...(p.timeline || []), ...step],
  };
}

// New people start where Adjust would put their starting dimensions, so
// opening Adjust and saving without changes leaves them exactly where they are.
// `overall` (0-100, from the closeness quiz) starts them that far into their
// layer; without it they start at the layer's usual place.
export function makePerson({ name, emoji, avatar = null, layer, overall: startAt = null }) {
  const start = layer || 1;
  const baseVal = typeof startAt === 'number' ? Math.round((start - 1) * 25 + clamp(startAt, 0, 95) / 4) : (LAYER_BASE_DIMS[start] || LAYER_BASE_DIMS[1]);
  const dims = { depth: baseVal, trust: baseVal, reciprocity: baseVal, interaction: baseVal, sharedExperiences: baseVal, listening: baseVal };
  const { overall } = placeOnLayers(computeOverall(dims));
  const today = new Date();
  return { id: uid(), name, emoji, ...(avatar ? { avatar } : {}), layer: start, dims, overall, interests: [], preferences: [], plans: [], experiences: [], important: [], goals: [], history: [{ date: formatAbsoluteDate(today), at: toISODate(today), value: overall, layer: start }], timeline: [{ label: 'First met', at: toISODate(today) }] };
}

export function generateGoalDescription(preset, person) {
  if (!person || preset.category !== 'relationship' || !preset.hint) return preset.hint;
  const l = getLayer(person.layer);
  const weakestKey = Object.keys(person.dims).reduce((a, b) => person.dims[a] <= person.dims[b] ? a : b);
  return `${preset.hint} — you're at Layer ${person.layer} (${l.name}) with ${person.name}, and ${GOAL_DIM_PHRASES[weakestKey] || weakestKey} has the most room to grow right now`;
}

// Raise skills by the given amounts. Each change records a chart point, at
// most one a day per skill; nothing used to add points, so the skills chart
// of anyone who didn't start from the sample data stayed empty for good.
export function bumpSkills(skills, bumps, at = toISODate(new Date())) {
  const next = { ...skills };
  Object.entries(bumps).forEach(([key, amount]) => {
    const skill = next[key];
    if (!skill || !(amount > 0)) return;
    const current = clamp(skill.current + amount, 0, 100);
    if (current === skill.current) return;
    next[key] = { ...skill, current, history: pushHistoryPoint(skill.history || [], { date: formatAbsoluteDate(new Date(`${at}T00:00:00`)), at, value: current }) };
  });
  return next;
}

// The skills a bump raised (to move skill goals with them).
export function raisedSkills(before, after) {
  return Object.keys(after).filter(k => before[k] && after[k].current > before[k].current);
}

// Skill goals whose skill went up move by SKILL_GOAL_STEP, with a chart
// point. `only` (goal ids) limits it to goals the log said it moved.
export function advanceSkillGoals(goals, raised, at = toISODate(new Date()), only) {
  if (!raised.length) return goals;
  return goals.map(g => {
    if (g.progress >= 100 || !raised.includes(SKILL_GOAL_PRESETS[g.type]) || (only && !only.includes(g.id))) return g;
    const value = clamp(g.progress + SKILL_GOAL_STEP, 0, 100);
    return { ...g, progress: value, history: pushHistoryPoint(g.history || [], { date: formatAbsoluteDate(new Date(`${at}T00:00:00`)), at, value }) };
  });
}

// --- Logging: how much each dimension grows -------------------------------
// A dimension rated 1-5 in the log's More details grows by its rating
// (1 -> +2, 3 -> +7, 5 -> +11, plus the active-listening bonus for
// reciprocity and listening). An unrated one uses the original formula with
// the overall "How meaningful" score.
export function dimBumps({ meaningfulness, ratings = {}, activeListening = [], type }) {
  const m = meaningfulness;
  const al = activeListening.length;
  const shared = type === 'activity' || type === 'hangout';
  const rated = (k, bonus = 0) => Math.round(ratings[k] * 2.2 + bonus);
  return {
    depth: ratings.depth ? rated('depth') : (m >= 4 ? Math.round(m * 2.6) : Math.round(m * 1.3)),
    trust: ratings.trust ? rated('trust') : Math.round(m * 2.2),
    reciprocity: ratings.reciprocity ? rated('reciprocity', al * 1.5) : Math.round(m * 1.6 + al * 1.5),
    interaction: ratings.interaction ? rated('interaction') : Math.round(m * 2.2),
    sharedExperiences: ratings.sharedExperiences ? rated('sharedExperiences') : (shared ? Math.round(m * 2.6) : Math.round(m * 0.8)),
    listening: ratings.listening ? rated('listening', al * 3.5) : Math.round(al * 3.5 + (m >= 4 ? 2 : 0)),
  };
}

// A goal about one dimension moves with that dimension's rating, if given.
export function goalBumpFor(goal, meaningfulness, ratings = {}) {
  const dim = GOAL_PRESET_DIM[goal.type];
  return Math.round((dim && ratings[dim] ? ratings[dim] : meaningfulness) * 3.2);
}

// --- Keeping the dimensions in step with the layer (P3, option C) ---------
// A person's dimension average stays inside their layer's 25-point band, so
// Adjust (which places people by that average) agrees with the layer shown.
// Sums rather than averages, since the average is rounded: Layer 3's band is
// an average that rounds to 50-74, a sum of 297-446.
const dimSum = (d) => DIM_ORDER.reduce((s, k) => s + d[k], 0);
export function layerDimBounds(layer) {
  return { min: layer <= 1 ? 0 : (layer - 1) * 150 - 3, max: layer >= 4 ? 600 : layer * 150 - 4 };
}

// Scale dimensions proportionally to a total, keeping their shape, as whole
// numbers between 0 and 100.
export function scaleDimsToSum(dims, target) {
  const total = dimSum(dims);
  const raw = DIM_ORDER.map(k => (total > 0 ? dims[k] * target / total : target / 6));
  const out = raw.map(v => clamp(Math.floor(v), 0, 100));
  let left = target - out.reduce((a, b) => a + b, 0);
  const order = DIM_ORDER.map((_, i) => i).sort((a, b) => (raw[b] - Math.floor(raw[b])) - (raw[a] - Math.floor(raw[a])));
  for (let pass = 0; left > 0 && pass < 6; pass++) {
    for (const i of order) { if (left > 0 && out[i] < 100) { out[i] += 1; left -= 1; } }
  }
  return Object.fromEntries(DIM_ORDER.map((k, i) => [k, out[i]]));
}

// After a log: growth that would push the average past the top of the layer's
// band is scaled down (until the meter levels up), and entering a new layer
// lifts the dimensions to at least the bottom of its band.
export function keepDimsInLayer(oldDims, newDims, layer) {
  const { min, max } = layerDimBounds(layer);
  let out = { ...newDims };
  if (dimSum(out) > max) {
    const room = Math.max(0, max - dimSum(oldDims));
    const inc = DIM_ORDER.map(k => Math.max(0, newDims[k] - oldDims[k]));
    const total = inc.reduce((a, b) => a + b, 0);
    out = Object.fromEntries(DIM_ORDER.map((k, i) => [k, oldDims[k] + (total > 0 ? Math.floor(inc[i] * room / total) : 0)]));
    if (dimSum(out) > max) out = scaleDimsToSum(out, max); // already past it (older data)
  }
  if (dimSum(out) < min) out = scaleDimsToSum(out, min);
  return out;
}

// One-off migration (saved data version 2): people whose dimensions drifted
// outside their layer's band are scaled into it, to where their progress
// meter is, so Adjust shows the layer and percentage they already have.
// People already inside their band are left alone. Returns the changed names.
export function migrateDimsToLayers(people) {
  const changed = [];
  const next = people.map(p => {
    if (!p || !p.dims) return p;
    const { min, max } = layerDimBounds(p.layer);
    const sum = dimSum(p.dims);
    if (sum >= min && sum <= max) return p;
    const target = clamp(Math.round(((p.layer - 1) * 25 + (p.overall || 0) / 4) * 6), min, max);
    changed.push(p.name);
    return { ...p, dims: scaleDimsToSum(p.dims, target) };
  });
  return { people: next, changed };
}
