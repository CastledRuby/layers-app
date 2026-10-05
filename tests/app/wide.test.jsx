/** @vitest-environment jsdom */
// A wide window (900 px or more, useWide): the month beside the day, the
// people list beside a profile, with the tabs still showing.
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MONTH_NAMES } from '../../src/lib/dates.js';
import { nav, person, renderApp, seedState } from './harness.jsx';

afterEach(() => { delete window.__layersWide; });

describe('a wide window', () => {
  it('shows the month beside the day, with no Day/Month switch', async () => {
    window.__layersWide = true;
    seedState();
    renderApp();
    expect(document.querySelector('.layers-root').classList.contains('is-wide')).toBe(true);
    const now = new Date();
    expect(screen.getByRole('grid', { name: `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}` })).toBeTruthy();
    expect(screen.getByText('Your day')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Calendar view' })).toBeNull();
  });

  it('shows a profile beside the people list, and the list stays as you go from person to person', async () => {
    window.__layersWide = true;
    seedState({ people: [person('Morgan', { layer: 3 }), person('Sam')] });
    const { user } = renderApp();
    await user.click(nav('People'));
    expect(screen.getByText('Pick someone')).toBeTruthy();
    const list = () => document.querySelector('.people-split-list');
    await user.click(within(list()).getByText('Morgan'));
    expect(screen.getByRole('button', { name: 'Plan something' })).toBeTruthy();
    expect(within(list()).getByText('Sam')).toBeTruthy();
    expect(nav('People').getAttribute('aria-current')).toBe('page');
    await user.click(within(list()).getByText('Sam'));
    expect(within(list()).getByText('Sam').closest('button').getAttribute('aria-current')).toBe('true');
    await user.keyboard('{Backspace}');
    expect(screen.getByText('Pick someone')).toBeTruthy();
  });

  it('is the phone-shaped layout when narrow', () => {
    seedState();
    renderApp();
    expect(document.querySelector('.layers-root').classList.contains('is-wide')).toBe(false);
    expect(screen.getByRole('group', { name: 'Calendar view' })).toBeTruthy();
  });
});
