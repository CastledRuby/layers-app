/** @vitest-environment jsdom */
// The calendar as Layers' main screen (docs/roadmap.md, "Next big task: the
// calendar"): your day first, the month a key away, planning by taps and
// keys, "How did it go?", ideas, key dates, and notifications handed to
// Windows with buttons that come back as layers:// links.
import { act, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MONTH_NAMES, toISODate } from '../../src/lib/dates.js';
import { dialog, nav, person, queryDialog, renderApp, savedPerson, savedState, seedState, toasts, wait } from './harness.jsx';

const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return toISODate(d); };
const TODAY = day(0);
const TOMORROW = day(1);
const YESTERDAY = day(-1);

afterEach(() => { delete window.layersSystem; vi.restoreAllMocks(); });

describe('Today is the main screen', () => {
  it('opens on your day, with the week strip; M shows the month, and a day in it can be picked', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();
    expect(screen.getByText(/Good (morning|afternoon|evening), Tester/)).toBeTruthy();
    expect(screen.getByText('Nothing planned today')).toBeTruthy();
    await user.keyboard('m');
    const now = new Date();
    const grid = screen.getByRole('grid', { name: `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}` });
    expect(grid).toBeTruthy();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('heading', { name: 'Tomorrow' })).toBeTruthy();
    await user.keyboard('m');
    expect(screen.queryByRole('grid')).toBeNull();
  });

  it('Ctrl+2 is the map of how close you are to people', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.keyboard('{Control>}2{/Control}');
    expect(screen.getByText(/Your circle/)).toBeTruthy();
  });

  it('Today is the centre tab, and Ctrl+1-5 follow the tabs in order', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    expect([...document.querySelectorAll('.nav-btn')].map(b => b.textContent)).toEqual(['Coach', 'People', 'Today', 'Journal', 'Me']);
    await user.keyboard('{Control>}1{/Control}');
    expect(screen.queryByRole('heading', { name: 'Today' })).toBeNull();
    await user.keyboard('{Control>}3{/Control}');
    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();
  });
});

