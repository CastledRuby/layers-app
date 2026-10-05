// Me tab: skills, achievements, appearance, updates and data.

import { useMemo, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LabeledBar } from '../components/atoms.jsx';
import { ACHIEVEMENTS, FOCUS_LABELS, FOCUS_SKILL_KEY, SKILL_ORDER, SKILL_TIPS } from '../data/constants.js';
import { achievementProgress, progressText } from '../lib/achievements.js';
import { notifySettings } from '../lib/calendar.js';
import { formatAbsoluteDate, formatCalendarDate, formatTime12, isJournalThisWeek, parseISODay, sortHistory } from '../lib/dates.js';
import { updateStatusText } from '../lib/text.js';
import { COLORS } from '../theme.js';

// A switch row (role="switch") for a setting kept on the profile.
function Toggle({ on, onChange, label, hint, children }) {
  return (
    <div className="mt-3">
      <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="w-full flex items-center justify-between gap-3 text-left">
        <span>
          <span className="block text-xs font-semibold" style={{ color: COLORS.ink }}>{label}</span>
          {hint && <span className="block text-xs" style={{ color: COLORS.inkSoft }}>{hint}</span>}
        </span>
        <span style={{ width: 36, height: 20, borderRadius: 999, background: on ? COLORS.accent : COLORS.line, position: 'relative', flexShrink: 0, transition: 'background-color .15s' }}>
          <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
        </span>
      </button>
      {on && children && <div className="flex flex-wrap gap-1.5 mt-2">{children}</div>}
    </div>
  );
}
const Pick = ({ on, onClick, children }) => <button type="button" onClick={onClick} aria-pressed={on} className={`chip${on ? ' chip--on' : ''}`} style={{ padding: '3px 10px' }}>{children}</button>;

