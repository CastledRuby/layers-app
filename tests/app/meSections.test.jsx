/** @vitest-environment jsdom */
// Me in sections (decided 2026-10-11): You, Calendar, App and Your data (and
// Claude in the Windows app), 1-5 to switch, and Find a setting (F) across
// them all.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { nav, renderApp, seedState } from './harness.jsx';

const tab = (name) => screen.getByRole('tab', { name });
const panel = () => screen.getByRole('tabpanel');

describe('Me in sections', () => {
  it('opens on You, and 1-5 switch sections', async () => {
    seedState();
    const { user } = renderApp();
    await user.click(nav('Me'));
    expect(screen.getAllByRole('tab').map(t => t.textContent.replace(/\d$/, ''))).toEqual(['You', 'Calendar', 'App', 'Your data']); // no Claude in the browser
    expect(tab('You').getAttribute('aria-selected')).toBe('true');
    expect(within(panel()).getByText('Your social skills')).toBeTruthy();
    await user.keyboard('2');
    expect(tab('Calendar').getAttribute('aria-selected')).toBe('true');
    expect(within(panel()).getByRole('switch', { name: /Morning summary/ })).toBeTruthy();
    expect(within(panel()).queryByText('Your social skills')).toBeNull();
    await user.keyboard('4');
    expect(within(panel()).getByRole('button', { name: /Export data/ })).toBeTruthy();
  });

  it('F finds a setting in any section, saying which; clearing it goes back', async () => {
    seedState();
    const { user } = renderApp();
    await user.click(nav('Me'));
    await user.keyboard('f');
    expect(document.activeElement).toBe(screen.getByLabelText('Find a setting'));
    await user.keyboard('dark');
    expect(screen.queryByRole('tabpanel')).toBeNull();
    expect(within(screen.getByRole('group', { name: 'Appearance, in App' })).getByRole('button', { name: 'Dark' })).toBeTruthy();
    await user.clear(screen.getByLabelText('Find a setting'));
    await user.keyboard('pineapple');
    expect(screen.getByText(/Nothing in Me matches “pineapple”/)).toBeTruthy();
    await user.clear(screen.getByLabelText('Find a setting'));
    expect(within(panel()).getByText('Your social skills')).toBeTruthy();
  });
});
