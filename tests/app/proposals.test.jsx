/** @vitest-environment jsdom */
// The proposals built for 1.0.28 (docs/roadmap.md: P1, P2 and P4-P7; P3 is
// still a decision), driven through
// the UI the way a person would use them.
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { toISODate } from '../../src/lib/dates.js';
import { dialog, done, logDetails, nav, openExtra, person, renderApp, savedPerson, savedState, seedState } from './harness.jsx';

const TODAY = toISODate(new Date());
const goal = (id, title, progress = 10) => ({ id, personId: null, category: 'relationship', type: 'learn', title, description: '', progress, history: [] });

async function startLog(user, names) {
  await user.click(document.querySelector('.fab-btn'));
  await user.click(within(dialog('What are you logging?')).getByRole('button', { name: /^Interaction/ }));
  await user.click(within(dialog('What did you do?')).getByRole('button', { name: /Talked/ }));
  const who = dialog('Who was this with?');
  for (const n of names) await user.click(within(who).getByRole('button', { name: new RegExp(n) }));
  await user.click(within(who.closest('.sheet-panel')).getByRole('button', { name: /^Confirm/ }));
  return logDetails();
}
const save = (user, details) => user.click(within(details.closest('.sheet-panel')).getByRole('button', { name: 'Save interaction' }));

describe('P1 progressive "More details" when logging', () => {
  it('stays out of the way: each extra is a chip until you open it', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    const details = await startLog(user, ['Morgan']);
    for (const chip of ['Rate each part', 'Active listening', 'Something new', 'How it felt']) {
      expect(within(details).getByRole('button', { name: new RegExp(chip) })).toBeTruthy();
    }
    expect(screen.queryByRole('radiogroup', { name: 'How deep did it go?' })).toBeNull();
    expect(screen.queryByLabelText('Reflection')).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Asked follow-up questions' })).toBeNull();
  });

  it('saves something new, a dimension rating, which goals moved and a reflection', { timeout: 20000 }, async () => {
    const before = person('Morgan', { goals: [goal('g1', 'Learn more'), goal('g2', 'Spend time together')] });
    seedState({ people: [before] });
    const { user } = renderApp();
    const details = await startLog(user, ['Morgan']);
    await openExtra(user, 'Something new');
    const newInfo = dialog('Something new about Morgan?');
    await user.click(within(newInfo).getByRole('button', { name: /Plans/ }));
    await user.type(within(newInfo).getByLabelText('Something new'), 'Running a marathon in May{Enter}');
    await done(user, 'Something new about Morgan?');
    await openExtra(user, 'Rate each part');
    await user.keyboard('5'); // the first row, depth
    await user.keyboard('{Enter}'); // Done
    await openExtra(user, 'Goals moved');
    await user.click(screen.getByRole('checkbox', { name: /Spend time together/ }));
    await done(user, 'Goals this moved');
    await openExtra(user, 'How it felt');
    await user.type(screen.getByLabelText('Reflection'), 'Felt easy today');
    await done(user, 'How did it feel?');
    expect(within(details).getByRole('button', { name: /Something new, 1 added/ })).toBeTruthy();
    expect(within(details).getByRole('button', { name: /Rate each part, 1 of 6/ })).toBeTruthy();
    expect(within(details).getByRole('button', { name: /Goals moved, 1 of 2/ })).toBeTruthy();
    expect(within(details).getByRole('button', { name: /How it felt, written/ })).toBeTruthy();
    await save(user, details);

    const morgan = savedPerson('Morgan');
    expect(morgan.plans.map(p => p.text)).toEqual(['Running a marathon in May']);
    expect(morgan.dims.depth - before.dims.depth).toBe(Math.round(5 * 2.2)); // grows by its rating, not "How meaningful"
    expect(morgan.goals.find(g => g.id === 'g1').progress).toBeGreaterThan(10);
    expect(morgan.goals.find(g => g.id === 'g2').progress).toBe(10); // unticked: didn't move
    expect(morgan.lastChange.why).toContain('You rated it: Depth 5');
    const entry = savedState().journal[0];
    expect(entry).toMatchObject({ reflection: 'Felt easy today', ratings: { depth: 5 }, added: ['Running a marathon in May'] });
  });

  it('shows the reflection in the journal, and finds it by search', async () => {
    const morgan = person('Morgan');
    seedState({ people: [morgan], journal: [{ id: 'j1', personId: morgan.id, at: TODAY, type: 'talked', meaningfulness: 3, added: [], activeListening: [], reflection: 'Felt easy today', standouts: ['depth'] }] });
    const { user } = renderApp();
    await user.click(nav('Journal'));
    expect(screen.getByText('“Felt easy today”')).toBeTruthy();
    expect(screen.getByText(/Went deeper/)).toBeTruthy();
    await user.type(screen.getByPlaceholderText('Search the journal...'), 'easy');
    expect(screen.getByText('“Felt easy today”')).toBeTruthy();
  });
});

