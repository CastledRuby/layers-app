// The Today tab, Layers' main screen: your day planned out, with a week strip
// or the month grid to move around in, what's waiting for a quick answer,
// ideas for who to see, and your goals. See docs/renderer/app-structure.md.
//
// Keys (not while typing or with a sheet open): M switches Day and Month,
// ← → move a day and ↑ ↓ a week, T comes back to today, and Enter (or
// clicking the day that's picked) opens the day in a popup (DaySheet), with
// Coach tips for its plans. L and J answer the first
// "How did it go?" (Log it, Just tick it), I plans the first idea, and W
// In a wide window (`wide`) the month grid sits beside the day all the time,
// in place of the week strip and the Day/Month switch.
// W opens the week's review (shown as a card on Sundays; on a Monday, last
// week's). P
// (anywhere) plans something on the day shown; that one lives in App.jsx.

import { useEffect, useMemo } from 'react';
import { Bell, Check, ChevronLeft, ChevronRight, Plus, Repeat, Search } from 'lucide-react';
import { Kbd, ProgressBar } from '../components/atoms.jsx';
import { AvatarStack } from '../components/PersonPick.jsx';
import { hasOpenSheet, isTabbedToButton as isTabbed, isTyping } from '../components/sheetLayer.js';
import { getLayer, TYPE_META } from '../data/constants.js';
import { alertOf, dayAgenda, isDaily, monthMarks, needsAnswer, planIdeas, templateFor } from '../lib/calendar.js';
import { formatTime12, MONTH_NAMES, parseISODay, toISODate, WEEKDAY_SHORT } from '../lib/dates.js';
import { focusSuggestion, homeGoalTitle, summaryFor } from '../lib/text.js';
import { COLORS } from '../theme.js';

