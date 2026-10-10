/** @vitest-environment jsdom */
// Closeness over time (decided 2026-10-10): a profile's chart climbs through
// the layers instead of showing the meter within one, so a level-up reads as
// one; "Show the six dimensions" switches to the dimensions by day, kept on
// each chart point from then on.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { toISODate } from '../../src/lib/dates.js';
import { logDetails, nav, person, renderApp, savedPerson, seedState } from './harness.jsx';

async function openProfile(user, name) {
  await user.click(nav('People'));
  await user.click(screen.getAllByRole('button', { name: new RegExp(name) })[0]);
  await screen.findByText('Current relationship stage');
}
const chart = (name) => screen.getByLabelText(`Closeness with ${name} over time`);

describe('closeness over time', () => {
  it('says where they started and where they are now, across a level-up', async () => {
    const morgan = person('Morgan', { layer: 3, overall: 4, history: [
      { date: 'Sep 20', at: '2026-09-20', value: 90, layer: 2 },
      { date: 'Oct 3', at: '2026-10-03', value: 4, layer: 3 },
    ] });
    seedState({ people: [morgan] });
    const { user } = renderApp();
    await openProfile(user, 'Morgan');
    expect(within(chart('Morgan')).getByText('Closeness over time')).toBeTruthy();
    expect(chart('Morgan').textContent).toMatch(/Sep 20: Layer 2, Exploratory, at 90%\. Now Layer 3, Personal, at 4%\./);
    expect(screen.queryByText('Progress')).toBeNull();
  });

  it('shows the six dimensions, kept with each log from now on', async () => {
    const morgan = person('Morgan', { layer: 2, history: [{ date: 'Sep 20', at: '2026-09-20', value: 30, layer: 2 }] });
    seedState({ people: [morgan] });
    const { user } = renderApp();
    await openProfile(user, 'Morgan');
    await user.click(within(chart('Morgan')).getByRole('button', { name: 'Show the six dimensions' }));
    expect(within(chart('Morgan')).getByText('The six dimensions')).toBeTruthy();
    expect(chart('Morgan').textContent).toMatch(/Kept each day they change, from 10 October 2026 on/);

    // A log keeps the dimensions on that day's point.
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(nav('Today'));
    await user.keyboard('n11'); // Interaction, Talked
    await user.keyboard('1{Enter}');
    await user.click(within(logDetails()).getByRole('button', { name: '4' }));
    await user.click(screen.getByRole('button', { name: 'Save interaction' }));
    const point = savedPerson('Morgan').history.at(-1);
    expect(point.at).toBe(toISODate(new Date()));
    expect(Object.keys(point.dims).sort()).toEqual(['depth', 'interaction', 'listening', 'reciprocity', 'sharedExperiences', 'trust']);
    await openProfile(user, 'Morgan');
    await user.click(within(chart('Morgan')).getByRole('button', { name: 'Show the six dimensions' }));
    expect(chart('Morgan').textContent).toMatch(/Depth \d+/);
  });
});
