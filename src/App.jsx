// The root component: owns all app state and every mutation handler, wires
// the Electron bridge and keyboard shortcuts, and lays out the phone frame.
// Screens live in views/, sheets in modals/, logic in lib/; the file map is
// in docs/renderer/app-structure.md.

import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { BottomNav } from './components/BottomNav.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { hasOpenSheet, SheetLayerContext, topSheet } from './components/sheetLayer.js';
import { categoryMeta, getLayer } from './data/constants.js';
import { EMPTY_SKILLS, INITIAL_GENERAL_GOALS, INITIAL_JOURNAL, INITIAL_PEOPLE, INITIAL_SKILLS } from './data/seed.js';
import { backfillJournalDates, backfillPeopleDates, backfillSkillDates, formatAbsoluteDate, pushHistoryPoint, toISODate } from './lib/dates.js';
import { advanceLayer, bumpSkills, chartDay, computeOverall, dimsEqual, makePerson, movePerson, placeOnLayers } from './lib/progress.js';
import { MAX_BACKUP_BYTES, createBackup, validateBackup } from './lib/backup.js';
import { useDailyCheckIn, useToday } from './lib/hooks.js';
import { loadSavedState, persistState } from './lib/storage.js';
import { clamp, uid } from './lib/util.js';
import { AddInfoModal } from './modals/AddInfoModal.jsx';
import { AddPersonModal } from './modals/AddPersonModal.jsx';
import { ConfirmDialog } from './modals/ConfirmDialog.jsx';
import { EditPersonModal } from './modals/EditPersonModal.jsx';
import { GoalModal } from './modals/GoalModal.jsx';
import { LogInteractionModal } from './modals/LogInteractionModal.jsx';
import { QuickAddInterestModal } from './modals/QuickAddInterestModal.jsx';
import { ShortcutsModal } from './modals/ShortcutsModal.jsx';
import { TemplatePickerModal } from './modals/TemplatePickerModal.jsx';
import { COLORS, CSS, THEME_DARK, THEME_LIGHT } from './theme.js';
import { CoachView } from './views/CoachView.jsx';
import { GoalsView } from './views/GoalsView.jsx';
import { HomeView } from './views/HomeView.jsx';
import { JournalView } from './views/JournalView.jsx';
import { MeView } from './views/MeView.jsx';
import { OnboardingView } from './views/OnboardingView.jsx';
import { PeopleView } from './views/PeopleView.jsx';
import { PersonProfile } from './views/PersonProfile.jsx';

// The sample people, goals, journal and skills, dated as of today.
function sampleData() {
  return {
    people: backfillPeopleDates(INITIAL_PEOPLE),
    journal: backfillJournalDates(INITIAL_JOURNAL),
    generalGoals: INITIAL_GENERAL_GOALS,
    skills: backfillSkillDates(INITIAL_SKILLS),
  };
}

// Events can only point at people who exist.
function unlinkMissingPeople(events, people) {
  const ids = new Set(people.map(p => p.id));
  return events.map(e => (e.personIds || []).every(id => ids.has(id)) ? e : { ...e, personIds: (e.personIds || []).filter(id => ids.has(id)) });
}

// Info items from a log. A topic that's already saved gets its "last
// mentioned" day refreshed (and comes out of the archive) instead of being
// added twice.
function addNotes(person, notes, at) {
  const cats = {};
  notes.forEach(n => {
    const list = cats[n.category] || person[n.category] || [];
    const existing = list.find(it => it.text.trim().toLowerCase() === n.text.trim().toLowerCase());
    cats[n.category] = existing
      ? list.map(it => it === existing ? { ...it, at, archived: false } : it)
      : [{ id: uid(), emoji: n.emoji || categoryMeta(n.category).emoji, text: n.text, at, temporary: n.category === 'important', archived: false }, ...list];
  });
  return cats;
}

