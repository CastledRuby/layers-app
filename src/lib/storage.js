// localStorage persistence for the whole app state.

import { validateBackup } from './backup.js';

export const STORAGE_KEY = 'layers-app-state-v1';
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
  const state = { ...result.data, onboarded: !!parsed.onboarded, theme: parsed.theme === 'dark' ? 'dark' : 'light' };
  delete state.exportedAt;
  if (result.warnings.length === 0) return { state, problem: null };
  return { state, problem: { kind: 'repaired', warnings: result.warnings, copyKept: keepCopy(raw, now) } };
}

// Returns false when the write failed (storage full or disabled), so the app
// can say so instead of silently losing every change after it.
export function persistState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

// Reminder notifications already shown, as `${eventId}:${day}` keys, so each
// reminder notifies once a day even across restarts. Only the latest 200
// are kept.
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
