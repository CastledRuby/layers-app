/** @vitest-environment jsdom */
// Your Google Calendar, read-only (docs/roadmap.md, "The plan from here",
// step 4): adding it in Me by its secret address, its events on Today marked
// as Google's, opened read-only, in planning's clash warning, and never
// reminded. The main process (where the address is kept, and the download)
// is stood in for.
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toISODate } from '../../src/lib/dates.js';
import { dialog, nav, person, renderApp, seedState, toasts } from './harness.jsx';

const today = toISODate(new Date());
const compact = today.replace(/-/g, '');
// A class today at 3:00 PM for an hour (floating time: this computer's).
const ICS = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'X-WR-CALNAME:School', 'BEGIN:VEVENT', 'UID:maths-1', 'SUMMARY:Maths', 'LOCATION:Room 4', `DTSTART:${compact}T150000`, `DTEND:${compact}T160000`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');

function fakeBridge() {
  const b = {
    getAutoLaunch: () => Promise.resolve(false), setAutoLaunch: () => Promise.resolve(false), getVersion: () => Promise.resolve('test'),
    getShortcutStatus: () => Promise.resolve({ registered: true }), setTheme: () => {}, showWindow: () => {},
    scheduleNotifications: vi.fn(() => Promise.resolve({ scheduled: 0 })), calendarReady: () => Promise.resolve([]), onCalendarAction: () => () => {},
    feeds: [],
    listFeeds: async () => b.feeds,
    addFeed: async (address) => {
      if (!address.startsWith('https://calendar.google.com/')) return { error: "That isn't a calendar address." };
      const feed = { id: 'f1', name: 'School', host: 'calendar.google.com' };
      b.feeds = [feed];
      return { ok: true, feed };
    },
    removeFeed: async () => { b.feeds = []; return { ok: true }; },
    fetchFeeds: async () => b.feeds.map(f => ({ id: f.id, name: f.name, text: ICS })),
  };
  window.layersSystem = b;
  return b;
}
afterEach(() => { delete window.layersSystem; });

describe('your Google Calendar', () => {
  it('is added in Me by its secret address, and its events show on Today, read-only', async () => {
    const bridge = fakeBridge();
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.click(nav('Me'));
    const card = () => screen.getByLabelText('Other calendars');
    await user.type(within(card()).getByLabelText('Secret address in iCal format'), 'not an address{Enter}');
    await within(card()).findByRole('alert');
    await user.clear(within(card()).getByLabelText('Secret address in iCal format'));
    await user.type(within(card()).getByLabelText('Secret address in iCal format'), 'https://calendar.google.com/calendar/ical/x/private-y/basic.ics{Enter}');
    await waitFor(() => expect(toasts()).toContain('Showing School'));
    await within(card()).findByText(/1 events?, updated/);

    await user.click(nav('Today'));
    const row = await screen.findByRole('button', { name: 'Maths' });
    expect(row.textContent).toMatch(/School · Room 4/);
    await user.click(row);
    const sheet = dialog('📅 Maths');
    expect(within(sheet).getByText(/Change it in Google Calendar/)).toBeTruthy();
    expect(within(sheet).queryByRole('button', { name: /Edit|Delete/ })).toBeNull();
    // Never reminded: nothing of Google's goes to Windows.
    const handed = bridge.scheduleNotifications.mock.calls.flatMap(([list]) => list);
    expect(handed.some(n => /Maths/.test(n.title || ''))).toBe(false);
  });

  it("warns when a plan clashes with it, but doesn't offer it in Plan again", async () => {
    const bridge = fakeBridge();
    bridge.feeds = [{ id: 'f1', name: 'School', host: 'calendar.google.com' }];
    seedState();
    const { user } = renderApp();
    await screen.findByRole('button', { name: 'Maths' });
    await user.keyboard('p8{Enter}'); // Something else, nobody: 12:00 PM
    await user.click(within(dialog('When?')).getByRole('button', { name: '3:30 PM' }));
    expect(within(dialog('When?')).getByText(/Overlaps Maths/)).toBeTruthy();
    await user.keyboard('{Escape}');
    await user.keyboard('p');
    expect(within(dialog('Plan something')).queryByText('Plan again')).toBeNull();
  });
});