describe('P2 journal editing and filters', () => {
  function seedJournal() {
    const morgan = person('Morgan', { layer: 1 });
    const riley = person('Riley', { layer: 3 });
    const entry = (id, who, at, summary) => ({ id, personId: who.id, at, type: 'talked', meaningfulness: 3, added: [], activeListening: [], summary });
    const threeWeeksAgo = new Date(); threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 20);
    seedState({ people: [morgan, riley], journal: [entry('j1', morgan, TODAY, 'Coffee with Morgan'), entry('j2', riley, toISODate(threeWeeksAgo), 'Walk with Riley')] });
  }

  it('edits an entry: note, type, meaningfulness and reflection', async () => {
    seedJournal();
    const { user } = renderApp();
    await user.click(nav('Journal'));
    await user.click(screen.getByRole('button', { name: /Edit entry: Morgan/ }));
    const sheet = dialog('Edit entry');
    await user.clear(within(sheet).getByLabelText('Note'));
    await user.type(within(sheet).getByLabelText('Note'), 'Long lunch with Morgan');
    await user.click(within(sheet).getByRole('button', { name: /Hung out/ }));
    await user.click(within(sheet).getByRole('button', { name: '5' }));
    await user.type(within(sheet).getByLabelText('Reflection'), 'Really relaxed');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(savedState().journal.find(j => j.id === 'j1')).toMatchObject({ summary: 'Long lunch with Morgan', type: 'hangout', meaningfulness: 5, reflection: 'Really relaxed', at: TODAY });
    expect(screen.getByText('Long lunch with Morgan')).toBeTruthy();
  });

  it('deletes an entry only after confirming', async () => {
    seedJournal();
    const { user } = renderApp();
    await user.click(nav('Journal'));
    await user.click(screen.getByRole('button', { name: /Edit entry: Riley/ }));
    await user.click(screen.getByRole('button', { name: /Delete this entry/ }));
    await user.click(screen.getByRole('button', { name: 'Delete entry' }));
    expect(savedState().journal.map(j => j.id)).toEqual(['j1']);
    expect(screen.queryByText('Walk with Riley')).toBeNull();
  });

  it('filters by period and by type, and clears them', async () => {
    seedJournal();
    const { user } = renderApp();
    await user.click(nav('Journal'));
    await user.click(screen.getByRole('button', { name: 'Past week' }));
    expect(screen.getByText('Coffee with Morgan')).toBeTruthy();
    expect(screen.queryByText('Walk with Riley')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Any time' }));
    await user.click(screen.getByRole('button', { name: 'Hung out' }));
    expect(screen.queryByText('Coffee with Morgan')).toBeNull();
    expect(screen.queryByText('Walk with Riley')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Talked' }));
    expect(screen.getByText('Coffee with Morgan')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Clear filters/ }));
    expect(screen.getByText('Coffee with Morgan')).toBeTruthy();
    expect(screen.getByText('Walk with Riley')).toBeTruthy();
  });
});

