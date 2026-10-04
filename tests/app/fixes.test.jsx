/** @vitest-environment jsdom */
// Regression tests for the bugs found in the 1.0.26 audit (docs/roadmap.md,
// Batch 1). Each test drives the app the way a person would hit the bug.
import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../../src/components/ErrorBoundary.jsx';
import { EMPTY_SKILLS, INITIAL_SKILLS } from '../../src/data/seed.js';
import { toISODate } from '../../src/lib/dates.js';
import { STORAGE_KEY, UNREADABLE_PREFIX } from '../../src/lib/storage.js';
import { confirmDialog, dialog, done, logDetails, nav, openExtra, person, queryDialog, renderApp, savedPerson, savedState, seedState, toasts, trackErrors, wait } from './harness.jsx';

const TODAY = toISODate(new Date());

async function openProfile(user, name) {
  await user.click(nav('People'));
  await user.click(screen.getAllByRole('button', { name: new RegExp(name) })[0]);
  await screen.findByText('Current relationship stage');
}

async function startLog(user, { names, type = /Talked/ }) {
  await user.click(document.querySelector('.fab-btn'));
  await user.click(within(dialog('What are you logging?')).getByRole('button', { name: /^Interaction/ }));
  await user.click(within(dialog('What did you do?')).getByRole('button', { name: type }));
  const who = dialog('Who was this with?');
  for (const n of names) await user.click(within(who).getByRole('button', { name: new RegExp(n) }));
  await user.click(within(who.closest('.sheet-panel')).getByRole('button', { name: /^Confirm/ }));
  return logDetails();
}

async function addTopic(user, category, item) {
  await user.click(screen.getByRole('button', { name: /Add detail/ }));
  await user.click(within(dialog('Add detail')).getByRole('button', { name: new RegExp(category) }));
  await user.click(within(dialog(category)).getByRole('button', { name: item }));
}

async function saveLog(user, details, { meaningfulness, practised = [] } = {}) {
  if (meaningfulness) await user.click(within(details).getByRole('button', { name: String(meaningfulness) }));
  if (practised.length) {
    await openExtra(user, 'Active listening');
    for (const label of practised) await user.click(screen.getByRole('checkbox', { name: label }));
    await done(user, 'Did you practise active listening?');
  }
  await user.click(within(details.closest('.sheet-panel')).getByRole('button', { name: 'Save interaction' }));
}

afterEach(() => { vi.restoreAllMocks(); });

describe('#1 Coach opened for someone who was then removed', () => {
  it('asks who the conversation was with instead of blanking the window', async () => {
    seedState({ people: [person('Morgan'), person('Riley')] });
    const errors = trackErrors();
    const { user } = renderApp();
    await openProfile(user, 'Morgan');
    await user.click(screen.getByRole('button', { name: 'Prepare to talk' }));
    await user.click(screen.getByRole('button', { name: 'Open full Conversation Coach' }));
    await openProfile(user, 'Morgan');
    await user.click(screen.getByRole('button', { name: /Edit/ }));
    await user.click(screen.getByRole('button', { name: /Remove this person/ }));
    await user.click(within(confirmDialog('Remove Morgan?')).getByRole('button', { name: 'Remove person' }));
    await user.click(nav('Coach'));
    await user.click(screen.getByRole('button', { name: 'Analyse a screenshot' }));
    errors.stop();
    expect(errors.errors).toEqual([]);
    expect(screen.getByText(/Analysing a conversation with/).textContent).toContain('Riley');
  });

  it("doesn't preselect a removed person when logging", async () => {
    seedState({ people: [person('Riley')] });
    const { user } = renderApp();
    await user.click(nav('Coach'));
    await user.click(screen.getByRole('button', { name: 'Log this conversation' }));
    await user.click(within(dialog('What are you logging?')).getByRole('button', { name: /^Interaction/ }));
    await user.click(within(dialog('What did you do?')).getByRole('button', { name: /Talked/ }));
    expect(screen.getByRole('button', { name: 'Confirm (1 selected)' })).toBeTruthy(); // Riley, who exists
  });

  it('shows a way out instead of a blank window when a screen crashes', () => {
    const Boom = () => { throw new Error('kaboom'); };
    const errors = trackErrors();
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    errors.stop();
    expect(screen.getByRole('alert').textContent).toContain('This screen hit a problem');
    expect(screen.getByRole('button', { name: 'Reload Layers' })).toBeTruthy();
  });
});

