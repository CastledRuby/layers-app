/** @vitest-environment jsdom */
// Quality of life (docs/roadmap.md, decided 2026-10-05): Undo on toasts,
// birthday reminders' "Plan something", daily backups and Match Windows.
import { act, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toISODate } from '../../src/lib/dates.js';
import { dialog, nav, person, renderApp, savedState, seedState, toasts, wait } from './harness.jsx';

const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return toISODate(d); };
const TODAY = day(0);
const TOMORROW = day(1);

afterEach(() => { delete window.layersSystem; vi.restoreAllMocks(); });

function fakeBridge(extra = {}) {
  const listeners = [];
  const bridge = {
    getAutoLaunch: () => Promise.resolve(false),
    setAutoLaunch: () => Promise.resolve(false),
    getVersion: () => Promise.resolve('test'),
    getShortcutStatus: () => Promise.resolve({ registered: true }),
    setTheme: () => {},
    showWindow: () => {},
    scheduleNotifications: () => Promise.resolve({ scheduled: 0 }),
    calendarReady: () => Promise.resolve([]),
    onCalendarAction: (cb) => { listeners.push(cb); return () => { listeners.splice(listeners.indexOf(cb), 1); }; },
    press: (link) => act(async () => { listeners.forEach(cb => cb(link)); }),
    ...extra,
  };
  window.layersSystem = bridge;
  return bridge;
}

describe('Undo', () => {
  it('brings back a deleted plan from the toast', async () => {
    seedState({ events: [{ id: 'g', title: 'Gym', kind: 'oneoff', date: TOMORROW, time: 600, personIds: [] }] });
    const { user } = renderApp();
    await user.keyboard('{ArrowRight}');
    await user.click(screen.getByRole('button', { name: 'Gym' }));
    await user.click(within(dialog('Gym')).getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete plan' }));
    expect(savedState().events).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Undo (Ctrl+Z)' }));
    expect(savedState().events.map(e => e.id)).toEqual(['g']);
    expect(toasts()).toContain('Undone');
  });

  it('Ctrl+Z undoes ticking a plan off, and a log', async () => {
    const morgan = person('Morgan');
    seedState({ people: [morgan], events: [{ id: 'c', title: 'Coffee with Morgan', kind: 'oneoff', date: day(-1), time: 600, duration: 60, personIds: [morgan.id], template: 'coffee' }] });
    const { user } = renderApp();
    await user.keyboard('{ArrowLeft}');
    await user.keyboard('j'); // Just tick it
    expect(savedState().events[0].doneAt).toBe(day(-1));
    await user.keyboard('{Control>}z{/Control}');
    expect(savedState().events[0].doneAt).toBeUndefined();

    await user.keyboard('n11'); // log: interaction, talked
    await user.keyboard('1{Enter}{Enter}'); // Morgan, then save
    expect(savedState().journal).toHaveLength(1);
    await user.keyboard('{Control>}z{/Control}');
    expect(savedState().journal).toEqual([]);
  });
});

describe('birthdays and key dates', () => {
  it('"Plan something" on a birthday reminder plans with them on the day', async () => {
    const morgan = person('Morgan');
    const bridge = fakeBridge();
    seedState({ people: [morgan] });
    renderApp();
    await wait(50);
    await bridge.press(`layers://plan?p=${morgan.id}&d=${TOMORROW}`);
    expect(dialog('Plan something')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Tomorrow' })).toBeTruthy();
  });
});

describe('daily backups', () => {
  it('saves one a little after starting, and Me shows it with the folder', async () => {
    const saveDailyBackup = vi.fn(() => Promise.resolve({ saved: true, dir: 'C:\\Users\\X\\Documents\\Layers backups', count: 1, latest: TODAY }));
    const openBackupsFolder = vi.fn(() => Promise.resolve({ error: null }));
    fakeBridge({ saveDailyBackup, openBackupsFolder, getBackupsInfo: () => Promise.resolve({ dir: 'C:\\Users\\X\\Documents\\Layers backups', count: 0, latest: null }) });
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await wait(4300);
    expect(saveDailyBackup).toHaveBeenCalledTimes(1);
    const [onDay, json] = saveDailyBackup.mock.calls[0];
    expect(onDay).toBe(TODAY);
    expect(JSON.parse(json).people.map(p => p.name)).toEqual(['Morgan']);
    await user.click(nav('Me'));
    expect(screen.getByText(/One a day, the last 14 kept, in Documents\\Layers backups\. Latest: Today\./)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Open folder' }));
    expect(openBackupsFolder).toHaveBeenCalled();
  }, 10000);
});

describe('Match Windows', () => {
  it('is the default, and Light or Dark can still be picked', async () => {
    seedState();
    const { user } = renderApp();
    await user.click(nav('Me'));
    expect(screen.getByRole('button', { name: 'Match Windows' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Dark' }));
    expect(document.querySelector('.layers-root').classList.contains('dark')).toBe(true);
    expect(savedState().themeMode).toBe('dark');
  });
});

describe('rating a plan from its notification', () => {
  it('"Personal" logs it (4) without opening anything, and ticks the plan off', async () => {
    const morgan = person('Morgan');
    const bridge = fakeBridge();
    seedState({ people: [morgan], events: [{ id: 'c', title: 'Coffee with Morgan', kind: 'oneoff', date: TODAY, time: 0, duration: 60, personIds: [morgan.id], template: 'coffee' }] });
    renderApp();
    await wait(50);
    await bridge.press(`layers://rate?e=c&d=${TODAY}&r=4`);
    const s = savedState();
    expect(s.journal).toEqual([expect.objectContaining({ personId: morgan.id, at: TODAY, meaningfulness: 4, type: 'hangout', summary: 'Coffee with Morgan' })]);
    expect(s.events[0].doneAt).toBe(TODAY);
    expect(screen.queryByRole('dialog')).toBeNull();
    await bridge.press(`layers://rate?e=c&d=${TODAY}&r=4`); // pressed twice: logged once
    expect(savedState().journal).toHaveLength(1);
  });
});

describe('the weekly review', () => {
  it('opens from its notification; Plan next week plans on next Monday, 1 plans with someone to catch up with', async () => {
    const morgan = person('Morgan', { layer: 3 });
    const bridge = fakeBridge();
    seedState({ people: [morgan], journal: [{ id: 'j', personId: morgan.id, at: day(-30), type: 'talked', meaningfulness: 3, added: [], activeListening: [] }] });
    const { user } = renderApp();
    await wait(50);
    await bridge.press(`layers://review?d=${TODAY}`);
    const sheet = dialog('Your week');
    expect(within(sheet).getByText(/You haven't seen Morgan in/)).toBeTruthy();
    await user.keyboard('1');
    const when = dialog('When?');
    expect(within(when).getByLabelText('Title').value).toBe('Coffee with Morgan');
  });

  it('W on Today opens it, the arrows move a week, and Enter plans next week', async () => {
    seedState();
    const { user } = renderApp();
    await user.keyboard('w');
    const sheet = dialog('Your week');
    const range = () => within(sheet).getByText(/ to /).textContent;
    const first = range();
    await user.keyboard('{ArrowLeft}');
    expect(range()).not.toBe(first);
    await user.keyboard('{ArrowRight}');
    expect(range()).toBe(first);
    await user.keyboard('{Enter}');
    expect(dialog('Plan something')).toBeTruthy();
  });
});
