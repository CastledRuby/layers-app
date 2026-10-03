// Backup files: createBackup writes one, validateBackup checks one before
// it replaces the app's data. A file that isn't a Layers backup, comes from
// a newer app version, or has a damaged top-level list is refused with a
// message; individually damaged records are repaired where that's safe (a
// missing list becomes empty, a number is clamped into range) or skipped and
// counted, so a bad entry can't crash a screen after import.
import { CATEGORIES, DIM_ORDER, LAYER_BASE_DIMS, SKILL_ORDER, TYPE_META, categoryMeta } from '../data/constants.js';
import { EMPTY_SKILLS } from '../data/seed.js';
import { clamp, uid } from './util.js';

export const BACKUP_VERSION = 1;
// Far beyond any real backup; stops a wrong file (a video, say) being read into memory.
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

export function createBackup({ people, journal, generalGoals, events, skills, profile }, now = new Date()) {
  return { version: BACKUP_VERSION, exportedAt: now.toISOString(), people, journal, generalGoals, events, skills, profile };
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';
const isISODay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v + 'T00:00:00').getTime());
const num = (v, min, max, fallback) => (typeof v === 'number' && isFinite(v) ? clamp(v, min, max) : fallback);
const count = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function cleanHistory(history) {
  return (Array.isArray(history) ? history : [])
    .filter(h => isObject(h) && typeof h.value === 'number' && isFinite(h.value))
    .map(h => ({ ...h, value: clamp(h.value, 0, 100) }));
}

function cleanGoal(g, personId, skipped) {
  if (!isObject(g) || !isText(g.title)) { skipped.goals++; return null; }
  return {
    ...g,
    id: isText(g.id) ? g.id : uid(),
    personId,
    category: ['relationship', 'skill', 'custom'].includes(g.category) ? g.category : 'custom',
    type: isText(g.type) ? g.type : 'custom',
    description: typeof g.description === 'string' ? g.description : '',
    ...('dueDate' in g ? { dueDate: isISODay(g.dueDate) ? g.dueDate : null } : {}),
    progress: num(g.progress, 0, 100, 0),
    history: cleanHistory(g.history),
  };
}

function cleanPerson(p, skipped) {
  const layer = Math.round(num(p.layer, 1, 4, 1));
  const dims = {};
  DIM_ORDER.forEach(k => { dims[k] = num(isObject(p.dims) ? p.dims[k] : undefined, 0, 100, LAYER_BASE_DIMS[layer]); });
  const person = {
    ...p,
    name: p.name.trim(),
    emoji: isText(p.emoji) ? p.emoji : '🧑',
    layer,
    dims,
    overall: num(p.overall, 0, 100, 0),
    goals: (Array.isArray(p.goals) ? p.goals : []).map(g => cleanGoal(g, p.id, skipped)).filter(Boolean),
    history: cleanHistory(p.history),
    timeline: (Array.isArray(p.timeline) ? p.timeline : []).filter(t => isObject(t) && isText(t.label)),
  };
  CATEGORIES.forEach(({ key }) => {
    person[key] = (Array.isArray(p[key]) ? p[key] : []).flatMap(item => {
      if (!isObject(item) || !isText(item.text)) { skipped.items++; return []; }
      return [{ ...item, id: isText(item.id) ? item.id : uid(), emoji: isText(item.emoji) ? item.emoji : categoryMeta(key).emoji, temporary: !!item.temporary, archived: !!item.archived }];
    });
  });
  return person;
}

function cleanEntry(j, personIds, skipped) {
  if (!isObject(j) || !personIds.has(j.personId)) { skipped.entries++; return null; }
  return {
    ...j,
    id: isText(j.id) ? j.id : uid(),
    type: TYPE_META[j.type] ? j.type : 'other',
    meaningfulness: Math.round(num(j.meaningfulness, 1, 5, 3)),
    added: (Array.isArray(j.added) ? j.added : []).filter(s => typeof s === 'string'),
    activeListening: (Array.isArray(j.activeListening) ? j.activeListening : []).filter(s => typeof s === 'string'),
  };
}

function cleanEvent(e, personIds, skipped) {
  const valid = isObject(e) && isText(e.title) && (e.kind === 'recurring' || (e.kind === 'oneoff' && isISODay(e.date)));
  if (!valid) { skipped.events++; return null; }
  const weekdays = Array.isArray(e.weekdays) ? e.weekdays : (typeof e.weekday === 'number' ? [e.weekday] : []);
  return {
    ...e,
    id: isText(e.id) ? e.id : uid(),
    personIds: (Array.isArray(e.personIds) ? e.personIds : []).filter(id => personIds.has(id)),
    weekdays: weekdays.filter(d => Number.isInteger(d) && d >= 0 && d <= 6),
    time: typeof e.time === 'number' && isFinite(e.time) ? clamp(Math.round(e.time), 0, 24 * 60 - 1) : null,
  };
}

