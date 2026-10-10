/** @vitest-environment jsdom */
// The quick log redesign and the polish that came with it (docs/roadmap.md,
// History): the quick log asks for little, each extra detail has its own
// sheet, everything works from the keyboard, the date button no longer paints
// over sheets above it, sheets slide away, and text on the accent colour is
// readable in both themes.
import { within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CSS, THEME_DARK, THEME_LIGHT } from '../../src/theme.js';
import { dialog, logDetails, person, queryDialog, renderApp, savedState, seedState, wait } from './harness.jsx';

afterEach(() => { delete window.__layersMotion; });

// N, 1 (Interaction), 1 (Talked), pick Morgan, Enter.
async function toDetails(user) {
  await user.keyboard('n');
  await user.keyboard('1');
  await user.keyboard('1');
  await user.click(within(dialog('Who was this with?')).getByRole('button', { name: /Morgan/ }));
  await user.keyboard('{Enter}');
  return logDetails();
}

describe('The quick log', () => {
  it('asks only for the date, how meaningful it was and a note', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    const details = await toDetails(user);
    expect(details.getAttribute('aria-label')).toBe('Talked with Morgan');
    expect(within(details).getByRole('button', { name: /^Date: Today/ })).toBeTruthy();
    expect(within(details).getByRole('group', { name: 'How meaningful was it?' })).toBeTruthy();
    expect(within(details).getByLabelText('Quick note')).toBeTruthy();
    expect(within(details).queryAllByRole('checkbox')).toEqual([]);
    expect(within(details).queryByLabelText('Reflection')).toBeNull();
  });

  it('can be done from the keyboard: N, 1, 1, a person, Enter, 4, Enter', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await toDetails(user);
    await user.keyboard('4');
    expect(within(logDetails()).getByRole('button', { name: '4' }).getAttribute('aria-pressed')).toBe('true');
    await user.keyboard('{Enter}');
    expect(queryDialog('Talked with Morgan')).toBeNull();
    expect(savedState().journal[0]).toMatchObject({ type: 'talked', meaningfulness: 4 });
  });

  it('typing a note then Enter saves it', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await toDetails(user);
    await user.keyboard('n'); // N focuses the note
    await user.keyboard('Coffee after work{Enter}');
    expect(savedState().journal[0].summary).toBe('Coffee after work');
  });

  it('Backspace goes back a step, but not while typing', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await toDetails(user);
    await user.keyboard('{Backspace}');
    expect(dialog('Who was this with?')).toBeTruthy();
    await user.keyboard('{Enter}');
    await user.click(within(logDetails()).getByLabelText('Quick note'));
    await user.keyboard('ab{Backspace}');
    expect(within(logDetails()).getByLabelText('Quick note').value).toBe('a');
  });
});

describe('More details, one sheet at a time', () => {
  it('each extra opens on its own key, and its chip says what was added', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await toDetails(user);
    await user.keyboard('l');
    expect(dialog('Did you practise active listening?')).toBeTruthy();
    await user.keyboard('1{Enter}');
    expect(queryDialog('Did you practise active listening?')).toBeNull();
    await user.keyboard('r');
    await user.keyboard('43{Enter}');
    const details = logDetails();
    expect(within(details).getByRole('button', { name: 'Active listening, 1 ticked' })).toBeTruthy();
    expect(within(details).getByRole('button', { name: 'Rate each part, 2 of 6' })).toBeTruthy();
    await user.keyboard('{Enter}');
    expect(savedState().journal[0]).toMatchObject({ activeListening: ['followup'], ratings: { depth: 4, trust: 3 } });
  });

  it("Enter in a pop-up's text box never saves the log underneath", async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await toDetails(user);
    await user.keyboard('i');
    await user.keyboard('{Enter}'); // empty "Something new": just closes
    expect(queryDialog('Something new about Morgan?')).toBeNull();
    expect(logDetails()).toBeTruthy();
    await user.keyboard('d');
    await user.click(within(dialog('Add detail')).getByRole('button', { name: /Custom/ }));
    await user.keyboard('Pizza{Enter}');
    expect(queryDialog('Custom')).toBeNull();
    expect(within(logDetails()).getByText(/Pizza/)).toBeTruthy();
    expect(savedState().journal).toEqual([]);
  });
});

describe('Sheets', () => {
  it("each sheet is its own layer, so the log's date button can't paint over a sheet opened above it", async () => {
    expect(CSS).toMatch(/\.sheet \{[^}]*isolation: isolate/);
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    const details = await toDetails(user);
    expect([...details.querySelectorAll('[style]')].filter(el => el.style.zIndex)).toEqual([]);
  });

  it('a dismissed sheet slides away, then closes', async () => {
    window.__layersMotion = true; // as if "reduce motion" were off
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.keyboard('n');
    await user.keyboard('{Escape}');
    expect(document.querySelector('.sheet.is-closing')).toBeTruthy();
    await wait(250);
    expect(queryDialog('What are you logging?')).toBeNull();
  });

  it("on a touch screen a tapped tile doesn't stay lifted and tinted", () => {
    const touch = CSS.slice(CSS.indexOf('@media (hover: none) and (pointer: coarse)'));
    expect(touch).toMatch(/\.tile:hover:not\(:disabled\) \{[^}]*transform: none;[^}]*box-shadow: none;[^}]*background: var\(--c-tile\)/);
    expect(touch).toMatch(/\.tile--accent:hover:not\(:disabled\) \{[^}]*background: var\(--c-accent-soft\)/);
  });
});

// WCAG relative luminance and contrast ratio, for '#RRGGBB' colours.
function contrast(a, b) {
  const lum = (hex) => {
    const [r, g, bl] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('Colours', () => {
  it('text on the accent colour is readable in both themes', () => {
    expect(contrast(THEME_LIGHT.onAccent, THEME_LIGHT.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(THEME_DARK.onAccent, THEME_DARK.accent)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Less typing: tap-to-add templates', () => {
  it('"Something new" adds interests and plans by tapping', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await toDetails(user);
    await user.keyboard('i');
    const sheet = dialog('Something new about Morgan?');
    await user.click(within(sheet).getByRole('button', { name: /Sports/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Football' }));
    await user.keyboard('3'); // Plans
    await user.click(within(sheet).getByRole('button', { name: 'Moving house' }));
    await user.click(within(sheet).getByRole('button', { name: 'Done' }));
    await user.keyboard('{Enter}');
    const morgan = savedState().people[0];
    expect(morgan.interests.map(i => [i.text, i.emoji])).toEqual([['Football', '⚽']]);
    expect(morgan.plans.map(p => p.text)).toEqual(['Moving house']);
  });

  it('"How did it feel?" builds the reflection from tapped phrases, then any typing', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await toDetails(user);
    await user.keyboard('f');
    const sheet = dialog('How did it feel?');
    await user.click(within(sheet).getByRole('button', { name: 'Easy and natural' }));
    await user.click(within(sheet).getByRole('button', { name: 'Ask more questions' }));
    await user.type(within(sheet).getByLabelText('Reflection'), 'Good chat');
    await user.click(within(sheet).getByRole('button', { name: 'Done' }));
    expect(within(logDetails()).getByRole('button', { name: 'How it felt, 2 picked, written' })).toBeTruthy();
    await user.keyboard('{Enter}');
    expect(savedState().journal[0].reflection).toBe('Easy and natural. Ask more questions. Good chat');
  });
});
