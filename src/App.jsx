// The root component: owns all app state and every mutation handler, wires
// the Electron bridge and keyboard shortcuts, and lays out the phone frame.
// Screens live in views/, sheets in modals/, logic in lib/; the file map is
// in docs/renderer/app-structure.md.

import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { BottomNav } from './components/BottomNav.jsx';
import { SheetLayerContext } from './components/sheetLayer.js';
import { CATEGORIES, categoryMeta, getLayer } from './data/constants.js';
import { EMPTY_SKILLS, INITIAL_GENERAL_GOALS, INITIAL_JOURNAL, INITIAL_PEOPLE, INITIAL_SKILLS } from './data/seed.js';
import { backfillJournalDates, backfillPeopleDates, formatAbsoluteDate, pushHistoryPoint, toISODate } from './lib/dates.js';
import { advanceLayer, computeOverall, layerForOverall, makePerson } from './lib/progress.js';
import { MAX_BACKUP_BYTES, createBackup, validateBackup } from './lib/backup.js';
import { useDailyCheckIn, useToday } from './lib/hooks.js';
import { loadSaved, persistState } from './lib/storage.js';
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

function LayersApp() {
  const [saved] = useState(() => loadSaved());
  const [people, setPeople] = useState(() => backfillPeopleDates((saved && Array.isArray(saved.people)) ? saved.people : INITIAL_PEOPLE));
  const [journal, setJournal] = useState(() => backfillJournalDates((saved && Array.isArray(saved.journal)) ? saved.journal : INITIAL_JOURNAL));
  const [generalGoals, setGeneralGoals] = useState(() => (saved && Array.isArray(saved.generalGoals)) ? saved.generalGoals : INITIAL_GENERAL_GOALS);
  const [events, setEvents] = useState(() => (saved && Array.isArray(saved.events)) ? saved.events : []);
  const [skills, setSkills] = useState(() => (saved && saved.skills) ? saved.skills : INITIAL_SKILLS);
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
  const importInputRef = useRef(null);

  function askConfirm(opts) {
    setConfirmState({ ...opts, onConfirm: () => { opts.onConfirm(); setConfirmState(null); }, onCancel: () => setConfirmState(null) });
  }

  useEffect(() => {
    persistState({ people, journal, generalGoals, events, skills, profile, onboarded, theme });
  }, [people, journal, generalGoals, events, skills, profile, onboarded, theme]);

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

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.id === 'people-search-input' || activeEl.id === 'journal-search-input')) { activeEl.blur(); return; }
        if (standaloneDetailOpen) { setStandaloneDetailOpen(false); return; }
        if (shortcutsOpen) { setShortcutsOpen(false); return; }
        if (confirmState) { confirmState.onCancel(); return; }
        if (editPersonOpen) { closeEditPerson(); return; }
        if (addPersonOpen) { setAddPersonOpen(false); return; }
        if (addInfoOpen) { closeAddInfo(); return; }
        if (quickInterestOpen) { closeQuickAddInterest(); return; }
        if (goalModalOpen) { closeGoalModal(); return; }
        if (logOpen) { closeLog(); return; }
        return;
      }
      const tag = document.activeElement && document.activeElement.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA';
      const anyModalOpen = !!confirmState || editPersonOpen || addPersonOpen || addInfoOpen || quickInterestOpen || goalModalOpen || logOpen || shortcutsOpen || standaloneDetailOpen;

      // '?' opens the shortcuts reference even while a modal isn't open;
      // still blocked while typing so it doesn't fire mid-sentence.
      if (!typing && onboarded && !anyModalOpen && e.key === '?') {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      // 'D' opens Add Detail as a standalone lookup — no log screen needed.
      // A pick here copies straight to clipboard since there's no note field
      // to append into outside an active logging session.
      if (!typing && onboarded && !anyModalOpen && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        setStandaloneDetailOpen(true);
        return;
      }
      if (typing || !onboarded || anyModalOpen) return;

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        openLog(null);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        setActiveTab('people'); setScreen({ name: 'tabs' }); setAddPersonOpen(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && ['1', '2', '3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        const tabs = ['home', 'people', 'coach', 'journal', 'me'];
        switchTab(tabs[Number(e.key) - 1]);
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        const id = activeTab === 'journal' ? 'journal-search-input' : 'people-search-input';
        const el = document.getElementById(id);
        if (el) { if (activeTab !== 'journal' && activeTab !== 'people') switchTab('people'); el.focus(); }
        return;
      }
      if (e.key === 'Backspace' && screen.name !== 'tabs') {
        e.preventDefault();
        backToTabs();
        return;
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmState, editPersonOpen, addPersonOpen, addInfoOpen, quickInterestOpen, goalModalOpen, logOpen, shortcutsOpen, standaloneDetailOpen, onboarded, activeTab, screen.name]);

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

  function openLog(personId) {
    if (people.length === 0) { pushToast('Add someone in People first'); return; }
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
    const chartDate = formatAbsoluteDate(pd); // for history/goal charts — stays correct forever
    const chartAt = toISODate(pd); // also the `at` of the journal entry and any notes saved
    const loggedNames = personIds.map(id => (people.find(p => p.id === id) || {}).name).filter(Boolean);
    const levelUps = [];
    personIds.forEach(personId => {
      setPeople(prev => prev.map(p => {
        if (p.id !== personId) return p;
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
        const newGoals = p.goals.map(g => g.progress >= 100 ? g : { ...g, progress: clamp(g.progress + goalBump, 0, 100), history: pushHistoryPoint(g.history, { date: chartDate, at: chartAt, value: clamp(g.progress + goalBump, 0, 100) }) });
        const newCats = {};
        CATEGORIES.forEach(c => { newCats[c.key] = p[c.key]; });
        notes.forEach(n => {
          const item = { id: uid(), emoji: categoryMeta(n.category).emoji, text: n.text, at: chartAt, temporary: false, archived: false };
          newCats[n.category] = [item, ...newCats[n.category]];
        });
        const why = [];
        if (leveledUp) why.push(`Reached Layer ${newLayer}: ${getLayer(newLayer).name}`);
        if (type === 'activity' || type === 'hangout') why.push('Shared an experience together');
        if (notes.some(n => n.category === 'interests')) why.push('Discovered a shared interest');
        if (activeListening.length >= 2) why.push('Good reciprocal conversation');
        if (meaningfulness >= 4) why.push('Personal experience discussed');
        if (why.length === 0) why.push('Logged a new interaction');
        if (leveledUp) levelUps.push({ name: p.name, layer: newLayer });
        return { ...p, dims: newDims, overall: newOverall, layer: newLayer, goals: newGoals, ...newCats, justLeveledUp: leveledUp || p.justLeveledUp, lastChange: { before: p.overall, after: newOverall, why }, history: pushHistoryPoint(p.history, { date: chartDate, at: chartAt, value: newOverall }) };
      }));
    });
    setJournal(prev => [
      ...personIds.map(personId => ({ id: uid(), personId, at: chartAt, type, meaningfulness, added: notes.map(n => n.text), activeListening, ...(summary ? { summary } : {}) })),
      ...prev,
    ]);
    setSkills(prev => {
      const next = { ...prev };
      const bump = (key, amt) => { if (amt <= 0) return; next[key] = { ...next[key], current: clamp(next[key].current + amt, 0, 100) }; };
      bump('activeListening', activeListening.length);
      if (activeListening.includes('followup')) bump('followUp', 2);
      if (activeListening.includes('paraphrase') || activeListening.length >= 2) bump('reciprocity', 1);
      if (notes.length > 0) bump('selfDisclosure', 1);
      return next;
    });
    setLogOpen(false);
    const who = loggedNames.length <= 2 ? loggedNames.join(' and ') : `${loggedNames.slice(0, 2).join(', ')} and ${loggedNames.length - 2} other${loggedNames.length - 2 > 1 ? 's' : ''}`;
    pushToast(who ? `Logged time with ${who}` : 'Interaction logged');
    levelUps.forEach(lu => pushToast(`🎉 ${lu.name} moved up to Layer ${lu.layer}: ${getLayer(lu.layer).name}!`));
  }

  function handleCreateEvent({ title, personIds, kind, date, weekdays, time, defaultMeaningfulness }) {
    setEvents(prev => [{ id: uid(), title, personIds, kind, date, weekdays, time, defaultMeaningfulness, createdAt: 'Today' }, ...prev]);
    pushToast(kind === 'recurring' ? 'Recurring event saved' : 'Event saved');
  }
  function handleUpdateEvent(eventId, { title, personIds, kind, date, weekdays, time, defaultMeaningfulness }) {
    setEvents(prev => prev.map(e => e.id !== eventId ? e : { ...e, title, personIds, kind, date, weekdays, time, defaultMeaningfulness }));
    pushToast('Event updated');
  }
  function handleDeleteEvent(eventId) {
    setEvents(prev => prev.filter(e => e.id !== eventId));
    pushToast('Event deleted');
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
    setPeople(prev => prev.map(p => p.id !== personId ? p : { ...p, [category]: [{ id: uid(), emoji: categoryMeta(category).emoji, text, at: toISODate(new Date()), temporary: !!temporary, archived: false }, ...p[category]] }));
    pushToast(`Saved to ${categoryMeta(category).label}`);
  }

  function handleAdjust(personId, dims) {
    let leveledUpInfo = null;
    setPeople(prev => prev.map(p => {
      if (p.id !== personId) return p;
      const avg = computeOverall(dims);
      const newLayer = layerForOverall(avg); // same 0-25/25-50/50-75/75-100 bands as before, spanning all 4 layers
      const bandStart = (newLayer - 1) * 25;
      const newOverall = newLayer >= 4 && avg >= 100 ? 100 : clamp(Math.round(((avg - bandStart) / 25) * 100), 0, 100);
      const leveledUp = newLayer > p.layer;
      if (leveledUp) leveledUpInfo = { name: p.name, layer: newLayer };
      const why = leveledUp ? [`Reached Layer ${newLayer}: ${getLayer(newLayer).name}`, 'You manually adjusted these values'] : ['You manually adjusted these values'];
      return { ...p, dims, overall: newOverall, layer: newLayer, justLeveledUp: leveledUp || p.justLeveledUp, lastChange: { before: p.overall, after: newOverall, why }, history: pushHistoryPoint(p.history, { date: formatAbsoluteDate(new Date()), at: toISODate(new Date()), value: newOverall }) };
    }));
    if (leveledUpInfo) pushToast(`🎉 ${leveledUpInfo.name} moved up to Layer ${leveledUpInfo.layer}: ${getLayer(leveledUpInfo.layer).name}!`);
    else pushToast('Progress updated');
  }
  function handleClearLevelUpFlag(personId) {
    setPeople(prev => prev.map(p => p.id !== personId ? p : { ...p, justLeveledUp: false }));
  }

  function handleLogFromAnalysis(personId, scenario) {
    const g = scenario.grading;
    let leveledUpInfo = null;
    setPeople(prev => prev.map(p => {
      if (p.id !== personId) return p;
      const depthBump = Math.round(g.depth / 14);
      const trustBump = Math.round(g.overall / 16);
      const reciprocityBump = Math.round(g.reciprocity / 14);
      const interactionBump = 4;
      const sharedExpBump = 2;
      const listeningBump = Math.round(g.activeListening / 14);
      const newDims = {
        depth: clamp(p.dims.depth + depthBump, 0, 100),
        trust: clamp(p.dims.trust + trustBump, 0, 100),
        reciprocity: clamp(p.dims.reciprocity + reciprocityBump, 0, 100),
        interaction: clamp(p.dims.interaction + interactionBump, 0, 100),
        sharedExperiences: clamp(p.dims.sharedExperiences + sharedExpBump, 0, 100),
        listening: clamp(p.dims.listening + listeningBump, 0, 100),
      };
      const dimBumpAvg = (depthBump + trustBump + reciprocityBump + interactionBump + sharedExpBump + listeningBump) / 6;
      const progressBump = g.overall >= 70 ? Math.round(dimBumpAvg * 0.55) : 0;
      const { layer: newLayer, progress: newOverall, leveledUp } = advanceLayer(p.layer, p.overall, progressBump);
      const goalBump = Math.round(g.overall / 10);
      const newGoals = p.goals.map(gl => gl.progress >= 100 ? gl : { ...gl, progress: clamp(gl.progress + goalBump, 0, 100), history: pushHistoryPoint(gl.history, { date: formatAbsoluteDate(new Date()), at: toISODate(new Date()), value: clamp(gl.progress + goalBump, 0, 100) }) });
      if (leveledUp) leveledUpInfo = { name: p.name, layer: newLayer };
      const why = leveledUp ? [`Reached Layer ${newLayer}: ${getLayer(newLayer).name}`, ...scenario.wentWell] : scenario.wentWell;
      return { ...p, dims: newDims, overall: newOverall, layer: newLayer, goals: newGoals, justLeveledUp: leveledUp || p.justLeveledUp, lastChange: { before: p.overall, after: newOverall, why }, history: pushHistoryPoint(p.history, { date: formatAbsoluteDate(new Date()), at: toISODate(new Date()), value: newOverall }) };
    }));
    if (leveledUpInfo) pushToast(`🎉 ${leveledUpInfo.name} moved up to Layer ${leveledUpInfo.layer}: ${getLayer(leveledUpInfo.layer).name}!`);
    setJournal(prev => [{ id: uid(), personId, at: toISODate(new Date()), type: 'analysed', meaningfulness: clamp(Math.round(g.overall / 20), 1, 5), added: [], activeListening: [], analysis: { grading: g, conversationState: scenario.conversationState } }, ...prev]);
    setSkills(prev => {
      const next = { ...prev };
      const bump = (key, amt) => { next[key] = { ...next[key], current: clamp(next[key].current + amt, 0, 100) }; };
      bump('activeListening', Math.round(g.activeListening / 25));
      bump('readingCues', 2);
      bump('reciprocity', Math.round(g.reciprocity / 25));
      if (scenario.conversationState === 'windingDown') bump('knowingWhenToStop', 3);
      return next;
    });
    const person = people.find(p => p.id === personId);
    pushToast(person ? `Logged and updated ${person.name}'s progress` : 'Interaction logged');
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
        setPeople(backfillPeopleDates(INITIAL_PEOPLE)); setJournal(backfillJournalDates(INITIAL_JOURNAL)); setGeneralGoals(INITIAL_GENERAL_GOALS); setSkills(INITIAL_SKILLS);
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
    a.download = `layers-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
          setSkills(data.skills);
          setProfile(data.profile);
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
      setPeople(backfillPeopleDates(INITIAL_PEOPLE)); setJournal(backfillJournalDates(INITIAL_JOURNAL)); setGeneralGoals(INITIAL_GENERAL_GOALS); setSkills(INITIAL_SKILLS);
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
                    <GoalsView people={people} generalGoals={generalGoals} onBack={backToTabs} onOpenPerson={openPerson} onOpenGoalCreate={openGoalCreate} onOpenGoalEdit={openGoalEdit} onDeleteGoal={handleDeleteGoal} onBumpGoal={handleBumpGoal} />
                  )}
                  {screen.name === 'tabs' && (
                    <>
                      {activeTab === 'home' && <HomeView today={today} people={people} journal={journal} generalGoals={generalGoals} events={events} profile={profile} onOpenPerson={openPerson} onSwitchTab={switchTab} onOpenGoals={openGoalsOverview} onOpenCoach={(tab) => openCoach(null, tab)} onLogEvent={(ev, meaningfulness, detail) => handleLogSubmit({ personIds: ev.personIds, type: 'other', meaningfulness, notes: [], activeListening: [], summary: detail ? `${ev.title} — ${detail}` : ev.title, pickedDate: new Date() })} onManageEvents={openEventManager} onEditEvent={openEditRecurringEvent} onDeleteEvent={handleDeleteEvent} />}
                      {activeTab === 'people' && <PeopleView people={people} journal={journal} onOpenPerson={openPerson} onAddPerson={() => setAddPersonOpen(true)} />}
                      {activeTab === 'coach' && <CoachView people={people} journal={journal} generalGoals={generalGoals} initialPersonId={coachInit.personId} initialTab={coachInit.tab} onOpenLog={openLog} onApproveInfo={handleApproveInfo} onLogFromAnalysis={handleLogFromAnalysis} onOpenPerson={openPerson} />}
                      {activeTab === 'journal' && <JournalView people={people} journal={journal} onOpenPerson={openPerson} />}
                      {activeTab === 'me' && <MeView people={people} journal={journal} skills={skills} generalGoals={generalGoals} profile={profile} onRestoreSample={handleRestoreSample} onStartOver={handleStartOver} onExport={handleExportData} onImportClick={handleImportClick} hasUpdater={hasUpdater} updateStatus={updateStatus} onCheckForUpdates={handleCheckForUpdates} onInstallUpdate={handleInstallUpdate} theme={theme} onSetTheme={setTheme} hasSystemBridge={hasSystemBridge} autoLaunch={autoLaunch} onToggleAutoLaunch={handleToggleAutoLaunch} onOpenShortcuts={() => setShortcutsOpen(true)} appVersion={appVersion} />}
                    </>
                  )}
                </>
              )}
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
              <ConfirmDialog title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} danger={confirmState.danger} onConfirm={confirmState.onConfirm} onCancel={confirmState.onCancel} />
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
