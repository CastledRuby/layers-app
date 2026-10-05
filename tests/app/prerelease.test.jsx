/** @vitest-environment jsdom */
// What went in before 1.0.31, from the owner's answers on 2026-10-05: arrow
// keys on the People list, logging with someone skipping a step, "Where are
// we now?" on a profile, and Today's getting-started list.
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { toISODate } from '../../src/lib/dates.js';
import { dialog, nav, person, renderApp, savedPerson, savedState, seedState, toasts } from './harness.jsx';

afterEach(() => { delete window.__layersWide; });
const today = toISODate(new Date());

describe('the People list from the keyboard', () => {
  it('↓ marks the closest first (the map turns into the list), and Enter opens them', async () => {
    seedState({ people: [person('Sam', { layer: 1 }), person('Riley', { layer: 3 })] });
    const { user } = renderApp();
    await user.click(nav('People'));
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: 'List view' }).getAttribute('aria-pressed')).toBe('true');
    const row = (name) => screen.getAllByRole('button').find(b => b.dataset.personRow && b.textContent.includes(name));
    expect(row('Riley').className).toContain('row-cursor');
    await user.keyboard('{ArrowDown}');
    expect(row('Sam').className).toContain('row-cursor');
    await user.keyboard('{Enter}');
    expect(screen.getByText('Current relationship stage')).toBeTruthy();
    expect(screen.getAllByText('Sam').length).toBeGreaterThan(0);
  });

  it('beside an open profile, ↑ ↓ open the one before or after', async () => {
    window.__layersWide = true;
    const riley = person('Riley', { layer: 3 });
    const sam = person('Sam', { layer: 1 });
    seedState({ people: [sam, riley] });
    const { user } = renderApp();
    await user.click(nav('People'));
    await user.keyboard('{ArrowDown}{Enter}');
    const list = () => document.querySelector('.people-split-list');
    expect(within(list()).getByText('Riley').closest('button').getAttribute('aria-current')).toBe('true');
    await user.keyboard('{ArrowDown}');
    expect(within(list()).getByText('Sam').closest('button').getAttribute('aria-current')).toBe('true');
  });

  it('in the search box, Enter opens the first match', async () => {
    seedState({ people: [person('Sam'), person('Riley')] });
    const { user } = renderApp();
    await user.click(nav('People'));
    await user.keyboard('/ri{Enter}');
    expect(screen.getByText('Current relationship stage')).toBeTruthy();
    expect(screen.getAllByText('Riley').length).toBeGreaterThan(0);
  });
});

describe('logging with someone', () => {
  it('starts at "What did you do?" when they are already picked', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.click(nav('People'));
    await user.click(screen.getAllByText('Morgan')[0]);
    await user.click(screen.getByRole('button', { name: 'Log an interaction' }));
    expect(dialog('What did you do?')).toBeTruthy();
    await user.keyboard('{Backspace}');
    expect(dialog('What are you logging?')).toBeTruthy(); // Plan something is still a step back
  });
});

describe('"Where are we now?"', () => {
  it('asks the closeness questions again, moves them there, and Undo puts them back', async () => {
    seedState({ people: [person('Morgan', { layer: 1 })] });
    const { user } = renderApp();
    await user.click(nav('People'));
    await user.click(screen.getAllByText('Morgan')[0]);
    const before = savedPerson('Morgan');
    await user.click(screen.getByRole('button', { name: 'Where are we now?' }));
    expect(dialog('How close are you and Morgan?')).toBeTruthy();
    await user.keyboard('yyyyyynnn'); // Layer 2, a third of Layer 3
    expect(screen.getByRole('status', { name: "Where you're starting" }).textContent).toMatch(/Now: Layer 1: Orientation/);
    await user.keyboard('{Enter}');
    expect(savedPerson('Morgan')).toMatchObject({ layer: 2, overall: 60 });
    expect(savedPerson('Morgan').lastChange.why).toContain('You answered "Where are we now?"');
    expect(toasts()).toContain('Morgan: Layer 2, 60%');
    await user.keyboard('{Control>}z{/Control}');
    expect(savedPerson('Morgan')).toMatchObject({ layer: before.layer, overall: before.overall });
  });

  it('is W on a person in Ctrl+K', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.keyboard('{Control>}k{/Control}mor{Tab}w');
    expect(dialog('How close are you and Morgan?')).toBeTruthy();
  });
});

describe('getting started', () => {
  it('lists the first things to try, ticks them off as you do them, and hides', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    const list = () => screen.queryByRole('region', { name: 'Getting started' });
    expect(within(list()).getByText('1 of 5')).toBeTruthy(); // someone's in the circle already
    await user.keyboard('{Control>}k{/Control}');
    await user.keyboard('{Escape}');
    expect(within(list()).getByText('2 of 5')).toBeTruthy();
    expect(savedState().profile.tried).toEqual({ jump: true });
    await user.click(within(list()).getByRole('button', { name: /Log your first chat/ }));
    expect(dialog('What are you logging?')).toBeTruthy();
    await user.keyboard('{Escape}');
    await user.click(within(list()).getByRole('button', { name: 'Hide' }));
    expect(list()).toBeNull();
    expect(screen.getByText('Try this next')).toBeTruthy();
    expect(savedState().profile.gettingStartedHidden).toBe(true);
  });

  it("isn't there for a circle with a few logs already", () => {
    const morgan = person('Morgan');
    const journal = Array.from({ length: 5 }, (_, i) => ({ id: `j${i}`, personId: morgan.id, type: 'talked', meaningfulness: 3, at: today }));
    seedState({ people: [morgan], journal });
    renderApp();
    expect(screen.queryByRole('region', { name: 'Getting started' })).toBeNull();
  });
});
