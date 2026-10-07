// Other calendars, read-only (docs/roadmap.md, "The plan from here", step 4):
// the secret iCal addresses you add in Me (Google Calendar's "Secret address
// in iCal format"), and downloading them. The page reads the files
// (src/lib/ics.js). See docs/electron.md.
//
// An address like that is as good as a password for that calendar, so it's
// kept in the data folder encrypted by Windows for this user (safeStorage),
// never shown to the page again, never synced and never in a backup. Fetching
// only downloads: nothing about you is sent.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAX_FEEDS = 10;
const MAX_BYTES = 5 * 1024 * 1024;

// A pasted address as https (webcal:// is the same thing), or null.
function cleanFeedUrl(text) {
  const raw = String(text || '').trim().replace(/^webcals?:\/\//i, 'https://');
  if (raw.length > 2000) return null;
  let url;
  try { url = new URL(raw); } catch { return null; }
  return url.protocol === 'https:' && url.hostname ? url.toString() : null;
}

// The calendars added: [{ id, name, url }], encrypted by Windows.
function feedStore(file, safeStorage) {
  function read() {
    try {
      if (!fs.existsSync(file) || !safeStorage.isEncryptionAvailable()) return [];
      const list = JSON.parse(safeStorage.decryptString(fs.readFileSync(file)));
      return Array.isArray(list) ? list.filter(f => f && typeof f.id === 'string' && typeof f.url === 'string') : [];
    } catch { return []; }
  }
  function write(list) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows can’t protect it here');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, safeStorage.encryptString(JSON.stringify(list)));
  }
  return {
    // What the page sees: no addresses, only names and where they're from.
    list: () => read().map(({ id, name, url }) => ({ id, name, host: new URL(url).hostname })),
    urls: () => read(),
    add(url, name) {
      const list = read();
      if (list.some(f => f.url === url)) return { error: 'That calendar is added already.' };
      if (list.length >= MAX_FEEDS) return { error: `Up to ${MAX_FEEDS} calendars.` };
      const feed = { id: crypto.randomUUID(), name: name || 'Calendar', url };
      write([...list, feed]);
      return { ok: true, feed: { id: feed.id, name: feed.name, host: new URL(url).hostname } };
    },
    remove(id) {
      write(read().filter(f => f.id !== id));
      return { ok: true };
    },
  };
}

// Downloads one calendar's file: { text } or { error }. `fetchImpl` is
// replaced in tests.
async function fetchFeed(url, { fetchImpl = globalThis.fetch, timeoutMs = 20000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: controller.signal, redirect: 'follow', headers: { Accept: 'text/calendar, */*' } });
    if (!res.ok) return { error: res.status === 404 || res.status === 403 || res.status === 401 ? 'That address no longer works (it may have been reset in Google Calendar).' : `The calendar couldn't be fetched (${res.status}).` };
    const text = await res.text();
    if (text.length > MAX_BYTES) return { error: 'That calendar is too large.' };
    if (!/BEGIN:VCALENDAR/i.test(text)) return { error: "That address doesn't give a calendar. Use the secret address in iCal format." };
    return { text };
  } catch (e) {
    return { error: e && e.name === 'AbortError' ? 'The calendar took too long to answer.' : "Couldn't reach the calendar. Are you online?" };
  } finally {
    clearTimeout(timer);
  }
}

// The calendar's own name, from its file (Google writes X-WR-CALNAME).
function calendarName(text) {
  const m = /^X-WR-CALNAME:(.+)$/m.exec(String(text).replace(/\r\n?/g, '\n'));
  return m ? m[1].trim().replace(/\\([,;\\])/g, '$1').slice(0, 80) : null;
}

module.exports = { calendarName, cleanFeedUrl, feedStore, fetchFeed, MAX_FEEDS };
