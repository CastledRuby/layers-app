// localStorage persistence for the whole app state.


const STORAGE_KEY = 'layers-app-state-v1';

export function loadSaved() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    return null;
  }
}

export function persistState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // Storage unavailable (private browsing, disabled storage, etc). Fail silently.
  }
}

const LAST_NOTIFIED_KEY = 'layers-last-notified-date';

export function getLastNotifiedDate() {
  try { return window.localStorage.getItem(LAST_NOTIFIED_KEY); } catch (e) { return null; }
}

export function setLastNotifiedDate(d) {
  try { window.localStorage.setItem(LAST_NOTIFIED_KEY, d); } catch (e) { /* ignore */ }
}
