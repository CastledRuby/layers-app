/** @vitest-environment jsdom */
// Activity and a one-page summary (docs/roadmap.md, "The plan from here",
// step 5): a profile's six months of logs, a day opening the Journal on it,
// the Journal's activity for everyone, and Export summary handing a page to
// the main process (stood in for) to save as a PDF.
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toISODate } from '../../src/lib/dates.js';
import { nav, person, renderApp, seedState, toasts } from './harness.jsx';

const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return toISODate(d); };
const entry = (id, personId, at, summary) => ({ id, personId, at, type: 'talked', meaningfulness: 4, added: [], activeListening: [], summary });

afterEach(() => { delete window.layersSystem; });

async function openProfile(user, name) {
  await user.click(nav('People'));
  await user.click(screen.getAllByRole('button', { name: new RegExp(name) })[0]);
  await screen.findByText('Current relationship stage');
}

describe('activity', () => {
  it("a profile shows its six months of logs, and a day opens the Journal on that person's logs that day", async () => {
    const morgan = person('Morgan');
    const riley = person('Riley');
    seedState({ people: [morgan, riley], journal: [entry('a', morgan.id, day(-1), 'Coffee chat'), entry('b', morgan.id, day(-3), 'Long call'), entry('c', riley.id, day(-1), 'Riley lunch')] });
    const { user } = renderApp();
    await openProfile(user, 'Morgan');
    const grid = screen.getByRole('group', { name: 'Activity with Morgan' });
    expect(within(grid).getAllByRole('button')).toHaveLength(2); // the two days with logs
    expect(grid.parentElement.textContent).toMatch(/2 logs in six months/);
    await user.click(within(grid).getByRole('button', { name: /^Yesterday: 1 log$/ }));
    expect(nav('Journal').getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('Coffee chat')).toBeTruthy();
    expect(screen.queryByText('Long call')).toBeNull(); // another day
    expect(screen.queryByText('Riley lunch')).toBeNull(); // someone else
    await user.click(screen.getByRole('button', { name: 'Any day' }));
    expect(screen.getByText('Long call')).toBeTruthy();
  });

  it("the Journal's activity is everyone's, and a day there filters to it", async () => {
    const morgan = person('Morgan');
    const riley = person('Riley');
    seedState({ people: [morgan, riley], journal: [entry('a', morgan.id, day(-1), 'Coffee chat'), entry('c', riley.id, day(-1), 'Riley lunch'), entry('b', morgan.id, day(-3), 'Long call')] });
    const { user } = renderApp();
    await user.click(nav('Journal'));
    const grid = screen.getByRole('group', { name: 'Activity' });
    await user.click(within(grid).getByRole('button', { name: /^Yesterday: 2 logs$/ }));
    expect(screen.getByText('Coffee chat')).toBeTruthy();
    expect(screen.getByText('Riley lunch')).toBeTruthy();
    expect(screen.queryByText('Long call')).toBeNull();
  });
});

describe('a one-page summary', () => {
  it('Summary on a profile hands the main process the page to save as a PDF', async () => {
    const exportSummary = vi.fn(async () => ({ saved: 'C:\\Users\\Liam\\OneDrive\\Documents\\Morgan summary.pdf' }));
    window.layersSystem = {
      getAutoLaunch: () => Promise.resolve(false), setAutoLaunch: () => Promise.resolve(false), getVersion: () => Promise.resolve('test'),
      getShortcutStatus: () => Promise.resolve({ registered: true }), setTheme: () => {}, showWindow: () => {},
      scheduleNotifications: () => Promise.resolve({ scheduled: 0 }), calendarReady: () => Promise.resolve([]), onCalendarAction: () => () => {},
      exportSummary,
    };
    const morgan = person('Morgan', { interests: [{ id: 'i', emoji: '🎸', text: 'Plays guitar' }] });
    seedState({ people: [morgan], journal: [entry('a', morgan.id, day(-1), 'Coffee chat')] });
    const { user } = renderApp();
    await openProfile(user, 'Morgan');
    await user.click(screen.getByRole('button', { name: /Summary/ }));
    await waitFor(() => expect(exportSummary).toHaveBeenCalled());
    const [html, fileName] = exportSummary.mock.calls[0];
    expect(html).toContain('Morgan');
    expect(html).toContain('Plays guitar');
    expect(html).toContain('Coffee chat');
    expect(fileName).toMatch(/^Morgan summary .+\.pdf$/);
    expect(toasts()).toContain('Summary saved: Morgan summary.pdf');
  });
});
