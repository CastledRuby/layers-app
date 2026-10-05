/** @vitest-environment jsdom */
// The quick-add box (Ctrl+Shift+L; src/QuickAdd.jsx): what it shows and
// sends, and the main window saving what it sends (App's onQuickAdd).
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuickAdd } from '../../src/QuickAdd.jsx';
import { toISODate } from '../../src/lib/dates.js';
import { readSentence } from '../../src/lib/sentence.js';
import { person, renderApp, savedState, seedState, toasts, wait } from './harness.jsx';

const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return toISODate(d); };
afterEach(() => { delete window.layersQuick; vi.restoreAllMocks(); });

function fakeQuick() {
  const shows = [];
  window.layersQuick = {
    submit: vi.fn(), open: vi.fn(), undo: vi.fn(), redo: vi.fn(), hide: vi.fn(), resize: vi.fn(),
    onShow: (cb) => { shows.push(cb); return () => shows.splice(shows.indexOf(cb), 1); },
    show: () => act(async () => { shows.forEach(cb => cb()); }),
  };
  return window.layersQuick;
}
function renderBox() {
  const user = userEvent.setup();
  render(<StrictMode><QuickAdd /></StrictMode>);
  return { user, input: screen.getByLabelText('Plan or log') };
}

describe('the quick-add box', () => {
  it('previews a typed plan, and Enter sends it to be saved, then closes within a second', async () => {
    const morgan = person('Morgan');
    seedState({ people: [morgan] });
    const quick = fakeQuick();
    const { user, input } = renderBox();
    await user.type(input, 'coffee w morgan tomorrow 10am');
    const preview = screen.getByRole('status', { name: 'Preview' });
    expect(preview.textContent).toMatch(/Coffee with Morgan/);
    expect(preview.textContent).toMatch(/10:00 AM to 11:00 AM/);
    await user.keyboard('{Enter}');
    expect(quick.submit).toHaveBeenCalledWith(expect.objectContaining({ kind: 'plan', title: 'Coffee with Morgan', personIds: [morgan.id], day: day(1), time: 600 }));
    expect(preview.textContent).toMatch(/Saved/);
    await act(async () => { await wait(1000); });
    expect(quick.hide).toHaveBeenCalled();
  });

  it('says what a log still needs, and only sends it once it has it', async () => {
    seedState({ people: [person('Morgan')] });
    const quick = fakeQuick();
    const { user, input } = renderBox();
    await user.type(input, 'talked to morgan{Enter}');
    expect(screen.getByText(/How was it\?/)).toBeTruthy();
    expect(quick.submit).not.toHaveBeenCalled();
    await user.type(input, ' good{Enter}');
    expect(quick.submit).toHaveBeenCalledWith(expect.objectContaining({ kind: 'log', meaningfulness: 3 }));
  });

  it('Ctrl+Z undoes what it just saved; Ctrl+Enter opens in Layers; Esc closes', async () => {
    seedState({ people: [person('Morgan')] });
    const quick = fakeQuick();
    const { user, input } = renderBox();
    await user.type(input, 'log morgan deep{Enter}');
    await user.keyboard('{Control>}z{/Control}');
    expect(quick.undo).toHaveBeenCalled();
    expect(screen.getByText('Undone')).toBeTruthy();
    await quick.show(); // shown again: a clean box
    await user.type(input, 'dinner with morgan fri{Control>}{Enter}{/Control}');
    expect(quick.open).toHaveBeenCalledWith(expect.objectContaining({ kind: 'plan', title: 'Dinner with Morgan' }));
    await user.keyboard('{Escape}');
    expect(quick.hide).toHaveBeenCalled();
  });

  it('Ctrl+Y redoes what Ctrl+Z undid, and Ctrl+Z still works in the empty box opened again soon after', async () => {
    seedState({ people: [person('Morgan')] });
    const quick = fakeQuick();
    const { user, input } = renderBox();
    await user.type(input, 'log morgan deep{Enter}');
    await user.keyboard('{Control>}z{/Control}');
    expect(quick.undo).toHaveBeenCalledTimes(1);
    await user.keyboard('{Control>}y{/Control}');
    expect(quick.redo).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status', { name: 'Preview' }).textContent).toMatch(/Saved/);
    await quick.show(); // opened again: empty, but it can still undo that
    expect(screen.getByText(/Just saved/)).toBeTruthy();
    await user.keyboard('{Control>}z{/Control}');
    expect(quick.undo).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Undone')).toBeTruthy();
  });
});

describe('the main window, saving what the box sends', () => {
  function fakeSystem() {
    const listeners = [];
    window.layersSystem = {
      getAutoLaunch: () => Promise.resolve(false), setAutoLaunch: () => Promise.resolve(false), getVersion: () => Promise.resolve('test'),
      getShortcutStatus: () => Promise.resolve({ registered: true, open: { registered: true } }), setTheme: () => {}, showWindow: () => {},
      scheduleNotifications: () => Promise.resolve({ scheduled: 0 }), calendarReady: () => Promise.resolve([]), onCalendarAction: () => () => {},
      onQuickAdd: (cb) => { listeners.push(cb); return () => listeners.splice(listeners.indexOf(cb), 1); },
      send: (msg) => act(async () => { listeners.forEach(cb => cb(msg)); }),
    };
    return window.layersSystem;
  }

  it('saves a plan with Undo, and undo takes it back', async () => {
    const morgan = person('Morgan');
    seedState({ people: [morgan] });
    const sys = fakeSystem();
    renderApp();
    await wait(50);
    await sys.send({ type: 'submit', sentence: readSentence('coffee with morgan tomorrow 10am', { people: [morgan] }) });
    expect(savedState().events).toEqual([expect.objectContaining({ title: 'Coffee with Morgan', date: day(1), time: 600, personIds: [morgan.id] })]);
    expect(toasts()).toContain('Plan saved');
    await sys.send({ type: 'undo' });
    expect(savedState().events).toEqual([]);
  });

  it('"redo" puts back what "undo" took', async () => {
    const morgan = person('Morgan');
    seedState({ people: [morgan] });
    const sys = fakeSystem();
    renderApp();
    await wait(50);
    await sys.send({ type: 'submit', sentence: readSentence('coffee w morgan tomorrow 10am', { people: [morgan] }) });
    await sys.send({ type: 'undo' });
    expect(savedState().events).toEqual([]);
    await sys.send({ type: 'redo' });
    expect(savedState().events).toEqual([expect.objectContaining({ title: 'Coffee with Morgan' })]);
  });

  it('"open" opens a typed plan in full', async () => {
    const morgan = person('Morgan');
    seedState({ people: [morgan] });
    const sys = fakeSystem();
    renderApp();
    await wait(50);
    await sys.send({ type: 'open', sentence: readSentence('gym every mon wed 7am', { people: [morgan] }) });
    expect(screen.getByRole('dialog', { name: 'When?' })).toBeTruthy();
    expect(screen.getByLabelText('Title').value).toBe('Gym');
  });
});
