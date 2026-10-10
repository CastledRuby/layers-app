// Me tab: skills, achievements, appearance, updates and data.

import { useMemo, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LabeledBar } from '../components/atoms.jsx';
import { ACHIEVEMENTS, FOCUS_LABELS, FOCUS_SKILL_KEY, SKILL_ORDER, SKILL_TIPS } from '../data/constants.js';
import { achievementProgress, progressText } from '../lib/achievements.js';
import { notifySettings } from '../lib/calendar.js';
import { analysisModel, dollarsText, spendSummary } from '../lib/analysis.js';
import { LIMITS, readLimit, saveLimit } from '../lib/chatBatch.js';
import { cleanStyle, STYLE_MAX } from '../lib/replies.js';
import { ChatTrendChart } from '../components/ChatTrendChart.jsx';
import { chatTrend } from '../lib/chatTrend.js';
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

// "just now", "5 minutes ago", "3 hours ago", or the day.
function syncedAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return formatCalendarDate(new Date(iso));
}

// Chat analysis with Claude: the Anthropic API key, kept by Windows on this
// laptop (only whether there is one comes back). onSave resolves to what went
// wrong, or null.
// style / onSaveStyle: how you text, in your words, for reply ideas and openers.
function AnalysisKeyCard({ analysisKey, onSave, onRemove, style = '', onSaveStyle }) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [spend] = useState(() => spendSummary()); // read when Me opens
  const [limit, setLimit] = useState(() => readLimit()); // Analyse all new's monthly limit (lib/chatBatch.js)
  // "Haiku 4.5" for one model; "2 with Haiku 4.5, 1 with Opus 5.5" for more.
  const byModel = (models) => { const list = Object.entries(models); return list.length === 1 ? analysisModel(list[0][0]).short : list.map(([id, n]) => `${n} with ${analysisModel(id).short}`).join(', '); };
  async function save() {
    if (!key.trim() || busy) return;
    setBusy(true); setError(null);
    const problem = await onSave(key.trim());
    setBusy(false);
    if (problem) setError(problem); else setKey('');
  }
  return (
    <div className="mt-4 rounded-2xl p-4" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }} aria-label="Chat analysis">
      <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Chat analysis (Claude)</p>
      <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>
        {analysisKey.hasKey
          ? 'Ready: Coach → Analyse a chat sends a chat you choose to Claude, only when you press Analyse, from your Anthropic credit. It uses Claude Haiku 4.5, the cheapest (about US$0.02 a chat); pick a bigger model there to compare, until Layers is next started.'
          : 'Analyse your own chats in Coach with Claude. Make an API key at console.anthropic.com (API keys), add a few dollars of credit there (about US$0.02 a chat with Claude Haiku 4.5, the cheapest), then paste the key here. Layers keeps it on this laptop, protected by Windows.'}
      </p>
      {(spend.thisMonth.chats > 0 || spend.lastMonth.chats > 0) && (
        <div className="mt-2.5 text-xs" aria-label="What Claude has cost" style={{ color: COLORS.ink }}>
          <p><span className="font-semibold">This month:</span> about {dollarsText(spend.thisMonth.dollars)} for {spend.thisMonth.chats} {spend.thisMonth.chats === 1 ? 'chat' : 'chats'}{spend.thisMonth.chats ? ` (${byModel(spend.thisMonth.models)})` : ''}</p>
          {spend.lastMonth.chats > 0 && <p className="mt-0.5"><span className="font-semibold">Last month:</span> about {dollarsText(spend.lastMonth.dollars)} for {spend.lastMonth.chats} {spend.lastMonth.chats === 1 ? 'chat' : 'chats'}</p>}
          <p className="mt-0.5" style={{ color: COLORS.inkSoft }}>Worked out on this laptop from what each answer used; console.anthropic.com has the exact bill.</p>
        </div>
      )}
      {analysisKey.hasKey && onSaveStyle && (
        <label className="block mt-3">
          <span className="text-xs font-semibold" style={{ color: COLORS.ink }}>How you text</span>
          <input type="text" defaultValue={style} maxLength={STYLE_MAX} onBlur={e => { if (cleanStyle(e.target.value) !== style) onSaveStyle(cleanStyle(e.target.value)); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            aria-label="How you text" placeholder="e.g. lowercase, short, lots of emoji, says 'haha'"
            className="w-full text-xs rounded-xl px-3 py-2.5 mt-1.5" style={{ border: `1px solid ${COLORS.line}` }} />
          <span className="text-xs mt-1 block" style={{ color: COLORS.inkSoft }}>Reply ideas and openers are written like you: from your own messages in chats you've logged, and this.</span>
        </label>
      )}
      {analysisKey.hasKey && (
        <div className="mt-3" role="group" aria-label="Monthly limit">
          <p className="text-xs font-semibold" style={{ color: COLORS.ink }}>Monthly limit for Analyse all new</p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {LIMITS.map(n => <button key={n} type="button" onClick={() => { saveLimit(n); setLimit(n); }} aria-pressed={limit === n} className={`chip${limit === n ? ' chip--on' : ''}`} style={{ padding: '4px 10px' }}>{n ? `US$${n}` : 'No limit'}</button>)}
          </div>
          <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>{limit ? `It stops before this month's spend would go past US$${limit}.` : 'It sends everything new, whatever it costs.'} One chat at a time isn't held to it.</p>
        </div>
      )}
      {analysisKey.hasKey ? (
        <button type="button" onClick={onRemove} className="text-xs font-semibold rounded-full px-3 py-2 mt-3" style={{ background: COLORS.paperRaised, color: COLORS.inkSoft, border: `1px solid ${COLORS.line}` }}>Remove the key</button>
      ) : (
        <div className="flex items-center gap-2 mt-3">
          <input type="password" value={key} onChange={e => { setKey(e.target.value); setError(null); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
            aria-label="Anthropic API key" placeholder="sk-ant-…" autoComplete="off" spellCheck={false}
            className="flex-1 min-w-0 text-xs rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}` }} />
          <button type="button" onClick={save} disabled={!key.trim() || busy} className="text-xs font-semibold rounded-full px-3 py-2 shrink-0" style={{ background: COLORS.accent, color: COLORS.onAccent, opacity: !key.trim() || busy ? 0.5 : 1 }}>{busy ? 'Checking…' : 'Save'}</button>
        </div>
      )}
      {error && <p className="text-xs mt-2" role="alert" style={{ color: COLORS.alert }}>{error}</p>}
    </div>
  );
}

// Other calendars, read-only: the ones shown, and adding one by pasting its
// secret iCal address (Google Calendar: Settings, your calendar, Integrate
// calendar). onAdd resolves to what went wrong, or null.
function CalendarsCard({ calendars, onAdd, onRemove, onRefresh }) {
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function add() {
    if (!address.trim() || busy) return;
    setBusy(true); setError(null);
    const problem = await onAdd(address.trim());
    setBusy(false);
    if (problem) setError(problem); else setAddress('');
  }
  const { feeds } = calendars;
  return (
    <div className="mt-4 rounded-2xl p-4" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }} aria-label="Other calendars">
      <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Your Google Calendar</p>
      <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>Your timetable and other events on Today and the month, read-only, so planning can warn about clashes. Google keeps reminding you about them; Layers doesn't.</p>
      {feeds.map(feed => (
        <div key={feed.id} className="flex items-center justify-between gap-3 mt-3 pt-3" style={{ borderTop: `1px solid ${COLORS.line}` }}>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: COLORS.ink }}>📅 {feed.name}</p>
            <p className="text-xs mt-0.5" style={{ color: calendars.errors[feed.id] ? COLORS.alert : COLORS.inkSoft }}>{calendars.errors[feed.id] || `${calendars.count(feed.id)} events${calendars.fetchedAt ? `, updated ${syncedAgo(calendars.fetchedAt)}` : ''}`}</p>
          </div>
          <button type="button" onClick={() => onRemove(feed)} aria-label={`Stop showing ${feed.name}`} className="text-xs font-semibold rounded-full px-3 py-2 shrink-0" style={{ background: COLORS.paperRaised, color: COLORS.inkSoft, border: `1px solid ${COLORS.line}` }}>Remove</button>
        </div>
      ))}
      <p className="text-xs mt-3" style={{ color: COLORS.inkSoft }}>{feeds.length ? 'Another one: ' : 'To add it: '}in Google Calendar on the web, open <b>Settings</b>, pick the calendar, then <b>Integrate calendar</b>, and copy the <b>Secret address in iCal format</b>. It works like a password for that calendar, so Layers keeps it on this laptop, protected by Windows, and never syncs it.</p>
      <div className="flex items-center gap-2 mt-2">
        <input type="url" value={address} onChange={e => { setAddress(e.target.value); setError(null); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          aria-label="Secret address in iCal format" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" autoComplete="off" spellCheck={false}
          className="flex-1 min-w-0 text-xs rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}` }} />
        <button type="button" onClick={add} disabled={!address.trim() || busy} className="text-xs font-semibold rounded-full px-3 py-2 shrink-0" style={{ background: COLORS.accent, color: COLORS.onAccent, opacity: !address.trim() || busy ? 0.5 : 1 }}>{busy ? 'Checking…' : 'Add'}</button>
      </div>
      {error && <p className="text-xs mt-2" role="alert" style={{ color: COLORS.alert }}>{error}</p>}
      {feeds.length > 0 && <button type="button" onClick={onRefresh} className="text-xs font-semibold mt-3" style={{ color: COLORS.accent }}>Refresh now</button>}
    </div>
  );
}

