// Helpers for the app tests: render the whole app (exactly what main.jsx
// mounts) against a seeded localStorage, drive it like a user, and read back
// what it saved. See docs/testing.md.
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import App from '../../src/App.jsx';
import { EMPTY_SKILLS } from '../../src/data/seed.js';
import { makePerson } from '../../src/lib/progress.js';

export const STATE_KEY = 'layers-app-state-v1';

// Seed a saved state, as if the app had been used before. Defaults to an
// onboarded user with nobody in their circle.
export function seedState(partial = {}) {
  const state = {
    onboarded: true,
    profile: { name: 'Tester', focus: 'mix' },
    people: [], journal: [], generalGoals: [], events: [],
    skills: EMPTY_SKILLS, theme: 'light',
    ...partial,
  };
  window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
  return state;
}

export function savedState() {
  return JSON.parse(window.localStorage.getItem(STATE_KEY));
}

export function savedPerson(name) {
  return savedState().people.find(p => p.name === name);
}

// A person as AddPersonModal would create them, with optional overrides.
export function person(name, overrides = {}) {
  return { ...makePerson({ name, emoji: '🙂', layer: overrides.layer || 1 }), ...overrides };
}

export function renderApp() {
  const user = userEvent.setup();
  const utils = render(<StrictMode><App /></StrictMode>);
  return { user, ...utils };
}

// Quit and relaunch: unmount, then mount again from what was saved.
export function relaunch(app) {
  app.unmount();
  return renderApp();
}

export const dialog = (name) => screen.getByRole('dialog', { name });
export const findDialog = (name) => screen.findByRole('dialog', { name });
export const queryDialog = (name) => screen.queryByRole('dialog', { name });
export const confirmDialog = (name) => screen.getByRole('alertdialog', { name });

export function nav(name) {
  return within(document.querySelector('.nav-bar')).getByRole('button', { name: new RegExp(`^${name}$`, 'i') });
}

export function toasts() {
  return [...document.querySelectorAll('.toast')].map(t => t.textContent);
}

// Let pending timers and effects run (toasts, the analysis "reading" delay).
export async function wait(ms) {
  await act(() => new Promise(r => setTimeout(r, ms)));
}

// Collect uncaught errors and React error logs during a test.
export function trackErrors() {
  const errors = [];
  const onError = (e) => errors.push(e.message || String(e.error));
  window.addEventListener('error', onError);
  const original = console.error;
  console.error = (...args) => { errors.push(args.map(String).join(' ')); };
  return {
    errors,
    stop() { window.removeEventListener('error', onError); console.error = original; },
  };
}