export function MeView({ people, journal, skills, profile, generalGoals = [], onUpdateProfile, onEditProfile, achievements, onAddSample, onRemoveSample, hasSamplePeople, canAddSample, onStartOver, onExport, onImportClick, backupInfo, onOpenBackups, hasUpdater, updateStatus, onCheckForUpdates, onInstallUpdate, onOpenDownloadPage, shortcutStatus, themeMode, onSetTheme, hasSystemBridge, autoLaunch, onToggleAutoLaunch, onOpenShortcuts, appVersion }) {
  const [chartSkill, setChartSkill] = useState(FOCUS_SKILL_KEY);

  // Strength is your highest skill and focus your lowest. Until something has
  // been tracked (every skill at 0%) there's neither, just a starting tip.
  const tracked = SKILL_ORDER.some(k => skills[k].current > 0);
  const strengthKey = useMemo(() => SKILL_ORDER.reduce((best, k) => skills[k].current > skills[best].current ? k : best, SKILL_ORDER[0]), [skills]);
  const focusKey = useMemo(() => SKILL_ORDER.reduce((low, k) => skills[k].current < skills[low].current ? k : low, SKILL_ORDER[0]), [skills]);
  const chartData = useMemo(() => sortHistory(skills[chartSkill].history || []), [skills, chartSkill]);

  // Recorded achievements stay unlocked; locked ones show how close you are.
  const progress = useMemo(() => achievementProgress(people, journal, skills), [people, journal, skills]);
  const glance = useMemo(() => {
    const developing = new Set();
    people.forEach(p => { if (p.goals.some(g => g.progress < 100)) developing.add(p.id); });
    journal.forEach(j => { if (isJournalThisWeek(j)) developing.add(j.personId); });
    return [
      [people.flatMap(p => p.goals).concat(generalGoals).filter(g => g.progress < 100).length, 'active goals'],
      [journal.length, 'conversations logged'],
      [journal.filter(j => j.meaningfulness >= 4).length, 'meaningful interactions'],
      [developing.size, 'being developed'],
    ];
  }, [people, journal, generalGoals]);
  const notify = notifySettings(profile);

  return (
    <div className="fade-anim px-5 pt-6 pb-6">
      <div className="flex items-center justify-between rounded-2xl p-3.5 mb-6" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
        <div style={{ minWidth: 0 }}>
          <p className="text-sm font-semibold truncate" style={{ color: COLORS.ink }}>{(profile && profile.name) || 'You'}</p>
          <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>{profile && FOCUS_LABELS[profile.focus] ? `Focusing on ${FOCUS_LABELS[profile.focus]}` : 'No focus chosen yet'}</p>
        </div>
        <button onClick={onEditProfile} className="text-xs font-semibold rounded-full px-3 py-1.5 shrink-0" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>Edit</button>
      </div>

      <div className="grid grid-cols-2 gap-y-4 mb-7">
        {glance.map(([n, label]) => (
          <div key={label}>
            <p className="font-display" style={{ fontSize: 26, color: COLORS.ink }}>{n}</p>
            <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>{label}</p>
          </div>
        ))}
      </div>

      <p className="font-display" style={{ fontSize: 24, color: COLORS.ink }}>Your social skills</p>
      <p className="text-sm mt-1" style={{ color: COLORS.inkSoft }}>Your own development, tracked privately.</p>

      <div className="mt-5 space-y-3.5">
        {SKILL_ORDER.map(k => (<LabeledBar key={k} label={skills[k].label} percent={skills[k].current} color={COLORS.accent} size="lg" />))}
      </div>

      {tracked ? (
        <div className="grid grid-cols-1 gap-2.5 mt-6">
          <div className="rounded-2xl p-3.5" style={{ background: COLORS.accentSoft }}>
            <p className="text-xs font-semibold" style={{ color: COLORS.accent }}>Your biggest strength</p>
            <p className="text-sm mt-1" style={{ color: COLORS.ink }}>{SKILL_TIPS[strengthKey].emoji} {skills[strengthKey].label}</p>
          </div>
          <div className="rounded-2xl p-3.5" style={{ background: COLORS.layer3Tint }}>
            <p className="text-xs font-semibold" style={{ color: COLORS.layer3Deep }}>Current focus</p>
            <p className="text-sm mt-1" style={{ color: COLORS.ink }}>{SKILL_TIPS[focusKey].emoji} {skills[focusKey].label}</p>
            <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>{SKILL_TIPS[focusKey].focus}</p>
          </div>
          <div className="rounded-2xl p-3.5" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
            <p className="text-xs font-semibold" style={{ color: COLORS.ink }}>Current challenge</p>
            <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>{SKILL_TIPS[focusKey].challenge}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-3.5 mt-6" style={{ background: COLORS.accentSoft }}>
          <p className="text-xs font-semibold" style={{ color: COLORS.accent }}>Getting started</p>
          <p className="text-xs mt-1.5" style={{ color: COLORS.ink }}>Your skills start at 0% and grow as you log conversations. When you log one, tick what you practised, like asking follow-up questions, and your strengths and next focus will show up here.</p>
        </div>
      )}

      <div className="mt-7">
        <p className="font-display" style={{ fontSize: 18, color: COLORS.ink }}>Progress history</p>
        <div className="flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar pb-1">
          {SKILL_ORDER.map(k => (
            <button key={k} onClick={() => setChartSkill(k)} className="text-xs font-semibold rounded-full px-3 py-1.5 shrink-0" style={{ background: chartSkill === k ? COLORS.accent : COLORS.paperRaised, color: chartSkill === k ? COLORS.onAccent : COLORS.inkSoft, border: `1px solid ${chartSkill === k ? COLORS.accent : COLORS.line}` }}>{skills[k].label}</button>
          ))}
        </div>
        <div className="mt-3" style={{ width: '100%', height: 170 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 14, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={COLORS.line} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.inkSoft }} axisLine={{ stroke: COLORS.line }} tickLine={false} interval={0} padding={{ left: 18, right: 18 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} width={26} />
              <Tooltip formatter={(v) => [`${v}%`, skills[chartSkill].label]} contentStyle={{ borderRadius: 12, border: `1px solid ${COLORS.line}`, fontSize: 12 }} />
              <Line type="monotone" dataKey="value" stroke={COLORS.accent} strokeWidth={2.5} dot={{ r: 3, fill: COLORS.accent }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-7">
        <p className="font-display" style={{ fontSize: 18, color: COLORS.ink }}>Achievements</p>
        <div className="grid grid-cols-2 gap-2.5 mt-3">
          {ACHIEVEMENTS.map(a => {
            const unlockedOn = achievements[a.key] ? parseISODay(achievements[a.key]) : null;
            const isUnlocked = !!unlockedOn;
            return (
              <div key={a.key} className="rounded-2xl p-3.5" style={{ background: isUnlocked ? COLORS.accentSoft : COLORS.paperRaised, border: `1px solid ${isUnlocked ? COLORS.accentSoft : COLORS.line}`, opacity: isUnlocked ? 1 : 0.55 }}>
                <span style={{ fontSize: 22 }}>{a.emoji}</span>
                <p className="text-xs font-semibold mt-1.5" style={{ color: COLORS.ink }}>{a.title}</p>
                <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>{a.desc}</p>
                {isUnlocked
                  ? <p className="text-xs mt-1 font-medium" style={{ color: COLORS.accent }}>Unlocked {formatAbsoluteDate(unlockedOn)}</p>
                  : <p className="text-xs mt-1 font-medium" style={{ color: COLORS.inkSoft }}>Locked · {progressText(progress[a.key])}</p>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-7 rounded-2xl p-4" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
        <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Appearance</p>
        <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>Match Windows switches between light and dark when Windows does.</p>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {[['system', 'Match Windows'], ['light', 'Light'], ['dark', 'Dark']].map(([t, label]) => (
            <button key={t} type="button" onClick={() => onSetTheme(t)} aria-pressed={themeMode === t} className="text-xs font-semibold rounded-full px-3 py-1.5" style={{ background: themeMode === t ? COLORS.accent : COLORS.paperRaised, color: themeMode === t ? COLORS.onAccent : COLORS.inkSoft, border: `1px solid ${themeMode === t ? COLORS.accent : COLORS.line}` }}>{label}</button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl p-4" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
        <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Notifications</p>
        <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>{hasSystemBridge ? 'Windows delivers these on time, even when Layers is closed. Their buttons snooze a reminder, rate or log a plan, and plan something.' : 'Small desktop nudges while Layers is open.'}</p>
        <Toggle on={notify.reminderNotifications} onChange={(v) => onUpdateProfile({ reminderNotifications: v })} label="Reminders before plans" hint="Each plan has its own; this is the one new plans start with.">
          {[[null, 'None'], [0, 'At the time'], [5, '5 min'], [15, '15 min'], [30, '30 min'], [60, '1 hour']].map(([v, l]) => <Pick key={l} on={notify.defaultAlert === v} onClick={() => onUpdateProfile({ defaultAlert: v })}>{l}</Pick>)}
        </Toggle>
        <Toggle on={notify.keyDateReminders} onChange={(v) => onUpdateProfile({ keyDateReminders: v })} label="Birthdays and key dates" hint="A week before, the evening before, and on the morning, with a button to plan something." />
        <Toggle on={notify.morningSummary} onChange={(v) => onUpdateProfile({ morningSummary: v })} label="Morning summary" hint="Your day's plans and key dates, each morning there's something on.">
          {[7 * 60, 8 * 60, 9 * 60].map(t => <Pick key={t} on={notify.morningTime === t} onClick={() => onUpdateProfile({ morningTime: t })}>{formatTime12(t)}</Pick>)}
        </Toggle>
        <Toggle on={notify.eveningHeadsUp} onChange={(v) => onUpdateProfile({ eveningHeadsUp: v })} label="Evening heads-up" hint="Tomorrow's plans, the night before.">
          {[19 * 60, 20 * 60, 21 * 60].map(t => <Pick key={t} on={notify.eveningTime === t} onClick={() => onUpdateProfile({ eveningTime: t })}>{formatTime12(t)}</Pick>)}
        </Toggle>
        <Toggle on={notify.askAfter} onChange={(v) => onUpdateProfile({ askAfter: v })} label="Ask how it went" hint="When a plan with someone ends: rate it right there (Casual to Deep), or Log it." />
        <Toggle on={notify.catchUpWeekly} onChange={(v) => onUpdateProfile({ catchUpWeekly: v })} label="Weekly catch-up list" hint={`Who you haven't seen in a while, with Plan buttons, at ${formatTime12(notify.morningTime)}.`}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w, i) => <Pick key={w} on={notify.catchUpDay === i} onClick={() => onUpdateProfile({ catchUpDay: i })}>{w}</Pick>)}
        </Toggle>
        <Toggle on={notify.quietNudges} onChange={(v) => onUpdateProfile({ quietNudges: v })} label="When someone close goes quiet" hint="Personal and Close people, once it's been longer than usual." />
        <Toggle on={notify.weeklyReview} onChange={(v) => onUpdateProfile({ weeklyReview: v })} label="Sunday review" hint={`Your week, then next week planned in one go, Sundays at ${formatTime12(notify.reviewTime)}.`} />
        <Toggle on={!profile || profile.checkInNotifications !== false} onChange={(v) => onUpdateProfile({ checkInNotifications: v })} label="Daily check-in nudge" hint="When you haven't logged with someone for two weeks." />
      </div>

      {hasSystemBridge && (
        <div className="mt-4 rounded-2xl p-4" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
          <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Startup</p>
          <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>Launch Layers automatically when you log in, so it's already running in the tray.</p>
          <button onClick={onToggleAutoLaunch} aria-pressed={autoLaunch} className="flex items-center gap-2 mt-3 text-xs font-semibold rounded-full px-3 py-2" style={{ background: autoLaunch ? COLORS.accentSoft : COLORS.paperRaised, color: autoLaunch ? COLORS.accent : COLORS.inkSoft, border: `1px solid ${autoLaunch ? COLORS.accent : COLORS.line}` }}>
            <span style={{ width: 14, height: 14, borderRadius: '50%', border: `1.5px solid currentColor`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{autoLaunch && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }} />}</span>
            {autoLaunch ? 'Launching at login' : 'Launch at login'}
          </button>
          {shortcutStatus && shortcutStatus.registered === false && (
            <p className="text-xs mt-2.5 font-medium" style={{ color: COLORS.alert }}>Another app is already using Ctrl+Shift+L, so the quick-add box won't open. Close that app or change its shortcut, then restart Layers.</p>
          )}
          {shortcutStatus && shortcutStatus.open && shortcutStatus.open.registered === false && (
            <p className="text-xs mt-2.5 font-medium" style={{ color: COLORS.alert }}>Another app is already using Ctrl+Alt+L, so it won't bring Layers forward. Close that app or change its shortcut, then restart Layers.</p>
          )}
          <p className="text-xs mt-2.5" style={{ color: COLORS.inkSoft }}>From anywhere in Windows: <span style={{ fontWeight: 600, color: COLORS.ink }}>Ctrl+Shift+L</span> opens the quick-add box (type a plan or a log, like "coffee with Priya fri 10am"), and <span style={{ fontWeight: 600, color: COLORS.ink }}>Ctrl+Alt+L</span> brings Layers to the front. In-app, press <span style={{ fontWeight: 600, color: COLORS.ink }}>Ctrl+K</span> to jump to anything, <span style={{ fontWeight: 600, color: COLORS.ink }}>N</span> to quick-log an interaction, and <span style={{ fontWeight: 600, color: COLORS.ink }}>Esc</span> to close any open dialog.</p>
        </div>
      )}

      {hasUpdater && (
        <div className="mt-7 rounded-2xl p-4" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>App updates</p>
            {appVersion && <span className="text-xs font-semibold rounded-full px-2 py-0.5" style={{ background: COLORS.accentSoft, color: COLORS.accent, fontFamily: 'monospace' }}>v{appVersion}</span>}
          </div>
          <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>{updateStatusText(updateStatus)}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {updateStatus && updateStatus.state === 'ready' ? (
              <button onClick={onInstallUpdate} className="text-xs font-semibold rounded-full px-3 py-2" style={{ background: COLORS.accent, color: COLORS.onAccent }}>Restart &amp; install</button>
            ) : updateStatus && updateStatus.state === 'available-portable' ? (
              <button onClick={onOpenDownloadPage} className="text-xs font-semibold rounded-full px-3 py-2" style={{ background: COLORS.accent, color: COLORS.onAccent }}>Open download page</button>
            ) : (
              <button onClick={onCheckForUpdates} disabled={!!(updateStatus && (updateStatus.state === 'checking' || updateStatus.state === 'downloading'))} className="text-xs font-semibold rounded-full px-3 py-2" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>Check for updates</button>
            )}
          </div>
        </div>
      )}

      <div className="mt-7 rounded-2xl p-4 flex items-center justify-between" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
        <div>
          <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Keyboard shortcuts</p>
          <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>Navigate Layers faster on Windows. Press <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>?</span> anytime to see this list.</p>
        </div>
        <button onClick={onOpenShortcuts} className="text-xs font-semibold rounded-full px-3 py-2 shrink-0" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>View</button>
      </div>

      <div className="mt-4 rounded-2xl p-4" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
        <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Backup</p>
        <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>Save a copy of everything to a file, or bring one back in. Handy before switching devices or reinstalling.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button onClick={onExport} className="flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-2" style={{ background: COLORS.accentSoft, color: COLORS.accent }}><Download size={13} /> Export data</button>
          <button onClick={onImportClick} className="flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-2" style={{ background: COLORS.paperRaised, color: COLORS.ink, border: `1px solid ${COLORS.line}` }}><Upload size={13} /> Import data</button>
        </div>
        {backupInfo && (
          <div className="flex items-center justify-between gap-3 mt-4 pt-3" style={{ borderTop: `1px solid ${COLORS.line}` }}>
            <div>
              <p className="text-xs font-semibold" style={{ color: COLORS.ink }}>Automatic backups</p>
              <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>One a day, the last 14 kept, in {backupInfo.dir.split(/[\\/]/).slice(-2).join('\\')}. {backupInfo.latest ? `Latest: ${formatCalendarDate(parseISODay(backupInfo.latest))}.` : 'The first one is saved shortly.'}</p>
            </div>
            <button type="button" onClick={onOpenBackups} className="text-xs font-semibold rounded-full px-3 py-2 shrink-0" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>Open folder</button>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl p-4" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
        <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Privacy</p>
        <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>Layers is a private personal-development tool. Everything is saved only on this device. Screenshot analysis never happens automatically, and extracted information always waits for your approval before it's saved.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {hasSamplePeople && <button onClick={onRemoveSample} className="text-xs font-semibold rounded-full px-3 py-2" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>Remove sample people</button>}
          {canAddSample && <button onClick={onAddSample} className="text-xs font-semibold rounded-full px-3 py-2" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>Add sample people</button>}
          <button onClick={onStartOver} className="text-xs font-semibold rounded-full px-3 py-2" style={{ background: COLORS.layer4Tint, color: COLORS.layer4Deep }}>Delete my data and start over</button>
        </div>
      </div>

      <p className="text-xs text-center mt-6" style={{ color: COLORS.inkSoft }}>Good social skills are about noticing, responding and adapting, not forcing a particular outcome.</p>
    </div>
  );
}