describe('#2 saved data that is damaged or fails to save', () => {
  it('keeps a copy of unreadable data and says so, instead of silently replacing it', async () => {
    window.localStorage.setItem(STORAGE_KEY, '{"people": [oops');
    renderApp();
    const alert = await screen.findByRole('alertdialog', { name: "Your saved data couldn't be read" });
    expect(alert.textContent).toContain('A copy of the original was kept');
    const copies = Object.keys(window.localStorage).filter(k => k.startsWith(UNREADABLE_PREFIX));
    expect(copies).toHaveLength(1);
    expect(window.localStorage.getItem(copies[0])).toBe('{"people": [oops');
  });

  it('repairs a damaged record at startup and explains what was skipped', async () => {
    seedState({ people: [person('Morgan'), { id: 'broken', name: '' }] });
    renderApp();
    const alert = await screen.findByRole('alertdialog', { name: 'Some saved data was repaired' });
    expect(alert.textContent).toContain('1 person without a name');
    expect(savedState().people.map(p => p.name)).toEqual(['Morgan']);
  });

  it('says so when saving fails, once', async () => {
    seedState();
    const { user } = renderApp();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    await user.click(nav('Me'));
    await user.click(screen.getByRole('button', { name: 'dark' }));
    await user.click(screen.getByRole('button', { name: 'light' }));
    expect(toasts().filter(t => t.includes("couldn't save")).length).toBe(1);
  });
});

describe('#3 removing a person', () => {
  it('unlinks them from reminders', async () => {
    const morgan = person('Morgan');
    seedState({ people: [morgan], events: [{ id: 'e1', title: 'Call Morgan', kind: 'recurring', weekdays: [0, 1, 2, 3, 4, 5, 6], time: 600, personIds: [morgan.id] }] });
    const { user } = renderApp();
    await openProfile(user, 'Morgan');
    await user.click(screen.getByRole('button', { name: /Edit/ }));
    await user.click(screen.getByRole('button', { name: /Remove this person/ }));
    await user.click(screen.getByRole('button', { name: 'Remove person' }));
    expect(savedState().events[0].personIds).toEqual([]);
  });
});

describe('#4 Adjust', () => {
  it('saving with nothing changed leaves the person where they are', async () => {
    // Dimensions grown ahead of layer progress, as logging leaves them.
    const ana = person('Ana', { layer: 2, overall: 10, dims: { depth: 60, trust: 60, reciprocity: 60, interaction: 60, sharedExperiences: 60, listening: 60 } });
    seedState({ people: [ana] });
    const { user } = renderApp();
    await openProfile(user, 'Ana');
    await user.click(screen.getByRole('button', { name: 'Adjust manually' }));
    expect(screen.getByText(/Saving now changes nothing/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(savedPerson('Ana')).toMatchObject({ layer: 2, overall: 10 });
  });

  it('previews where a change would put them before saving', async () => {
    seedState({ people: [person('Ana', { layer: 2 })] });
    const { user } = renderApp();
    await openProfile(user, 'Ana');
    await user.click(screen.getByRole('button', { name: 'Adjust manually' }));
    const sliders = screen.getAllByRole('slider');
    sliders.forEach(s => { s.focus(); });
    // Drag every slider to 80: average 80 is Layer 4, 20%.
    const { fireEvent } = await import('@testing-library/react');
    sliders.forEach(s => fireEvent.change(s, { target: { value: '80' } }));
    expect(screen.getByRole('status').textContent).toBe('Saving puts Ana at Layer 4: Close, 20% (now Layer 2, 20%).');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(savedPerson('Ana')).toMatchObject({ layer: 4, overall: 20 });
    expect(savedPerson('Ana').timeline.map(t => t.label)).toContain('Reached Layer 4: Close');
  });
});

describe('#10 / jumps to search from any tab', () => {
  it('focuses People search from Today', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.keyboard('/');
    expect(document.activeElement.id).toBe('people-search-input');
  });
});

describe('#11 single-key shortcuts ignore Ctrl/Alt combinations', () => {
  it('Ctrl+N and Alt+D open nothing; N and D still work', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.keyboard('{Control>}n{/Control}');
    await user.keyboard('{Alt>}d{/Alt}');
    expect(queryDialog('What are you logging?')).toBeNull();
    expect(queryDialog('Add detail')).toBeNull();
    await user.keyboard('n');
    expect(dialog('What are you logging?')).toBeTruthy();
  });
});

