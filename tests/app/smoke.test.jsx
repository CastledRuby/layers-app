/** @vitest-environment jsdom */
// Smoke tests: the app starts, onboards, and every tab renders without errors,
// both with nobody in your circle and with the sample people.
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { nav, relaunch, renderApp, savedState, seedState, trackErrors } from './harness.jsx';

const TABS = [
  ['Today', /Good (morning|afternoon|evening)/],
  ['People', /Your circle/],
  ['Coach', /Conversation Coach/],
  ['Journal', /Every interaction, in one place/],
  ['Me', /Your social skills/],
];

async function visitEveryTab(user) {
  for (const [tab, heading] of TABS) {
    await user.click(nav(tab));
    expect((await screen.findAllByText(heading)).length).toBeGreaterThan(0);
  }
}

describe('first launch', () => {
  it('starts fresh with zero people, and every tab renders', async () => {
    const errors = trackErrors();
    const { user } = renderApp();
    await user.type(screen.getByLabelText('Your name'), 'Sam');
    await user.click(screen.getByRole('button', { name: 'A bit of everything' }));
    await user.click(screen.getByRole('button', { name: 'Start fresh with my own people' }));
    await user.click(screen.getByRole('button', { name: "Skip, I'll add people later" }));
    await user.click(screen.getByRole('button', { name: 'Go to Today' }));

    expect(screen.getByText(/Good (morning|afternoon|evening), Sam/)).toBeTruthy();
    await visitEveryTab(user);
    errors.stop();
    expect(errors.errors).toEqual([]);

    const s = savedState();
    expect(s.onboarded).toBe(true);
    expect(s.people).toEqual([]);
    expect(s.profile).toEqual({ name: 'Sam', focus: 'mix' });
  });

  it('explores with the sample people, and every tab renders', async () => {
    const errors = trackErrors();
    const { user } = renderApp();
    await user.type(screen.getByLabelText('Your name'), 'Sam');
    await user.click(screen.getByRole('button', { name: 'Explore with example people first' }));
    await user.click(screen.getByRole('button', { name: 'Go to Today' }));
    await visitEveryTab(user);
    errors.stop();
    expect(errors.errors).toEqual([]);
    expect(savedState().people.map(p => p.name)).toContain('Alex');
  });

  it('never shows onboarding again after a relaunch', async () => {
    const app = renderApp();
    await app.user.type(screen.getByLabelText('Your name'), 'Sam');
    await app.user.click(screen.getByRole('button', { name: 'Explore with example people first' }));
    await app.user.click(screen.getByRole('button', { name: 'Go to Today' }));
    relaunch(app);
    expect(screen.queryByText('Welcome to Layers')).toBeNull();
    expect(screen.getByText(/Good (morning|afternoon|evening), Sam/)).toBeTruthy();
  });
});

describe('returning user', () => {
  it('restores the saved theme', () => {
    seedState({ theme: 'dark' });
    renderApp();
    expect(document.querySelector('.layers-root').classList.contains('dark')).toBe(true);
  });
});
