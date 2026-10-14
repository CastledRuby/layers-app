/** @vitest-environment jsdom */
// Screen fixes from the audit of 2026-10-14: Tab stays in the sheet on top;
// Esc leaves Me's Find box; Ctrl+K closes a question left open; messages are
// read out; and Tell Claude what was said closes the sheet that was open.
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toISODate } from '../../src/lib/dates.js';
import { dialog, nav, person, queryDialog, renderApp, seedState } from './harness.jsx';

afterEach(() => { delete window.layersSystem; });

describe('sheets', () => {
  it('Tab and Shift+Tab stay in the sheet on top, going round it', async () => {
    seedState();
    const { user } = renderApp();
    await user.keyboard('p');
    const sheet = dialog('Plan something');
    for (let i = 0; i < 25; i++) {
      await user.tab();
      expect(sheet.contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 25; i++) {
      await user.tab({ shift: true });
      expect(sheet.contains(document.activeElement)).toBe(true);
    }
  });

  it('Ctrl+K going somewhere closes a question left open', async () => {
    const today = toISODate(new Date());
    seedState({ events: [{ id: 'g', title: 'Gym', kind: 'oneoff', date: today, time: 1380, personIds: [] }] });
    const { user } = renderApp();
    await user.click(nav('Today'));
    await user.click(screen.getByRole('button', { name: 'Gym' }));
    await user.click(within(dialog(/Gym/)).getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    await user.keyboard('{Control>}k{/Control}');
    await user.keyboard('journal{Enter}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(nav('Journal').getAttribute('aria-current')).toBe('page');
  });
});

describe('Me', () => {
  it("Esc leaves the Find box, as its Esc says", async () => {
    seedState();
    const { user } = renderApp();
    await user.click(nav('Me'));
    await user.keyboard('f');
    const find = screen.getByLabelText('Find a setting');
    expect(document.activeElement).toBe(find);
    await user.keyboard('dark{Escape}');
    expect(document.activeElement).not.toBe(find);
    expect(find.value).toBe('dark');
  });
});

describe('messages', () => {
  it('are in a region screen readers read out as they come', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.keyboard('{Control>}k{/Control}');
    await user.keyboard('log morgan deep{Enter}');
    const toast = screen.getByText('Logged time with Morgan');
    expect(toast.closest('[aria-live="polite"]')).toBeTruthy();
  });

  it("Tell Claude what was said closes a sheet opened since, rather than leaving it over Coach", async () => {
    window.layersSystem = {
      getAutoLaunch: () => Promise.resolve(false), setAutoLaunch: () => Promise.resolve(false), getVersion: () => Promise.resolve('test'),
      getShortcutStatus: () => Promise.resolve({ registered: true }), setTheme: () => {}, showWindow: () => {},
      getAnalysisKeyStatus: async () => ({ hasKey: true }), setAnalysisKey: async () => ({ ok: true }), clearAnalysisKey: async () => ({ ok: true }),
      runAnalysis: vi.fn(),
    };
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.keyboard('{Control>}k{/Control}');
    await user.keyboard('log morgan deep{Enter}');
    await user.keyboard('p'); // a plan sheet, opened while the message shows
    expect(dialog('Plan something')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Tell Claude what was said' }));
    expect(queryDialog('Plan something')).toBeNull();
    expect(screen.getByLabelText('Your own chat')).toBeTruthy();
  });
});
