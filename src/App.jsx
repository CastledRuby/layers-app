// The root component: owns all app state and every mutation handler, wires
// the Electron bridge and keyboard shortcuts, and lays out the phone frame.
// Screens live in views/, sheets in modals/, logic in lib/; the file map is
// in docs/renderer/app-structure.md.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { BottomNav } from './components/BottomNav.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { PageTransition } from './components/PageTransition.jsx';
import { hasOpenSheet, isTyping, SheetLayerContext, topSheet } from './components/sheetLayer.js';
import { ACHIEVEMENTS, ACTIVITY_TEMPLATES, categoryMeta, DIM_LABELS, DIM_ORDER, getLayer, TABS } from './data/constants.js';
import { EMPTY_SKILLS, INITIAL_GENERAL_GOALS, INITIAL_JOURNAL, INITIAL_PEOPLE, INITIAL_SKILLS } from './data/seed.js';
import { backfillJournalDates, backfillPeopleDates, backfillSkillDates, formatAbsoluteDate, formatCalendarDate, formatWeekdays, parseISODay, pushHistoryPoint, toISODate } from './lib/dates.js';
import { achievementProgress, newlyUnlocked } from './lib/achievements.js';
import { advanceLayer, advanceSkillGoals, bumpSkills, chartDay, computeOverall, dimBumps, dimsEqual, goalBumpFor, keepDimsInLayer, makePerson, migrateDimsToLayers, movePerson, placeOnLayers, raisedSkills } from './lib/progress.js';
import { MAX_BACKUP_BYTES, createBackup, validateBackup } from './lib/backup.js';
import { NOTIFY_DEFAULTS, isDoneOn, notifySettings, parseActionUrl, snoozeUntil, templateFor } from './lib/calendar.js';
import { useCalendarNotifications, useDailyBackup, useDailyCheckIn, useSlideAcross, useSystemDark, useToday, useWide } from './lib/hooks.js';
import { followUpEvent, markDone, markMissed } from './lib/reminders.js';
import { DEFAULT_ANALYSIS_MODEL } from './lib/analysis.js';
import { getFeedCache, setFeedCache, getSyncSettings, setSyncSettings, getSnoozes, loadSavedState, persistState, setSnoozes } from './lib/storage.js';
import { clamp, uid } from './lib/util.js';
import { AddInfoModal } from './modals/AddInfoModal.jsx';
import { AddPersonModal } from './modals/AddPersonModal.jsx';
import { ConfirmDialog } from './modals/ConfirmDialog.jsx';
import { EditEntryModal } from './modals/EditEntryModal.jsx';
import { EditPersonModal } from './modals/EditPersonModal.jsx';
import { EditProfileModal } from './modals/EditProfileModal.jsx';
import { EventSheet } from './modals/EventSheet.jsx';
import { GoalModal } from './modals/GoalModal.jsx';
import { KeyDateSheet } from './modals/KeyDateSheet.jsx';
import { LogInteractionModal } from './modals/LogInteractionModal.jsx';
import { PlanSheet } from './modals/PlanSheet.jsx';
import { PhotoFolderSheet } from './modals/PhotoFolderSheet.jsx';
import { createStamper } from './lib/sync.js';
import { SyncError, syncErrorText, syncOnce } from './lib/syncFile.js';
import { SyncSheet } from './modals/SyncSheet.jsx';
import { calendarItems, parseCalendar } from './lib/ics.js';
import { summaryFileName, summaryHtml } from './lib/summary.js';
import { QuickAddInterestModal } from './modals/QuickAddInterestModal.jsx';
import { ShortcutsModal } from './modals/ShortcutsModal.jsx';
import { StartOverSheet } from './modals/StartOverSheet.jsx';
import { DaySheet } from './modals/DaySheet.jsx';
import { JumpSheet } from './modals/JumpSheet.jsx';
import { planFieldsOf } from './lib/sentence.js';
import { TemplatePickerModal } from './modals/TemplatePickerModal.jsx';
import { ChatReviewSheet } from './modals/ChatReviewSheet.jsx';
import { WeekReviewSheet } from './modals/WeekReviewSheet.jsx';
import { COLORS, CSS, THEME_DARK, THEME_LIGHT } from './theme.js';
import { CoachView } from './views/CoachView.jsx';
import { GoalsView } from './views/GoalsView.jsx';
import { JournalView } from './views/JournalView.jsx';
import { MeView } from './views/MeView.jsx';
import { OnboardingView } from './views/OnboardingView.jsx';
import { PeopleView } from './views/PeopleView.jsx';
import { PersonProfile } from './views/PersonProfile.jsx';
import { QuizSheet } from './components/ClosenessQuiz.jsx';
import { TodayView } from './views/TodayView.jsx';

// The sample people, goals, journal and skills, dated as of today.
function sampleData() {
  return {
    people: backfillPeopleDates(INITIAL_PEOPLE),
    journal: backfillJournalDates(INITIAL_JOURNAL),
    generalGoals: INITIAL_GENERAL_GOALS,
    skills: backfillSkillDates(INITIAL_SKILLS),
  };
}