function LayersApp() {
  // Saved data is checked like an imported backup; see lib/storage.js.
  const [loaded] = useState(() => loadSavedState());
  const saved = loaded.state;
  const [people, setPeople] = useState(() => backfillPeopleDates(saved ? saved.people : INITIAL_PEOPLE));
  const [journal, setJournal] = useState(() => backfillJournalDates(saved ? saved.journal : INITIAL_JOURNAL));
  const [generalGoals, setGeneralGoals] = useState(() => saved ? saved.generalGoals : INITIAL_GENERAL_GOALS);
  const [events, setEvents] = useState(() => saved ? saved.events : []);
  const [skills, setSkills] = useState(() => backfillSkillDates(saved ? saved.skills : INITIAL_SKILLS));
  const [profile, setProfile] = useState(() => (saved && saved.profile) ? saved.profile : { name: '', focus: null });
  const [onboarded, setOnboarded] = useState(() => !!(saved && saved.onboarded));
  const [theme, setTheme] = useState(() => (saved && saved.theme === 'dark') ? 'dark' : 'light');
  const [screen, setScreen] = useState({ name: 'tabs' });
  const [activeTab, setActiveTab] = useState('home');
  const [toasts, setToasts] = useState([]);
  const [coachInit, setCoachInit] = useState({ personId: null, tab: 'prepare' });
  const [updateStatus, setUpdateStatus] = useState(null);
  const hasUpdater = typeof window !== 'undefined' && !!window.layersUpdater;
  const hasSystemBridge = typeof window !== 'undefined' && !!window.layersSystem;
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [appVersion, setAppVersion] = useState(null);

  const [logOpen, setLogOpen] = useState(false);
  const [logDefaultPerson, setLogDefaultPerson] = useState(null);
  const [logInitialStep, setLogInitialStep] = useState(null);
  const [logEditEvent, setLogEditEvent] = useState(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalModalDefaultPerson, setGoalModalDefaultPerson] = useState(null);
  const [goalEditing, setGoalEditing] = useState(null);
  const [addInfoOpen, setAddInfoOpen] = useState(false);
  const [addInfoTarget, setAddInfoTarget] = useState(null);
  const [quickInterestOpen, setQuickInterestOpen] = useState(false);
  const [quickInterestPersonId, setQuickInterestPersonId] = useState(null);
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [standaloneDetailOpen, setStandaloneDetailOpen] = useState(false);
  const [editPersonOpen, setEditPersonOpen] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const [sheetLayer, setSheetLayer] = useState(null);
  const [searchFocus, setSearchFocus] = useState(null);
  const importInputRef = useRef(null);
  const saveFailed = useRef(false);

  function askConfirm(opts) {
    setConfirmState({ ...opts, onConfirm: () => { opts.onConfirm(); setConfirmState(null); }, onCancel: () => setConfirmState(null) });
  }

  useEffect(() => {
    const ok = persistState({ people, journal, generalGoals, events, skills, profile, onboarded, theme });
    // Say so once if saving fails (storage full), rather than silently losing
    // every change after it.
    if (!ok && !saveFailed.current) pushToast("Layers couldn't save your latest changes: storage may be full. Export a backup from Me to keep a copy.");
    saveFailed.current = !ok;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, journal, generalGoals, events, skills, profile, onboarded, theme]);

  // Saved data that couldn't be read, or needed repair, is explained once at
  // startup. A copy of the original is kept either way (lib/storage.js).
  useEffect(() => {
    const problem = loaded.problem;
    if (!problem) return;
    const copy = problem.copyKept
      ? ' A copy of the original was kept on this computer, so nothing is lost for good.'
      : " The original couldn't be copied because storage is full.";
    askConfirm(problem.kind === 'unreadable'
      ? { title: "Your saved data couldn't be read", message: `Layers is starting fresh.${copy} If you have a backup, restore it from Me, Import data.`, confirmLabel: 'OK', hideCancel: true, onConfirm: () => {} }
      : { title: 'Some saved data was repaired', message: `Layers skipped ${problem.warnings.join('; ')}, which couldn't be read.${copy}`, confirmLabel: 'OK', hideCancel: true, onConfirm: () => {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Today" for date-derived labels, and the once-a-day check-in reminder.
  const today = useToday();
  useDailyCheckIn(onboarded, people, journal, today);

  useEffect(() => {
    if (!hasUpdater) return;
    const unsubscribe = window.layersUpdater.onStatus((status) => {
      setUpdateStatus(status);
      if (status.state === 'available') pushToast(`Downloading update v${status.version}...`);
      if (status.state === 'ready') pushToast(`Update v${status.version} ready — restart to install`);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUpdater]);

  function handleCheckForUpdates() {
    if (!hasUpdater) return;
    setUpdateStatus({ state: 'checking' });
    window.layersUpdater.checkForUpdates();
  }
  function handleInstallUpdate() {
    if (hasUpdater) window.layersUpdater.quitAndInstall();
  }

  useEffect(() => {
    if (!hasSystemBridge) return;
    window.layersSystem.getAutoLaunch().then(v => setAutoLaunch(!!v)).catch(() => {});
    if (window.layersSystem.getVersion) window.layersSystem.getVersion().then(v => setAppVersion(v)).catch(() => {});
  }, [hasSystemBridge]);

  // Keep the page and the Electron window background on the theme's paper
  // colour, so nothing flashes white on resize or at the next launch (main.cjs
  // saves the theme for that; index.html paints it before the app loads).
  useEffect(() => {
    document.documentElement.style.background = (theme === 'dark' ? THEME_DARK : THEME_LIGHT).paper;
    if (hasSystemBridge && window.layersSystem.setTheme) window.layersSystem.setTheme(theme);
  }, [theme, hasSystemBridge]);

  function handleToggleAutoLaunch() {
    if (!hasSystemBridge) return;
    const next = !autoLaunch;
    setAutoLaunch(next);
    window.layersSystem.setAutoLaunch(next);
  }

  // "/" switches to People or Journal, then focuses its search box once it
  // has rendered. It used to look for the box before switching, so it did
  // nothing from Home, Coach or Me.
  useEffect(() => {
    if (!searchFocus) return;
    const el = document.getElementById(`${searchFocus.target}-search-input`);
    if (el) el.focus();
  }, [searchFocus]);

  useEffect(() => {
    function onKeyDown(e) {
      // Esc leaves a search box, or closes the top-most sheet or dialog only
      // (a picker opened inside a sheet closes by itself). See sheetLayer.js.
      if (e.key === 'Escape') {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.id === 'people-search-input' || activeEl.id === 'journal-search-input')) { activeEl.blur(); return; }
        const top = topSheet();
        if (top) top.close();
        return;
      }
      // A focused slider or checkbox isn't typing; a text field is.
      const el = document.activeElement;
      const typing = !!el && (el.tagName === 'TEXTAREA' || el.isContentEditable || (el.tagName === 'INPUT' && !['range', 'checkbox', 'radio', 'button', 'submit'].includes(el.type)));
      if (typing || !onboarded || hasOpenSheet()) return;
      // Single-key shortcuts ignore Ctrl/Alt/Win combinations, so Ctrl+N or
      // Alt+D (browser and Windows habits) don't open anything.
      const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
      const ctrlOnly = (e.ctrlKey || e.metaKey) && !e.altKey;

      if (plain && e.key === '?') { e.preventDefault(); setShortcutsOpen(true); return; }
      // 'D' opens Add Detail as a standalone lookup; a pick is copied to the
      // clipboard, since there's no note to add it to outside a log.
      if (plain && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); setStandaloneDetailOpen(true); return; }
      if (plain && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); openLog(null); return; }
      if (ctrlOnly && e.shiftKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        setActiveTab('people'); setScreen({ name: 'tabs' }); setAddPersonOpen(true);
        return;
      }
      if (ctrlOnly && !e.shiftKey && ['1', '2', '3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        const tabs = ['home', 'people', 'coach', 'journal', 'me'];
        switchTab(tabs[Number(e.key) - 1]);
        return;
      }
      if (plain && e.key === '/') {
        e.preventDefault();
        const target = activeTab === 'journal' && screen.name === 'tabs' ? 'journal' : 'people';
        switchTab(target);
        setSearchFocus({ target, at: Date.now() });
        return;
      }
      if (plain && e.key === 'Backspace' && screen.name !== 'tabs') {
        e.preventDefault();
        backToTabs();
        return;
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboarded, activeTab, screen.name]);

  function pushToast(text) {
    const id = uid();
    setToasts(t => [...t, { id, text }]);
    // Longer messages (import errors) stay up long enough to read.
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), Math.max(2600, text.length * 55));
  }

  const selectedPerson = screen.name === 'person' ? people.find(p => p.id === screen.personId) : null;

  function openPerson(id) { setScreen({ name: 'person', personId: id }); }
  function openGoalsOverview() { setScreen({ name: 'goals' }); }
  function backToTabs() { setScreen({ name: 'tabs' }); }
  function switchTab(tab) { setActiveTab(tab); setScreen({ name: 'tabs' }); }
  function openCoach(personId, tab) { setCoachInit({ personId: personId || null, tab: tab || 'prepare' }); setActiveTab('coach'); setScreen({ name: 'tabs' }); }

  // With nobody in your circle the log still opens: "Event" works without
  // people, and "Interaction" explains that it needs someone first.
  function openLog(personId) {
    setLogDefaultPerson(personId || null); setLogInitialStep(null); setLogEditEvent(null); setLogOpen(true);
  }
  function openEventManager() {
    setLogDefaultPerson(null); setLogInitialStep('eventKind'); setLogEditEvent(null); setLogOpen(true);
  }
  function openEditRecurringEvent(ev) {
    setLogDefaultPerson(null); setLogInitialStep('eventForm'); setLogEditEvent(ev); setLogOpen(true);
  }
  function closeLog() { setLogOpen(false); setLogInitialStep(null); setLogEditEvent(null); }

  function handleLogSubmit({ personIds, type, meaningfulness, notes, activeListening, summary, pickedDate }) {
    const pd = pickedDate || new Date();
    const chartAt = toISODate(pd); // the journal entry's day, and "last mentioned" for any notes
    const loggedNames = personIds.map(id => (people.find(p => p.id === id) || {}).name).filter(Boolean);
    const levelUps = [];
    // Worked out from the current people in one pass, so every level-up is
    // known before the toasts below. (They used to be collected inside
    // setPeople updaters, which React may run later, so only the first
    // person's level-up was announced.)
    const nextPeople = people.map(p => {
      if (!personIds.includes(p.id)) return p;
      const depthBump = meaningfulness >= 4 ? Math.round(meaningfulness * 2.6) : Math.round(meaningfulness * 1.3);
      const trustBump = Math.round(meaningfulness * 2.2);
      const reciprocityBump = Math.round(meaningfulness * 1.6 + activeListening.length * 1.5);
      const interactionBump = Math.round(meaningfulness * 2.2);
      const sharedExpBump = (type === 'activity' || type === 'hangout') ? Math.round(meaningfulness * 2.6) : Math.round(meaningfulness * 0.8);
      const listeningBump = Math.round(activeListening.length * 3.5 + (meaningfulness >= 4 ? 2 : 0));
      const newDims = {
        depth: clamp(p.dims.depth + depthBump, 0, 100),
        trust: clamp(p.dims.trust + trustBump, 0, 100),
        reciprocity: clamp(p.dims.reciprocity + reciprocityBump, 0, 100),
        interaction: clamp(p.dims.interaction + interactionBump, 0, 100),
        sharedExperiences: clamp(p.dims.sharedExperiences + sharedExpBump, 0, 100),
        listening: clamp(p.dims.listening + listeningBump, 0, 100),
      };
      // Layer progress moves more slowly than before, and only for
      // interactions you rated 4 or 5 — a brief/low-meaningfulness chat
      // still updates the six quality dimensions above (so specific
      // things you did well are still reflected there), but doesn't
      // nudge the big layer-progress meter on its own.
      const dimBumpAvg = (depthBump + trustBump + reciprocityBump + interactionBump + sharedExpBump + listeningBump) / 6;
      const progressBump = meaningfulness >= 4 ? Math.round(dimBumpAvg * 0.55) : 0;
      const { layer: newLayer, progress: newOverall, leveledUp } = advanceLayer(p.layer, p.overall, progressBump);
      const goalBump = Math.round(meaningfulness * 3.2);
      const newGoals = p.goals.map(g => {
        if (g.progress >= 100) return g;
        const value = clamp(g.progress + goalBump, 0, 100);
        const day = chartDay(g.history, chartAt);
        return { ...g, progress: value, history: pushHistoryPoint(g.history || [], { date: formatAbsoluteDate(new Date(`${day}T00:00:00`)), at: day, value }) };
      });
      const newInterest = notes.some(n => n.category === 'interests' && !(p.interests || []).some(it => it.text.trim().toLowerCase() === n.text.trim().toLowerCase()));
      const why = [];
      if (leveledUp) why.push(`Reached Layer ${newLayer}: ${getLayer(newLayer).name}`);
      if (type === 'activity' || type === 'hangout') why.push('Shared an experience together');
      if (newInterest) why.push('Discovered a shared interest');
      if (activeListening.length >= 2) why.push('Good reciprocal conversation');
      if (meaningfulness >= 4) why.push('Personal experience discussed');
      if (why.length === 0) why.push('Logged a new interaction');
      if (leveledUp) levelUps.push({ name: p.name, layer: newLayer });
      return movePerson(p, { layer: newLayer, overall: newOverall, at: chartAt, why, extra: { dims: newDims, goals: newGoals, ...addNotes(p, notes, chartAt) } });
    });
    setPeople(nextPeople);
    setJournal(prev => [
      ...personIds.map(personId => ({ id: uid(), personId, at: chartAt, type, meaningfulness, added: notes.map(n => n.text), activeListening, ...(summary ? { summary } : {}) })),
      ...prev,
    ]);
    setSkills(prev => bumpSkills(prev, {
      activeListening: activeListening.length,
      followUp: activeListening.includes('followup') ? 2 : 0,
      reciprocity: activeListening.includes('paraphrase') || activeListening.length >= 2 ? 1 : 0,
      selfDisclosure: notes.length > 0 ? 1 : 0,
    }));
    setLogOpen(false);
    const who = loggedNames.length <= 2 ? loggedNames.join(' and ') : `${loggedNames.slice(0, 2).join(', ')} and ${loggedNames.length - 2} other${loggedNames.length - 2 > 1 ? 's' : ''}`;
    pushToast(who ? `Logged time with ${who}` : 'Interaction logged');
    levelUps.forEach(lu => pushToast(`🎉 ${lu.name} moved up to Layer ${lu.layer}: ${getLayer(lu.layer).name}!`));
  }

  function handleCreateEvent({ title, personIds, kind, date, weekdays, time, defaultMeaningfulness }) {
    setEvents(prev => [{ id: uid(), title, personIds, kind, date, weekdays, time, defaultMeaningfulness, createdAt: toISODate(new Date()) }, ...prev]);
    pushToast(kind === 'recurring' ? 'Recurring event saved' : 'Event saved');
  }
  function handleUpdateEvent(eventId, { title, personIds, kind, date, weekdays, time, defaultMeaningfulness }) {
    setEvents(prev => prev.map(e => e.id !== eventId ? e : { ...e, title, personIds, kind, date, weekdays, time, defaultMeaningfulness }));
    pushToast('Event updated');
  }
  function handleDeleteEvent(eventId) {
    const ev = events.find(e => e.id === eventId);
    askConfirm({
      title: 'Delete this event?',
      message: ev ? `"${ev.title}" will be removed for good.` : 'This event will be removed for good.',
      confirmLabel: 'Delete event',
      danger: true,
      onConfirm: () => { setEvents(prev => prev.filter(e => e.id !== eventId)); pushToast('Event deleted'); },
    });
  }

  function updateGoalsFor(personId, updater) {
    if (personId) { setPeople(prev => prev.map(p => p.id !== personId ? p : { ...p, goals: updater(p.goals) })); }
    else { setGeneralGoals(prev => updater(prev)); }
  }

  function openGoalCreate(personId) { setGoalEditing(null); setGoalModalDefaultPerson(personId === undefined ? null : personId); setGoalModalOpen(true); }
  function openGoalEdit(personId, goal) { setGoalEditing({ goal, personId }); setGoalModalDefaultPerson(personId); setGoalModalOpen(true); }
  function closeGoalModal() { setGoalModalOpen(false); setGoalEditing(null); }

  function handleGoalSave(personId, goalData, isEdit) {
    updateGoalsFor(personId, goals => isEdit ? goals.map(g => g.id === goalData.id ? goalData : g) : [...goals, goalData]);
    pushToast(isEdit ? 'Goal updated' : 'Goal added');
    setGoalModalOpen(false); setGoalEditing(null);
  }
  function handleDeleteGoal(personId, goalId, title) {
    askConfirm({
      title: 'Delete this goal?',
      message: title ? `"${title}" will be removed for good.` : 'This goal will be removed for good.',
      confirmLabel: 'Delete goal',
      danger: true,
      onConfirm: () => { updateGoalsFor(personId, goals => goals.filter(g => g.id !== goalId)); pushToast('Goal removed'); },
    });
  }
  function handleBumpGoal(personId, goalId) {
    let completed = false;
    updateGoalsFor(personId, goals => goals.map(g => {
      if (g.id !== goalId) return g;
      const next = clamp(g.progress + 20, 0, 100);
      if (next >= 100 && g.progress < 100) completed = true;
      return { ...g, progress: next, history: pushHistoryPoint(g.history, { date: formatAbsoluteDate(new Date()), at: toISODate(new Date()), value: next }) };
    }));
    pushToast(completed ? 'Goal complete! 🎉' : 'Progress updated');
  }

  function openAddInfo(personId, category) { setAddInfoTarget({ personId, category }); setAddInfoOpen(true); }
  function closeAddInfo() { setAddInfoOpen(false); setAddInfoTarget(null); }
  function openQuickAddInterest(personId) { setQuickInterestPersonId(personId); setQuickInterestOpen(true); }
  function closeQuickAddInterest() { setQuickInterestOpen(false); setQuickInterestPersonId(null); }
  function handleQuickAddInterestSave({ emoji, text }) {
    setPeople(prev => prev.map(p => p.id !== quickInterestPersonId ? p : { ...p, interests: [{ id: uid(), emoji, text, at: toISODate(new Date()), temporary: false, archived: false }, ...p.interests] }));
  }
  function handleAddInfoSave({ emoji, text, temporary }) {
    const { personId, category } = addInfoTarget;
    setPeople(prev => prev.map(p => p.id !== personId ? p : { ...p, [category]: [{ id: uid(), emoji, text, at: toISODate(new Date()), temporary: !!temporary, archived: false }, ...p[category]] }));
    pushToast(`Added to ${categoryMeta(category).label}`);
    setAddInfoOpen(false); setAddInfoTarget(null);
  }
  function handleSaveInfoItem(personId, category, itemId, text) {
    setPeople(prev => prev.map(p => p.id !== personId ? p : { ...p, [category]: p[category].map(it => it.id === itemId ? { ...it, text, at: toISODate(new Date()) } : it) }));
  }
  function handleDeleteInfoItem(personId, category, itemId, text) {
    askConfirm({
      title: 'Delete this?',
      message: text ? `"${text}" will be removed for good.` : 'This will be removed for good.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => { setPeople(prev => prev.map(p => p.id !== personId ? p : { ...p, [category]: p[category].filter(it => it.id !== itemId) })); },
    });
  }
  function handleToggleTemporary(personId, category, itemId) {
    setPeople(prev => prev.map(p => p.id !== personId ? p : { ...p, [category]: p[category].map(it => it.id === itemId ? { ...it, temporary: !it.temporary } : it) }));
  }
  function handleToggleArchive(personId, category, itemId) {
    setPeople(prev => prev.map(p => p.id !== personId ? p : { ...p, [category]: p[category].map(it => it.id === itemId ? { ...it, archived: !it.archived } : it) }));
  }
  function handleApproveInfo(personId, category, text, temporary) {
    const clean = String(text || '').trim();
    if (!clean) return; // an edit cleared to nothing isn't saved as an empty item
    setPeople(prev => prev.map(p => p.id !== personId ? p : { ...p, [category]: [{ id: uid(), emoji: categoryMeta(category).emoji, text: clean, at: toISODate(new Date()), temporary: !!temporary, archived: false }, ...p[category]] }));
    pushToast(`Saved to ${categoryMeta(category).label}`);
  }

  // Adjust maps the dimensions onto the layers absolutely (placeOnLayers).
  // Saving with nothing changed does nothing: it used to re-place the person
  // from dimensions that logging had grown faster than layer progress, which
  // could move them to another layer.
  function handleAdjust(personId, dims) {
    const person = people.find(p => p.id === personId);
    if (!person) return;
    if (dimsEqual(person.dims, dims)) { pushToast('No changes'); return; }
    const { layer, overall } = placeOnLayers(computeOverall(dims));
    const leveledUp = layer > person.layer;
    const why = leveledUp ? [`Reached Layer ${layer}: ${getLayer(layer).name}`, 'You manually adjusted these values'] : ['You manually adjusted these values'];
    setPeople(prev => prev.map(p => p.id !== personId ? p : movePerson(p, { layer, overall, at: toISODate(new Date()), why, extra: { dims } })));
    if (leveledUp) pushToast(`🎉 ${person.name} moved up to Layer ${layer}: ${getLayer(layer).name}!`);
    else if (layer < person.layer) pushToast(`${person.name} moved to Layer ${layer}: ${getLayer(layer).name}`);
    else pushToast('Progress updated');
  }
  function handleClearLevelUpFlag(personId) {
    setPeople(prev => prev.map(p => p.id !== personId ? p : { ...p, justLeveledUp: false }));
  }

  function handleLogFromAnalysis(personId, scenario) {
    const g = scenario.grading;
    const person = people.find(p => p.id === personId);
    if (!person) return;
    const day = toISODate(new Date());
    const depthBump = Math.round(g.depth / 14);
    const trustBump = Math.round(g.overall / 16);
    const reciprocityBump = Math.round(g.reciprocity / 14);
    const interactionBump = 4;
    const sharedExpBump = 2;
    const listeningBump = Math.round(g.activeListening / 14);
    const newDims = {
      depth: clamp(person.dims.depth + depthBump, 0, 100),
      trust: clamp(person.dims.trust + trustBump, 0, 100),
      reciprocity: clamp(person.dims.reciprocity + reciprocityBump, 0, 100),
      interaction: clamp(person.dims.interaction + interactionBump, 0, 100),
      sharedExperiences: clamp(person.dims.sharedExperiences + sharedExpBump, 0, 100),
      listening: clamp(person.dims.listening + listeningBump, 0, 100),
    };
    const dimBumpAvg = (depthBump + trustBump + reciprocityBump + interactionBump + sharedExpBump + listeningBump) / 6;
    const progressBump = g.overall >= 70 ? Math.round(dimBumpAvg * 0.55) : 0;
    const { layer: newLayer, progress: newOverall, leveledUp } = advanceLayer(person.layer, person.overall, progressBump);
    // The review's "Goal progress: +N%" is exactly what's applied (it used to
    // apply a tenth of the overall grade instead).
    const goalBump = typeof g.goalImpact === 'number' ? g.goalImpact : Math.round(g.overall / 10);
    const newGoals = person.goals.map(gl => {
      if (gl.progress >= 100) return gl;
      const value = clamp(gl.progress + goalBump, 0, 100);
      return { ...gl, progress: value, history: pushHistoryPoint(gl.history || [], { date: formatAbsoluteDate(new Date()), at: day, value }) };
    });
    const why = leveledUp ? [`Reached Layer ${newLayer}: ${getLayer(newLayer).name}`, ...scenario.wentWell] : scenario.wentWell;
    setPeople(prev => prev.map(p => p.id !== personId ? p : movePerson(p, { layer: newLayer, overall: newOverall, at: day, why, extra: { dims: newDims, goals: newGoals } })));
    if (leveledUp) pushToast(`🎉 ${person.name} moved up to Layer ${newLayer}: ${getLayer(newLayer).name}!`);
    setJournal(prev => [{ id: uid(), personId, at: day, type: 'analysed', meaningfulness: clamp(Math.round(g.overall / 20), 1, 5), added: [], activeListening: [], analysis: { grading: g, conversationState: scenario.conversationState } }, ...prev]);
    setSkills(prev => bumpSkills(prev, {
      activeListening: Math.round(g.activeListening / 25),
      readingCues: 2,
      reciprocity: Math.round(g.reciprocity / 25),
      knowingWhenToStop: scenario.conversationState === 'windingDown' ? 3 : 0,
    }));
    pushToast(`Logged and updated ${person.name}'s progress`);
  }

  function handleAddPerson({ name, emoji, layer }) {
    const newPerson = makePerson({ name, emoji, layer });
    setPeople(prev => [...prev, newPerson]);
    pushToast(`${name} added to your circle`);
    setAddPersonOpen(false);
  }

  function openEditPerson() { setEditPersonOpen(true); }
  function closeEditPerson() { setEditPersonOpen(false); }
  function handleSavePersonEdit(personId, { name, emoji }) {
    setPeople(prev => prev.map(p => p.id !== personId ? p : { ...p, name, emoji }));
    pushToast('Person updated');
    setEditPersonOpen(false);
  }
  function handleDeletePerson(personId, name) {
    setEditPersonOpen(false);
    askConfirm({
      title: `Remove ${name}?`,
      message: `This deletes ${name}'s profile, goals, saved information, and everything logged about them. This cannot be undone.`,
      confirmLabel: 'Remove person',
      danger: true,
      onConfirm: () => {
        setPeople(prev => prev.filter(p => p.id !== personId));
        setJournal(prev => prev.filter(j => j.personId !== personId));
        setEvents(prev => prev.map(e => (e.personIds || []).includes(personId) ? { ...e, personIds: e.personIds.filter(id => id !== personId) } : e));
        // Coach remembers who it was opened for; it would otherwise reopen on
        // someone who no longer exists.
        setCoachInit(c => c.personId === personId ? { ...c, personId: null } : c);
        setScreen({ name: 'tabs' }); setActiveTab('people');
        pushToast(`${name} was removed`);
      },
    });
  }

  function handleRestoreSample() {
    askConfirm({
      title: 'Restore sample data?',
      message: "This replaces your current people, goals, and journal with the built-in example data. Anything you've added will be lost unless you export it first.",
      confirmLabel: 'Restore samples',
      danger: true,
      onConfirm: () => {
        const sample = sampleData();
        setPeople(sample.people); setJournal(sample.journal); setGeneralGoals(sample.generalGoals); setSkills(sample.skills);
        setEvents(prev => unlinkMissingPeople(prev, sample.people));
        setCoachInit(c => ({ ...c, personId: null }));
        setScreen({ name: 'tabs' }); setActiveTab('home');
        pushToast('Sample data restored');
      },
    });
  }

  function handleStartOver() {
    askConfirm({
      title: 'Delete all your data?',
      message: 'This permanently deletes every person, goal, and journal entry. This cannot be undone unless you export a backup first.',
      confirmLabel: 'Delete everything',
      danger: true,
      onConfirm: () => {
        setPeople([]); setJournal([]); setGeneralGoals([]); setEvents([]); setSkills(EMPTY_SKILLS);
        setCoachInit(c => ({ ...c, personId: null }));
        setScreen({ name: 'tabs' }); setActiveTab('home');
        setOnboarded(false);
      },
    });
  }

  function handleExportData() {
    const data = createBackup({ people, journal, generalGoals, events, skills, profile });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `layers-backup-${toISODate(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    pushToast('Data exported');
  }

  function handleImportClick() { importInputRef.current && importInputRef.current.click(); }
  function handleImportFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) { pushToast("That file is too large to be a Layers backup."); return; }
    const reader = new FileReader();
    reader.onerror = () => pushToast("That file couldn't be read.");
    reader.onload = () => {
      let raw;
      try { raw = JSON.parse(reader.result); } catch (err) { pushToast("That file isn't a Layers backup."); return; }
      // Check everything before anything is replaced: a wrong or damaged
      // file is refused, and damaged records are repaired or skipped.
      const result = validateBackup(raw);
      if (!result.ok) { pushToast(result.error); return; }
      const { data, summary, warnings } = result;
      const from = data.exportedAt ? ` from ${formatAbsoluteDate(new Date(data.exportedAt))}` : '';
      askConfirm({
        title: 'Import this backup?',
        message: `This replaces everything currently in the app with this backup${from}: ${summary.text}.${warnings.length ? ` Some damaged records will be skipped: ${warnings.join('; ')}.` : ''}`,
        confirmLabel: 'Import',
        danger: true,
        onConfirm: () => {
          // Backups from before `at` existed: read their labels as of the export.
          setPeople(backfillPeopleDates(data.people, data.exportedAt));
          setJournal(backfillJournalDates(data.journal, data.exportedAt));
          setGeneralGoals(data.generalGoals);
          setEvents(data.events);
          setSkills(backfillSkillDates(data.skills, data.exportedAt));
          setProfile(data.profile);
          setCoachInit(c => ({ ...c, personId: null }));
          setOnboarded(true);
          setScreen({ name: 'tabs' }); setActiveTab('home');
          pushToast('Backup imported');
        },
      });
    };
    reader.readAsText(file);
  }

  function handleOnboardingComplete({ name, focus, startFresh, newPeople }) {
    setProfile({ name, focus });
    if (startFresh) {
      setPeople((newPeople || []).map(p => makePerson({ name: p.name, emoji: p.emoji, layer: 1 })));
      setJournal([]); setGeneralGoals([]); setSkills(EMPTY_SKILLS);
    } else {
      const sample = sampleData();
      setPeople(sample.people); setJournal(sample.journal); setGeneralGoals(sample.generalGoals); setSkills(sample.skills);
    }
    setOnboarded(true);
    setScreen({ name: 'tabs' }); setActiveTab('home');
  }

  return (
    <SheetLayerContext.Provider value={sheetLayer}>
      <div className={`layers-root${theme === 'dark' ? ' dark' : ''}`} style={{ background: COLORS.paper, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{CSS}</style>
        <div className="app-shell">
          <div className="phone-frame">
            <div className="scroll-area no-scrollbar" style={{ paddingBottom: (!onboarded || screen.name !== 'tabs') ? 30 : 110 }}>
              {/* A crash while rendering a screen shows a way out instead of a blank window. */}
              <ErrorBoundary key={`${onboarded}-${screen.name}-${screen.personId || ''}-${activeTab}`} onHome={() => switchTab('home')}>
                {!onboarded ? (
                  <OnboardingView initialName={profile.name} initialFocus={profile.focus} onComplete={handleOnboardingComplete} />
                ) : (
                  <>
                    {screen.name === 'person' && selectedPerson && (
                      <PersonProfile
                        today={today}
                        person={selectedPerson}
                        journal={journal}
                        onBack={backToTabs}
                        onOpenLog={openLog}
                        onOpenGoalCreate={openGoalCreate}
                        onOpenGoalEdit={openGoalEdit}
                        onDeleteGoal={handleDeleteGoal}
                        onBumpGoal={handleBumpGoal}
                        onOpenAddInfo={openAddInfo}
                        onOpenQuickAddInterest={openQuickAddInterest}
                        onSaveInfo={handleSaveInfoItem}
                        onDeleteInfo={handleDeleteInfoItem}
                        onToggleTemporary={handleToggleTemporary}
                        onToggleArchive={handleToggleArchive}
                        onAdjust={(dims) => handleAdjust(selectedPerson.id, dims)}
                        onOpenCoach={(pid) => openCoach(pid, 'prepare')}
                        onEditPerson={openEditPerson}
                        onClearLevelUpFlag={handleClearLevelUpFlag}
                      />
                    )}
                    {screen.name === 'goals' && (
                      <GoalsView today={today} people={people} generalGoals={generalGoals} onBack={backToTabs} onOpenPerson={openPerson} onOpenGoalCreate={openGoalCreate} onOpenGoalEdit={openGoalEdit} onDeleteGoal={handleDeleteGoal} onBumpGoal={handleBumpGoal} />
                    )}
                    {screen.name === 'tabs' && (
                      <>
                        {activeTab === 'home' && <HomeView today={today} people={people} journal={journal} generalGoals={generalGoals} events={events} profile={profile} onOpenPerson={openPerson} onSwitchTab={switchTab} onOpenGoals={openGoalsOverview} onOpenCoach={(tab) => openCoach(null, tab)} onLogEvent={(ev, meaningfulness, detail) => handleLogSubmit({ personIds: ev.personIds, type: 'other', meaningfulness, notes: [], activeListening: [], summary: detail ? `${ev.title} — ${detail}` : ev.title, pickedDate: new Date() })} onManageEvents={openEventManager} onEditEvent={openEditRecurringEvent} onDeleteEvent={handleDeleteEvent} />}
                        {activeTab === 'people' && <PeopleView people={people} journal={journal} onOpenPerson={openPerson} onAddPerson={() => setAddPersonOpen(true)} />}
                        {activeTab === 'coach' && <CoachView people={people} journal={journal} initialPersonId={coachInit.personId} initialTab={coachInit.tab} onOpenLog={openLog} onApproveInfo={handleApproveInfo} onLogFromAnalysis={handleLogFromAnalysis} onOpenPerson={openPerson} />}
                        {activeTab === 'journal' && <JournalView people={people} journal={journal} onOpenPerson={openPerson} />}
                        {activeTab === 'me' && <MeView people={people} journal={journal} skills={skills} generalGoals={generalGoals} profile={profile} onRestoreSample={handleRestoreSample} onStartOver={handleStartOver} onExport={handleExportData} onImportClick={handleImportClick} hasUpdater={hasUpdater} updateStatus={updateStatus} onCheckForUpdates={handleCheckForUpdates} onInstallUpdate={handleInstallUpdate} theme={theme} onSetTheme={setTheme} hasSystemBridge={hasSystemBridge} autoLaunch={autoLaunch} onToggleAutoLaunch={handleToggleAutoLaunch} onOpenShortcuts={() => setShortcutsOpen(true)} appVersion={appVersion} />}
                      </>
                    )}
                  </>
                )}
              </ErrorBoundary>
            </div>

            {onboarded && screen.name === 'tabs' && (
              <>
                <button className="fab-btn" onClick={() => openLog(null)} aria-label="Log an interaction"><Plus size={26} color="#fff" /></button>
                <BottomNav active={activeTab} onChange={switchTab} />
              </>
            )}

            <div className="toast-stack">
              {toasts.map(t => (<div key={t.id} className="toast">{t.text}</div>))}
            </div>

            <input ref={importInputRef} type="file" accept="application/json" onChange={handleImportFile} style={{ display: 'none' }} />

            {logOpen && <LogInteractionModal people={people} defaultPersonId={logDefaultPerson} events={events} initialStep={logInitialStep} initialEditEvent={logEditEvent} onClose={closeLog} onSubmit={handleLogSubmit} onCreateEvent={handleCreateEvent} onUpdateEvent={handleUpdateEvent} onDeleteEvent={handleDeleteEvent} />}
            {goalModalOpen && <GoalModal people={people} defaultPersonId={goalModalDefaultPerson} editingGoal={goalEditing ? goalEditing.goal : null} editingPersonId={goalEditing ? goalEditing.personId : null} onClose={closeGoalModal} onSave={handleGoalSave} />}
            {addInfoOpen && addInfoTarget && (
              <AddInfoModal personName={(people.find(p => p.id === addInfoTarget.personId) || {}).name} category={addInfoTarget.category} onClose={closeAddInfo} onSave={handleAddInfoSave} />
            )}
            {quickInterestOpen && quickInterestPersonId && (
              <QuickAddInterestModal personName={(people.find(p => p.id === quickInterestPersonId) || {}).name} onClose={closeQuickAddInterest} onSave={handleQuickAddInterestSave} />
            )}
            {addPersonOpen && <AddPersonModal onClose={() => setAddPersonOpen(false)} onSave={handleAddPerson} />}
            {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
            {standaloneDetailOpen && (
              <TemplatePickerModal
                title="Add detail"
                subtitle="Not currently logging anything — picking an item here copies it to your clipboard."
                onClose={() => setStandaloneDetailOpen(false)}
                onPick={(item) => {
                  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(item).catch(() => {});
                  pushToast(`Copied "${item}"`);
                }}
              />
            )}
            {editPersonOpen && selectedPerson && (
              <EditPersonModal person={selectedPerson} onClose={closeEditPerson}
                onSave={(vals) => handleSavePersonEdit(selectedPerson.id, vals)}
                onDelete={() => handleDeletePerson(selectedPerson.id, selectedPerson.name)} />
            )}
            {confirmState && (
              <ConfirmDialog title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} danger={confirmState.danger} hideCancel={confirmState.hideCancel} onConfirm={confirmState.onConfirm} onCancel={confirmState.onCancel} />
            )}
          </div>
          {/* Where every Sheet/ConfirmDialog portals to — see SheetPortal. */}
          <div className="sheet-layer" ref={setSheetLayer} />
        </div>
      </div>
    </SheetLayerContext.Provider>
  );
}

export default LayersApp;