describe('#12 Esc', () => {
  it('closes "Prepare to talk"', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await openProfile(user, 'Morgan');
    await user.click(screen.getByRole('button', { name: 'Prepare to talk' }));
    expect(dialog('Prepare to talk to Morgan')).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(queryDialog('Prepare to talk to Morgan')).toBeNull();
  });

  it('closes only a picker opened inside the log, keeping what was entered', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    const details = await startLog(user, { names: ['Morgan'] });
    await user.type(within(details).getByPlaceholderText(/Caught up after school/), 'Good chat');
    await user.click(within(details).getByRole('button', { name: /Add detail/ }));
    expect(dialog('Add detail')).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(queryDialog('Add detail')).toBeNull();
    expect(within(logDetails()).getByPlaceholderText(/Caught up after school/).value).toBe('Good chat');
  });
});

describe('#13 topics picked while logging', () => {
  it('are saved to the profile when logging with one person', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    const details = await startLog(user, { names: ['Morgan'] });
    await addTopic(user, 'Sports', 'Football');
    await addTopic(user, 'Life stuff', 'Moving house');
    expect(within(details).getByText("Topics are also saved to Morgan's profile.")).toBeTruthy();
    await saveLog(user, details);
    const morgan = savedPerson('Morgan');
    expect(morgan.interests.map(i => i.text)).toEqual(['Football']);
    expect(morgan.important.map(i => [i.text, i.temporary])).toEqual([['Moving house', true]]);
    expect(savedState().journal[0].added).toEqual(['Football', 'Moving house']);
    expect(savedState().skills.selfDisclosure.current).toBe(1);
  });

  it("refresh an interest that's already saved instead of adding it twice", async () => {
    seedState({ people: [person('Morgan', { interests: [{ id: 'i1', emoji: '⚽', text: 'Football', at: '2026-01-01', temporary: false, archived: true }] })] });
    const { user } = renderApp();
    const details = await startLog(user, { names: ['Morgan'] });
    await addTopic(user, 'Sports', 'Football');
    await saveLog(user, details);
    expect(savedPerson('Morgan').interests).toEqual([{ id: 'i1', emoji: '⚽', text: 'Football', at: TODAY, temporary: false, archived: false }]);
  });

  it('stay in the note only for a group log', async () => {
    seedState({ people: [person('Morgan'), person('Riley')] });
    const { user } = renderApp();
    const details = await startLog(user, { names: ['Morgan', 'Riley'] });
    await addTopic(user, 'Sports', 'Football');
    await saveLog(user, details);
    expect(savedPerson('Morgan').interests).toEqual([]);
    expect(savedState().journal.map(j => j.summary)).toEqual(['Football', 'Football']);
  });
});

describe('#14 skills chart', () => {
  it('gets a point when logging moves a skill', async () => {
    seedState({ people: [person('Morgan')], skills: EMPTY_SKILLS });
    const { user } = renderApp();
    const details = await startLog(user, { names: ['Morgan'] });
    await saveLog(user, details, { practised: ['Asked follow-up questions'] });
    expect(savedState().skills.followUp.history).toEqual([{ date: expect.any(String), at: TODAY, value: 2 }]);
  });
});