describe('Planning', () => {
  it('by keys: P, 1 for coffee, pick someone, Enter, tomorrow at 6, Enter', async () => {
    const morgan = person('Morgan');
    seedState({ people: [morgan] });
    const { user } = renderApp();
    await user.keyboard('p');
    await user.keyboard('1');
    await user.click(within(dialog('Who with?')).getByRole('button', { name: /Morgan/ }));
    await user.keyboard('{Enter}');
    const when = dialog('When?');
    expect(within(when).getByLabelText('Title').value).toBe('Coffee with Morgan');
    await user.click(within(when).getByRole('button', { name: 'Tomorrow' }));
    await user.click(within(when).getByRole('button', { name: '6:00 PM' }));
    await user.keyboard('{Enter}');
    expect(savedState().events[0]).toMatchObject({ title: 'Coffee with Morgan', kind: 'oneoff', date: TOMORROW, time: 1080, duration: 60, alert: 15, personIds: [morgan.id], template: 'coffee' });
    expect(screen.getByRole('heading', { name: 'Tomorrow' })).toBeTruthy(); // the day plan follows it
    expect(screen.getByRole('button', { name: 'Coffee with Morgan' })).toBeTruthy();
  });

  it('a daily plan repeats from its first day, and can be edited', async () => {
    seedState();
    const { user } = renderApp();
    await user.keyboard('p');
    await user.click(screen.getByRole('button', { name: /Study/ }));
    await user.click(screen.getByRole('button', { name: /Continue without anyone/ }));
    await user.click(screen.getByRole('button', { name: 'Every day' }));
    await user.click(screen.getByRole('button', { name: 'Save plan' }));
    expect(savedState().events[0]).toMatchObject({ title: 'Study session', kind: 'recurring', weekdays: [0, 1, 2, 3, 4, 5, 6], from: TODAY });
    await user.click(screen.getByRole('button', { name: 'Study session' }));
    await user.keyboard('e');
    await user.click(screen.getByRole('button', { name: '1 h before' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(savedState().events[0].alert).toBe(60);
  });

  it('lots at once: Shift+Enter saves and starts the next plan, typing a name picks someone', async () => {
    const morgan = person('Morgan');
    seedState({ people: [person('Ana'), morgan] });
    const { user } = renderApp();
    await user.keyboard('p1');
    await user.keyboard('mo'); // finds Morgan
    expect(within(dialog('Who with?')).getByText(/Enter picks Morgan/)).toBeTruthy();
    await user.keyboard('{Enter}{Enter}');
    await user.keyboard('2{Shift>}{Enter}{/Shift}'); // tomorrow; save + another
    const next = dialog('Plan another');
    expect(within(next).getByRole('status', { name: 'Added so far' }).textContent).toMatch(/Coffee with Morgan · \w{3} \d+, 10:00 AM/);
    await user.keyboard('6{Enter}'); // Study, nobody
    await user.keyboard('rrr'); // Once -> Several days -> Every day -> Every week
    await user.click(screen.getByRole('button', { name: 'Mon–Fri' }));
    await user.keyboard('{Enter}');
    expect(queryDialog('Plan another')).toBeNull();
    const events = savedState().events;
    expect(events).toHaveLength(2);
    expect(events.find(e => e.template === 'coffee')).toMatchObject({ kind: 'oneoff', date: TOMORROW, personIds: [morgan.id] });
    expect(events.find(e => e.template === 'study')).toMatchObject({ kind: 'recurring', weekdays: [1, 2, 3, 4, 5] });
  });

  it('"Several days" saves one plan per day picked; letter keys set the time and reminder', async () => {
    seedState();
    const { user } = renderApp();
    await user.keyboard('p8{Enter}'); // Something else, nobody
    await user.keyboard('r23'); // Several days: today, plus tomorrow and the day after
    await user.keyboard('t'); // 12:00 PM (the template's, not a chip) -> 9:00 AM, the first chip
    await user.keyboard('{Shift>}a{/Shift}'); // reminder 15 min -> 5 min
    expect(screen.getByRole('button', { name: /Save 3 plans/ })).toBeTruthy();
    await user.keyboard('{Enter}');
    const events = savedState().events;
    expect(events.map(e => e.date).sort()).toEqual([TODAY, TOMORROW, day(2)]);
    expect(events.every(e => e.kind === 'oneoff' && e.time === 540 && e.alert === 5)).toBe(true);
    expect(toasts()).toContain('3 plans saved');
  });

  it("a plan that hasn't started offers Edit and Plan it again, not Log it; C copies it to the next day", async () => {
    const morgan = person('Morgan');
    seedState({ people: [morgan], events: [{ id: 'c', title: 'Coffee with Morgan', kind: 'oneoff', date: TOMORROW, time: 600, duration: 60, alert: 15, personIds: [morgan.id], template: 'coffee' }] });
    const { user } = renderApp();
    await user.keyboard('{ArrowRight}');
    await user.click(screen.getByRole('button', { name: 'Coffee with Morgan' }));
    const sheet = dialog('☕ Coffee with Morgan');
    expect(within(sheet).queryByRole('button', { name: 'Log it' })).toBeNull();
    expect(within(sheet).queryByRole('button', { name: 'Mark done' })).toBeNull();
    expect(within(sheet).getByRole('button', { name: 'Edit' })).toBeTruthy();
    await user.keyboard('c');
    expect(within(dialog('Plan it again')).getByLabelText('Title').value).toBe('Coffee with Morgan');
    await user.keyboard('{Enter}');
    const copy = savedState().events.find(e => e.id !== 'c');
    expect(copy).toMatchObject({ title: 'Coffee with Morgan', kind: 'oneoff', date: day(2), time: 600, personIds: [morgan.id] });
  });

  it('"Plan something" on a profile starts with that person', async () => {
    const morgan = person('Morgan');
    seedState({ people: [morgan] });
    const { user } = renderApp();
    await user.click(nav('People'));
    await user.click(screen.getAllByRole('button', { name: /Morgan/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Plan something' }));
    await user.keyboard('2'); // Call
    expect(within(dialog('When?')).getByLabelText('Title').value).toBe('Call Morgan');
  });
});

describe('After a plan', () => {
  it('asks how it went: Just tick it marks it done', async () => {
    const morgan = person('Morgan');
    seedState({ people: [morgan], events: [{ id: 'c', title: 'Coffee with Morgan', kind: 'oneoff', date: YESTERDAY, time: 600, duration: 60, personIds: [morgan.id], template: 'coffee' }] });
    const { user } = renderApp();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByText('How did coffee with Morgan go?')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Just tick it' }));
    expect(savedState().events[0].doneAt).toBe(YESTERDAY);
    expect(screen.queryByText('How did coffee with Morgan go?')).toBeNull();
  });

  it('Log it opens the quick log filled in, and saving ticks the plan off', async () => {
    const morgan = person('Morgan');
    seedState({ people: [morgan], events: [{ id: 'c', title: 'Coffee with Morgan', kind: 'oneoff', date: YESTERDAY, time: 600, duration: 60, personIds: [morgan.id], template: 'coffee' }] });
    const { user } = renderApp();
    await user.keyboard('{ArrowLeft}');
    await user.click(screen.getByRole('button', { name: 'Log it' }));
    expect(dialog('Hung out with Morgan')).toBeTruthy();
    await user.keyboard('4{Enter}');
    expect(savedState().journal[0]).toMatchObject({ at: YESTERDAY, type: 'hangout', meaningfulness: 4, summary: 'Coffee with Morgan' });
    expect(savedState().events[0].doneAt).toBe(YESTERDAY);
  });
});

describe('Ideas and key dates', () => {
  it('suggests seeing someone close you have not seen for a while', async () => {
    const morgan = person('Morgan', { layer: 4 });
    seedState({ people: [morgan], journal: [{ id: 'j', personId: morgan.id, at: day(-20), type: 'talked', meaningfulness: 3, added: [], activeListening: [] }] });
    const { user } = renderApp();
    expect(screen.getByText("You haven't seen Morgan in 3 weeks.")).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Plan coffee' }));
    expect(within(dialog('When?')).getByLabelText('Title').value).toBe('Coffee with Morgan');
  });

  it("a birthday added on a profile shows on the calendar every year", async () => {
    const morgan = person('Morgan');
    seedState({ people: [morgan] });
    const { user } = renderApp();
    await user.click(nav('People'));
    await user.click(screen.getAllByRole('button', { name: /Morgan/ })[0]);
    await user.click(screen.getByRole('button', { name: /Add date/ }));
    await user.keyboard('1'); // Birthday
    await user.keyboard('{Enter}');
    expect(savedPerson('Morgan').dates).toEqual([expect.objectContaining({ kind: 'birthday', date: TODAY, yearly: true })]);
    await user.keyboard('{Control>}3{/Control}');
    expect(screen.getByRole('button', { name: /Morgan's birthday/ })).toBeTruthy();
  });
});

describe('Notifications in the Windows app', () => {
  function fakeBridge(links = []) {
    const listeners = [];
    const bridge = {
      getAutoLaunch: () => Promise.resolve(false),
      setAutoLaunch: () => Promise.resolve(false),
      getVersion: () => Promise.resolve('test'),
      getShortcutStatus: () => Promise.resolve({ registered: true }),
      setTheme: () => {},
      showWindow: () => {},
      scheduleNotifications: vi.fn(() => Promise.resolve({ scheduled: 1 })),
      calendarReady: () => Promise.resolve(links),
      onCalendarAction: (cb) => { listeners.push(cb); return () => {}; },
      // A button pressed in a notification, as main.cjs passes it on.
      press: (link) => act(async () => { listeners.forEach(cb => cb(link)); }),
    };
    window.layersSystem = bridge;
    return bridge;
  }

  it('hands Windows the next two weeks: a reminder before each plan', async () => {
    const bridge = fakeBridge();
    seedState({ events: [{ id: 'g', title: 'Gym', kind: 'oneoff', date: TOMORROW, time: 600, duration: 60, alert: 15, personIds: [] }] });
    renderApp();
    await wait(1700);
    const list = bridge.scheduleNotifications.mock.calls.at(-1)[0];
    expect(list.find(n => n.tag === `a:g:${TOMORROW}`)).toMatchObject({ kind: 'alert', title: 'Gym', body: 'In 15 minutes · 10:00 AM' });
  });

  it('a Done button pressed while Layers was closed is done once it starts; Snooze reschedules', async () => {
    const bridge = fakeBridge([`layers://done?e=a&d=${TODAY}`]);
    seedState({ events: [
      { id: 'a', title: 'Call Gran', kind: 'oneoff', date: TODAY, time: 600, personIds: [] },
      { id: 'b', title: 'Gym', kind: 'oneoff', date: TODAY, time: 1430, personIds: [] },
    ] });
    renderApp();
    await wait(50);
    expect(savedState().events.find(e => e.id === 'a').doneAt).toBe(TODAY);
    await bridge.press(`layers://snooze?e=b&d=${TODAY}&m=10`);
    await wait(1700);
    expect(toasts()).toContain('"Gym" snoozed for 10 minutes');
    const list = bridge.scheduleNotifications.mock.calls.at(-1)[0];
    expect(list.some(n => n.kind === 'snooze' && n.eventId === 'b')).toBe(true);
  });

  it('Log it from a notification opens the quick log for that plan', async () => {
    const morgan = person('Morgan');
    const bridge = fakeBridge();
    seedState({ people: [morgan], events: [{ id: 'c', title: 'Call Morgan', kind: 'oneoff', date: TODAY, time: 600, personIds: [morgan.id], template: 'call' }] });
    renderApp();
    await wait(50);
    await bridge.press(`layers://log?e=c&d=${TODAY}`);
    expect(await screen.findByRole('dialog', { name: 'Called Morgan' })).toBeTruthy();
  });
});

describe('Picking people by keys', () => {
  it('in the quick log, a number picks that person and Enter goes on', async () => {
    seedState({ people: [person('Ana'), person('Morgan')] });
    const { user } = renderApp();
    await user.keyboard('n11'); // Interaction, Talked
    await user.keyboard('2{Enter}');
    expect(dialog('Talked with Morgan')).toBeTruthy();
  });
});
