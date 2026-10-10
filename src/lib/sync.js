// Ready for syncing (docs/roadmap.md, "Proposal: Layers on your phone", step
// 1): when each record last changed, what was deleted, and how two copies of
// the data come together. The laptop keeps this in what it saves and in
// backups; sync through OneDrive (lib/syncFile.js, syncOnce) merges with it,
// and so will the phone later.
//
// createStamper keeps `updatedAt` on people, journal entries, plans and goals
// (a person's and the general ones), and on the profile, without touching
// the app's state: each save is compared with the one before by reference.
// State is never changed in place, so a new object is a changed record, and
// a record that's gone was deleted. Undo and Redo, which compare the data by
// reference, are left alone.
//
// mergeData brings two copies together record by record: the one changed
// last wins; a person's goals are merged one by one too; and something
// deleted on one side stays deleted unless the other side changed it after.

// What a deleted record was: { id, kind, at } with kind one of these.
export const KINDS = ['person', 'entry', 'event', 'goal'];
// Deletions are remembered this long, long enough for a phone that's been
// off for a while to catch up.
export const KEEP_DELETED_DAYS = 90;
const COLLECTIONS = [['people', 'person'], ['journal', 'entry'], ['events', 'event'], ['generalGoals', 'goal']];
const DAY_MS = 24 * 60 * 60 * 1000;

function prune(deleted, now) {
  const oldest = new Date(new Date(now).getTime() - KEEP_DELETED_DAYS * DAY_MS).toISOString();
  return deleted.filter(d => d.at >= oldest);
}

// deleted: the list saved last time. The first stamp() only remembers what's
// there (keeping the updatedAt it was saved with); after that, a record
// that's new or changed gets `now`, and one that's gone is added to deleted.
export function createStamper(deleted = []) {
  const seen = new Map(); // `${kind}:${id}` -> { ref, out }
  let gone = [...deleted];
  let primed = false;

  function stamp(state, now) {
    const present = new Set();
    function one(kind, rec, build) {
      const key = `${kind}:${rec.id}`;
      present.add(key);
      const before = seen.get(key);
      if (before && before.ref === rec) {
        if (build) build(rec, true); // still walk its goals, so they count as present
        return before.out;
      }
      const body = build ? build(rec, false) : rec;
      const out = primed ? { ...body, updatedAt: now } : (body === rec ? rec : body);
      seen.set(key, { ref: rec, out });
      return out;
    }
    const goals = (list) => list.map(g => one('goal', g));
    const person = (p, unchanged) => {
      const list = p.goals || [];
      if (unchanged) { list.forEach(g => present.add(`goal:${g.id}`)); return p; }
      const out = goals(list);
      return out.every((g, i) => g === list[i]) ? p : { ...p, goals: out };
    };
    const result = {};
    COLLECTIONS.forEach(([key, kind]) => {
      result[key] = (state[key] || []).map(rec => one(kind, rec, kind === 'person' ? person : null));
    });
    if (state.profile) {
      const before = seen.get('profile:me');
      const out = before && before.ref === state.profile ? before.out : primed ? { ...state.profile, updatedAt: now } : state.profile;
      seen.set('profile:me', { ref: state.profile, out });
      result.profile = out;
    }
    // Gone since the last save: deleted. Back again (Undo): not deleted.
    const removed = [];
    seen.forEach((_, key) => {
      if (key === 'profile:me' || present.has(key)) return;
      seen.delete(key);
      const [kind, ...rest] = key.split(':');
      removed.push({ id: rest.join(':'), kind, at: now });
    });
    gone = prune([...gone.filter(d => !present.has(`${d.kind}:${d.id}`) && !removed.some(r => r.id === d.id && r.kind === d.kind)), ...(primed ? removed : [])], now);
    primed = true;
    result.deleted = gone;
    return result;
  }
  // The data a sync brought in (lib/syncFile.js), with its own times:
  // remembered as it is, so the next save keeps those times rather than
  // stamping it as changed here, and its deletions taken on.
  function adopt(data) {
    seen.clear();
    COLLECTIONS.forEach(([key, kind]) => (data[key] || []).forEach(rec => {
      seen.set(`${kind}:${rec.id}`, { ref: rec, out: rec });
      if (kind === 'person') (rec.goals || []).forEach(g => seen.set(`goal:${g.id}`, { ref: g, out: g }));
    }));
    if (data.profile) seen.set('profile:me', { ref: data.profile, out: data.profile });
    gone = [...(data.deleted || [])];
    primed = true;
  }
  // Starting from different data altogether (finishing setting up, starting
  // over, restoring a backup): what was there is forgotten, not counted as
  // deleted, so other devices keep theirs; the next save only remembers.
  function forget() {
    seen.clear();
    primed = false;
  }
  return { stamp, adopt, forget };
}