const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const addDays = (day, n) => { const d = parseISODay(day); return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
const daysBetween = (a, b) => Math.round((parseISODay(b) - parseISODay(a)) / 86400000);

function relativeLabel(day, today) {
  const diff = daysBetween(today, day);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return WEEKDAY_LONG[parseISODay(day).getDay()];
}
function fullDate(day, today) {
  const d = parseISODay(day);
  const year = d.getFullYear() !== parseISODay(today).getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${WEEKDAY_LONG[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}${year}`;
}

// Small dots under a day: planned (accent), key dates (rose), logged (green).
function Dots({ mark }) {
  if (!mark) return <span style={{ height: 5 }} />;
  const dots = [mark.planned && COLORS.accent, mark.dates && COLORS.layer4, mark.logged && COLORS.good].filter(Boolean);
  return (
    <span className="flex items-center justify-center gap-0.5" style={{ height: 5 }} aria-hidden="true">
      {dots.map((c, i) => <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: c }} />)}
    </span>
  );
}

function DayCell({ day, today, selected, mark, onSelect, compact }) {
  const d = parseISODay(day);
  const isToday = day === today;
  const isSel = day === selected;
  return (
    <button type="button" onClick={() => onSelect(day)} aria-pressed={isSel} aria-label={fullDate(day, today)} className="flex flex-col items-center gap-1 rounded-2xl py-1.5 day-cell" style={{ flex: 1, minWidth: 0 }}>
      {!compact && <span className="text-xs font-semibold" style={{ color: isSel ? COLORS.accent : COLORS.inkSoft }}>{WEEKDAY_SHORT[d.getDay()][0]}</span>}
      <span className={isSel ? 'pop' : ''} style={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: isSel || isToday ? 700 : 500, fontVariantNumeric: 'tabular-nums', background: isSel ? COLORS.accent : 'transparent', color: isSel ? COLORS.onAccent : COLORS.ink, boxShadow: isToday && !isSel ? `inset 0 0 0 1.5px ${COLORS.accent}` : 'none' }}>{d.getDate()}</span>
      <Dots mark={mark} />
    </button>
  );
}

function WeekStrip({ selected, today, marksFor, onSelect }) {
  const d = parseISODay(selected);
  const monday = addDays(selected, -((d.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  return (
    <div className="flex items-center gap-1 mt-4">
      <button type="button" onClick={() => onSelect(addDays(selected, -7))} aria-label="Previous week" className="icon-btn"><ChevronLeft size={18} color={COLORS.inkSoft} /></button>
      <div className="flex flex-1 min-w-0">{days.map(day => <DayCell key={day} day={day} today={today} selected={selected} mark={marksFor(day)} onSelect={onSelect} />)}</div>
      <button type="button" onClick={() => onSelect(addDays(selected, 7))} aria-label="Next week" className="icon-btn"><ChevronRight size={18} color={COLORS.inkSoft} /></button>
    </div>
  );
}

function MonthGrid({ selected, today, marksFor, onSelect }) {
  const d = parseISODay(selected);
  const year = d.getFullYear(); const month = d.getMonth();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7; // weeks start on Monday
  const count = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => toISODate(new Date(year, month, i + 1)))];
  const moveMonth = (n) => {
    const target = new Date(year, month + n, 1);
    const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    onSelect(toISODate(new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last))));
  };
  return (
    <div className="mt-4 rounded-3xl p-3 fade-anim" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month" className="icon-btn"><ChevronLeft size={18} color={COLORS.inkSoft} /></button>
        <p className="font-display" style={{ fontSize: 18, color: COLORS.ink }}>{MONTH_NAMES[month]} {year}</p>
        <button type="button" onClick={() => moveMonth(1)} aria-label="Next month" className="icon-btn"><ChevronRight size={18} color={COLORS.inkSoft} /></button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((w, i) => <span key={i} className="text-center text-xs font-semibold" style={{ color: COLORS.inkSoft }}>{w}</span>)}
      </div>
      <div className="grid grid-cols-7" role="grid" aria-label={`${MONTH_NAMES[month]} ${year}`}>
        {cells.map((day, i) => day ? <DayCell key={day} day={day} today={today} selected={selected} mark={marksFor(day)} onSelect={onSelect} compact /> : <span key={`x${i}`} />)}
      </div>
    </div>
  );
}

function SectionTitle({ children, extra }) {
  return (
    <div className="flex items-center justify-between mt-6 mb-2.5">
      <p className="font-display" style={{ fontSize: 19, color: COLORS.ink }}>{children}</p>
      {extra}
    </div>
  );
}

function EventRow({ item, now, onOpen }) {
  const { ev, start, end, people, done } = item;
  const template = templateFor(ev.template);
  const past = end !== null && now !== null && end <= now;
  const alert = alertOf(ev);
  return (
    <button type="button" onClick={onOpen} aria-label={`${ev.title}${done ? ', done' : ''}`} className="w-full flex items-stretch gap-3 text-left event-row">
      <div className="shrink-0 text-right pt-2.5" style={{ width: 62 }}>
        {start === null ? (
          <p className="text-xs font-semibold" style={{ color: COLORS.inkSoft }}>All day</p>
        ) : (
          <>
            <p className="text-xs font-bold" style={{ color: past ? COLORS.inkSoft : COLORS.ink, fontVariantNumeric: 'tabular-nums' }}>{formatTime12(start)}</p>
            <p className="text-xs" style={{ color: COLORS.inkSoft, fontVariantNumeric: 'tabular-nums' }}>{formatTime12(end)}</p>
          </>
        )}
      </div>
      <div className="flex-1 min-w-0 rounded-2xl px-3.5 py-2.5 mb-2" style={{ background: done ? 'transparent' : COLORS.paperRaised, border: `1px solid ${COLORS.line}`, boxShadow: done ? 'none' : `inset 3px 0 0 ${people.length ? getLayer(Math.max(...people.map(p => p.layer))).color : COLORS.accent}`, opacity: done ? 0.6 : 1 }}>
        <div className="flex items-center gap-2">
          {done ? <Check size={15} color={COLORS.good} strokeWidth={3} /> : template && <span aria-hidden="true">{template.emoji}</span>}
          <p className="text-sm font-semibold flex-1 min-w-0 truncate" style={{ color: COLORS.ink, textDecoration: done ? 'line-through' : 'none' }}>{ev.title}</p>
          {people.length > 0 && <AvatarStack people={people} size={22} />}
        </div>
        <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: COLORS.inkSoft }}>
          {people.length > 0 && <span className="truncate">{people.map(p => p.name).join(', ')}</span>}
          {ev.kind === 'recurring' && <span className="flex items-center gap-0.5 shrink-0"><Repeat size={11} />{isDaily(ev) ? 'Daily' : 'Weekly'}</span>}
          {alert !== null && !done && <span className="flex items-center gap-0.5 shrink-0"><Bell size={11} />{alert === 0 ? 'At time' : alert >= 1440 ? '1 day' : alert >= 60 ? `${alert / 60} h` : `${alert} min`}</span>}
        </p>
      </div>
    </button>
  );
}

export function TodayView({ today, selectedDay, onSelectDay, mode, onSetMode, people, journal, events, generalGoals, skills, profile, onPlan, onOpenEvent, onLogEvent, onTickEvent, onOpenPerson, onAddPerson, onOpenLog, onSwitchTab, onOpenGoals, onOpenReview, onOpenDay, onOpenJump, onHideFirstSteps, wide = false }) {
  const state = useMemo(() => ({ people, journal, events, generalGoals }), [people, journal, events, generalGoals]);
  const day = selectedDay || today;
  const sel = parseISODay(day);
  const marks = useMemo(() => {
    const out = {};
    // This month and its neighbours, enough for any week strip.
    [-1, 0, 1].forEach(n => Object.assign(out, monthMarks(state, new Date(sel.getFullYear(), sel.getMonth() + n, 1).getFullYear(), new Date(sel.getFullYear(), sel.getMonth() + n, 1).getMonth())));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, sel.getFullYear(), sel.getMonth()]);
  const marksFor = (d) => marks[d];
  const agenda = useMemo(() => dayAgenda(state, day), [state, day]);
  const clock = new Date();
  const nowMinutes = day === today ? clock.getHours() * 60 + clock.getMinutes() : null;
  const waiting = useMemo(() => needsAnswer(agenda, day, clock), [agenda, day, clock.getHours(), clock.getMinutes()]); // eslint-disable-line react-hooks/exhaustive-deps
  const ideas = useMemo(() => (day >= today ? planIdeas(state, parseISODay(today)) : []), [state, day, today]);
  const suggestion = useMemo(() => focusSuggestion(profile && profile.focus, people, journal, skills, parseISODay(today)), [profile, people, journal, skills, today]);
  const topGoals = useMemo(() => {
    const fromPeople = people.flatMap(p => p.goals.filter(g => g.progress < 100).map(g => ({ ...g, personName: p.name, color: getLayer(p.layer).color })));
    const fromGeneral = generalGoals.filter(g => g.progress < 100).map(g => ({ ...g, personName: null, color: COLORS.accent }));
    return [...fromPeople, ...fromGeneral].sort((a, b) => b.progress - a.progress).slice(0, 3);
  }, [people, generalGoals]);

  // Day-level keys; P for planning is global (App.jsx).
  useEffect(() => {
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping() || hasOpenSheet()) return;
      if (e.key === 'm' || e.key === 'M') { e.preventDefault(); onSetMode(mode === 'month' ? 'day' : 'month'); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); onSelectDay(addDays(day, -1)); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); onSelectDay(addDays(day, 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); onSelectDay(addDays(day, -7)); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); onSelectDay(addDays(day, 7)); }
      else if (e.key === 'Enter' && onOpenDay && !isTabbed()) { e.preventDefault(); onOpenDay(day); }
      else if (e.key === 't' || e.key === 'T') { e.preventDefault(); onSelectDay(today); }
      else if ((e.key === 'l' || e.key === 'L') && waiting[0]) { e.preventDefault(); onLogEvent(waiting[0].ev, day); }
      else if ((e.key === 'j' || e.key === 'J') && waiting[0]) { e.preventDefault(); onTickEvent(waiting[0].ev, day); }
      else if ((e.key === 'i' || e.key === 'I') && ideas[0]) { e.preventDefault(); onPlan({ day, personIds: [ideas[0].person.id], template: ideas[0].template }); }
      // On a Monday the week has barely begun, so W shows the one just gone.
      else if ((e.key === 'w' || e.key === 'W') && onOpenReview) { e.preventDefault(); onOpenReview(sel.getDay() === 1 ? addDays(day, -1) : day); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, day, today, waiting, ideas, onSetMode, onSelectDay, onLogEvent, onTickEvent, onPlan, onOpenReview, onOpenDay]);
  // Clicking the day that's already picked opens it in the popup.
  const pickDay = (d) => (d === day && onOpenDay ? onOpenDay(d) : onSelectDay(d));

  const hour = clock.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const isEmpty = agenda.allDay.length === 0 && agenda.timed.length === 0;
  // A new circle's first things to try, each ticked off by doing it. It
  // stands in for "Try this next" until they're done or it's hidden, and
  // doesn't show for a circle with a few logs already.
  const tried = (profile && profile.tried) || {};
  const firstSteps = [
    { key: 'person', done: people.length > 0, label: 'Add your first person', keys: ['Ctrl', 'Shift', 'A'], run: onAddPerson },
    { key: 'log', done: journal.length > 0, label: 'Log your first chat', keys: ['N'], run: onOpenLog },
    { key: 'plan', done: events.length > 0, label: 'Plan your first thing', keys: ['P'], run: () => onPlan({ day }) },
    { key: 'jump', done: !!tried.jump, label: 'Jump to anything, or type a plan', keys: ['Ctrl', 'K'], run: onOpenJump },
    { key: 'quick', done: !!tried.quick, label: 'Add a plan from any app', keys: ['Ctrl', 'Shift', 'L'], run: null },
  ];
  const showFirstSteps = !!onHideFirstSteps && !(profile && profile.gettingStartedHidden) && journal.length < 5 && firstSteps.some(s => !s.done);
  const nowIndex = nowMinutes === null ? -1 : agenda.timed.findIndex(it => it.start > nowMinutes);
  function runSuggestion() {
    const a = suggestion.action;
    if (a.type === 'addPerson') onAddPerson();
    else if (a.type === 'log') onOpenLog();
    else if (a.type === 'person') onOpenPerson(a.id);
    else if (a.type === 'tab') onSwitchTab(a.tab);
  }

  return (
    <div className={wide ? 'px-8 pt-8 pb-4 today-wide' : 'px-5 pt-6 pb-4'}>
      <div className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm" style={{ color: COLORS.inkSoft }}>{greeting}{profile && profile.name ? `, ${profile.name}` : ''}</p>
        {onOpenJump && <button type="button" onClick={onOpenJump} aria-label="Search, or type a plan" title="Search, or type a plan (Ctrl+K)" className="icon-btn -mr-2"><Search size={18} color={COLORS.inkSoft} /></button>}
      </div>
      <div className="flex items-end justify-between gap-3 mt-0.5">
        <div className="min-w-0">
          <h1 className="font-display" style={{ fontSize: 30, lineHeight: 1.1, color: COLORS.ink, margin: 0 }}>{relativeLabel(day, today)}</h1>
          <p className="text-sm mt-1 flex items-center gap-2" style={{ color: COLORS.inkSoft }}>
            {fullDate(day, today)}
            {day !== today && <button type="button" onClick={() => onSelectDay(today)} className="chip" style={{ padding: '2px 8px', fontSize: 11 }}>Back to today <Kbd>T</Kbd></button>}
          </p>
        </div>
        {!wide && (
          <div className="seg seg--sm shrink-0" role="group" aria-label="Calendar view" style={{ width: 132 }}>
            {['day', 'month'].map(m => (
              <button key={m} type="button" onClick={() => onSetMode(m)} aria-pressed={mode === m} className={`seg-btn${mode === m ? ' seg-btn--on' : ''}`} style={{ fontSize: 12 }}>{m === 'day' ? 'Day' : 'Month'}</button>
            ))}
          </div>
        )}
      </div>

      {!wide && (mode === 'month'
        ? <MonthGrid selected={day} today={today} marksFor={marksFor} onSelect={pickDay} />
        : <WeekStrip selected={day} today={today} marksFor={marksFor} onSelect={pickDay} />)}

      {waiting.length > 0 && (
        <div className="mt-5 flex flex-col gap-2">
          {waiting.map((it, i) => (
            <div key={it.ev.id} className="rounded-2xl p-3.5 fade-anim" style={{ background: COLORS.accentSoft }}>
              <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>How did {it.ev.title.charAt(0).toLowerCase() + it.ev.title.slice(1)} go?</p>
              <div className="flex items-center gap-2 mt-2.5">
                <button type="button" onClick={() => onLogEvent(it.ev, day)} className="text-xs font-semibold rounded-full px-3.5 py-2 flex items-center gap-1.5" style={{ background: COLORS.accent, color: COLORS.onAccent }}>Log it{i === 0 && <Kbd onAccent>L</Kbd>}</button>
                <button type="button" onClick={() => onTickEvent(it.ev, day)} className="chip">Just tick it{i === 0 && <Kbd>J</Kbd>}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <SectionTitle extra={<button type="button" onClick={() => onPlan({ day })} className="chip" style={{ padding: '4px 6px 4px 10px' }}><Plus size={13} color={COLORS.accent} />Plan<Kbd>P</Kbd></button>}>
        {day === today ? 'Your day' : 'Planned'}
      </SectionTitle>

      {agenda.allDay.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {agenda.allDay.map(x => x.kind === 'event' ? (
            <button key={x.id} type="button" onClick={() => onOpenEvent(x.ev.id, day)} className={`chip${x.done ? '' : ' chip--on'}`}>{x.done ? <Check size={12} /> : '📌'} {x.ev.title}</button>
          ) : (
            <button key={x.id} type="button" onClick={() => x.person ? onOpenPerson(x.person.id) : onOpenGoals()} className="chip">{x.emoji} {x.label}</button>
          ))}
        </div>
      )}

      {agenda.timed.map((it, i) => (
        <div key={it.ev.id}>
          {i === nowIndex && <NowLine minutes={nowMinutes} />}
          <EventRow item={it} now={nowMinutes} onOpen={() => onOpenEvent(it.ev.id, day)} />
        </div>
      ))}
      {nowIndex === -1 && nowMinutes !== null && agenda.timed.length > 0 && <NowLine minutes={nowMinutes} />}

      {isEmpty && (
        <button type="button" onClick={() => onPlan({ day })} className="w-full rounded-2xl p-5 text-center" style={{ border: `1.5px dashed ${COLORS.line}`, color: COLORS.inkSoft }}>
          <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Nothing planned{day === today ? ' today' : ''}</p>
          <p className="text-xs mt-1">Tap to plan something, or press P.</p>
        </button>
      )}

      {agenda.logged.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-bold mb-1.5" style={{ color: COLORS.inkSoft, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Logged</p>
          {agenda.logged.map(x => (
            <button key={x.id} type="button" onClick={() => onOpenPerson(x.person.id)} className="w-full flex items-center gap-2 py-1.5 text-left">
              <Check size={13} color={COLORS.good} strokeWidth={3} />
              <span className="text-sm" style={{ color: COLORS.ink }}>{(TYPE_META[x.entry.type] || TYPE_META.other).emoji} <span className="font-semibold">{x.person.name}:</span> {summaryFor(x.entry)}</span>
            </button>
          ))}
        </div>
      )}

      {ideas.length > 0 && (
        <>
          <SectionTitle>Ideas</SectionTitle>
          <div className="flex flex-col gap-2">
            {ideas.map((idea, i) => (
              <div key={idea.person.id} className="flex items-center gap-3 rounded-2xl p-3" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                <AvatarStack people={[idea.person]} size={36} />
                <p className="text-sm flex-1 min-w-0" style={{ color: COLORS.ink }}>{idea.text}</p>
                <button type="button" onClick={() => onPlan({ day, personIds: [idea.person.id], template: idea.template })} className="text-xs font-semibold rounded-full px-3 py-2 shrink-0 flex items-center gap-1.5" style={{ background: COLORS.accent, color: COLORS.onAccent }}>Plan {templateFor(idea.template).label.toLowerCase()}{i === 0 && <Kbd onAccent>I</Kbd>}</button>
              </div>
            ))}
          </div>
        </>
      )}

      {day === today && (
        <>
          {sel.getDay() === 0 && onOpenReview && (
            <button type="button" onClick={() => onOpenReview(day)} className="w-full text-left rounded-2xl p-3.5 mt-6 flex items-center gap-3" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
              <span style={{ fontSize: 22 }} aria-hidden="true">🗓️</span>
              <span className="flex-1">
                <span className="block text-sm font-semibold" style={{ color: COLORS.ink }}>Your week in review</span>
                <span className="block text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>Who you saw, what got done, and next week planned in one go.</span>
              </span>
              <Kbd>W</Kbd>
            </button>
          )}
          {showFirstSteps ? <GettingStarted steps={firstSteps} onHide={onHideFirstSteps} /> : (
            <div className="rounded-2xl p-3.5 mt-6" style={{ background: COLORS.accentSoft }}>
              <p className="text-xs font-semibold" style={{ color: COLORS.accent }}>Try this next</p>
              <p className="text-sm mt-1" style={{ color: COLORS.ink }}>{suggestion.text}</p>
              <button type="button" onClick={runSuggestion} className="text-xs font-semibold rounded-full px-3 py-1.5 mt-2.5" style={{ background: COLORS.accent, color: COLORS.onAccent }}>{suggestion.button}</button>
            </div>
          )}

          <SectionTitle extra={<button type="button" onClick={onOpenGoals} className="text-xs font-medium" style={{ color: COLORS.accent }}>See all</button>}>Current goals</SectionTitle>
          {topGoals.length === 0 ? (
            <p className="text-sm" style={{ color: COLORS.inkSoft }}>No active goals yet. Set one to start tracking progress.</p>
          ) : topGoals.map(g => (
            <button key={g.id} type="button" onClick={() => g.personId ? onOpenPerson(g.personId) : onOpenGoals()} className="w-full text-left rounded-2xl p-3.5 mb-2.5" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>{homeGoalTitle(g, g.personName)}</p>
                <span className="font-display shrink-0" style={{ fontSize: 19, color: g.color }}>{g.progress}%</span>
              </div>
              <div className="mt-2"><ProgressBar percent={g.progress} color={g.color} height={7} /></div>
            </button>
          ))}
        </>
      )}
      </div>
      {wide && <aside className="today-wide-side" aria-label="Month"><MonthGrid selected={day} today={today} marksFor={marksFor} onSelect={pickDay} /></aside>}
    </div>
  );
}

// The getting-started list: each step ticks itself off; a step with a key
// you press anywhere (the quick-add box) only says how.
function GettingStarted({ steps, onHide }) {
  const done = steps.filter(s => s.done).length;
  return (
    <section className="rounded-2xl p-4 mt-6 fade-anim" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }} aria-label="Getting started">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold flex-1" style={{ color: COLORS.ink }}>Getting started</p>
        <span className="text-xs font-semibold" style={{ color: COLORS.accent }}>{done} of {steps.length}</span>
        <button type="button" onClick={onHide} className="text-xs font-medium ml-2" style={{ color: COLORS.inkSoft }}>Hide</button>
      </div>
      <div className="mt-2 mb-1"><ProgressBar percent={(done / steps.length) * 100} height={5} /></div>
      {steps.map(s => {
        const body = (
          <>
            <span className={`first-step-check${s.done ? ' first-step-check--done' : ''}`} aria-hidden="true">{s.done && <Check size={12} strokeWidth={3} />}</span>
            <span className="flex-1 min-w-0 text-sm" style={{ color: s.done ? COLORS.inkSoft : COLORS.ink, textDecoration: s.done ? 'line-through' : 'none' }}>{s.label}</span>
            <span className="flex items-center gap-1 shrink-0">{s.keys.map(k => <Kbd key={k}>{k}</Kbd>)}</span>
          </>
        );
        return s.run && !s.done
          ? <button key={s.key} type="button" onClick={s.run} className="w-full flex items-center gap-2.5 py-2 text-left">{body}</button>
          : <p key={s.key} className="flex items-center gap-2.5 py-2" aria-label={`${s.label}${s.done ? ', done' : ''}`}>{body}</p>;
      })}
    </section>
  );
}

function NowLine({ minutes }) {
  return (
    <div className="flex items-center gap-2 my-1.5" aria-label={`Now, ${formatTime12(minutes)}`}>
      <span className="text-xs font-bold shrink-0 text-right" style={{ width: 62, color: COLORS.alert }}>Now</span>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: COLORS.alert }} />
      <span style={{ flex: 1, height: 1.5, background: COLORS.alert, opacity: 0.6 }} />
    </div>
  );
}