describe('#15 and #17 levelling up', () => {
  it('announces every level-up in a group log and dates it on each timeline', async () => {
    seedState({ people: [person('Morgan', { overall: 99 }), person('Riley', { overall: 99 })] });
    const { user } = renderApp();
    const details = await startLog(user, { names: ['Morgan', 'Riley'] });
    await saveLog(user, details, { meaningfulness: 5 });
    expect(toasts().filter(t => t.includes('moved up to Layer 2'))).toEqual([
      '🎉 Morgan moved up to Layer 2: Exploratory!',
      '🎉 Riley moved up to Layer 2: Exploratory!',
    ]);
    for (const name of ['Morgan', 'Riley']) {
      expect(savedPerson(name).timeline).toContainEqual({ label: 'Reached Layer 2: Exploratory', at: TODAY });
    }
  });

  it('shows the gain across the layer change instead of +0%', async () => {
    seedState({ people: [person('Morgan', { overall: 99 })] });
    const { user } = renderApp();
    const details = await startLog(user, { names: ['Morgan'] });
    await saveLog(user, details, { meaningfulness: 5 });
    await openProfile(user, 'Morgan');
    expect(screen.getByText(/Layer 1 · 99% → Layer 2 · \d+%/)).toBeTruthy();
    expect(screen.queryByText('+0%')).toBeNull();
  });
});

describe('#16 logged interactions on the day plan', () => {
  it('show on the day they were logged for, not the day they were added', () => {
    const morgan = person('Morgan');
    seedState({ people: [morgan], journal: [
      { id: 'j1', personId: morgan.id, at: '2026-01-05', type: 'talked', meaningfulness: 3, added: [], activeListening: [], summary: 'Backdated chat' },
      { id: 'j2', personId: morgan.id, at: TODAY, type: 'talked', meaningfulness: 3, added: [], activeListening: [], summary: 'Chat today' },
    ] });
    renderApp();
    const logged = screen.getByText('Logged').parentElement.textContent;
    expect(logged).toContain('Chat today');
    expect(logged).not.toContain('Backdated chat');
  });
});

