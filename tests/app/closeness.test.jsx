/** @vitest-environment jsdom */
// Adding someone with "How close are you two?" (AddPersonModal and the quiz
// in components/ClosenessQuiz.jsx), all from the keyboard. Where answers
// place someone is unit-tested in src/closeness.test.js.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { dialog, nav, person, renderApp, savedPerson, seedState, toasts } from './harness.jsx';

const question = () => screen.getByRole('heading', { level: 3 }).textContent;
const result = () => screen.getByRole('status', { name: "Where you're starting" }).textContent;

describe('adding someone', () => {
  it('asks a few questions, places them on a layer, and adds them there', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.click(nav('People'));
    await user.keyboard('a');
    expect(dialog('Add someone new')).toBeTruthy();
    await user.keyboard('Sam{Enter}');
    expect(dialog('How close are you and Sam?')).toBeTruthy();
    expect(question()).toBe('Would Sam say hi if you passed each other in a corridor?');
    await user.keyboard('yy');
    expect(question()).toMatch(/chat with Sam for five minutes/);
    await user.keyboard('yyy');
    expect(question()).toMatch(/watching a movie with Sam/);
    await user.keyboard('ynn'); // Layer 3 isn't there yet: the quiz stops
    expect(dialog('Adding Sam')).toBeTruthy();
    expect(result()).toMatch(/Layer 2: Exploratory · 60% in/);
    expect(result()).toMatch(/From 8 answers/);
    await user.keyboard('{Enter}');
    expect(savedPerson('Sam')).toMatchObject({ layer: 2, overall: 60 });
    expect(toasts()).toContain('Sam added at Layer 2: Exploratory');
  });

  it('stops after two questions for someone you barely know', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.keyboard('{Control>}{Shift>}a{/Shift}{/Control}Jo{Enter}nn');
    expect(result()).toMatch(/Layer 1: Orientation · 5% in/);
  });

  it('Backspace goes back a question, 1-4 picks another layer, and L skips the questions', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.keyboard('{Control>}{Shift>}a{/Shift}{/Control}Ana{Enter}y');
    expect(question()).toMatch(/a few basics about Ana/);
    await user.keyboard('{Backspace}');
    expect(question()).toMatch(/say hi/);
    await user.keyboard('l'); // pick it yourself
    expect(within(dialog('Adding Ana')).getByRole('button', { name: /Layer 1: Orientation/ }).getAttribute('aria-pressed')).toBe('true');
    await user.keyboard('4{Enter}');
    expect(savedPerson('Ana').layer).toBe(4);
  });

  it('can go round again with Q, and change the avatar with the arrows', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.keyboard('{Control>}{Shift>}a{/Shift}{/Control}Kai{Tab}{ArrowRight}{Enter}nn');
    expect(result()).toMatch(/Layer 1/);
    await user.keyboard('q');
    expect(question()).toMatch(/say hi/);
    await user.keyboard('yyyyyyyyyyy');
    expect(result()).toMatch(/Layer 4: Stable \/ Close · 90% in/);
    await user.keyboard('{Enter}');
    expect(savedPerson('Kai')).toMatchObject({ layer: 4, emoji: '🧑‍🦱' });
  });
});