// The sample people, goals and journal entries keep fixed ids ('alex',
// 'gen-goal-1', 'j1', ...), which is how "Remove sample people" finds them
// among your own (whose ids come from uid()).
const SAMPLE_PERSON_IDS = new Set(INITIAL_PEOPLE.map(p => p.id));
const SAMPLE_GOAL_IDS = new Set(INITIAL_GENERAL_GOALS.map(g => g.id));
// Skills loaded with the samples carry month-only chart labels ('Sep').
const skillsCameWithSamples = (skills) => Object.values(skills).some(s => (s.history || []).some(h => /^[A-Za-z]{3}$/.test(String(h.date || ''))));
const allSkillsZero = (skills) => Object.values(skills).every(s => !s.current);
const listNames = (names) => names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

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
  // 'system' follows Windows' light or dark mode; `theme` is what's showing.
  const [themeMode, setThemeMode] = useState(() => (saved && saved.themeMode) || 'system');
  const systemDark = useSystemDark();
  const wide = useWide(); // the desktop layout, 900 px wide or more
  const theme = themeMode === 'system' ? (systemDark ? 'dark' : 'light') : themeMode;
  // { key: 'YYYY-MM-DD' } for each achievement reached; null until worked out.
  const [achievements, setAchievements] = useState(() => (saved && saved.achievements) || null);
  // When each record last changed, and what was deleted, kept in what's saved
  // and in backups for syncing later (lib/sync.js); the state itself is left
  // alone, so Undo and Redo still compare it by reference.
  const [stamper] = useState(() => createStamper((saved && saved.deleted) || []));
  const stamped = () => stamper.stamp({ people, journal, generalGoals, events, profile }, new Date().toISOString());
  const [screen, setScreen] = useState({ name: 'tabs' });
  const [activeTab, setActiveTab] = useState('today');
  // The calendar: the day it shows (null = today) and Day or Month.
  const [selectedDay, setSelectedDay] = useState(null);
  const [calendarMode, setCalendarMode] = useState('day');
  const [planState, setPlanState] = useState(null); // PlanSheet's prefill while it's open
  const [journalGoal, setJournalGoal] = useState('all'); // the Journal's goal filter
  const [journalPerson, setJournalPerson] = useState('all'); // ...its person filter
  const [journalDay, setJournalDay] = useState(null); // ...and a day picked on an activity calendar
  const [weekReview, setWeekReview] = useState(null); // a day in the week WeekReviewSheet shows
  const [eventView, setEventView] = useState(null); // { eventId, day } in EventSheet
  const [dayView, setDayView] = useState(null); // a day open in DaySheet
  const [jumpOpen, setJumpOpen] = useState(false); // Ctrl+K, JumpSheet
  const [keyDateFor, setKeyDateFor] = useState(null); // person id, KeyDateSheet
  const [recheckFor, setRecheckFor] = useState(null); // person id, "Where are we now?" (QuizSheet)
  const [snoozes, setSnoozeList] = useState(() => getSnoozes());
  const [toasts, setToasts] = useState([]); // [{ id, text, undo? }]
  const lastUndo = useRef(null); // the newest toast that can still be undone
  const lastRedo = useRef(null); // after an Undo, while "Undone" shows: what Redo puts back
  const [coachInit, setCoachInit] = useState({ personId: null, tab: 'prepare' });
  const [updateStatus, setUpdateStatus] = useState(null);
  const hasUpdater = typeof window !== 'undefined' && !!window.layersUpdater;
  const hasSystemBridge = typeof window !== 'undefined' && !!window.layersSystem;
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [appVersion, setAppVersion] = useState(null);
  const [shortcutStatus, setShortcutStatus] = useState(null);
  const announcedUpdate = useRef(null);

  const [logOpen, setLogOpen] = useState(false);
  const [logDefaultPerson, setLogDefaultPerson] = useState(null);
  const [logPrefill, setLogPrefill] = useState(null); // logging a plan: see LogInteractionModal
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalModalDefaultPerson, setGoalModalDefaultPerson] = useState(null);
  const [goalEditing, setGoalEditing] = useState(null);
  const [addInfoOpen, setAddInfoOpen] = useState(false);
  const [addInfoTarget, setAddInfoTarget] = useState(null);
  const [quickInterestOpen, setQuickInterestOpen] = useState(false);
  const [quickInterestPersonId, setQuickInterestPersonId] = useState(null);
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [photoFolderOpen, setPhotoFolderOpen] = useState(false); // PhotoFolderSheet
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [startOverOpen, setStartOverOpen] = useState(false);
  const [standaloneDetailOpen, setStandaloneDetailOpen] = useState(false);
  const [reviewEntryId, setReviewEntryId] = useState(null); // an analysed chat's review, from the Journal
  const [editPersonOpen, setEditPersonOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const [sheetLayer, setSheetLayer] = useState(null);
  const [searchFocus, setSearchFocus] = useState(null);
  const importInputRef = useRef(null);
  const scrollRef = useRef(null);
  const saveFailed = useRef(false);
  // Achievements reached by loading data (startup, samples, an import) are
  // recorded without a toast; only ones you reach by using the app announce.
  const quietAchievements = useRef(true);

  function dayWords(day) {
    const label = formatCalendarDate(parseISODay(day));
    return ['Today', 'Tomorrow', 'Yesterday'].includes(label) ? label.toLowerCase() : label;
  }
  function askConfirm(opts) {
    setConfirmState({ ...opts, onConfirm: () => { opts.onConfirm(); setConfirmState(null); }, onAlt: opts.onAlt && (() => { opts.onAlt(); setConfirmState(null); }), onCancel: () => setConfirmState(null) });
  }

  useEffect(() => {
    const ok = persistState({ ...stamped(), skills, onboarded, theme, themeMode, achievements: achievements || {} });
    // Say so once if saving fails (storage full), rather than silently losing
    // every change after it.
    if (!ok && !saveFailed.current) pushToast("Layers couldn't save your latest changes: storage may be full. Export a backup from Me to keep a copy.");
    saveFailed.current = !ok;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, journal, generalGoals, events, skills, profile, onboarded, theme, themeMode, achievements]);

  // Record achievements as they're reached (lib/achievements.js).
  useEffect(() => {
    const quiet = achievements === null || quietAchievements.current || !onboarded;
    quietAchievements.current = false;
    const fresh = newlyUnlocked(achievementProgress(people, journal, skills), achievements);
    if (fresh.length === 0) { if (achievements === null) setAchievements({}); return; }
    const day = toISODate(new Date());
    setAchievements(prev => ({ ...(prev || {}), ...Object.fromEntries(fresh.map(k => [k, day])) }));
    if (!quiet) pushToast(fresh.length === 1 ? `🏅 Achievement unlocked: ${ACHIEVEMENTS.find(a => a.key === fresh[0]).title}` : `🏅 ${fresh.length} achievements unlocked`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, journal, skills, achievements, onboarded]);

  // Saved data that couldn't be read, or needed repair, is explained once at
  // startup. A copy of the original is kept either way (lib/storage.js).
  useEffect(() => {
    const problem = loaded.problem;
    const moved = loaded.migrated || [];
    const migrationNote = moved.length
      ? `Layers now keeps each person's six dimensions in step with their layer, so Adjust shows where they already are. ${listNames(moved)} ${moved.length === 1 ? 'was' : 'were'} adjusted to fit; layers and progress didn't change.`
      : '';
    if (!problem) {
      if (migrationNote) askConfirm({ title: 'Dimensions updated', message: migrationNote, confirmLabel: 'OK', hideCancel: true, onConfirm: () => {} });
      return;
    }
    const copy = problem.copyKept
      ? ' A copy of the original was kept on this computer, so nothing is lost for good.'
      : " The original couldn't be copied because storage is full.";
    askConfirm(problem.kind === 'unreadable'
      ? { title: "Your saved data couldn't be read", message: `Layers is starting fresh.${copy} If you have a backup, restore it from Me, Import data.`, confirmLabel: 'OK', hideCancel: true, onConfirm: () => {} }
      : { title: 'Some saved data was repaired', message: `Layers skipped ${problem.warnings.join('; ')}, which couldn't be read.${copy}${migrationNote ? ` ${migrationNote}` : ''}`, confirmLabel: 'OK', hideCancel: true, onConfirm: () => {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Today" for date-derived labels, and the once-a-day check-in reminder.
  // Both can be turned off in Me > Notifications (stored on the profile).
  const today = useToday();
  useDailyCheckIn(onboarded && profile.checkInNotifications !== false, people, journal, today);
  // What the backups folder holds ({ dir, count, latest }), for Me.
  const [backupInfo, setBackupInfo] = useState(null);
  useEffect(() => {
    if (hasSystemBridge && window.layersSystem.getBackupsInfo) Promise.resolve(window.layersSystem.getBackupsInfo()).then(setBackupInfo).catch(() => {});
  }, [hasSystemBridge]);
  useDailyBackup(onboarded && hasSystemBridge, today,
    () => JSON.stringify(createBackup({ ...stamped(), skills, achievements })),
    setBackupInfo);
  // --- Sync through OneDrive (lib/syncFile.js, electron/sync.cjs) ----------
  // Automatic once it's on: on start, a few seconds after a change, every
  // five minutes, and when the window shows or hides. A sync that brings in
  // changes from another device takes them without stamping them as changed
  // here, and clears Undo (it would undo them too).
  const syncBridge = hasSystemBridge && window.layersSystem.readSyncFiles ? window.layersSystem : null;
  const [syncSettings, setSyncState] = useState(() => getSyncSettings());
  const [syncInfo, setSyncInfo] = useState(null); // { dir, hasFile }
  const [syncSheetOpen, setSyncSheetOpen] = useState(false);
  const syncLocal = useRef(null);
  useEffect(() => { syncLocal.current = () => ({ ...stamped(), skills, achievements: achievements || {} }); });
  const syncRun = useRef({ running: null, again: false, fromSync: false });
  function saveSync(change) {
    setSyncState(s => { const next = { ...s, ...change }; setSyncSettings(next); return next; });
  }
  function applySynced(m) {
    stamper.adopt(m);
    syncRun.current.fromSync = true;
    quietAchievements.current = true;
    setPeople(m.people); setJournal(m.journal); setEvents(m.events); setGeneralGoals(m.generalGoals);
    setProfile(m.profile); setSkills(m.skills); setAchievements(m.achievements);
    lastUndo.current = null; lastRedo.current = null;
    setToasts(t => t.filter(x => !x.undo && !x.redo));
    pushToast('Synced: changes from your other device');
  }
  function runSync(passphrase) {
    const r = syncRun.current;
    if (!syncBridge || !syncLocal.current) return Promise.resolve(null);
    if (r.running) { r.again = true; return r.running; }
    r.running = (async () => {
      try {
        const pass = passphrase || await syncBridge.getSyncPassphrase();
        if (!pass) throw new SyncError('no-passphrase');
        const result = await syncOnce({ bridge: syncBridge, passphrase: pass, local: syncLocal.current() });
        if (result.changed) applySynced(result.merged);
        if (!passphrase) saveSync({ lastSynced: new Date().toISOString(), error: null });
        return null;
      } catch (e) {
        if (!passphrase) saveSync({ error: syncErrorText(e) });
        return e;
      } finally {
        r.running = null;
        if (r.again && !passphrase) { r.again = false; runSync(); }
      }
    })();
    return r.running;
  }
  const syncOn = Boolean(syncBridge && onboarded && syncSettings.on);
  useEffect(() => {
    if (!syncOn) return undefined;
    const first = setTimeout(() => runSync(), 2000);
    const every = setInterval(() => runSync(), 5 * 60 * 1000);
    const onShow = () => runSync();
    document.addEventListener('visibilitychange', onShow);
    return () => { clearTimeout(first); clearInterval(every); document.removeEventListener('visibilitychange', onShow); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncOn]);
  useEffect(() => {
    if (!syncOn) return undefined;
    if (syncRun.current.fromSync) { syncRun.current.fromSync = false; return undefined; }
    const soon = setTimeout(() => runSync(), 5000);
    return () => clearTimeout(soon);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncOn, people, journal, events, generalGoals, profile, skills, achievements]);
  function openSyncSheet() {
    if (!syncBridge) return;
    Promise.resolve(syncBridge.getSyncInfo()).then(info => { setSyncInfo(info); setSyncSheetOpen(true); }).catch(() => {});
  }
  // From SyncSheet: sync once with this passphrase; only if that works is it
  // remembered and sync turned on. Resolves to what went wrong, or null.
  async function handleSyncTurnOn(passphrase) {
    const problem = await runSync(passphrase);
    if (problem) return syncErrorText(problem);
    const kept = await syncBridge.setSyncPassphrase(passphrase);
    if (kept && kept.error) return `Windows couldn't keep the passphrase: ${kept.error}`;
    saveSync({ on: true, lastSynced: new Date().toISOString(), error: null });
    setSyncSheetOpen(false);
    pushToast('Sync is on');
    return null;
  }
  function handleSyncOff() {
    askConfirm({
      title: 'Turn off sync?',
      message: 'This laptop stops syncing and forgets the passphrase. The sync file stays in OneDrive for your other devices, and everything here stays as it is.',
      confirmLabel: 'Turn off',
      onConfirm: () => { Promise.resolve(syncBridge.clearSyncPassphrase()).catch(() => {}); saveSync({ on: false, error: null }); pushToast('Sync is off'); },
    });
  }
  function handleOpenSyncFolder() {
    Promise.resolve(syncBridge.openSyncFolder()).then(r => { if (r && r.error) pushToast(`Couldn't open the sync folder: ${r.error}`); }).catch(() => {});
  }
  useEffect(() => {
    if (syncBridge && syncBridge.getSyncInfo) Promise.resolve(syncBridge.getSyncInfo()).then(setSyncInfo).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Other calendars, read-only (lib/ics.js, electron/feeds.cjs) ---------
  // Fetched on start and every 30 minutes; their events show on Today, the
  // month and in planning's clash warning, marked as from Google, never
  // reminded (Google does that), never saved with your plans or synced.
  const feedBridge = hasSystemBridge && window.layersSystem.fetchFeeds ? window.layersSystem : null;
  const [feeds, setFeeds] = useState([]); // [{ id, name, host }]
  const [feedCache, setFeedCacheState] = useState(() => getFeedCache());
  const feedCacheRef = useRef(feedCache);
  useEffect(() => { feedCacheRef.current = feedCache; });
  function saveFeedCache(c) { setFeedCache(c); setFeedCacheState(c); }
  async function refreshFeeds() {
    if (!feedBridge) return;
    try {
      const list = (await feedBridge.listFeeds()) || [];
      setFeeds(list);
      if (!list.length) { saveFeedCache({ fetchedAt: new Date().toISOString(), items: [], errors: {} }); return; }
      const fetched = (await feedBridge.fetchFeeds()) || [];
      const start = parseISODay(today);
      const day = (n) => toISODate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + n));
      const items = [];
      const errors = {};
      fetched.forEach(feed => {
        if (feed.error) { errors[feed.id] = feed.error; return; }
        try {
          calendarItems(parseCalendar(feed.text), day(-30), day(120)).forEach(it => items.push({ ...it, feedId: feed.id, feedName: feed.name }));
        } catch { errors[feed.id] = "Layers couldn't read that calendar."; }
      });
      // A calendar that couldn't be fetched (offline) keeps what it had.
      const kept = feedCacheRef.current.items.filter(it => errors[it.feedId]);
      saveFeedCache({ fetchedAt: new Date().toISOString(), items: [...items, ...kept], errors });
    } catch { /* tried again in 30 minutes */ }
  }
  useEffect(() => {
    if (!feedBridge || !onboarded) return undefined;
    refreshFeeds();
    const every = setInterval(refreshFeeds, 30 * 60 * 1000);
    return () => clearInterval(every);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboarded, today]);
  // As plans that can't be changed here (source 'google').
  const feedEvents = useMemo(() => feedCache.items.filter(it => feeds.some(f => f.id === it.feedId)).map(it => ({
    id: `g:${it.feedId}:${it.key}`, title: it.title, kind: 'oneoff', date: it.date, time: it.time, allDay: it.allDay, duration: it.duration,
    alert: null, personIds: [], source: 'google', feedName: it.feedName, location: it.location,
  })), [feedCache, feeds]);
  const shownEvents = useMemo(() => (feedEvents.length ? [...events, ...feedEvents] : events), [events, feedEvents]);
  async function handleAddFeed(address) {
    const result = await feedBridge.addFeed(address);
    if (result && result.error) return result.error;
    pushToast(`Showing ${(result && result.feed && result.feed.name) || 'that calendar'}`);
    await refreshFeeds();
    return null;
  }
  function handleRemoveFeed(feed) {
    askConfirm({
      title: `Stop showing ${feed.name}?`,
      message: 'Its events go from Layers, and this laptop forgets its address. Nothing changes in Google Calendar.',
      confirmLabel: 'Stop showing it',
      onConfirm: () => { Promise.resolve(feedBridge.removeFeed(feed.id)).then(() => refreshFeeds()).catch(() => {}); },
    });
  }

  // --- Chat analysis with Claude (lib/analysis.js, electron/analysis.cjs) ---
  const analysisBridge = hasSystemBridge && window.layersSystem.runAnalysis ? window.layersSystem : null;
  const [hasAnalysisKey, setHasAnalysisKey] = useState(false);
  // The Layers chats folder, for chats from your exports (electron/chatfiles.cjs).
  const chatsBridge = hasSystemBridge && window.layersSystem.listChatExports ? window.layersSystem : null;
  // The model chats are analysed with: the cheapest each time Layers starts,
  // and another only while you try it (Coach's model buttons).
  const [analysisModelId, setAnalysisModelId] = useState(DEFAULT_ANALYSIS_MODEL);
  useEffect(() => {
    if (analysisBridge) Promise.resolve(analysisBridge.getAnalysisKeyStatus()).then(s => setHasAnalysisKey(Boolean(s && s.hasKey))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function handleSaveAnalysisKey(key) {
    const result = await analysisBridge.setAnalysisKey(key);
    if (result && result.error) return result.error;
    setHasAnalysisKey(true);
    pushToast('Chat analysis is ready in Coach');
    return null;
  }
  function handleRemoveAnalysisKey() {
    askConfirm({
      title: 'Remove your API key?',
      message: 'This laptop forgets it, and chat analysis stops until you add a key again. Your Anthropic account is unchanged.',
      confirmLabel: 'Remove',
      onConfirm: () => { Promise.resolve(analysisBridge.clearAnalysisKey()).catch(() => {}); setHasAnalysisKey(false); },
    });
  }

  function handleOpenBackups() {
    Promise.resolve(window.layersSystem.openBackupsFolder()).then(r => { if (r && r.error) pushToast(`Couldn't open the backups folder: ${r.error}`); }).catch(() => {});
  }
  useCalendarNotifications({ enabled: onboarded, state: { events, people, generalGoals, journal }, settings: notifySettings(profile), snoozes });

  useEffect(() => {
    if (!hasUpdater) return;
    const unsubscribe = window.layersUpdater.onStatus((status) => {
      setUpdateStatus(status);
      // Each version is announced once, though main.cjs re-checks every few hours.
      const key = `${status.state}:${status.version}`;
      if (announcedUpdate.current === key) return;
      if (status.state === 'available') pushToast(`Downloading update v${status.version}...`);
      if (status.state === 'ready') pushToast(`Update v${status.version} ready — restart to install`);
      if (status.state === 'available-portable') pushToast(`Layers v${status.version} is out. Get it from Me, App updates.`);
      if (['available', 'ready', 'available-portable'].includes(status.state)) announcedUpdate.current = key;
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
  function handleOpenDownloadPage() {
    if (hasUpdater && window.layersUpdater.openDownloadPage) window.layersUpdater.openDownloadPage();
  }

  useEffect(() => {
    if (!hasSystemBridge) return;
    window.layersSystem.getAutoLaunch().then(v => setAutoLaunch(!!v)).catch(() => {});
    if (window.layersSystem.getVersion) window.layersSystem.getVersion().then(v => setAppVersion(v)).catch(() => {});
    if (window.layersSystem.getShortcutStatus) window.layersSystem.getShortcutStatus().then(s => setShortcutStatus(s)).catch(() => {});
  }, [hasSystemBridge]);

  // Keep the page and the Electron window background on the theme's paper
  // colour, so nothing flashes white on resize or at the next launch (main.cjs
  // saves the theme for that; index.html paints it before the app loads).
  useEffect(() => {
    document.documentElement.style.background = (theme === 'dark' ? THEME_DARK : THEME_LIGHT).paper;
    if (hasSystemBridge && window.layersSystem.setTheme) window.layersSystem.setTheme(theme, themeMode);
  }, [theme, themeMode, hasSystemBridge]);

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
        // Typing in a sheet that has keys: Esc leaves the text box first (Sheet.jsx).
        if (isTyping() && activeEl.closest('[data-keys]')) { activeEl.blur(); return; }
        const top = topSheet();
        if (top) top.close();
        return;
      }
      // Ctrl+K opens (or closes) the jump box from anywhere, even over a sheet
      // or while typing.
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K') && onboarded) {
        e.preventDefault();
        setJumpOpen(o => !o);
        markTried('jump');
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
      if (plain && (e.key === 'p' || e.key === 'P')) { e.preventDefault(); openPlan({ day: activeTab === 'today' && screen.name === 'tabs' ? selectedDay || today : today }); return; }
      if (plain && (e.key === 'a' || e.key === 'A') && (activeTab === 'people' || screen.name === 'person')) { e.preventDefault(); setAddPersonOpen(true); return; }
      if (ctrlOnly && e.shiftKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        setActiveTab('people'); setScreen({ name: 'tabs' }); setAddPersonOpen(true);
        return;
      }
      if (ctrlOnly && !e.shiftKey && (e.key === 'z' || e.key === 'Z') && lastUndo.current) {
        e.preventDefault();
        undoToast(lastUndo.current.id, lastUndo.current.undo);
        return;
      }
      if (ctrlOnly && ((!e.shiftKey && (e.key === 'y' || e.key === 'Y')) || (e.shiftKey && (e.key === 'z' || e.key === 'Z'))) && lastRedo.current) {
        e.preventDefault();
        redoToast(lastRedo.current.id, lastRedo.current.redo);
        return;
      }
      if (ctrlOnly && !e.shiftKey && ['1', '2', '3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        switchTab(TABS[Number(e.key) - 1]);
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
  }, [onboarded, activeTab, screen.name, selectedDay, today]);

  // `undo`: a snapshot() from just before the change; the toast then offers
  // Undo (or Ctrl+Z) while it's showing. `redo` (only "Undone" has one)
  // offers Redo (or Ctrl+Y) the same way.
  function pushToast(text, { undo, redo } = {}) {
    const id = uid();
    setToasts(t => [...t, { id, text, undo, redo }]);
    if (undo) { lastUndo.current = { id, undo }; lastRedo.current = null; }
    if (redo) lastRedo.current = { id, redo };
    // Longer messages (import errors) stay up long enough to read, and ones
    // with Undo or Redo long enough to reach it.
    setTimeout(() => {
      setToasts(t => t.filter(x => x.id !== id));
      if (lastUndo.current && lastUndo.current.id === id) lastUndo.current = null;
      if (lastRedo.current && lastRedo.current.id === id) lastRedo.current = null;
    }, undo || redo ? 7000 : Math.max(2600, text.length * 55));
  }
  // Undo puts the saved data back as it was just before a change: people,
  // journal, plans, goals, skills, achievements and your profile. Redo puts
  // back what the Undo took away, if nothing has changed since.
  function snapshot() { return { people, journal, events, generalGoals, skills, achievements, profile }; }
  // The data as it is now, for Undo and Redo pressed in the key handler
  // (which sees the data from when it was set up).
  const liveData = useRef(null);
  useEffect(() => { liveData.current = snapshot(); });
  function restoreData(snap) {
    quietAchievements.current = true;
    setPeople(snap.people); setJournal(snap.journal); setEvents(snap.events); setGeneralGoals(snap.generalGoals);
    setSkills(snap.skills); setAchievements(snap.achievements); setProfile(snap.profile);
  }
  function dropToast(id) { setToasts(t => t.filter(x => x.id !== id)); }
  function undoToast(id, snap) {
    const before = liveData.current || snapshot();
    restoreData(snap);
    dropToast(id);
    if (lastUndo.current && lastUndo.current.id === id) lastUndo.current = null;
    pushToast('Undone', { redo: { data: before, undone: snap } });
  }
  function redoToast(id, redo) {
    const now = liveData.current || snapshot();
    dropToast(id);
    if (lastRedo.current && lastRedo.current.id === id) lastRedo.current = null;
    // Only straight after the Undo: a change since would be lost.
    if (!['people', 'journal', 'events', 'generalGoals', 'skills', 'profile'].every(k => now[k] === redo.undone[k])) { pushToast('Nothing to redo: something changed since'); return; }
    restoreData(redo.data);
    pushToast('Redone', { undo: now });
  }

  const selectedPerson = screen.name === 'person' ? people.find(p => p.id === screen.personId) : null;

  function openPerson(id) { setScreen({ name: 'person', personId: id }); }
  // Today's getting-started list ticks these off: Ctrl+K and the quick-add
  // box, tried at least once (profile.tried).
  function markTried(key) { setProfile(p => (p.tried && p.tried[key] ? p : { ...p, tried: { ...(p.tried || {}), [key]: true } })); }
  function openGoalsOverview() { setScreen({ name: 'goals' }); }
  function backToTabs() { setScreen({ name: 'tabs' }); }
  function switchTab(tab) { setActiveTab(tab); setScreen({ name: 'tabs' }); }
  // A goal's "N logs": the Journal, showing the logs that moved it.
  function showGoalLogs(goalId) { setJournalGoal(goalId); switchTab('journal'); }
  // A day on someone's activity calendar: the Journal, on their logs that day.
  function showDayLogs(personId, day) { setJournalPerson(personId || 'all'); setJournalDay(day); setJournalGoal('all'); switchTab('journal'); }
  // Export summary on a profile: a one-page PDF (lib/summary.js), saved where you pick.
  async function handleExportSummary(personId) {
    const p = people.find(x => x.id === personId);
    if (!p || !hasSystemBridge || !window.layersSystem.exportSummary) return;
    const result = await window.layersSystem.exportSummary(summaryHtml(p, { journal, today }), summaryFileName(p, today));
    if (result && result.saved) pushToast(`Summary saved: ${result.saved.split(/[\\/]/).pop()}`);
    else if (result && result.error) pushToast(`Couldn't save the summary: ${result.error}`);
  }
  // chatKey: a chat from your exports to show opened in Analyse (from the week review).
  function openCoach(personId, tab, chatKey = null) { setCoachInit({ personId: personId || null, tab: tab || 'prepare', chatKey }); setActiveTab('coach'); setScreen({ name: 'tabs' }); }
  // Ctrl+K's row picked (JumpSheet, lib/jump.js). Going somewhere closes the
  // sheets that were open; an action like Dark mode leaves them be.
  function closeSheets() {
    setLogOpen(false); setLogPrefill(null); setPlanState(null); setEventView(null); setDayView(null); setWeekReview(null);
    setKeyDateFor(null); setRecheckFor(null); setGoalModalOpen(false); setAddInfoOpen(false); setQuickInterestOpen(false); setAddPersonOpen(false); setPhotoFolderOpen(false);
    setShortcutsOpen(false); setStartOverOpen(false); setStandaloneDetailOpen(false); setEditPersonOpen(false);
    setEditingEntryId(null); setEditProfileOpen(false);
  }
  function runJump(row, { full = false } = {}) {
    const run = row.run;
    setJumpOpen(false);
    const go = (fn) => { closeSheets(); fn(); };
    if (run.type === 'person') go(() => openPerson(run.id));
    else if (run.type === 'personAction') {
      go(() => ({ open: () => openPerson(run.id), log: () => openLog(run.id), plan: () => openPlan({ personIds: [run.id] }), prepare: () => openCoach(run.id, 'prepare'), recheck: () => { openPerson(run.id); setRecheckFor(run.id); } })[run.action]());
    } else if (run.type === 'plan') go(() => { switchTab('today'); setSelectedDay(run.day === today ? null : run.day); setEventView({ eventId: run.eventId, day: run.day }); });
    else if (run.type === 'tab') go(() => { switchTab(run.tab); if (run.mode) setCalendarMode(run.mode); });
    else if (run.type === 'goals') go(openGoalsOverview);
    else if (run.type === 'review') go(() => setWeekReview(today));
    else if (run.type === 'sentence') go(() => saveSentence(row.sentence, full));
    else if (run.type === 'action') {
      const themes = { light: 'Light mode', dark: 'Dark mode', system: 'Matching Windows' };
      if (themes[run.key]) { setThemeMode(run.key); pushToast(themes[run.key]); return; }
      ({
        log: () => go(() => openLog(null)),
        plan: () => go(() => openPlan({ day: today })),
        addPerson: () => go(() => setAddPersonOpen(true)),
        photos: () => go(() => setPhotoFolderOpen(true)),
        goal: () => go(() => openGoalCreate()),
        export: handleExportData,
        restore: handleImportClick,
        backups: handleOpenBackups,
        updates: handleCheckForUpdates,
        shortcuts: () => go(() => setShortcutsOpen(true)),
        startOver: () => go(() => setStartOverOpen(true)),
      })[run.key]();
    }
  }
  // A plan or log typed as a sentence (lib/sentence.js), from Ctrl+K: saved
  // straight away (with Undo on its message), or with `full` (Ctrl+Enter)
  // opened in its sheet, filled in. A log with no rating yet opens too.
  // From the quick-add box (`quick`), a plan is saved without touching
  // what's open in the window, which may be hidden.
  function saveSentence(r, full, { quick = false } = {}) {
    if (r.kind === 'plan') {
      const fields = planFieldsOf(r, notifySettings(profile).defaultAlert);
      if (full) openPlan({ draft: fields });
      else if (quick) handleSavePlan(fields, null, { quick: true });
      else { switchTab('today'); handleSavePlan(fields, null); }
      return;
    }
    if (!full && r.meaningfulness) {
      handleLogSubmit({ personIds: r.personIds, type: r.type, meaningfulness: r.meaningfulness, notes: [], activeListening: [], summary: r.note || undefined, pickedDate: parseISODay(r.day) });
      return;
    }
    setLogDefaultPerson(null);
    setLogPrefill({ personIds: r.personIds, type: r.type, note: r.note, day: r.day, meaningfulness: r.meaningfulness || undefined });
    setLogOpen(true);
  }
  // The quick-add box (Ctrl+Shift+L, its own window; QuickAdd.jsx) sends
  // what was typed here: "submit" saves it (with Undo), "open" opens it in
  // full, and "undo" takes back the last thing saved.
  const quickAddRef = useRef(null);
  useEffect(() => {
    quickAddRef.current = (msg) => {
      if (!msg) return;
      if (msg.type === 'undo') { if (lastUndo.current) undoToast(lastUndo.current.id, lastUndo.current.undo); return; }
      if (msg.type === 'redo') { if (lastRedo.current) redoToast(lastRedo.current.id, lastRedo.current.redo); return; }
      if (!msg.sentence || !['plan', 'log'].includes(msg.sentence.kind)) return;
      markTried('quick');
      if (msg.type === 'open') { closeSheets(); saveSentence(msg.sentence, true); }
      else if (msg.type === 'submit') saveSentence(msg.sentence, false, { quick: true });
    };
  });
  useEffect(() => {
    const sys = window.layersSystem;
    if (!sys || !sys.onQuickAdd) return undefined;
    return sys.onQuickAdd((msg) => { if (quickAddRef.current) quickAddRef.current(msg); });
  }, []);
  // "Prepare to talk" from Coach tips: off to Coach, closing the day and plan.
  function openPrepare(personId) { setDayView(null); setEventView(null); openCoach(personId, 'prepare'); }

  // With nobody in your circle the log still opens: "Event" works without
  // people, and "Interaction" explains that it needs someone first.
  function openLog(personId) {
    setLogDefaultPerson(personId || null); setLogPrefill(null); setLogOpen(true);
  }
  function closeLog() { setLogOpen(false); setLogPrefill(null); }
  // Log a plan: the quick log opens on its details, filled in, and saving it
  // ticks the plan off for that day.
  function openLogFromEvent(ev, day) {
    const template = templateFor(ev.template);
    setLogDefaultPerson(null);
    setLogPrefill({ eventId: ev.id, day, personIds: ev.personIds || [], type: template ? template.type : 'other', note: ev.title, goalIds: linkedGoalIds(ev) });
    setEventView(null);
    setLogOpen(true);
  }
  // prefill: { day, personIds, template }, { event } to edit one, or
  // { copyOf, day } to plan one again.
  function openPlan(prefill = {}) { setLogOpen(false); setEventView(null); setWeekReview(null); setPlanState(prefill); }

  // From the log sheet. Its optional More details add: `ratings` (a 1-5
  // rating per dimension, each driving that dimension's growth), `goalIds`
  // (only these goals move; undefined means all of each person's active
  // goals) and a `reflection`.
  function handleLogSubmit({ personIds, type, meaningfulness, notes, activeListening, summary, pickedDate, ratings = {}, goalIds, reflection, analysis }) {
    const snap = snapshot();
    const rated = DIM_ORDER.filter(k => ratings[k]);
    const pd = pickedDate || new Date();
    const chartAt = toISODate(pd); // the journal entry's day, and "last mentioned" for any notes
    const loggedNames = personIds.map(id => (people.find(p => p.id === id) || {}).name).filter(Boolean);
    const levelUps = [];
    const nextSkills = bumpSkills(skills, {
      activeListening: activeListening.length,
      followUp: activeListening.includes('followup') ? 2 : 0,
      reciprocity: activeListening.includes('paraphrase') || activeListening.length >= 2 ? 1 : 0,
      selfDisclosure: notes.length > 0 ? 1 : 0,
    });
    const raised = raisedSkills(skills, nextSkills);
    // Worked out from the current people in one pass, so every level-up is
    // known before the toasts below. (They used to be collected inside
    // setPeople updaters, which React may run later, so only the first
    // person's level-up was announced.)
    const nextPeople = people.map(p => {
      if (!personIds.includes(p.id)) return p;
      const bumps = dimBumps({ meaningfulness, ratings, activeListening, type });
      const grown = Object.fromEntries(DIM_ORDER.map(k => [k, clamp(p.dims[k] + bumps[k], 0, 100)]));
      // Layer progress moves more slowly than before, and only for
      // interactions you rated 4 or 5 — a brief/low-meaningfulness chat
      // still updates the six quality dimensions above (so specific
      // things you did well are still reflected there), but doesn't
      // nudge the big layer-progress meter on its own.
      const dimBumpAvg = DIM_ORDER.reduce((s, k) => s + bumps[k], 0) / 6;
      const progressBump = meaningfulness >= 4 ? Math.round(dimBumpAvg * 0.55) : 0;
      const { layer: newLayer, progress: newOverall, leveledUp } = advanceLayer(p.layer, p.overall, progressBump);
      // The dimensions stay inside the (new) layer's band (P3, option C).
      const newDims = keepDimsInLayer(p.dims, grown, newLayer);
      const newGoals = p.goals.map(g => {
        if (g.progress >= 100 || (goalIds && !goalIds.includes(g.id))) return g;
        const value = clamp(g.progress + goalBumpFor(g, meaningfulness, ratings), 0, 100);
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
      if (rated.length) why.push(`You rated it: ${rated.map(k => `${DIM_LABELS[k]} ${ratings[k]}`).join(', ')}`);
      if (why.length === 0) why.push('Logged a new interaction');
      if (leveledUp) levelUps.push({ name: p.name, layer: newLayer });
      return movePerson(p, { layer: newLayer, overall: newOverall, at: chartAt, why, extra: { dims: newDims, goals: advanceSkillGoals(newGoals, raised, undefined, goalIds), ...addNotes(p, notes, chartAt) } });
    });
    // Which of each person's goals this log moved, kept on their entry (the
    // Journal's goal filter, and a goal's "N logs").
    const moved = Object.fromEntries(nextPeople.filter(p => personIds.includes(p.id)).map(p => {
      const before = people.find(x => x.id === p.id);
      return [p.id, p.goals.filter(g => { const was = before.goals.find(x => x.id === g.id); return was && g.progress > was.progress; }).map(g => g.id)];
    }));
    setPeople(nextPeople);
    setGeneralGoals(prev => advanceSkillGoals(prev, raised));
    setJournal(prev => [
      ...personIds.map(personId => ({ id: uid(), personId, at: chartAt, type, meaningfulness, added: notes.map(n => n.text), activeListening, ...(summary ? { summary } : {}), ...(moved[personId] && moved[personId].length ? { goalIds: moved[personId] } : {}), ...(rated.length ? { ratings: Object.fromEntries(rated.map(k => [k, ratings[k]])) } : {}), ...(reflection ? { reflection } : {}), ...(analysis ? { analysis } : {}) })),
      ...prev,
    ]);
    setSkills(nextSkills);
    setLogOpen(false);
    const who = loggedNames.length <= 2 ? loggedNames.join(' and ') : `${loggedNames.slice(0, 2).join(', ')} and ${loggedNames.length - 2} other${loggedNames.length - 2 > 1 ? 's' : ''}`;
    pushToast(who ? `Logged time with ${who}` : 'Interaction logged', { undo: snap });
    levelUps.forEach(lu => pushToast(`🎉 ${lu.name} moved up to Layer ${lu.layer}: ${getLayer(lu.layer).name}!`));
  }

  // From PlanSheet: a new plan, a list of them ("Several days"), or changes to
  // one (editingId). Clearing a field removes it, so an edited plan never
  // keeps a stale goal or start day. With `another` the sheet stays open for
  // the next plan and lists what's been added, so there's no toast or jump.
  // replaceIds: copies of an edited plan that it now repeats over. onlyDay:
  // a repeating plan changed for that day alone, which becomes a one-off of
  // its own while the repeat skips the day.
  function handleSavePlan(fieldsOrList, editingId, { another = false, quick = false, replaceIds = [], onlyDay } = {}) {
    const snap = snapshot();
    const now = new Date().toISOString();
    const tidy = (ev) => { Object.keys(ev).forEach(k => { if (ev[k] === null || ev[k] === undefined) delete ev[k]; }); return ev; };
    const list = Array.isArray(fieldsOrList) ? fieldsOrList : [fieldsOrList];
    const fields = list[0];
    if (editingId && onlyDay) {
      const created = toISODate(new Date());
      setEvents(prev => {
        const ev = prev.find(e => e.id === editingId);
        if (!ev) return prev;
        const day = tidy({ id: uid(), defaultMeaningfulness: ev.defaultMeaningfulness || 3, ...fields, ...(isDoneOn(ev, onlyDay) ? { doneAt: onlyDay } : {}), createdAt: created, updatedAt: now });
        return [day, ...prev.map(e => e.id !== editingId ? e : { ...e, skipDays: [...new Set([...(e.skipDays || []), onlyDay])].sort(), updatedAt: now })];
      });
      pushToast(`Changed for ${dayWords(onlyDay)} only`, { undo: snap });
    } else if (editingId) {
      setEvents(prev => prev.filter(e => !replaceIds.includes(e.id)).map(e => e.id !== editingId ? e : tidy({ ...e, goalId: null, from: null, date: null, weekdays: null, allDay: null, ...fields, updatedAt: now })));
      pushToast(replaceIds.length ? `Plan updated, and ${replaceIds.length === 1 ? 'its copy' : `its ${replaceIds.length} copies`} replaced` : 'Plan updated', { undo: snap });
    } else {
      const created = toISODate(new Date());
      setEvents(prev => [...list.map(f => tidy({ id: uid(), defaultMeaningfulness: 3, ...f, createdAt: created, updatedAt: now })), ...prev]);
      if (!another) pushToast(list.length > 1 ? `${list.length} plans saved` : fields.kind === 'recurring' ? 'Repeating plan saved' : 'Plan saved', { undo: snap });
    }
    if (another || quick) return;
    setPlanState(null);
    if (fields.kind === 'oneoff' && fields.date) setSelectedDay(fields.date === today ? null : fields.date);
  }
  // A notification's Snooze: remind again in 10 or 60 minutes, or tomorrow.
  function handleSnooze(eventId, day, minutes) {
    const ev = events.find(e => e.id === eventId);
    if (!ev) return;
    const at = snoozeUntil(minutes === 'tomorrow' ? 'tomorrow' : Number(minutes) || 10);
    const next = [...getSnoozes().filter(s => !(s.eventId === eventId && s.day === day)), { id: uid(), eventId, day, at }];
    setSnoozes(next);
    setSnoozeList(next);
    pushToast(minutes === 'tomorrow' ? `"${ev.title}" snoozed until tomorrow` : `"${ev.title}" snoozed for ${Number(minutes) >= 60 ? '1 hour' : `${Number(minutes) || 10} minutes`}`);
  }
  // A reminder's linked goal, if it still exists (otherwise every goal moves,
  // as for any other log).
  function linkedGoalIds(ev) {
    return ev.goalId && people.some(p => p.goals.some(g => g.id === ev.goalId)) ? [ev.goalId] : undefined;
  }
  // A rating pressed on "How did it go?" (Casual 2 to Deep 5): a quick log of
  // the plan, made without opening Layers, and the plan ticked off for the day.
  const rated = useRef(new Set()); // plans rated this session, so a repeated press logs once
  function handleRateEvent(ev, day, rating) {
    if (isDoneOn(ev, day) || rated.current.has(`${ev.id}:${day}`)) return;
    rated.current.add(`${ev.id}:${day}`);
    const personIds = (ev.personIds || []).filter(id => people.some(p => p.id === id));
    if (!personIds.length) { handleMarkEventDone(ev.id, day); return; }
    const template = templateFor(ev.template);
    handleLogSubmit({ personIds, type: template ? template.type : 'other', meaningfulness: rating, notes: [], activeListening: [], summary: ev.title, pickedDate: parseISODay(day), goalIds: linkedGoalIds(ev) });
    handleMarkEventDone(ev.id, day, { quiet: true });
  }
  // A one-off is done for good; a weekly reminder for that day only.
  function handleMarkEventDone(eventId, day, { quiet = false } = {}) {
    const snap = snapshot();
    setEvents(prev => prev.map(e => e.id === eventId ? markDone(e, day) : e));
    if (!quiet) pushToast('Marked done', { undo: snap });
  }
  // It didn't happen: no log, and "How did it go?" stops asking (a repeating
  // plan for that day only).
  function handleMarkEventMissed(eventId, day) {
    const snap = snapshot();
    setEvents(prev => prev.map(e => e.id === eventId ? markMissed(e, day) : e));
    pushToast("Noted: it didn't happen", { undo: snap });
  }
  function handleSaveKeyDate(personId, kd) {
    setPeople(prev => prev.map(p => p.id !== personId ? p : { ...p, dates: [...(p.dates || []), { id: uid(), ...kd }] }));
    setKeyDateFor(null);
    pushToast('Date saved to the calendar');
  }
  function handleDeleteKeyDate(personId, dateId) {
    const snap = snapshot();
    setPeople(prev => prev.map(p => p.id !== personId ? p : { ...p, dates: (p.dates || []).filter(d => d.id !== dateId) }));
    pushToast('Date removed', { undo: snap });
  }

  // A notification button, as a layers:// link from main.cjs: mark done,
  // log it, snooze, or open that day (and plan).
  function handleCalendarAction(link) {
    const a = parseActionUrl(link);
    if (!a) return;
    const ev = a.eventId ? events.find(e => e.id === a.eventId) : null;
    const day = a.day || today;
    if (a.action === 'done' && ev) handleMarkEventDone(ev.id, day);
    else if (a.action === 'snooze' && ev) handleSnooze(ev.id, day, a.minutes);
    else if (a.action === 'log' && ev) { switchTab('today'); setSelectedDay(day === today ? null : day); openLogFromEvent(ev, day); }
    else if (a.action === 'rate' && ev) handleRateEvent(ev, day, a.rating || 3);
    else if (a.action === 'review') { switchTab('today'); setWeekReview(a.day || today); }
    else if (a.action === 'plan') {
      // A key date's "Plan something": with that person, on the day (or today, if it's passed).
      const on = day < today ? today : day;
      switchTab('today');
      setSelectedDay(on === today ? null : on);
      openPlan({ day: on, personIds: a.personId && people.some(p => p.id === a.personId) ? [a.personId] : undefined });
    }
    else {
      switchTab('today');
      setSelectedDay(day === today ? null : day);
      if (ev) setEventView({ eventId: ev.id, day });
    }
  }
  const calendarActionRef = useRef(handleCalendarAction);
  useEffect(() => { calendarActionRef.current = handleCalendarAction; });
  useEffect(() => {
    if (!hasSystemBridge || !window.layersSystem.calendarReady) return undefined;
    const off = window.layersSystem.onCalendarAction(link => calendarActionRef.current(link));
    window.layersSystem.calendarReady().then(links => (links || []).forEach(link => calendarActionRef.current(link))).catch(() => {});
    return off;
  }, [hasSystemBridge]);

  // Profile > a temporary detail > bell: "Ask <name> how <it> went" in 3 days.
  function handleRemindFollowUp(personId, item) {
    const person = people.find(p => p.id === personId);
    if (!person) return;
    const ev = followUpEvent(person, item);
    setEvents(prev => [{ id: uid(), ...ev, createdAt: toISODate(new Date()) }, ...prev]);
    pushToast(`Reminder set for ${formatCalendarDate(new Date(`${ev.date}T00:00:00`))}, 9:00 AM`);
  }
  // A repeating plan opened on one of its days (`day`) can lose just that day.
  function handleDeleteEvent(eventId, day) {
    const ev = events.find(e => e.id === eventId);
    const snap = snapshot();
    if (ev && ev.kind === 'recurring' && day) {
      askConfirm({
        title: 'Delete this plan?',
        message: `"${ev.title}" repeats ${formatWeekdays(ev.weekdays || []).replace(/^Every/, 'every')}. Delete it for ${dayWords(day)} only, or every time?`,
        altLabel: `Only ${dayWords(day)}`,
        onAlt: () => {
          setEvents(prev => prev.map(e => e.id !== eventId ? e : { ...e, skipDays: [...new Set([...(e.skipDays || []), day])].sort(), updatedAt: new Date().toISOString() }));
          setEventView(null); setPlanState(null); pushToast(`Deleted for ${dayWords(day)} only`, { undo: snap });
        },
        confirmLabel: 'Every time',
        danger: true,
        onConfirm: () => { setEvents(prev => prev.filter(e => e.id !== eventId)); setEventView(null); setPlanState(null); pushToast('Plan deleted', { undo: snap }); },
      });
      return;
    }
    askConfirm({
      title: 'Delete this plan?',
      message: ev ? `"${ev.title}" will be removed for good${ev.kind === 'recurring' ? ', every time it repeats' : ''}.` : 'This plan will be removed for good.',
      confirmLabel: 'Delete plan',
      danger: true,
      onConfirm: () => { setEvents(prev => prev.filter(e => e.id !== eventId)); setEventView(null); setPlanState(null); pushToast('Plan deleted', { undo: snap }); },
    });
  }

  // Journal entries can be edited or deleted (Journal tab). The record changes;
  // progress the entry already added stays (EditEntryModal says so).
  function handleUpdateEntry(entryId, { at, type, meaningfulness, summary, reflection }) {
    setJournal(prev => prev.map(j => {
      if (j.id !== entryId) return j;
      const next = { ...j, at, type, meaningfulness };
      delete next.date; // a legacy label would no longer match `at`
      if (summary) next.summary = summary; else delete next.summary;
      if (reflection) next.reflection = reflection; else delete next.reflection;
      return next;
    }));
    setEditingEntryId(null);
    pushToast('Entry updated');
  }
  function handleDeleteEntry(entryId) {
    const snap = snapshot();
    askConfirm({
      title: 'Delete this entry?',
      message: "It's removed from the journal for good. Progress it already added stays.",
      confirmLabel: 'Delete entry',
      danger: true,
      onConfirm: () => { setJournal(prev => prev.filter(j => j.id !== entryId)); setEditingEntryId(null); pushToast('Entry deleted', { undo: snap }); },
    });
  }

  function updateGoalsFor(personId, updater) {
    if (personId) { setPeople(prev => prev.map(p => p.id !== personId ? p : { ...p, goals: updater(p.goals) })); }
    else { setGeneralGoals(prev => updater(prev)); }
  }

  function openGoalCreate(personId) { setGoalEditing(null); setGoalModalDefaultPerson(personId === undefined ? null : personId); setGoalModalOpen(true); }
  function openGoalEdit(personId, goal) { setGoalEditing({ goal, personId }); setGoalModalDefaultPerson(personId); setGoalModalOpen(true); }
  function closeGoalModal() { setGoalModalOpen(false); setGoalEditing(null); }

  // "+ New goal" while planning or logging (QuickGoalSheet): the goal is
  // saved at once, and the plan or log it came from picks it.
  function handleQuickGoal(personId, goal) {
    updateGoalsFor(personId, goals => [...goals, goal]);
    pushToast(`Goal added: ${goal.title}`);
  }
  function handleGoalSave(personId, goalData, isEdit) {
    updateGoalsFor(personId, goals => isEdit ? goals.map(g => g.id === goalData.id ? goalData : g) : [...goals, goalData]);
    pushToast(isEdit ? 'Goal updated' : 'Goal added');
    setGoalModalOpen(false); setGoalEditing(null);
  }
  function handleDeleteGoal(personId, goalId, title) {
    const snap = snapshot();
    askConfirm({
      title: 'Delete this goal?',
      message: title ? `"${title}" will be removed for good.` : 'This goal will be removed for good.',
      confirmLabel: 'Delete goal',
      danger: true,
      onConfirm: () => {
        updateGoalsFor(personId, goals => goals.filter(g => g.id !== goalId));
        setEvents(prev => prev.map(e => { if (e.goalId !== goalId) return e; const next = { ...e }; delete next.goalId; return next; }));
        pushToast('Goal removed', { undo: snap });
      },
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
  // "Where are we now?" (the closeness questions again, from a profile or
  // Ctrl+K): moves them where the answers put them. Their dimensions all
  // shift by the same amount, so how they compare stays; Undo puts it back.
  function handleRecheck(personId, placement) {
    setRecheckFor(null);
    const person = people.find(p => p.id === personId);
    if (!person) return;
    const target = (placement.layer - 1) * 25 + (placement.overall === null ? 5 : placement.overall / 4);
    const shift = target - computeOverall(person.dims);
    let dims = Object.fromEntries(DIM_ORDER.map(k => [k, clamp(Math.round(person.dims[k] + shift), 0, 100)]));
    let placed = placeOnLayers(computeOverall(dims));
    if (placed.layer !== placement.layer) {
      dims = Object.fromEntries(DIM_ORDER.map(k => [k, Math.round(target)]));
      placed = placeOnLayers(computeOverall(dims));
    }
    if (placed.layer === person.layer && placed.overall === person.overall) { pushToast(`${person.name} is already there`); return; }
    const snap = snapshot();
    const why = placed.layer > person.layer ? [`Reached Layer ${placed.layer}: ${getLayer(placed.layer).name}`, 'You answered "Where are we now?"'] : ['You answered "Where are we now?"'];
    setPeople(prev => prev.map(p => p.id !== personId ? p : movePerson(p, { layer: placed.layer, overall: placed.overall, at: toISODate(new Date()), why, extra: { dims } })));
    pushToast(`${person.name}: Layer ${placed.layer}, ${placed.overall}%`, { undo: snap });
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
    const keptDims = keepDimsInLayer(person.dims, newDims, newLayer);
    // The review's "Goal progress: +N%" is exactly what's applied (it used to
    // apply a tenth of the overall grade instead).
    const goalBump = typeof g.goalImpact === 'number' ? g.goalImpact : Math.round(g.overall / 10);
    const newGoals = person.goals.map(gl => {
      if (gl.progress >= 100) return gl;
      const value = clamp(gl.progress + goalBump, 0, 100);
      return { ...gl, progress: value, history: pushHistoryPoint(gl.history || [], { date: formatAbsoluteDate(new Date()), at: day, value }) };
    });
    const why = leveledUp ? [`Reached Layer ${newLayer}: ${getLayer(newLayer).name}`, ...scenario.wentWell] : scenario.wentWell;
    const nextSkills = bumpSkills(skills, {
      activeListening: Math.round(g.activeListening / 25),
      readingCues: 2,
      reciprocity: Math.round(g.reciprocity / 25),
      knowingWhenToStop: scenario.conversationState === 'windingDown' ? 3 : 0,
    });
    const raised = raisedSkills(skills, nextSkills);
    setPeople(prev => prev.map(p => p.id !== personId ? p : movePerson(p, { layer: newLayer, overall: newOverall, at: day, why, extra: { dims: keptDims, goals: advanceSkillGoals(newGoals, raised) } })));
    setGeneralGoals(prev => advanceSkillGoals(prev, raised));
    if (leveledUp) pushToast(`🎉 ${person.name} moved up to Layer ${newLayer}: ${getLayer(newLayer).name}!`);
    setJournal(prev => [{ id: uid(), personId, at: day, type: 'analysed', meaningfulness: clamp(Math.round(g.overall / 20), 1, 5), added: [], activeListening: [], analysis: { grading: g, conversationState: scenario.conversationState } }, ...prev]);
    setSkills(nextSkills);
    pushToast(`Logged and updated ${person.name}'s progress`);
  }

  function handleAddPerson({ name, emoji, avatar, layer, overall }) {
    const newPerson = makePerson({ name, emoji, avatar, layer, overall });
    setPeople(prev => [...prev, newPerson]);
    pushToast(`${name} added at Layer ${newPerson.layer}: ${getLayer(newPerson.layer).name}`);
    setAddPersonOpen(false);
  }

  function openEditPerson() { setEditPersonOpen(true); }
  function closeEditPerson() { setEditPersonOpen(false); }
  // Photos from a folder: each picked person's avatar becomes their photo,
  // all with one Undo.
  function handlePhotoFolder(list) {
    const snap = snapshot();
    setPeople(prev => prev.map(p => { const c = list.find(x => x.personId === p.id); return c ? { ...p, avatar: { style: 'photo', src: c.src } } : p; }));
    setPhotoFolderOpen(false);
    const names = list.map(c => (people.find(p => p.id === c.personId) || {}).name).filter(Boolean);
    pushToast(`Photos added for ${names.length <= 2 ? names.join(' and ') : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`}`, { undo: snap });
  }
  function handleSavePersonEdit(personId, { name, aka = [], emoji, avatar }) {
    setPeople(prev => prev.map(p => {
      if (p.id !== personId) return p;
      const next = { ...p, name, emoji };
      const nicknames = [...new Set(aka.map(s => s.trim()).filter(s => s && s.toLowerCase() !== name.toLowerCase()))];
      if (nicknames.length) next.aka = nicknames; else delete next.aka;
      if (avatar) next.avatar = avatar; else delete next.avatar;
      return next;
    }));
    pushToast('Person updated');
    setEditPersonOpen(false);
  }
  function handleDeletePerson(personId, name) {
    const snap = snapshot();
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
        pushToast(`${name} was removed`, { undo: snap });
      },
    });
  }

  // Sample people sit alongside your own: they can be added and removed
  // without touching anyone you added. ("Restore sample data" used to
  // replace everything, and there was no way to remove only the samples,
  // though onboarding promised you could clear them.)
  function handleRemoveSample() {
    const snap = snapshot();
    const names = people.filter(p => SAMPLE_PERSON_IDS.has(p.id)).map(p => p.name);
    const resetSkills = skillsCameWithSamples(skills);
    askConfirm({
      title: 'Remove the sample people?',
      message: `${listNames(names)}, their goals and everything logged with them will be removed. People you added stay.${resetSkills ? ' Your skills started from the example levels, so they go back to 0%.' : ''}`,
      confirmLabel: 'Remove samples',
      danger: true,
      onConfirm: () => {
        const remaining = people.filter(p => !SAMPLE_PERSON_IDS.has(p.id));
        setPeople(remaining);
        setJournal(prev => prev.filter(j => !SAMPLE_PERSON_IDS.has(j.personId)));
        setGeneralGoals(prev => prev.filter(g => !SAMPLE_GOAL_IDS.has(g.id)));
        setEvents(prev => unlinkMissingPeople(prev, remaining));
        if (resetSkills) setSkills(EMPTY_SKILLS);
        // Achievements the samples earned weren't yours: keep the ones your
        // own data still earns, with their original dates.
        const still = achievementProgress(remaining, journal.filter(j => !SAMPLE_PERSON_IDS.has(j.personId)), resetSkills ? EMPTY_SKILLS : skills);
        quietAchievements.current = true;
        setAchievements(prev => Object.fromEntries(Object.entries(prev || {}).filter(([k]) => still[k] && still[k].done)));
        setCoachInit(c => SAMPLE_PERSON_IDS.has(c.personId) ? { ...c, personId: null } : c);
        setScreen({ name: 'tabs' }); setActiveTab('today');
        pushToast('Sample people removed', { undo: snap });
      },
    });
  }

  function handleAddSample() {
    askConfirm({
      title: 'Add the sample people?',
      message: 'Alex, Jamie, Priya, Noah and Sam are added alongside your own people, with some example goals and journal entries. You can remove them again here.',
      confirmLabel: 'Add samples',
      onConfirm: () => {
        const sample = sampleData();
        const added = sample.people.filter(sp => !people.some(p => p.id === sp.id));
        const addedIds = new Set(added.map(p => p.id));
        setPeople(prev => [...prev, ...added]);
        setJournal(prev => [...sample.journal.filter(j => addedIds.has(j.personId) && !prev.some(x => x.id === j.id)), ...prev]);
        setGeneralGoals(prev => [...prev, ...sample.generalGoals.filter(g => !prev.some(x => x.id === g.id))]);
        // Example skill levels only if you haven't tracked any of your own.
        if (allSkillsZero(skills)) setSkills(sample.skills);
        quietAchievements.current = true;
        pushToast('Sample people added');
      },
    });
  }

  // From StartOverSheet: clear the parts picked ({ people, journal, plans,
  // progress, settings }). Clearing people (and so their journal) goes back
  // to the welcome screen to set up again; otherwise you stay in Me.
  // Starting over here never wipes your other devices: what's cleared isn't
  // counted as deleted, and sync turns off on this computer (turning it on
  // again brings their data back).
  function handleStartOver(parts) {
    const snap = snapshot();
    stamper.forget();
    if (syncSettings.on && syncBridge) { Promise.resolve(syncBridge.clearSyncPassphrase()).catch(() => {}); saveSync({ on: false, error: null }); }
    quietAchievements.current = true;
    if (parts.people) { setPeople([]); setCoachInit(c => ({ ...c, personId: null })); }
    if (parts.people || parts.journal) setJournal([]);
    if (parts.plans) { setEvents([]); setSnoozes([]); setSnoozeList([]); }
    else if (parts.people) setEvents(prev => unlinkMissingPeople(prev, []));
    if (parts.progress) { setGeneralGoals([]); setSkills(EMPTY_SKILLS); setAchievements(null); }
    if (parts.settings) { setProfile({ name: '', focus: null }); setThemeMode('system'); }
    setStartOverOpen(false);
    setSelectedDay(null);
    if (parts.people) {
      setScreen({ name: 'tabs' }); setActiveTab('today');
      setOnboarded(false);
      return;
    }
    const names = { journal: 'the journal', plans: 'plans', progress: 'skills and goals', settings: 'settings' };
    pushToast(`Cleared ${listNames(Object.keys(names).filter(k => parts[k]).map(k => names[k]))}`, { undo: snap });
  }

  function handleExportData() {
    const data = createBackup({ ...stamped(), skills, achievements });
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

  function handleImportClick() { if (importInputRef.current) importInputRef.current.click(); }
  function handleImportFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) { pushToast("That file is too large to be a Layers backup."); return; }
    const reader = new FileReader();
    reader.onerror = () => pushToast("That file couldn't be read.");
    reader.onload = () => {
      let raw;
      try { raw = JSON.parse(reader.result); } catch { pushToast("That file isn't a Layers backup."); return; }
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
          stamper.forget(); // what's replaced isn't counted as deleted (lib/sync.js)
          // Backups from before `at` existed: read their labels as of the export.
          setPeople(migrateDimsToLayers(backfillPeopleDates(data.people, data.exportedAt)).people);
          setJournal(backfillJournalDates(data.journal, data.exportedAt));
          setGeneralGoals(data.generalGoals);
          setEvents(data.events);
          setSkills(backfillSkillDates(data.skills, data.exportedAt));
          setProfile(data.profile);
          quietAchievements.current = true;
          setAchievements(data.achievements);
          setCoachInit(c => ({ ...c, personId: null }));
          setOnboarded(true);
          setScreen({ name: 'tabs' }); setActiveTab('today');
          pushToast('Backup imported');
        },
      });
    };
    reader.readAsText(file);
  }

  // From onboarding. `notify` holds the notification switches it shows; one
  // left at its default isn't saved, so it follows the default. `then` is
  // 'plan' to plan something straight away.
  function handleOnboardingComplete({ name, focus, startFresh, newPeople, notify = {}, then }) {
    stamper.forget(); // the people shown before setting up weren't yours (lib/sync.js)
    setProfile(p => {
      const next = { ...p, name, focus };
      delete next.gettingStartedHidden;
      Object.entries(notify).forEach(([k, v]) => { if (v === NOTIFY_DEFAULTS[k]) delete next[k]; else next[k] = v; });
      return next;
    });
    quietAchievements.current = true;
    if (startFresh) {
      setPeople((newPeople || []).map(p => ({ ...makePerson({ name: p.name, emoji: p.emoji, avatar: p.avatar, layer: p.layer || 1, overall: p.overall }), ...(p.dates && p.dates.length ? { dates: p.dates } : {}) })));
      setJournal([]); setGeneralGoals([]); setSkills(EMPTY_SKILLS);
    } else {
      const sample = sampleData();
      setPeople(sample.people); setJournal(sample.journal); setGeneralGoals(sample.generalGoals); setSkills(sample.skills);
    }
    setOnboarded(true);
    setScreen({ name: 'tabs' }); setActiveTab('today');
    if (then === 'plan') openPlan({ day: today });
  }

  // A wide window shows People as the list in the middle, and once someone's
  // picked, the list beside their profile (it slides over), with the tabs
  // still showing; going from person to person doesn't slide the page.
  const peopleSplit = wide && onboarded && ((screen.name === 'person' && !!selectedPerson) || (screen.name === 'tabs' && activeTab === 'people'));
  const peopleListRef = useRef(null);
  useSlideAcross(peopleListRef, selectedPerson ? 'beside' : 'middle');
  const splitPersonId = peopleSplit && selectedPerson ? selectedPerson.id : null;
  // A new profile beside the list starts at its top.
  useEffect(() => { if (splitPersonId && scrollRef.current) scrollRef.current.scrollTop = 0; }, [splitPersonId]);
  const showNav = onboarded && (screen.name === 'tabs' || peopleSplit);
  // Which page is showing, for PageTransition: tabs by their place in the
  // bar, and a person or goals screen as a step further in.
  const pageKey = !onboarded ? 'welcome' : peopleSplit ? 'people' : screen.name === 'tabs' ? activeTab : `${screen.name}:${screen.personId || ''}`;
  const pageOrder = !onboarded ? -1 : peopleSplit ? TABS.indexOf('people') : screen.name === 'tabs' ? TABS.indexOf(activeTab) : TABS.length;
  const profileView = selectedPerson && (
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
      onRemindFollowUp={handleRemindFollowUp}
      onPlan={(personId) => openPlan({ personIds: [personId] })}
      onAddKeyDate={setKeyDateFor}
      onDeleteKeyDate={handleDeleteKeyDate}
      onRecheck={() => setRecheckFor(selectedPerson.id)}
      onShowGoalLogs={showGoalLogs}
      onShowDayLogs={showDayLogs}
      onExportSummary={hasSystemBridge && window.layersSystem.exportSummary ? handleExportSummary : null}
    />
  );
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [pageKey]);

  return (
    <SheetLayerContext.Provider value={sheetLayer}>
      <div className={`layers-root${theme === 'dark' ? ' dark' : ''}${wide ? ' is-wide' : ''}`} style={{ background: COLORS.paper, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{CSS}</style>
        <div className="app-shell">
          <div className="phone-frame">
            <div ref={scrollRef} className="scroll-area no-scrollbar" style={{ paddingBottom: showNav ? 110 : 30 }}>
              <PageTransition pageKey={pageKey} order={pageOrder}>
              {/* A crash while rendering a screen shows a way out instead of a blank window. */}
              <ErrorBoundary key={`${onboarded}-${peopleSplit ? 'people-split' : `${screen.name}-${screen.personId || ''}-${activeTab}`}`} onHome={() => switchTab('today')}>
                {!onboarded ? (
                  <div className="page-col"><OnboardingView initialName={profile.name} initialFocus={profile.focus} initialNotify={notifySettings(profile)} onComplete={handleOnboardingComplete} onRestore={handleImportClick} /></div>
                ) : peopleSplit ? (
                  <div className={`people-split${selectedPerson ? '' : ' people-split--solo'}`}>
                    <div className="people-split-list" ref={peopleListRef}>
                      <PeopleView people={people} journal={journal} onOpenPerson={openPerson} onAddPerson={() => setAddPersonOpen(true)} onAddPhotos={() => setPhotoFolderOpen(true)} split selectedId={selectedPerson ? selectedPerson.id : null} />
                    </div>
                    {selectedPerson && (
                      <div className="people-split-detail">
                        <div key={selectedPerson.id} className="fade-anim">{profileView}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {screen.name === 'person' && <div className="page-col">{profileView}</div>}
                    {screen.name === 'goals' && (
                      <div className="page-col"><GoalsView today={today} people={people} generalGoals={generalGoals} journal={journal} onShowGoalLogs={showGoalLogs} onBack={backToTabs} onOpenPerson={openPerson} onOpenGoalCreate={openGoalCreate} onOpenGoalEdit={openGoalEdit} onDeleteGoal={handleDeleteGoal} onBumpGoal={handleBumpGoal} /></div>
                    )}
                    {screen.name === 'tabs' && (
                      <>
                        {activeTab === 'today' && <TodayView wide={wide} today={today} selectedDay={selectedDay || today} onSelectDay={(d) => setSelectedDay(d === today ? null : d)} mode={calendarMode} onSetMode={setCalendarMode} people={people} journal={journal} events={shownEvents} generalGoals={generalGoals} skills={skills} profile={profile} onPlan={openPlan} onOpenEvent={(eventId, day) => setEventView({ eventId, day })} onLogEvent={openLogFromEvent} onTickEvent={(ev, day) => handleMarkEventDone(ev.id, day)} onMissEvent={(ev, day) => handleMarkEventMissed(ev.id, day)} onOpenPerson={openPerson} onAddPerson={() => setAddPersonOpen(true)} onOpenLog={() => openLog(null)} onSwitchTab={switchTab} onOpenGoals={openGoalsOverview} onOpenReview={setWeekReview} onOpenDay={setDayView} onOpenJump={() => { setJumpOpen(true); markTried('jump'); }} onHideFirstSteps={() => setProfile(p => ({ ...p, gettingStartedHidden: true }))} />}
                        {activeTab === 'people' && <PeopleView people={people} journal={journal} onOpenPerson={openPerson} onAddPerson={() => setAddPersonOpen(true)} onAddPhotos={() => setPhotoFolderOpen(true)} />}
                        {activeTab === 'coach' && <div className="page-col"><CoachView people={people} journal={journal} initialPersonId={coachInit.personId} initialTab={coachInit.tab} onOpenLog={openLog} onApproveInfo={handleApproveInfo} onLogFromAnalysis={handleLogFromAnalysis} onOpenPerson={openPerson}
                          onLogChat={(l) => handleLogSubmit({ personIds: l.personIds.filter(id => people.some(p => p.id === id)), type: 'messaged', meaningfulness: l.meaningfulness, notes: [], activeListening: l.activeListening, summary: l.summary || undefined, pickedDate: l.date, ratings: l.ratings, analysis: l.analysis })}
                          analysisReady={!analysisBridge ? 'none' : hasAnalysisKey ? 'ready' : 'no-key'} onAnalyse={(request) => analysisBridge.runAnalysis(request)} onOpenMe={() => switchTab('me')} yourName={profile.name}
                          model={analysisModelId} onModel={setAnalysisModelId} chatExports={chatsBridge} initialChatKey={coachInit.chatKey || null} /></div>}
                        {activeTab === 'journal' && <div className="page-col"><JournalView today={today} people={people} generalGoals={generalGoals} journal={journal} goalFilter={journalGoal} onGoalFilter={setJournalGoal}
                          personFilter={journalPerson} onPersonFilter={setJournalPerson} dayFilter={journalDay} onDayFilter={setJournalDay} onOpenPerson={openPerson} onEditEntry={setEditingEntryId} onOpenReview={setReviewEntryId} /></div>}
                        {activeTab === 'me' && <div className="page-col"><MeView people={people} journal={journal} skills={skills} generalGoals={generalGoals} profile={profile} onAddSample={handleAddSample} onRemoveSample={handleRemoveSample} hasSamplePeople={people.some(p => SAMPLE_PERSON_IDS.has(p.id))} canAddSample={INITIAL_PEOPLE.some(sp => !people.some(p => p.id === sp.id))} onStartOver={() => setStartOverOpen(true)} onExport={handleExportData} onImportClick={handleImportClick} backupInfo={backupInfo} onOpenBackups={handleOpenBackups} hasUpdater={hasUpdater} updateStatus={updateStatus} onCheckForUpdates={handleCheckForUpdates} onInstallUpdate={handleInstallUpdate} onOpenDownloadPage={handleOpenDownloadPage} shortcutStatus={shortcutStatus} themeMode={themeMode} onSetTheme={setThemeMode} onUpdateProfile={(changes) => setProfile(p => ({ ...p, ...changes }))} onEditProfile={() => setEditProfileOpen(true)} achievements={achievements || {}} hasSystemBridge={hasSystemBridge} autoLaunch={autoLaunch} onToggleAutoLaunch={handleToggleAutoLaunch} onOpenShortcuts={() => setShortcutsOpen(true)} appVersion={appVersion}
                          sync={syncBridge ? { ...syncSettings, dir: syncInfo && syncInfo.dir } : null}
                          calendars={feedBridge ? { feeds, fetchedAt: feedCache.fetchedAt, errors: feedCache.errors, count: (id) => feedCache.items.filter(it => it.feedId === id).length } : null}
                          onAddCalendar={handleAddFeed} onRemoveCalendar={handleRemoveFeed} onRefreshCalendars={refreshFeeds}
                          analysisKey={analysisBridge ? { hasKey: hasAnalysisKey } : null} onSaveAnalysisKey={handleSaveAnalysisKey} onRemoveAnalysisKey={handleRemoveAnalysisKey} onSyncTurnOn={openSyncSheet} onSyncNow={() => runSync()} onSyncOff={handleSyncOff} onOpenSyncFolder={handleOpenSyncFolder} /></div>}
                      </>
                    )}
                  </>
                )}
              </ErrorBoundary>
              </PageTransition>
            </div>

            {showNav && (
              <>
                <button className="fab-btn" onClick={() => openLog(null)} aria-label="Log an interaction"><Plus size={26} color={COLORS.onAccent} /></button>
                <BottomNav active={peopleSplit ? 'people' : activeTab} onChange={switchTab} />
              </>
            )}

            <div className="toast-stack">
              {toasts.map(t => (
                <div key={t.id} className={`toast${t.undo || t.redo ? ' toast--undo' : ''}`}>
                  <span className="toast-text">{t.text}</span>
                  {t.undo && <button type="button" onClick={() => undoToast(t.id, t.undo)} className="toast-undo" aria-label="Undo (Ctrl+Z)">Undo</button>}
                  {t.redo && <button type="button" onClick={() => redoToast(t.id, t.redo)} className="toast-undo" aria-label="Redo (Ctrl+Y)">Redo</button>}
                </div>
              ))}
            </div>

            <input ref={importInputRef} type="file" accept="application/json" onChange={handleImportFile} style={{ display: 'none' }} />

            {logOpen && <LogInteractionModal people={people} defaultPersonId={logDefaultPerson} prefill={logPrefill} onCreateGoal={handleQuickGoal} onClose={closeLog} onPlan={() => openPlan({ day: selectedDay || today })} onAnalyse={() => { closeLog(); openCoach(null, 'analyse'); }} onSubmit={(payload) => { handleLogSubmit(payload); if (logPrefill && logPrefill.eventId) handleMarkEventDone(logPrefill.eventId, logPrefill.day, { quiet: true }); setLogPrefill(null); }} />}
            {planState && <PlanSheet people={people} events={shownEvents} today={today} prefill={planState} defaultAlert={notifySettings(profile).defaultAlert} onClose={() => setPlanState(null)} onSave={handleSavePlan} onDelete={handleDeleteEvent} onCreateGoal={handleQuickGoal} />}
            {eventView && shownEvents.some(e => e.id === eventView.eventId) && (() => {
              const ev = shownEvents.find(e => e.id === eventView.eventId);
              return <EventSheet ev={ev} day={eventView.day} today={today} people={people} goals={[...people.flatMap(p => p.goals), ...generalGoals]} journal={journal} generalGoals={generalGoals} onPrepare={openPrepare} onClose={() => setEventView(null)} onLog={() => openLogFromEvent(ev, eventView.day)} onDone={() => { handleMarkEventDone(ev.id, eventView.day); setEventView(null); }} onMissed={() => { handleMarkEventMissed(ev.id, eventView.day); setEventView(null); }} onEdit={() => openPlan({ event: ev, day: eventView.day })} onCopy={() => openPlan({ copyOf: ev, day: eventView.day })} onDelete={() => handleDeleteEvent(ev.id, eventView.day)} />;
            })()}
            {dayView && (
              <DaySheet day={dayView} today={today} people={people} journal={journal} events={shownEvents} generalGoals={generalGoals}
                onDay={(d) => { setDayView(d); setSelectedDay(d === today ? null : d); }}
                onOpenEvent={(eventId, d) => setEventView({ eventId, day: d })} onPlan={openPlan} onPrepare={openPrepare} onClose={() => setDayView(null)} />
            )}
            {weekReview && <WeekReviewSheet day={weekReview} people={people} journal={journal} events={events} generalGoals={generalGoals} onClose={() => setWeekReview(null)} onPlan={openPlan}
              chatExports={hasAnalysisKey ? chatsBridge : null} yourName={profile.name} onOpenChat={(key) => { setWeekReview(null); openCoach(null, 'analyse', key); }} />}
            {recheckFor && people.some(p => p.id === recheckFor) && (() => {
              const p = people.find(x => x.id === recheckFor);
              return <QuizSheet name={p.name} person={p} now={{ layer: p.layer, overall: p.overall }} onClose={() => setRecheckFor(null)} onDone={(placement) => handleRecheck(p.id, placement)} />;
            })()}
            {keyDateFor && people.some(p => p.id === keyDateFor) && <KeyDateSheet personName={people.find(p => p.id === keyDateFor).name} onClose={() => setKeyDateFor(null)} onSave={(kd) => handleSaveKeyDate(keyDateFor, kd)} />}
            {goalModalOpen && <GoalModal people={people} defaultPersonId={goalModalDefaultPerson} editingGoal={goalEditing ? goalEditing.goal : null} editingPersonId={goalEditing ? goalEditing.personId : null} onClose={closeGoalModal} onSave={handleGoalSave} />}
            {addInfoOpen && addInfoTarget && (
              <AddInfoModal personName={(people.find(p => p.id === addInfoTarget.personId) || {}).name} category={addInfoTarget.category} onClose={closeAddInfo} onSave={handleAddInfoSave} />
            )}
            {quickInterestOpen && quickInterestPersonId && (
              <QuickAddInterestModal personName={(people.find(p => p.id === quickInterestPersonId) || {}).name} onClose={closeQuickAddInterest} onSave={handleQuickAddInterestSave} />
            )}
            {addPersonOpen && <AddPersonModal onClose={() => setAddPersonOpen(false)} onSave={handleAddPerson} />}
            {photoFolderOpen && <PhotoFolderSheet people={people} onClose={() => setPhotoFolderOpen(false)} onApply={handlePhotoFolder} />}
            {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
            {jumpOpen && (
              <JumpSheet people={people} events={events} today={today} has={{ bridge: hasSystemBridge, updater: hasUpdater }}
                onRun={runJump} onClose={() => setJumpOpen(false)} />
            )}
            {syncSheetOpen && <SyncSheet hasFile={!!(syncInfo && syncInfo.hasFile)} folder={syncInfo && syncInfo.dir ? syncInfo.dir.split(/[\\/]/).slice(-2).join('\\') : 'OneDrive'} onClose={() => setSyncSheetOpen(false)} onTurnOn={handleSyncTurnOn} />}
            {startOverOpen && <StartOverSheet counts={{ people: people.length, journal: journal.length, events: events.length, goals: generalGoals.length + people.reduce((n, p) => n + p.goals.length, 0) }} onExport={handleExportData} onClose={() => setStartOverOpen(false)} onConfirm={handleStartOver} />}
            {editProfileOpen && <EditProfileModal profile={profile} onClose={() => setEditProfileOpen(false)} onSave={(vals) => { setProfile(p => ({ ...p, ...vals })); setEditProfileOpen(false); pushToast('Profile updated'); }} />}
            {standaloneDetailOpen && (
              <TemplatePickerModal
                title="Add detail"
                templates={ACTIVITY_TEMPLATES}
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
            {editingEntryId && journal.some(j => j.id === editingEntryId) && (() => {
              const entry = journal.find(j => j.id === editingEntryId);
              return <EditEntryModal entry={entry} personName={(people.find(p => p.id === entry.personId) || {}).name} onClose={() => setEditingEntryId(null)} onSave={(changes) => handleUpdateEntry(entry.id, changes)} onDelete={() => handleDeleteEntry(entry.id)} />;
            })()}
            {reviewEntryId && journal.some(j => j.id === reviewEntryId && j.analysis) && (() => {
              const entry = journal.find(j => j.id === reviewEntryId);
              return <ChatReviewSheet entry={entry} person={people.find(p => p.id === entry.personId)} onClose={() => setReviewEntryId(null)} />;
            })()}
            {confirmState && (
              <ConfirmDialog title={confirmState.title} message={confirmState.message} confirmLabel={confirmState.confirmLabel} danger={confirmState.danger} hideCancel={confirmState.hideCancel} onConfirm={confirmState.onConfirm} altLabel={confirmState.altLabel} onAlt={confirmState.onAlt} onCancel={confirmState.onCancel} />
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