describe('#18 Coach Analyse', () => {
  it("applies the goal gain it shows, and can't log the same analysis twice", async () => {
    seedState({ people: [person('Morgan', { goals: [{ id: 'g1', personId: null, category: 'relationship', type: 'learn', title: 'Learn more', description: '', progress: 10, history: [] }] })] });
    const { user } = renderApp();
    await user.click(nav('Coach'));
    await user.click(screen.getByRole('button', { name: 'Analyse a chat' }));
    await user.click(screen.getByRole('button', { name: /Morgan/ }));
    await user.click(screen.getByRole('button', { name: /A first proper conversation/ }));
    await screen.findByText('Reconstructed conversation', {}, { timeout: 2000 });
    expect(screen.getByText('+11%')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Log this as an interaction' }));
    expect(savedPerson('Morgan').goals[0].progress).toBe(21);
    await user.click(screen.getByRole('button', { name: '← Try a different sample' }));
    await user.click(screen.getByRole('button', { name: /A first proper conversation/ }));
    await screen.findByText('Reconstructed conversation', {}, { timeout: 2000 });
    expect(screen.queryByRole('button', { name: 'Log this as an interaction' })).toBeNull();
    expect(savedState().journal).toHaveLength(1);
  });

  it("doesn't save an extracted detail edited down to nothing", async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.click(nav('Coach'));
    await user.click(screen.getByRole('button', { name: 'Analyse a chat' }));
    await user.click(screen.getByRole('button', { name: /Morgan/ }));
    await user.click(screen.getByRole('button', { name: /A first proper conversation/ }));
    await screen.findByText('Reconstructed conversation', {}, { timeout: 2000 });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByDisplayValue('Skateboarding (just started)'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(savedPerson('Morgan').interests).toEqual([]);
  });
});

describe('#19 goal description', () => {
  it('follows the person you pick', async () => {
    seedState({ people: [person('Morgan'), person('Riley')] });
    const { user } = renderApp();
    await openProfile(user, 'Morgan');
    await user.click(screen.getByRole('button', { name: /Add goal/ }));
    const goal = dialog('New goal');
    await user.click(within(goal).getByRole('button', { name: /Become closer friends/ }));
    const description = within(goal).getByPlaceholderText('Describe a measurable target');
    expect(description.value).toContain('with Morgan');
    await user.click(within(goal).getByRole('button', { name: /Riley/ }));
    expect(description.value).toContain('with Riley');
  });
});

describe('#21 wording', () => {
  it('Me has no "biggest strength" until something is tracked', async () => {
    seedState({ skills: EMPTY_SKILLS });
    const { user } = renderApp();
    await user.click(nav('Me'));
    expect(screen.getByText('Getting started')).toBeTruthy();
    expect(screen.queryByText('Your biggest strength')).toBeNull();
  });

  it('Me picks strength and focus from your real levels', async () => {
    seedState({ skills: INITIAL_SKILLS });
    const { user } = renderApp();
    await user.click(nav('Me'));
    expect(screen.getByText('Your biggest strength').parentElement.textContent).toContain('Active listening'); // 82%
    expect(screen.getByText('Current focus').parentElement.textContent).toContain('Self-disclosure'); // 61%
  });

  it('Journal says nothing is logged yet, rather than "no match"', async () => {
    seedState();
    const { user } = renderApp();
    await user.click(nav('Journal'));
    expect(screen.getByText(/Nothing logged yet/)).toBeTruthy();
  });

  it("Today doesn't say Layers can't send notifications", () => {
    seedState();
    renderApp();
    expect(screen.queryByText(/doesn't send OS notifications/)).toBeNull();
  });
});

describe('#22 reminders', () => {
  it('can be created with nobody in your circle', async () => {
    seedState();
    const { user } = renderApp();
    await user.keyboard('p');
    await user.click(screen.getByRole('button', { name: /Something else/ }));
    await user.click(screen.getByRole('button', { name: /Continue without anyone/ }));
    await user.clear(screen.getByLabelText('Title'));
    await user.type(screen.getByLabelText('Title'), 'Book dentist');
    await user.click(screen.getByRole('button', { name: 'Save plan' }));
    expect(savedState().events.map(e => [e.title, e.createdAt])).toEqual([['Book dentist', TODAY]]);
  });

  it('the log explains that an interaction needs someone first', async () => {
    seedState();
    const { user } = renderApp();
    await user.keyboard('n');
    const interaction = within(dialog('What are you logging?')).getByRole('button', { name: /Interaction/ });
    expect(interaction.disabled).toBe(true);
    expect(interaction.textContent).toContain('Add someone in People first');
  });

  it('asks before deleting', async () => {
    seedState({ events: [{ id: 'e1', title: 'Call Gran', kind: 'recurring', weekdays: [0, 1, 2, 3, 4, 5, 6], time: 600, personIds: [] }] });
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: 'Call Gran' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(confirmDialog('Delete this plan?').textContent).toContain('"Call Gran" will be removed for good, every time it repeats');
    await user.keyboard('{Escape}');
    expect(savedState().events).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete plan' }));
    expect(savedState().events).toEqual([]);
  });
});

describe('saving and reopening', () => {
  it('keeps a logged interaction across a relaunch', async () => {
    seedState({ people: [person('Morgan')] });
    const app = renderApp();
    const details = await startLog(app.user, { names: ['Morgan'] });
    await saveLog(app.user, details, { meaningfulness: 4 });
    app.unmount();
    const { user } = renderApp();
    expect(savedState().journal).toHaveLength(1);
    await user.click(nav('Journal'));
    expect(screen.getByText('Had a meaningful conversation')).toBeTruthy();
  });

  it('settles timers without errors', async () => {
    const errors = trackErrors();
    seedState({ people: [person('Morgan')] });
    renderApp();
    await wait(50);
    errors.stop();
    expect(errors.errors).toEqual([]);
  });
});
