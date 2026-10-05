/** @vitest-environment jsdom */
// Picking someone's avatar (AvatarPicker): when adding them, editing them,
// and while setting up, all from the keyboard as well as by tapping.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { dialog, nav, person, renderApp, savedPerson, seedState } from './harness.jsx';

const pressed = (sheet, name) => within(dialog(sheet)).getByRole('button', { name }).getAttribute('aria-pressed');

describe('the avatar picker', () => {
  it('adding someone: arrows pick, T changes the skin tone, G the group', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.keyboard('{Control>}{Shift>}a{/Shift}{/Control}Kai{Tab}');
    await user.keyboard('{ArrowRight}'); // Woman
    expect(pressed('Add someone new', 'Woman')).toBe('true');
    await user.keyboard('ttt'); // the third tone: medium
    expect(pressed('Add someone new', 'Medium skin tone')).toBe('true');
    await user.keyboard('{ArrowDown}'); // a row down: curly hair, still medium
    expect(pressed('Add someone new', 'Curly hair')).toBe('true');
    await user.keyboard('l{Enter}');
    expect(savedPerson('Kai').emoji).toBe('🧑🏽‍🦱');
  });

  it('groups: G shows the next one, and tapping picks from it', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.keyboard('{Control>}{Shift>}a{/Shift}{/Control}Rex{Tab}gg');
    expect(within(dialog('Add someone new')).getByRole('group', { name: 'Animals' })).toBeTruthy();
    expect(within(dialog('Add someone new')).queryByRole('group', { name: 'Skin tone' })).toBeNull();
    await user.click(within(dialog('Add someone new')).getByRole('button', { name: 'Fox' }));
    await user.keyboard('l{Enter}');
    expect(savedPerson('Rex').emoji).toBe('🦊');
  });

  it("editing someone keeps their tone, and Enter saves", async () => {
    seedState({ people: [person('Morgan', { emoji: '🧑🏿' })] });
    const { user } = renderApp();
    await user.click(nav('People'));
    await user.click(screen.getAllByText('Morgan')[0]);
    await user.click(screen.getByRole('button', { name: /^Edit/ }));
    expect(dialog('Edit person')).toBeTruthy();
    expect(pressed('Edit person', 'Dark skin tone')).toBe('true');
    await user.keyboard('{Tab}{ArrowRight}{Enter}');
    expect(savedPerson('Morgan').emoji).toBe('👩🏿');
  });

  it('/ finds one by name; Enter picks the first match, then the arrows move through the matches', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.keyboard('{Control>}{Shift>}a{/Shift}{/Control}Lou{Tab}/');
    expect(document.activeElement).toBe(screen.getByLabelText('Find an avatar'));
    await user.keyboard('red hair');
    expect(within(dialog('Add someone new')).getByRole('group', { name: 'Matches' }).querySelectorAll('button')).toHaveLength(3);
    await user.keyboard('{Enter}');
    expect(pressed('Add someone new', 'Red hair')).toBe('true');
    expect(dialog('Add someone new')).toBeTruthy(); // Enter in the find box doesn't go on
    await user.keyboard('{ArrowRight}');
    expect(pressed('Add someone new', 'Woman, red hair')).toBe('true');
    await user.keyboard('l{Enter}');
    expect(savedPerson('Lou').emoji).toBe('👩‍🦰');
  });

  it('initials: Shift+G from People, the arrows pick a colour, and they show everywhere', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.keyboard('{Control>}{Shift>}a{/Shift}{/Control}Ethan M{Tab}{Shift>}g{/Shift}');
    const sheet = () => dialog('Add someone new');
    expect(within(sheet()).getByRole('group', { name: 'Initials' })).toBeTruthy();
    expect(within(sheet()).getAllByText('EM').length).toBeGreaterThan(0);
    await user.keyboard('{ArrowRight}{ArrowRight}'); // Their layer, then Sky
    expect(pressed('Add someone new', 'Initials, sky')).toBe('true');
    await user.keyboard('l{Enter}');
    expect(savedPerson('Ethan M').avatar).toEqual({ style: 'initials', color: 'sky' });
    await user.click(nav('People'));
    await user.click(screen.getByRole('button', { name: 'List view' }));
    expect(screen.getAllByText('EM').length).toBeGreaterThan(0);
  });

  it('going back to an emoji drops the initials', async () => {
    seedState({ people: [person('Morgan', { avatar: { style: 'initials', color: 'rose' } })] });
    const { user } = renderApp();
    await user.click(nav('People'));
    await user.click(screen.getAllByText('Morgan')[0]);
    await user.click(screen.getByRole('button', { name: /^Edit/ }));
    expect(pressed('Edit person', 'Initials, rose')).toBe('true');
    await user.keyboard('{Tab}g{ArrowRight}{Enter}'); // People: the first one
    expect('avatar' in savedPerson('Morgan')).toBe(false);
    expect(savedPerson('Morgan').emoji).toBe('🧑');
  });

  it('setting up: A (or tapping their avatar) opens the picker for the newest person', async () => {
    const { user } = renderApp();
    await user.type(screen.getByLabelText('Your name'), 'Sam{Enter}');
    await user.type(screen.getByLabelText("Person's name"), 'Ana{Enter}');
    await user.keyboard('{Escape}a'); // out of the name box, then A
    expect(dialog("Ana's avatar")).toBeTruthy();
    await user.keyboard('g{ArrowRight}{ArrowRight}{Enter}'); // Faces: the first, then the second
    expect(screen.getByRole('button', { name: "Change Ana's avatar" }).textContent).toBe('😎');
    await user.click(screen.getByRole('button', { name: 'Continue with 1 person' }));
    await user.click(screen.getByRole('button', { name: 'Go to Today' }));
    expect(savedPerson('Ana').emoji).toBe('😎');
  });
});