describe('P4 sample people', () => {
  it('removes only the samples, keeping people you added', async () => {
    const { user } = renderApp();
    await user.type(screen.getByLabelText('Your name'), 'Sam');
    await user.click(screen.getByRole('button', { name: 'Explore with example people first' }));
    await user.keyboard('{Control>}{Shift>}a{/Shift}{/Control}');
    await user.type(screen.getByPlaceholderText('Their name'), 'Morgan');
    await user.click(screen.getByRole('button', { name: 'Add to my circle' }));
    await user.click(nav('Me'));
    await user.click(screen.getByRole('button', { name: 'Remove sample people' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Remove the sample people?' });
    expect(confirm.textContent).toContain('Alex, Jamie, Priya, Noah and Sam');
    expect(confirm.textContent).toContain('go back to 0%');
    await user.click(within(confirm).getByRole('button', { name: 'Remove samples' }));
    const s = savedState();
    expect(s.people.map(p => p.name)).toEqual(['Morgan']);
    expect(s.journal).toEqual([]);
    expect(s.generalGoals).toEqual([]);
    expect(Object.values(s.skills).every(k => k.current === 0)).toBe(true);
    expect(screen.queryByRole('button', { name: 'Remove sample people' })).toBeNull();
  });

  it('adds the samples alongside your own, once', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.click(nav('Me'));
    await user.click(screen.getByRole('button', { name: 'Add sample people' }));
    await user.click(screen.getByRole('button', { name: 'Add samples' }));
    const names = savedState().people.map(p => p.name);
    expect(names).toEqual(['Morgan', 'Alex', 'Jamie', 'Priya', 'Noah', 'Sam']);
    expect(savedState().skills.activeListening.current).toBeGreaterThan(0); // example levels, since none were tracked
    expect(screen.queryByRole('button', { name: 'Add sample people' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove sample people' })).toBeTruthy();
  });

  it("keeps skills you've tracked when adding the samples", async () => {
    const skills = { activeListening: { label: 'Active listening', current: 7, history: [] }, followUp: { label: 'Follow-up questions', current: 0, history: [] }, reciprocity: { label: 'Reciprocity', current: 0, history: [] }, selfDisclosure: { label: 'Self-disclosure', current: 0, history: [] }, readingCues: { label: 'Reading conversational cues', current: 0, history: [] }, knowingWhenToStop: { label: 'Knowing when to stop', current: 0, history: [] } };
    seedState({ skills });
    const { user } = renderApp();
    await user.click(nav('Me'));
    await user.click(screen.getByRole('button', { name: 'Add sample people' }));
    await user.click(screen.getByRole('button', { name: 'Add samples' }));
    expect(savedState().skills.activeListening.current).toBe(7);
  });
});

describe('P6 smarter reminders', () => {
  const now = new Date();
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };

  it('shows a weekly reminder ahead of its day, and marking a one-off done hides it', async () => {
    const tomorrow = inDays(1);
    seedState({ events: [
      { id: 'w', title: 'Football practice', kind: 'recurring', weekdays: [tomorrow.getDay()], time: 1080, personIds: [] },
      { id: 'o', title: 'Book dentist', kind: 'oneoff', date: TODAY, time: 600, personIds: [] },
    ] });
    const { user } = renderApp();
    expect(screen.getByText('Football practice').closest('button').textContent).toContain('Tomorrow');
    await user.click(screen.getByText('Book dentist'));
    await user.click(screen.getByRole('button', { name: 'Mark done' }));
    expect(screen.queryByText('Book dentist')).toBeNull();
    expect(savedState().events.find(e => e.id === 'o').doneAt).toBe(TODAY);
    await user.click(screen.getByRole('button', { name: 'Manage' }));
    expect(screen.getByText(/\(done\)/)).toBeTruthy();
  });

  it('logging a reminder linked to a goal moves only that goal, and marks it done', async () => {
    const morgan = person('Morgan', { goals: [goal('g1', 'Learn more'), goal('g2', 'Spend time together')] });
    seedState({ people: [morgan], events: [{ id: 'o', title: 'Lunch with Morgan', kind: 'oneoff', date: TODAY, time: 720, personIds: [morgan.id], goalId: 'g2' }] });
    const { user } = renderApp();
    expect(screen.getByText('Goal: Spend time together')).toBeTruthy();
    await user.click(screen.getByText('Lunch with Morgan'));
    await user.click(screen.getByRole('button', { name: 'Log this now' }));
    const goals = savedPerson('Morgan').goals;
    expect(goals.find(g => g.id === 'g1').progress).toBe(10);
    expect(goals.find(g => g.id === 'g2').progress).toBeGreaterThan(10);
    expect(savedState().events[0].doneAt).toBe(TODAY);
  });

  it('a temporary detail gets a "remind me to follow up" bell', async () => {
    seedState({ people: [person('Morgan', { important: [{ id: 'i1', emoji: '🔔', text: 'Job interview', at: TODAY, temporary: true, archived: false }] })] });
    const { user } = renderApp();
    await user.click(nav('People'));
    await user.click(screen.getAllByRole('button', { name: /Morgan/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Remind me to ask about "Job interview"' }));
    expect(savedState().events[0]).toMatchObject({ title: 'Ask Morgan how "Job interview" went', kind: 'oneoff', date: toISODate(inDays(3)), time: 540 });
  });

  it('notifies at the reminder time, once, unless turned off', async () => {
    const shown = [];
    class FakeNotification { constructor(title, opts) { shown.push([title, opts.body]); } }
    FakeNotification.permission = 'granted';
    globalThis.Notification = FakeNotification;
    try {
      const morgan = person('Morgan');
      const event = { id: 'w', title: 'Call Morgan', kind: 'recurring', weekdays: [0, 1, 2, 3, 4, 5, 6], time: minutesNow, personIds: [morgan.id] };
      seedState({ people: [morgan], events: [event] });
      const first = renderApp();
      expect(shown).toContainEqual(['Layers reminder', 'Call Morgan (Morgan)']);
      first.unmount();
      renderApp(); // a relaunch the same day doesn't repeat it
      expect(shown.filter(s => s[0] === 'Layers reminder')).toHaveLength(1);

      window.localStorage.clear();
      shown.length = 0;
      seedState({ people: [morgan], events: [event], profile: { name: 'T', focus: 'mix', reminderNotifications: false } });
      renderApp();
      expect(shown.filter(s => s[0] === 'Layers reminder')).toEqual([]);
    } finally {
      delete globalThis.Notification;
    }
  });

  it('notification switches live in Me', async () => {
    seedState();
    const { user } = renderApp();
    await user.click(nav('Me'));
    const sw = screen.getByRole('switch', { name: /Reminders at their time/ });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    await user.click(sw);
    expect(savedState().profile.reminderNotifications).toBe(false);
  });
});

describe('P7 skills and Me', () => {
  it('edits your name and focus from Me', async () => {
    seedState();
    const { user } = renderApp();
    await user.click(nav('Me'));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const sheet = dialog('Your profile');
    await user.clear(within(sheet).getByLabelText('Your name'));
    await user.type(within(sheet).getByLabelText('Your name'), 'Alexis');
    await user.click(within(sheet).getByRole('button', { name: 'Deepening close relationships' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(savedState().profile).toMatchObject({ name: 'Alexis', focus: 'deepen' });
    expect(screen.getByText('Focusing on deepening close relationships')).toBeTruthy();
  });

  it('records an achievement when you reach it, announces it, and keeps it', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await user.click(nav('Me'));
    expect(screen.getByText('First Meaningful Conversation').parentElement.textContent).toContain('Locked · 0 of 1 conversation');
    await user.click(document.querySelector('.fab-btn'));
    await user.click(within(dialog('What are you logging?')).getByRole('button', { name: /^Interaction/ }));
    await user.click(within(dialog('What did you do?')).getByRole('button', { name: /Talked/ }));
    await user.click(within(dialog('Who was this with?')).getByRole('button', { name: /Morgan/ }));
    await user.click(screen.getByRole('button', { name: /^Confirm/ }));
    await user.click(within(logDetails()).getByRole('button', { name: '4' }));
    await user.click(screen.getByRole('button', { name: 'Save interaction' }));
    expect([...document.querySelectorAll('.toast')].map(t => t.textContent)).toContain('🏅 Achievement unlocked: First Meaningful Conversation');
    expect(savedState().achievements).toEqual({ firstMeaningful: TODAY });
    expect(screen.getByText('First Meaningful Conversation').parentElement.textContent).toMatch(/Unlocked \w{3} \d+/);
  });

  it('records what loaded data already earned without a flood of toasts', () => {
    const morgan = person('Morgan');
    seedState({ people: [morgan], journal: [{ id: 'j1', personId: morgan.id, at: TODAY, type: 'talked', meaningfulness: 5, added: [], activeListening: [] }] });
    renderApp();
    expect(savedState().achievements).toEqual({ firstMeaningful: TODAY });
    expect([...document.querySelectorAll('.toast')].map(t => t.textContent).filter(t => t.includes('Achievement'))).toEqual([]);
  });

  it('moves a skill goal when its skill goes up', async () => {
    seedState({ people: [person('Morgan')], generalGoals: [{ id: 'sg', personId: null, category: 'skill', type: 'followUpQ', title: 'Ask better follow-up questions', description: '', progress: 0, history: [] }] });
    const { user } = renderApp();
    await user.click(document.querySelector('.fab-btn'));
    await user.click(within(dialog('What are you logging?')).getByRole('button', { name: /^Interaction/ }));
    await user.click(within(dialog('What did you do?')).getByRole('button', { name: /Talked/ }));
    await user.click(within(dialog('Who was this with?')).getByRole('button', { name: /Morgan/ }));
    await user.click(screen.getByRole('button', { name: /^Confirm/ }));
    await openExtra(user, 'Active listening');
    await user.click(screen.getByRole('checkbox', { name: 'Asked follow-up questions' }));
    await done(user, 'Did you practise active listening?');
    await user.click(screen.getByRole('button', { name: 'Save interaction' }));
    expect(savedState().generalGoals[0].progress).toBe(20);
  });

  it('"Try this next" follows your focus', async () => {
    seedState({ profile: { name: 'T', focus: 'new' } });
    const { user } = renderApp();
    expect(screen.getByText('Try this next').parentElement.textContent).toContain("Add someone you'd like to get to know better.");
    await user.click(screen.getByRole('button', { name: 'Add a person' }));
    expect(dialog('Add someone new')).toBeTruthy();
  });

  it('"Try this next" for deepening opens your closest relationship', async () => {
    seedState({ profile: { name: 'T', focus: 'deepen' }, people: [person('Morgan', { layer: 1 }), person('Riley', { layer: 3 })] });
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: 'Open Riley' }));
    expect(screen.getByText('Current relationship stage')).toBeTruthy();
    expect(screen.getAllByText('Riley').length).toBeGreaterThan(0);
  });
});

describe('follow-up fixes from the 1.0.28 docs review', () => {
  it("an unticked skill goal stays put even when its skill rises", async () => {
    const skillGoal = { id: 'sg', personId: null, category: 'skill', type: 'followUpQ', title: 'Ask better follow-up questions', description: '', progress: 0, history: [] };
    seedState({ people: [person('Morgan', { goals: [skillGoal] })] });
    const { user } = renderApp();
    const details = await startLog(user, ['Morgan']);
    await openExtra(user, 'Active listening');
    await user.click(screen.getByRole('checkbox', { name: 'Asked follow-up questions' }));
    await done(user, 'Did you practise active listening?');
    await openExtra(user, 'Goals moved');
    await user.click(screen.getByRole('checkbox', { name: /Ask better follow-up questions/ }));
    await done(user, 'Goals this moved');
    await save(user, details);
    expect(savedPerson('Morgan').goals[0].progress).toBe(0);
  });

  it('deleting a goal unlinks reminders from it', async () => {
    const morgan = person('Morgan', { goals: [goal('g1', 'Learn more')] });
    seedState({ people: [morgan], events: [{ id: 'o', title: 'Lunch', kind: 'oneoff', date: TODAY, time: 720, personIds: [morgan.id], goalId: 'g1' }] });
    const { user } = renderApp();
    await user.click(nav('People'));
    await user.click(screen.getAllByRole('button', { name: /Morgan/ })[0]);
    await user.click(screen.getByRole('button', { name: /Delete/ }));
    await user.click(screen.getByRole('button', { name: 'Delete goal' }));
    expect(savedState().events[0].goalId).toBeUndefined();
  });

  it('removing the samples keeps your own achievement dates', async () => {
    const morgan = person('Morgan');
    const samples = await import('../../src/data/seed.js');
    seedState({
      people: [morgan, ...samples.INITIAL_PEOPLE],
      journal: [{ id: 'mine', personId: morgan.id, at: '2026-09-01', type: 'talked', meaningfulness: 5, added: [], activeListening: [] }],
      achievements: { firstMeaningful: '2026-09-01' },
    });
    const { user } = renderApp();
    await user.click(nav('Me'));
    await user.click(screen.getByRole('button', { name: 'Remove sample people' }));
    await user.click(screen.getByRole('button', { name: 'Remove samples' }));
    expect(savedState().achievements).toEqual({ firstMeaningful: '2026-09-01' });
  });
});

describe('Rating the six dimensions while logging', () => {
  const rows = () => ['How deep did it go?', 'How much trust was there?', 'How reciprocal was it?', 'How engaged were you both?', 'How much of an experience did you share?', 'How well did you listen to each other?'];
  const picked = (question) => {
    const checked = within(screen.getByRole('radiogroup', { name: question })).queryAllByRole('radio').find(r => r.getAttribute('aria-checked') === 'true');
    return checked ? Number(checked.textContent) : null;
  };

  it('fills one row per number typed, top to bottom', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await startLog(user, ['Morgan']);
    await openExtra(user, 'Rate each part');
    await user.keyboard('435245');
    expect(rows().map(picked)).toEqual([4, 3, 5, 2, 4, 5]);
  });

  it('Backspace steps back and clears; arrows move without changing', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await startLog(user, ['Morgan']);
    await openExtra(user, 'Rate each part');
    await user.keyboard('43');
    await user.keyboard('{Backspace}');
    expect(rows().slice(0, 3).map(picked)).toEqual([4, null, null]);
    await user.keyboard('2');
    expect(picked('How much trust was there?')).toBe(2);
    await user.keyboard('{ArrowUp}{ArrowUp}5');
    expect(picked('How deep did it go?')).toBe(5);
    expect(picked('How much trust was there?')).toBe(2);
  });

  it('clicking works too, and the next row is highlighted', async () => {
    seedState({ people: [person('Morgan')] });
    const { user } = renderApp();
    await startLog(user, ['Morgan']);
    await openExtra(user, 'Rate each part');
    await user.click(within(screen.getByRole('radiogroup', { name: 'How reciprocal was it?' })).getByRole('radio', { name: '3' }));
    expect(picked('How reciprocal was it?')).toBe(3);
    await user.keyboard('1');
    expect(picked('How engaged were you both?')).toBe(1);
  });

  it('saves the ratings, shows them in the journal, and moves a goal by its dimension', async () => {
    const deeper = { id: 'gd', personId: null, category: 'relationship', type: 'deeper', title: 'Have deeper conversations', description: '', progress: 0, history: [] };
    seedState({ people: [person('Morgan', { goals: [deeper] })] });
    const { user } = renderApp();
    const details = await startLog(user, ['Morgan']);
    await user.click(within(details).getByRole('button', { name: '2' })); // How meaningful: 2
    await openExtra(user, 'Rate each part');
    await user.keyboard('5');
    await user.keyboard('{Enter}');
    await save(user, details);
    expect(savedState().journal[0].ratings).toEqual({ depth: 5 });
    expect(savedPerson('Morgan').goals[0].progress).toBe(Math.round(5 * 3.2)); // by depth 5, not meaningfulness 2
    await user.click(nav('Journal'));
    expect(screen.getByText('Rated: Depth 5')).toBeTruthy();
  });
});

describe('P3 option C: dimensions stay inside the layer', () => {
  it("logging can't push the dimension average past the top of the layer's band", async () => {
    const dims = { depth: 24, trust: 24, reciprocity: 24, interaction: 24, sharedExperiences: 24, listening: 24 };
    seedState({ people: [person('Morgan', { layer: 1, overall: 10, dims })] });
    const { user } = renderApp();
    const details = await startLog(user, ['Morgan']);
    await save(user, details);
    const m = savedPerson('Morgan');
    const avg = Object.values(m.dims).reduce((a, b) => a + b, 0) / 6;
    expect(m.layer).toBe(1);
    expect(Math.round(avg)).toBeLessThanOrEqual(24);
  });

  it('saved data from before is migrated once: dimensions moved into the band, layer and progress kept, with a notice', async () => {
    const legacy = person('Morgan', { layer: 3, overall: 72, dims: { depth: 70, trust: 72, reciprocity: 78, interaction: 84, sharedExperiences: 61, listening: 86 } });
    window.localStorage.setItem('layers-app-state-v1', JSON.stringify({ onboarded: true, profile: { name: 'T', focus: 'mix' }, people: [legacy], journal: [], generalGoals: [], events: [], skills: (await import('../../src/data/seed.js')).EMPTY_SKILLS, theme: 'light' }));
    renderApp();
    const notice = await screen.findByRole('alertdialog', { name: 'Dimensions updated' });
    expect(notice.textContent).toContain('Morgan was adjusted to fit');
    const m = savedPerson('Morgan');
    expect(m).toMatchObject({ layer: 3, overall: 72 });
    const avg = Object.values(m.dims).reduce((a, b) => a + b, 0) / 6;
    expect(Math.round(avg)).toBe(68); // where its 72% sits in Layer 3's band
    expect(savedState().dataVersion).toBe(2);
  });

  it("doesn't migrate twice", () => {
    const legacy = person('Morgan', { layer: 1, overall: 10, dims: { depth: 90, trust: 90, reciprocity: 90, interaction: 90, sharedExperiences: 90, listening: 90 } });
    seedState({ people: [legacy], dataVersion: 2 });
    renderApp();
    expect(screen.queryByRole('alertdialog', { name: 'Dimensions updated' })).toBeNull();
    expect(savedPerson('Morgan').dims.depth).toBe(90);
  });
});
