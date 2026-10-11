/** @vitest-environment jsdom */
// Keys for where you are (decided 2026-10-11): ? lists the keys for the screen
// or sheet you're on first, then the ones that work everywhere, then the
// rest; it works inside a sheet too, and a sheet with keys has a ? button.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { dialog, nav, queryDialog, renderApp, seedState } from './harness.jsx';

const section = (name) => within(dialog('Keyboard shortcuts')).getByRole('region', { name });

describe('keys for where you are', () => {
  it("on Today, Today's keys come first, then everywhere's", async () => {
    seedState();
    const { user } = renderApp();
    await user.click(nav('Today'));
    await user.keyboard('?');
    const here = section('Here: Today');
    expect(here.textContent).toContain('Today: switch between the day and the month');
    expect(here.textContent).not.toContain('Quick log an interaction');
    expect(section('Everywhere').textContent).toContain('Quick log an interaction');
    expect(section('Everything else').textContent).toContain('Planning "When?"');
  });

  it("in the plan sheet, ? (or its ? button) shows planning's keys, and Esc goes back to the plan", async () => {
    seedState();
    const { user } = renderApp();
    await user.keyboard('p8{Enter}'); // Something else, nobody: on "When?"
    await user.keyboard('?');
    expect(section('Here: Planning').textContent).toMatch(/step through time, length, repeat, reminder/);
    await user.keyboard('{Escape}');
    expect(queryDialog('Keyboard shortcuts')).toBeNull();
    expect(dialog('When?')).toBeTruthy();
    await user.click(within(dialog('When?')).getByRole('button', { name: 'Keys for this' }));
    expect(section('Here: Planning')).toBeTruthy();
  });

  it('on Me, with no keys of its own, it lists everywhere and each screen', async () => {
    seedState();
    const { user } = renderApp();
    await user.click(nav('Me'));
    await user.keyboard('?');
    expect(within(dialog('Keyboard shortcuts')).queryByRole('region', { name: /^Here:/ })).toBeNull();
    expect(section('On each screen').textContent).toContain('Today: back to today');
  });
});
