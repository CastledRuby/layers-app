// Other calendars (electron/feeds.cjs): which addresses are taken, keeping
// them encrypted (Windows' protection stood in for) and out of the page's
// sight, and fetching them (the network stood in for).
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { calendarName, cleanFeedUrl, feedStore, fetchFeed } from '../electron/feeds.cjs';

const dirs = [];
afterEach(() => { dirs.splice(0).forEach(d => fs.rmSync(d, { recursive: true, force: true })); });
const tempFile = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'layers-feeds-')); dirs.push(d); return path.join(d, 'calendars.bin'); };
const fake = { isEncryptionAvailable: () => true, encryptString: (s) => Buffer.from(`enc:${s}`), decryptString: (b) => b.toString().slice(4) };
const ADDRESS = 'https://calendar.google.com/calendar/ical/me%40gmail.com/private-abc123/basic.ics';

describe('calendar addresses', () => {
  it('takes https and webcal addresses, nothing else', () => {
    expect(cleanFeedUrl(` ${ADDRESS} `)).toBe(ADDRESS);
    expect(cleanFeedUrl('webcal://example.com/school.ics')).toBe('https://example.com/school.ics');
    expect(cleanFeedUrl('http://example.com/a.ics')).toBeNull();
    expect(cleanFeedUrl('file:///C:/secret.ics')).toBeNull();
    expect(cleanFeedUrl('not an address')).toBeNull();
  });

  it('keeps them encrypted, and gives the page only names', () => {
    const file = tempFile();
    const store = feedStore(file, fake);
    expect(store.add(ADDRESS, 'School')).toMatchObject({ ok: true, feed: { name: 'School', host: 'calendar.google.com' } });
    expect(store.add(ADDRESS, 'Again')).toMatchObject({ error: expect.any(String) });
    expect(fs.readFileSync(file, 'utf8').startsWith('enc:')).toBe(true);
    expect(JSON.stringify(store.list())).not.toContain('private-abc123');
    const [feed] = store.list();
    expect(store.urls()[0].url).toBe(ADDRESS);
    store.remove(feed.id);
    expect(store.list()).toEqual([]);
  });

  it('reads the calendar’s own name', () => {
    expect(calendarName('BEGIN:VCALENDAR\r\nX-WR-CALNAME:School\\, Year 12\r\nEND:VCALENDAR')).toBe('School, Year 12');
    expect(calendarName('BEGIN:VCALENDAR\r\nEND:VCALENDAR')).toBeNull();
  });
});

describe('fetching a calendar', () => {
  const answer = (status, text) => async () => ({ ok: status === 200, status, text: async () => text });

  it('gives the file, or says what went wrong', async () => {
    expect(await fetchFeed(ADDRESS, { fetchImpl: answer(200, 'BEGIN:VCALENDAR\r\nEND:VCALENDAR') })).toEqual({ text: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR' });
    expect(await fetchFeed(ADDRESS, { fetchImpl: answer(404, '') })).toMatchObject({ error: expect.stringMatching(/no longer works/) });
    expect(await fetchFeed(ADDRESS, { fetchImpl: answer(200, '<html>sign in</html>') })).toMatchObject({ error: expect.stringMatching(/secret address/) });
    expect(await fetchFeed(ADDRESS, { fetchImpl: async () => { throw new TypeError('offline'); } })).toMatchObject({ error: expect.stringMatching(/online/) });
  });
});
