/** @vitest-environment jsdom */
// The last sheets that needed the mouse (docs/roadmap.md, "Drafted next
// (2026-10-06)", B): the full goal editor and its more specific versions,
// Add info, your profile and Coach's Prepare by keys; and focus moving into a
// sheet when it opens and back when it closes.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PRESET_VARIANTS } from '../../src/data/constants.js';
import { toISODate } from '../../src/lib/dates.js';
import { dialog, nav, person, renderApp, savedPerson, savedState, seedState } from './harness.jsx';

const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return toISODate(d); };

async function openProfile(user, name) {
  await user.click(nav('People'));
  await user.click(screen.getAllByRole('button', { name: new RegExp(name) })[0]);
  await screen.findByText('Current relationship stage');
}

describe('the full goal editor by keys', () => {
  it('3 picks a goal, V its more specific versions (2 the second), D a due date, Enter creates it', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await openProfile(user, 'Morgan');
    await user.click(screen.getByRole('button', { name: /Add goal/ }));
    const goal = () => dialog('New goal');
    await user.keyboard('3'); // Learn more about them
    expect(within(goal()).getByRole('button', { name: 'Learn more about them' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(goal()).getByRole('button', { name: /More specific versions of Learn more about them/ })).toBeTruthy(); // the chevron is a real button
    await user.keyboard('v');
    await user.keyboard('2');
    expect(within(goal()).getByLabelText('Description').value).toBe(PRESET_VARIANTS.learn[1]);
    await user.keyboard('d'); // due in 2 weeks
    await user.keyboard('{Enter}');
    expect(savedPerson('Morgan').goals[0]).toMatchObject({ type: 'learn', description: PRESET_VARIANTS.learn[1], dueDate: inDays(14) });
  });

  it('S steps through the skill goals, C writes your own, and ← → change who it is for', async () => {
    seedState({ people: [person('Morgan'), person('Riley')] });
    const { user } = renderApp();
    await openProfile(user, 'Morgan');
    await user.click(screen.getByRole('button', { name: /Add goal/ }));
    await user.keyboard('ss'); // the second skill goal
    expect(within(dialog('New goal')).getByRole('button', { name: 'Stop asking too many questions' }).getAttribute('aria-pressed')).toBe('true');
    await user.keyboard('c');
    expect(document.activeElement).toBe(within(dialog('New goal')).getByLabelText('Goal title'));
    await user.keyboard('Meet their family{Escape}');
    await user.keyboard('e'); // the description
    await user.keyboard('Have dinner with their family{Escape}');
    await user.keyboard('{ArrowRight}'); // Morgan -> Riley
    await user.keyboard('{Enter}');
    expect(savedPerson('Riley').goals[0]).toMatchObject({ type: 'custom', title: 'Meet their family', description: 'Have dinner with their family' });
  });
});

describe('Add info and your profile by keys', () => {
  it('Add info: type, Esc, → for the next icon, T temporary, Enter saves', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await openProfile(user, 'Morgan');
    await user.click(screen.getByRole('button', { name: 'Add to Interests' }));
    const sheet = dialog('Add to Interests');
    expect(document.activeElement).toBe(within(sheet).getByLabelText('Details'));
    await user.keyboard('Climbing{Escape}');
    const before = within(sheet).getByRole('group', { name: 'Icon' }).querySelector('[aria-pressed="true"]').textContent;
    await user.keyboard('{ArrowRight}t{Enter}');
    const item = savedPerson('Morgan').interests.find(i => i.text === 'Climbing');
    expect(item).toBeTruthy();
    expect(item.emoji).not.toBe(before);
    expect(item.temporary).toBe(true);
  });

  it('your profile: 2 picks a focus, N the name, Enter saves', async () => {
    seedState();
    const { user } = renderApp();
    await user.click(nav('Me'));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(dialog('Your profile')).toBeTruthy();
    await user.keyboard('2n');
    await user.keyboard('Alexis{Escape}{Enter}');
    expect(savedState().profile).toMatchObject({ name: 'Alexis', focus: 'deepen' });
  });
});

describe("Coach's Prepare by keys", () => {
  it('→ the next person, L logs with them, A analyses a chat with them', async () => {
    seedState({ people: [person('Morgan'), person('Riley')] });
    const { user } = renderApp();
    await user.click(nav('Coach'));
    const first = screen.getByText(/^Potential hooks for|^No saved information for/).textContent;
    await user.keyboard('{ArrowRight}');
    const next = screen.getByText(/^Potential hooks for|^No saved information for/).textContent;
    expect(next).not.toBe(first);
    const who = next.includes('Riley') ? 'Riley' : 'Morgan';
    await user.keyboard('l');
    expect(screen.getByRole('dialog', { name: 'What did you do?' })).toBeTruthy(); // the log, with them picked
    await user.keyboard('{Escape}');
    await user.keyboard('a');
    expect(screen.getByRole('button', { name: 'Analyse a chat' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(new RegExp(who))).toBeTruthy();
    await user.keyboard('1');
    expect(screen.getByRole('button', { name: 'Prepare' }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('focus', () => {
  it('moves into a sheet when it opens, and back to where it was when it closes', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.click(nav('Me'));
    const edit = screen.getByRole('button', { name: 'Edit' });
    await user.click(edit);
    const sheet = dialog('Your profile');
    expect(sheet.contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');
    await screen.findByRole('button', { name: 'Edit' });
    await new Promise(r => setTimeout(r, 250)); // the closing slide
    expect(document.activeElement).toBe(edit);
  });

  it('a confirm dialog that deletes starts on Cancel, so Enter is safe', async () => {
    seedState({ events: [{ id: 'e1', title: 'Call Gran', kind: 'oneoff', date: toISODate(new Date()), time: 1380, personIds: [] }] });
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: 'Call Gran' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(document.activeElement.textContent).toBe('Cancel');
    await user.keyboard('{Enter}');
    expect(savedState().events).toHaveLength(1);
  });
});