// The deleted list from a save or a backup: well-formed entries only.
export function cleanDeleted(list) {
  return (Array.isArray(list) ? list : []).filter(d => d && typeof d === 'object'
    && typeof d.id === 'string' && d.id && KINDS.includes(d.kind)
    && typeof d.at === 'string' && !isNaN(new Date(d.at).getTime()))
    .map(d => ({ id: d.id, kind: d.kind, at: d.at }));
}

const stampOf = (rec) => (rec && typeof rec.updatedAt === 'string' ? rec.updatedAt : '');

// Two copies of the same records, by id: the one changed last (a tie, or no
// updatedAt on either, keeps `mine`), then without anything deleted after it
// last changed. `inner` merges a pair that both have (a person's goals).
function mergeList(mine = [], theirs = [], kind, deleted, inner) {
  const byId = new Map();
  mine.forEach(r => byId.set(r.id, r));
  theirs.forEach(r => {
    const m = byId.get(r.id);
    if (!m) { byId.set(r.id, r); return; }
    const winner = stampOf(r) > stampOf(m) ? r : m;
    byId.set(r.id, inner ? inner(winner, m, r) : winner);
  });
  // Mine first in their order, then anything only they have, in theirs.
  const order = [...mine.map(r => r.id), ...theirs.map(r => r.id).filter(id => !mine.some(r => r.id === id))];
  return order.map(id => byId.get(id)).filter(r => {
    const d = deleted.find(x => x.kind === kind && x.id === r.id);
    return !d || d.at < stampOf(r);
  });
}

// Skills only grow, so each takes the copy that's further on; an achievement
// keeps the day it was first earned.
function mergeSkills(mine = {}, theirs = {}) {
  const out = { ...theirs, ...mine };
  Object.keys(out).forEach(k => {
    if (mine[k] && theirs[k] && (theirs[k].current || 0) > (mine[k].current || 0)) out[k] = theirs[k];
  });
  return out;
}
function mergeAchievements(mine = {}, theirs = {}) {
  const out = { ...theirs, ...mine };
  Object.keys(theirs).forEach(k => { if (mine[k] && theirs[k] < mine[k]) out[k] = theirs[k]; });
  return out;
}

// Two copies of the data (this computer's and the phone's) as one. Each is
// { people, journal, events, generalGoals, profile, skills, achievements,
// deleted }. `now` decides which deletions are old enough to forget.
export function mergeData(mine, theirs, now = new Date().toISOString()) {
  const deleted = prune(mergeDeleted(cleanDeleted(mine.deleted), cleanDeleted(theirs.deleted)), now);
  // A person: the copy changed last, with both copies' goals merged.
  const person = (winner, m, t) => ({ ...winner, goals: mergeList(m.goals || [], t.goals || [], 'goal', deleted) });
  return {
    people: mergeList(mine.people, theirs.people, 'person', deleted, person),
    journal: mergeList(mine.journal, theirs.journal, 'entry', deleted),
    events: mergeList(mine.events, theirs.events, 'event', deleted),
    generalGoals: mergeList(mine.generalGoals, theirs.generalGoals, 'goal', deleted),
    profile: stampOf(theirs.profile) > stampOf(mine.profile) ? theirs.profile : mine.profile,
    skills: mergeSkills(mine.skills, theirs.skills),
    achievements: mergeAchievements(mine.achievements || {}, theirs.achievements || {}),
    deleted,
  };
}

// Both sides' deletions, each record once with the latest time.
function mergeDeleted(a, b) {
  const out = new Map();
  [...a, ...b].forEach(d => {
    const key = `${d.kind}:${d.id}`;
    const was = out.get(key);
    if (!was || d.at > was.at) out.set(key, d);
  });
  return [...out.values()];
}
