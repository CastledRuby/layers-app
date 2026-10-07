/** @vitest-environment jsdom */
// Skills over time from analysed chats: on a profile, for chats with them,
// and in Me, for everyone. Only chats you analysed and logged count.
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { nav, person, renderApp, seedState } from './harness.jsx';

const analysis = (overall, listening, depth, balance, naturalness) => ({ grading: { overall, activeListening: listening, depth, reciprocity: balance, naturalness }, conversationState: 'engaged' });

describe('skills over time', () => {
  it('shows on a profile and in Me once there are analysed chats', async () => {
    const amelie = person('Amelie', { layer: 4 });
    const chloe = person('Chloe');
    seedState({
      people: [amelie, chloe],
      journal: [
        { id: 'j1', personId: amelie.id, type: 'messaged', meaningfulness: 3, at: '2026-09-20', analysis: analysis(60, 60, 40, 50, 70) },
        { id: 'j2', personId: amelie.id, type: 'messaged', meaningfulness: 4, at: '2026-10-05', analysis: analysis(75, 72, 55, 61, 80) },
        { id: 'j3', personId: chloe.id, type: 'talked', meaningfulness: 3, at: '2026-10-05' },
      ],
    });
    const { user } = renderApp();
    await user.click(nav('People'));
    await user.click(screen.getAllByRole('button', { name: /Amelie/ })[0]);
    const mine = await screen.findByLabelText('Skills from analysed chats with Amelie');
    expect(screen.getByText('Your chats with Amelie')).toBeTruthy();
    expect(mine.textContent).toMatch(/Listening 72 \+12/);
    expect(mine.textContent).toMatch(/Depth 55 \+15/);
    expect(mine.textContent).toMatch(/From 2 analysed chats you logged, and how each has moved since the first/);

    await user.keyboard('{Backspace}');
    await user.click(screen.getAllByRole('button', { name: /Chloe/ })[0]);
    await screen.findByText('Current relationship stage');
    expect(screen.queryByText('Your chats with Chloe')).toBeNull(); // nothing analysed with her

    await user.keyboard('{Backspace}');
    await user.click(nav('Me'));
    expect(screen.getByText('Your chats over time')).toBeTruthy();
    expect(screen.getByLabelText('Skills from analysed chats').textContent).toMatch(/Balance 61 \+11/);
  });
});
