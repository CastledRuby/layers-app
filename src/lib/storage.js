// localStorage persistence for the whole app state.

import { validateBackup } from './backup.js';
import { migrateDimsToLayers } from './progress.js';

export const STORAGE_KEY = 'layers-app-state-v1';
// The shape of the saved state. 2: dimensions kept inside their layer's band
// (P3); saves without a dataVersion are 1 and get migrateDimsToLayers once.
export const DATA_VERSION = 2;
// Copies of saved data that couldn't be read as-is, kept so nothing is lost
// for good: `layers-app-state-v1-unreadable-<ISO time>`.
export const UNREADABLE_PREFIX = `${STORAGE_KEY}-unreadable-`;

function keepCopy(raw, now) {
  try {
    // Once is enough: startup can run twice (React's development mode), and
    // the same damaged data may be read again at the next launch.
    const storage = window.localStorage;
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(UNREADABLE_PREFIX) && storage.getItem(key) === raw) return true;
    }
    storage.setItem(`${UNREADABLE_PREFIX}${now.toISOString()}`, raw);
    return true;
  } catch {
    return false; // storage full: the copy can't be kept, and the notice says so
  }
}

// Reads the saved state and checks it with the same validator as a backup
// import, so a damaged record can't crash a screen at startup.
// Returns { state, problem }:
//   state    the saved state, repaired if needed, or null if there is none
//   problem  null, or { kind: 'unreadable' | 'repaired', warnings, copyKept }
//   migrated names of people whose dimensions the version-2 migration moved
// It used to return null for unreadable data, which loaded the sample people
// and onboarding, and the next save overwrote the original for good.
export function loadSavedState(now = new Date()) {
  let raw;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return { state: null, problem: null }; // storage disabled: nothing to read
  }
  if (!raw) return { state: null, problem: null };

  let parsed = null;
  try { parsed = JSON.parse(raw); } catch { /* handled below */ }
  const result = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? validateBackup({ ...parsed, version: 1 }, { source: 'saved' })
    : { ok: false };
  if (!result.ok) {
    return { state: null, problem: { kind: 'unreadable', warnings: [], copyKept: keepCopy(raw, now) } };
  }
  // achievements: null for saved data from before they were recorded.
  const state = { ...result.data, onboarded: !!parsed.onboarded, theme: parsed.theme === 'dark' ? 'dark' : 'light' };
  delete state.exportedAt;
  let migrated = [];
  if (!(parsed.dataVersion >= 2)) {
    const m = migrateDimsToLayers(state.people);
    state.people = m.people;
    migrated = m.changed;
  }
  if (result.warnings.length === 0) return { state, problem: null, migrated };
  return { state, problem: { kind: 'repaired', warnings: result.warnings, copyKept: keepCopy(raw, now) }, migrated };
}

// Returns false when the write failed (storage full or disabled), so the app
// can say so instead of silently losing every change after it.
export function persistState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, dataVersion: DATA_VERSION }));
    return true;
  } catch {
    return false;
  }
}

const LAST_NOTIFIED_KEY = 'layers-last-notified-date';

export function getLastNotifiedDate() {
  try { return window.localStorage.getItem(LAST_NOTIFIED_KEY); } catch { return null; }
}

export function setLastNotifiedDate(d) {
  try { window.localStorage.setItem(LAST_NOTIFIED_KEY, d); } catch { /* ignore */ }
}

// Notifications Layers showed itself (outside the Windows app), by their tag
// (lib/calendar.js), so each shows once even across restarts. Only the latest
// 200 are kept.
const NOTIFIED_REMINDERS_KEY = 'layers-notified-reminders';

export function getNotifiedReminders() {
  try {
    const list = JSON.parse(window.localStorage.getItem(NOTIFIED_REMINDERS_KEY) || '[]');
    return new Set(Array.isArray(list) ? list : []);
  } catch { return new Set(); }
}

export function addNotifiedReminder(key) {
  try {
    const list = [...getNotifiedReminders(), key].slice(-200);
    window.localStorage.setItem(NOTIFIED_REMINDERS_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

// Snoozed reminders ({ id, eventId, day, at }) from a notification's Snooze
// button. They only matter until they've fired, so they're kept here rather
// than in the saved state (and backups); ones a day past are dropped.
const SNOOZES_KEY = 'layers-snoozes';

export function getSnoozes(now = Date.now()) {
  try {
    const list = JSON.parse(window.localStorage.getItem(SNOOZES_KEY) || '[]');
    return (Array.isArray(list) ? list : []).filter(s => s && typeof s.at === 'number' && s.at > now - 86400000 && typeof s.eventId === 'string');
  } catch { return []; }
}

export function setSnoozes(list) {
  try { window.localStorage.setItem(SNOOZES_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}