function cleanSkills(skills) {
  const out = {};
  SKILL_ORDER.forEach(key => {
    const s = isObject(skills) && isObject(skills[key]) ? skills[key] : {};
    out[key] = { label: isText(s.label) ? s.label : EMPTY_SKILLS[key].label, current: num(s.current, 0, 100, 0), history: cleanHistory(s.history) };
  });
  return out;
}

// Returns { ok: false, error } or { ok: true, data, summary, warnings }.
// storage.js also runs the app's own saved state through it at startup
// (source 'saved'), which only changes the wording of the warnings.
export function validateBackup(raw, { source = 'backup' } = {}) {
  const fail = (error) => ({ ok: false, error });
  if (!isObject(raw) || !('people' in raw)) return fail("That file isn't a Layers backup.");
  if ('version' in raw && (typeof raw.version !== 'number' || raw.version < 1)) return fail("That file isn't a Layers backup (it has an unknown format).");
  if (raw.version > BACKUP_VERSION) return fail('That backup was made by a newer version of Layers. Update Layers, then import it again.');
  for (const key of ['people', 'journal', 'generalGoals', 'events']) {
    if (key in raw && !Array.isArray(raw[key])) return fail(`That backup is damaged: its ${key === 'generalGoals' ? 'goals' : key} list is unreadable.`);
  }
  for (const key of ['skills', 'profile']) {
    if (key in raw && raw[key] !== null && !isObject(raw[key])) return fail(`That backup is damaged: its ${key} are unreadable.`);
  }

  const skipped = { people: 0, duplicates: 0, items: 0, goals: 0, entries: 0, events: 0 };
  const seen = new Set();
  const people = raw.people.flatMap(p => {
    if (!isObject(p) || !isText(p.id) || !isText(p.name)) { skipped.people++; return []; }
    if (seen.has(p.id)) { skipped.duplicates++; return []; }
    seen.add(p.id);
    return [cleanPerson(p, skipped)];
  });
  if (raw.people.length > 0 && people.length === 0) return fail("That backup is damaged: none of its people could be read.");

  const journal = (raw.journal || []).map(j => cleanEntry(j, seen, skipped)).filter(Boolean);
  const generalGoals = (raw.generalGoals || []).map(g => cleanGoal(g, null, skipped)).filter(Boolean);
  const events = (raw.events || []).map(e => cleanEvent(e, seen, skipped)).filter(Boolean);
  const skills = cleanSkills(raw.skills);
  const profile = isObject(raw.profile)
    ? { ...raw.profile, name: typeof raw.profile.name === 'string' ? raw.profile.name : '', focus: typeof raw.profile.focus === 'string' ? raw.profile.focus : null }
    : { name: '', focus: null };
  const exportedAt = typeof raw.exportedAt === 'string' && !isNaN(new Date(raw.exportedAt).getTime()) ? raw.exportedAt : null;

  const warnings = [];
  if (skipped.people) warnings.push(`${count(skipped.people, 'person', 'people')} without a name`);
  if (skipped.duplicates) warnings.push(count(skipped.duplicates, 'duplicate person', 'duplicate people'));
  if (skipped.entries) warnings.push(`${count(skipped.entries, 'journal entry', 'journal entries')} for people ${source === 'saved' ? 'who are no longer in your circle' : 'not in the backup'}`);
  if (skipped.goals) warnings.push(`${count(skipped.goals, 'goal')} without a title`);
  if (skipped.items) warnings.push(`${count(skipped.items, 'saved detail')} without text`);
  if (skipped.events) warnings.push(`${count(skipped.events, 'event')} with a missing title or date`);

  const goalCount = people.reduce((n, p) => n + p.goals.length, 0) + generalGoals.length;
  const summary = {
    exportedAt,
    people: people.length,
    journal: journal.length,
    goals: goalCount,
    events: events.length,
    text: [count(people.length, 'person', 'people'), count(journal.length, 'journal entry', 'journal entries'), count(goalCount, 'goal'), count(events.length, 'event')].join(', '),
  };
  return { ok: true, data: { people, journal, generalGoals, events, skills, profile, exportedAt }, summary, warnings };
}