export function MeView({ people, journal, skills, profile, generalGoals = [], onUpdateProfile, onEditProfile, achievements, onAddSample, onRemoveSample, hasSamplePeople, canAddSample, onStartOver, onExport, onImportClick, backupInfo, onOpenBackups, hasUpdater, updateStatus, onCheckForUpdates, onInstallUpdate, onOpenDownloadPage, shortcutStatus, themeMode, onSetTheme, hasSystemBridge, autoLaunch, onToggleAutoLaunch, onOpenShortcuts, appVersion, sync = null, onSyncTurnOn, onSyncNow, onSyncOff, onOpenSyncFolder, calendars = null, onAddCalendar, onRemoveCalendar, onRefreshCalendars, analysisKey = null, onSaveAnalysisKey, onRemoveAnalysisKey }) {
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
      <div className="flex items-start justify-between gap-3 mb-6">
        <div style={{ minWidth: 0 }}>
          <h1 className="font-display truncate" style={{ fontSize: 24, color: COLORS.ink }}>{(profile && profile.name) || 'You'}</h1>
          <p className="text-sm mt-1" style={{ color: COLORS.inkSoft }}>{profile && FOCUS_LABELS[profile.focus] ? `Focusing on ${FOCUS_LABELS[profile.focus]}` : 'No focus chosen yet'}</p>
        </div>
        <button onClick={onEditProfile} className="text-xs font-semibold rounded-full px-3 py-1.5 shrink-0 mt-1" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>Edit</button>
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

      {(() => {
        const points = chatTrend(journal);
        return points.length > 0 && (
          <div className="mt-7">
            <p className="font-display mb-3" style={{ fontSize: 18, color: COLORS.ink }}>Your chats over time</p>
            <ChatTrendChart points={points} label="Skills from analysed chats" />
          </div>
        );
      })()}

      <div className="mt-7">
        <p className="font-display" style={{ fontSize: 18, color: COLORS.ink }}>Progress history</p>
        <div className="flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar pb-1">
          {SKILL_ORDER.map(k => (
            <button key={k} onClick={() => setChartSkill(k)} className="text-xs font-semibold rounded-full px-3 py-1.5 shrink-0" style={{ background: chartSkill === k ? COLORS.accent : COLORS.paperRaised, color: chartSkill === k ? COLORS.onAccent : COLORS.inkSoft, border: `1px solid ${chartSkill === k ? COLORS.accent : COLORS.line}` }}>{skills[k].label}</button>
          ))}
        </div>
        <div className="mt-3" style={{ width: '100%', height: 170 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 14, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={COLORS.line} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.inkSoft }} axisLine={{ stroke: COLORS.line }} tickLine={false} interval={0} padding={{ left: 18, right: 18 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} width={30} />
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
          <p className="text-xs mt-2.5" style={{ color: COLORS.inkSoft }}>From anywhere in Windows: <span style={{ fontWeight: 600, color: COLORS.ink }}>Ctrl+Shift+L</span> opens the quick-add box (type a plan or a log, like "coffee w Priya fri 10am"), and <span style={{ fontWeight: 600, color: COLORS.ink }}>Ctrl+Alt+L</span> brings Layers to the front, or sends it back when it's already there. In-app, press <span style={{ fontWeight: 600, color: COLORS.ink }}>Ctrl+K</span> to jump to anything, <span style={{ fontWeight: 600, color: COLORS.ink }}>N</span> to quick-log an interaction, and <span style={{ fontWeight: 600, color: COLORS.ink }}>Esc</span> to close any open dialog.</p>
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

      {analysisKey && <AnalysisKeyCard analysisKey={analysisKey} onSave={onSaveAnalysisKey} onRemove={onRemoveAnalysisKey} style={profile.style || ''} onSaveStyle={(value) => onUpdateProfile({ style: value })} />}

      {calendars && <CalendarsCard calendars={calendars} onAdd={onAddCalendar} onRemove={onRemoveCalendar} onRefresh={onRefreshCalendars} />}

      {sync && (
        <div className="mt-4 rounded-2xl p-4" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }} aria-label="Sync">
          <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Sync through OneDrive</p>
          <p className="text-xs mt-1.5" style={{ color: sync.on && sync.error ? COLORS.alert : COLORS.inkSoft }} role="status">
            {!sync.on ? 'Keep your other computers (and, later, your phone) the same, through one encrypted file in OneDrive that only your passphrase opens.'
              : sync.error ? sync.error
                : `On. ${sync.lastSynced ? `Last synced ${syncedAgo(sync.lastSynced)}` : 'Syncing shortly'}${sync.dir ? `, in ${sync.dir.split(/[\\/]/).slice(-2).join('\\')}` : ''}.`}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {!sync.on ? (
              <button type="button" onClick={onSyncTurnOn} className="text-xs font-semibold rounded-full px-3 py-2" style={{ background: COLORS.accent, color: COLORS.onAccent }}>Turn on sync</button>
            ) : (
              <>
                <button type="button" onClick={onSyncNow} className="text-xs font-semibold rounded-full px-3 py-2" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>Sync now</button>
                <button type="button" onClick={onOpenSyncFolder} className="text-xs font-semibold rounded-full px-3 py-2" style={{ background: COLORS.paperRaised, color: COLORS.ink, border: `1px solid ${COLORS.line}` }}>Open folder</button>
                <button type="button" onClick={onSyncOff} className="text-xs font-semibold rounded-full px-3 py-2" style={{ background: COLORS.paperRaised, color: COLORS.inkSoft, border: `1px solid ${COLORS.line}` }}>Turn off</button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 rounded-2xl p-4" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
        <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Privacy</p>
        <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>Layers is a private personal-development tool. Everything is saved on this device{sync && sync.on ? ', and in an encrypted copy in your OneDrive that only your passphrase opens' : ' only'}. A chat is only analysed when you press Analyse (and then sent to Claude), and anything found in it waits for your approval before it's saved. Logging an analysed chat keeps the chat and Claude's review with the log, so they're in your backups too.</p>
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
