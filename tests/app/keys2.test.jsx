/** @vitest-environment jsdom */
// The owner's second live test (2026-10-05): a key into and out of every
// note box, Redo (Ctrl+Y), and Ctrl+K's letters for a person's actions.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { toISODate } from '../../src/lib/dates.js';
import { dialog, logDetails, nav, person, renderApp, savedState, seedState, toasts } from './harness.jsx';

const keyOn = (label) => screen.getByLabelText(label).closest('.keyed-field').querySelector('.keyed-field-key').textContent;

describe('note boxes', () => {
  it("the log's quick note: N goes in, Esc comes out, and the box shows which", async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.keyboard('n111{Enter}'); // an interaction, talked, Morgan
    expect(logDetails()).toBeTruthy();
    expect(keyOn('Quick note')).toBe('N');
    await user.keyboard('n');
    expect(document.activeElement).toBe(screen.getByLabelText('Quick note'));
    expect(keyOn('Quick note')).toBe('Esc');
    await user.keyboard('good chat{Escape}');
    expect(logDetails()).toBeTruthy();
    expect(document.activeElement).not.toBe(screen.getByLabelText('Quick note'));
    await user.keyboard('5{Enter}');
    expect(savedState().journal[0]).toMatchObject({ summary: 'good chat', meaningfulness: 5 });
  });

  it('Add detail: number keys open a topic, Backspace goes back, and N writes your own', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.keyboard('n111{Enter}d');
    expect(dialog('Add detail')).toBeTruthy();
    await user.keyboard('1');
    expect(dialog('Sports')).toBeTruthy();
    await user.keyboard('{Backspace}n');
    expect(document.activeElement).toBe(screen.getByLabelText('Your own'));
    await user.keyboard('Chess club{Enter}');
    expect(within(logDetails()).getByText(/Chess club/)).toBeTruthy();
  });

  it('editing a journal entry: 1-5, N for the note, F for how it felt, Enter saves', async () => {
    const morgan = person('Morgan');
    seedState({ people: [morgan], journal: [{ id: 'j1', personId: morgan.id, type: 'talked', meaningfulness: 3, at: toISODate(new Date()), date: 'Today', summary: 'Old note' }] });
    const { user } = renderApp();
    await user.click(nav('Journal'));
    await user.click(screen.getByRole('button', { name: /^Edit entry: Morgan/ }));
    expect(dialog('Edit entry')).toBeTruthy();
    await user.keyboard('4n');
    expect(document.activeElement).toBe(screen.getByLabelText('Note'));
    await user.keyboard('{Control>}a{/Control}New note{Escape}f');
    expect(document.activeElement).toBe(screen.getByLabelText('Reflection'));
    await user.keyboard('Felt easy{Tab}{Enter}');
    expect(savedState().journal[0]).toMatchObject({ meaningfulness: 4, summary: 'New note', reflection: 'Felt easy' });
  });
});

describe('Redo', () => {
  it('Ctrl+Y puts back what Ctrl+Z took away, and Ctrl+Z works again after', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.keyboard('n111{Enter}{Enter}');
    expect(savedState().journal).toHaveLength(1);
    await user.keyboard('{Control>}z{/Control}');
    expect(savedState().journal).toHaveLength(0);
    expect(toasts()).toContain('Undone');
    await user.keyboard('{Control>}y{/Control}');
    expect(savedState().journal).toHaveLength(1);
    expect(toasts()).toContain('Redone');
    await user.keyboard('{Control>}z{/Control}');
    expect(savedState().journal).toHaveLength(0);
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}'); // Ctrl+Shift+Z redoes too
    expect(savedState().journal).toHaveLength(1);
  });

  it("doesn't redo once something else has changed", async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.keyboard('n111{Enter}{Enter}');
    await user.keyboard('{Control>}z{/Control}');
    await user.keyboard('p11{Enter}{Enter}'); // a coffee with Morgan, saved
    expect(savedState().events).toHaveLength(1);
    await user.keyboard('{Control>}y{/Control}');
    expect(savedState().journal).toHaveLength(0);
    expect(savedState().events).toHaveLength(1);
  });
});

describe("Ctrl+K: a person's actions by letter", () => {
  it('O, L, P and R open, log, plan and prepare', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.keyboard('{Control>}k{/Control}mor{Tab}');
    for (const k of ['O', 'L', 'P', 'R']) expect(within(dialog('Jump to')).getAllByText(k).length).toBeGreaterThan(0);
    await user.keyboard('l');
    expect(dialog('What did you do?')).toBeTruthy(); // an interaction with Morgan, already picked
    await user.keyboard('1{Enter}');
    expect(logDetails()).toBeTruthy();
    await user.keyboard('{Escape}{Control>}k{/Control}mor{ArrowRight}p1'); // Plan with Morgan: a coffee
    expect(dialog('When?')).toBeTruthy();
    expect(screen.getByLabelText('Title').value).toBe('Coffee with Morgan');
  });
});
