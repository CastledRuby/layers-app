// Plan something: a new calendar event, or editing one. Three steps, one
// thing at a time, almost all taps, and every tap has a key:
//   what  a template (Coffee, Call, ...)            keys 1-8
//   who   the people                                1-9 or type a name, Enter goes on
//   when  day, time, length, repeat and reminder    1-7 the day; T, L, R, A and G
//                                                   step through time, length,
//                                                   repeat, reminder and goal
//                                                   (with Shift, backwards);
//                                                   N the title; Enter saves
// Shift+Enter (or "Save + another") saves and starts the next plan in the same
// sheet, for putting in a lot at once; what's been added shows on the first
// step. "Several days" saves one plan for each day picked.
// A plan started from a profile or an idea skips the steps it already knows;
// editing opens straight on "when", and so does a copy (prefill.copyOf).
// See docs/renderer/app-structure.md.

import { useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { isTabbedToButton, isTyping } from '../components/sheetLayer.js';
import { Kbd } from '../components/atoms.jsx';
import { PeopleGrid } from '../components/PersonPick.jsx';
import { usePeopleKeys } from '../components/peopleKeys.js';
import { DateDropdown, TimeDropdown } from '../components/pickers.jsx';
import { DEFAULT_DURATION, EVENT_TEMPLATES, alertOf, durationOf, isDaily, templateFor } from '../lib/calendar.js';
import { formatTime12, formatWeekdays, parseISODay, toISODate, WEEKDAY_SHORT } from '../lib/dates.js';
import { COLORS } from '../theme.js';

const TIMES = [9 * 60, 12 * 60 + 30, 15 * 60 + 30, 18 * 60, 20 * 60];
const LENGTHS = [15, 30, 60, 120, 180];
const ALERTS = [null, 0, 5, 15, 30, 60, 1440];
const REPEATS = [['once', 'Once'], ['several', 'Several days'], ['daily', 'Every day'], ['weekly', 'Every week']];
const MON_FRI = [1, 2, 3, 4, 5];
const STEPS = ['what', 'who', 'when'];
const lengthLabel = (m) => (m < 60 ? `${m} min` : `${m / 60} h`);
const alertLabel = (a) => (a === null ? 'None' : a === 0 ? 'At the time' : a === 1440 ? '1 day before' : a >= 60 ? `${a / 60} h before` : `${a} min before`);
const namesText = (list) => (list.length <= 2 ? list.join(' and ') : `${list.slice(0, 2).join(', ')} and ${list.length - 2} more`);
const addDays = (day, n) => { const d = parseISODay(day); return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
const shortDay = (d) => `${WEEKDAY_SHORT[parseISODay(d).getDay()]} ${parseISODay(d).getDate()}`;
const autoTitleFor = (template, people, personIds) => (template || templateFor('custom')).title(namesText(personIds.map(id => (people.find(p => p.id === id) || {}).name).filter(Boolean)));

// The next item in a list after `current` (with `back`, the one before),
// wrapping round; from something not in the list, the first (or last).
function cycle(list, current, back) {
  const i = list.indexOf(current);
  if (i < 0) return back ? list[list.length - 1] : list[0];
  return list[(i + (back ? list.length - 1 : 1)) % list.length];
}

// What the sheet opens on. `start` is the prefill: { day, personIds,
// template } for a new plan, { event } to edit one, { copyOf } to plan one
// again (from the day after).
function firstStep(start) {
  return start.event || start.copyOf ? 'when' : !start.template ? 'what' : start.personIds ? 'when' : 'who';
}
function freshForm(start, people, today, defaultAlert) {
  const editing = start.event || null;
  const source = editing || start.copyOf || null;
  const template = templateFor(source ? source.template : start.template);
  const day = editing ? (editing.kind === 'oneoff' ? editing.date : start.day || today)
    : start.copyOf && start.copyOf.kind === 'oneoff' ? addDays(start.day && start.day > today ? start.day : today, 1)
      : start.day || today;
  const personIds = (source ? source.personIds || [] : start.personIds || []).filter(id => people.some(p => p.id === id));
  const recurring = source && source.kind === 'recurring';
  return {
    template,
    personIds,
    title: source ? source.title : '',
    // A copy keeps a title that was typed, and follows the people otherwise.
    titleTouched: !!editing || (!!start.copyOf && start.copyOf.title !== autoTitleFor(template, people, personIds)),
    day,
    days: [day], // for "Several days"
    allDay: source ? !!source.allDay : false,
    time: source && typeof source.time === 'number' ? source.time : template ? template.time : 18 * 60,
    duration: source ? durationOf(source) : template ? template.duration : DEFAULT_DURATION,
    repeat: recurring ? (isDaily(source) ? 'daily' : 'weekly') : 'once',
    weekdays: recurring && !isDaily(source) ? source.weekdays : [parseISODay(day).getDay()],
    alert: source ? alertOf(source) : defaultAlert,
    goalId: source ? source.goalId || null : null,
  };
}

function Choice({ on, onClick, children, label }) {
  return <button type="button" onClick={onClick} aria-pressed={on} aria-label={label} className={`chip${on ? ' chip--on' : ''}`}>{children}</button>;
}
function Section({ title, hint, children }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: COLORS.inkSoft, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{title}{hint && <Kbd>{hint}</Kbd>}</p>
      <div className="flex flex-wrap gap-1.5 items-center">{children}</div>
    </div>
  );
}

export function PlanSheet({ people, today, prefill = {}, defaultAlert = 15, onClose, onSave, onDelete }) {
  // After "Save + another", the next plan starts from `start` (the same day,
  // and the same person when planning from a profile).
  const [start, setStart] = useState(prefill);
  const [form, setForm] = useState(() => freshForm(prefill, people, today, defaultAlert));
  const [step, setStep] = useState(() => firstStep(prefill));
  const [dir, setDir] = useState(null);
  const [added, setAdded] = useState([]); // what "Save + another" has saved so far
  const titleRef = useRef(null);
  const set = (patch) => setForm(f => ({ ...f, ...(typeof patch === 'function' ? patch(f) : patch) }));

  const editing = start.event || null;
  const copyOf = !editing && start.copyOf ? start.copyOf : null;
  const { template, personIds, day, days, allDay, time, duration, repeat, weekdays, alert, goalId } = form;
  const picked = personIds.map(id => people.find(p => p.id === id)).filter(Boolean);
  const shownTitle = form.titleTouched ? form.title : autoTitleFor(template, people, personIds);
  const goals = picked.flatMap(p => p.goals.filter(g => g.progress < 100).map(g => ({ id: g.id, title: g.title, personName: p.name })));
  const canSave = shownTitle.trim().length > 0 && (repeat !== 'weekly' || weekdays.length > 0) && (repeat !== 'several' || days.length > 0);
  const repeats = editing ? REPEATS.filter(([k]) => k !== 'several') : REPEATS;
  const nextDays = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const peopleKeys = usePeopleKeys(people, personIds, (id) => set(f => ({ personIds: f.personIds.includes(id) ? f.personIds.filter(x => x !== id) : [...f.personIds, id] })));

  function go(next) {
    setDir(STEPS.indexOf(next) >= STEPS.indexOf(step) ? 'in' : 'back');
    setStep(next);
  }
  function pickTemplate(t) {
    set(editing || copyOf ? { template: t } : { template: t, time: t.time, duration: t.duration });
    go(start.personIds ? 'when' : 'who');
  }
  const BACK = editing ? {} : { who: start.template ? null : 'what', when: start.personIds ? (start.template ? null : 'what') : 'who' };

  function pickDay(d) {
    if (repeat === 'several') set(f => ({ days: f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d].sort() }));
    else set(f => ({ day: d, weekdays: f.repeat === 'weekly' && f.weekdays.length === 1 ? [parseISODay(d).getDay()] : f.weekdays }));
  }
  function pickRepeat(r) {
    set(f => ({
      repeat: r,
      days: r === 'several' && f.repeat !== 'several' ? [f.day] : f.days,
      day: f.repeat === 'several' && r !== 'several' && f.days.length ? f.days[0] : f.day,
    }));
  }
  function pickTime(t) { set(t === 'all' ? { allDay: true } : { allDay: false, time: t }); }

  // "Coffee with Priya · Tue 6, 6:00 PM", for the list of plans just added.
  function summary() {
    const at = allDay ? 'all day' : formatTime12(time);
    const when = repeat === 'once' ? `${day === today ? 'today' : shortDay(day)}, ${at}`
      : repeat === 'several' ? `${days.length} days, ${at}`
        : repeat === 'daily' ? `every day, ${at}` : `${formatWeekdays(weekdays).replace(/^Every/, 'every')}, ${at}`;
    return `${shownTitle.trim()} · ${when}`;
  }
  function save(another = false) {
    if (!canSave) return;
    const kind = repeat === 'once' || repeat === 'several' ? 'oneoff' : 'recurring';
    const fields = {
      title: shownTitle.trim(),
      template: template ? template.key : 'custom',
      personIds,
      kind,
      date: kind === 'oneoff' ? day : null,
      weekdays: kind === 'recurring' ? (repeat === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : weekdays) : null,
      from: kind === 'recurring' ? (editing && editing.from && editing.from < day ? editing.from : day) : undefined,
      allDay,
      time: allDay ? null : time,
      duration: allDay ? null : duration,
      alert,
      goalId: goals.some(g => g.id === goalId) ? goalId : null,
    };
    const next = !editing && another;
    onSave(repeat === 'several' ? days.map(d => ({ ...fields, date: d })) : fields, editing ? editing.id : null, { another: next });
    if (!next) return;
    // Start the next plan here: the same day, and the same person if the
    // plan came from their profile.
    const base = { day: start.day, personIds: !start.template && !start.copyOf ? start.personIds : undefined };
    setAdded(list => [...list, summary()]);
    setStart(base);
    setForm(freshForm(base, people, today, defaultAlert));
    setDir('back');
    setStep(firstStep(base));
  }

  function onKey(e) {
    if (e.metaKey || e.altKey) return;
    if (e.ctrlKey) { if (e.key === 'Enter' && step === 'when') { e.preventDefault(); save(e.shiftKey); } return; }
    if (isTyping()) return;
    if (step === 'who' && !(e.key === 'Enter' && isTabbedToButton()) && peopleKeys.handleKey(e)) return;
    if (e.key === 'Backspace' && BACK[step]) { e.preventDefault(); go(BACK[step]); return; }
    if (e.key === 'Enter' && isTabbedToButton()) return;
    const num = /^[1-9]$/.test(e.key) ? Number(e.key) : null;
    const act = (fn) => { e.preventDefault(); fn(); };
    if (step === 'what') {
      if (num && num <= EVENT_TEMPLATES.length) act(() => pickTemplate(EVENT_TEMPLATES[num - 1]));
      return;
    }
    if (step === 'who') {
      if (e.key === 'Enter') act(() => go('when'));
      return;
    }
    const back = e.shiftKey;
    const letter = e.key.length === 1 ? e.key.toLowerCase() : null;
    if (e.key === 'Enter') act(() => save(e.shiftKey));
    else if (num && num <= 7) act(() => pickDay(nextDays[num - 1]));
    else if (letter === 't') act(() => pickTime(cycle([...TIMES, 'all'], allDay ? 'all' : time, back)));
    else if (letter === 'l' && !allDay) act(() => set({ duration: cycle(LENGTHS, duration, back) }));
    else if (letter === 'r') act(() => pickRepeat(cycle(repeats.map(([k]) => k), repeat, back)));
    else if (letter === 'a') act(() => set({ alert: cycle(ALERTS, alert, back) }));
    else if (letter === 'g' && goals.length) act(() => set({ goalId: cycle([null, ...goals.map(g => g.id)], goalId, back) }));
    else if (letter === 'n') act(() => titleRef.current && titleRef.current.select());
  }

  const dayLabel = (d, i) => (i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : shortDay(d));
  const isDayOn = (d) => (repeat === 'several' ? days.includes(d) : day === d);
  const titles = { what: added.length ? 'Plan another' : 'Plan something', who: 'Who with?', when: editing ? 'Edit plan' : copyOf ? 'Plan it again' : 'When?' };
  const saveLabel = editing ? 'Save changes' : repeat === 'several' && days.length > 1 ? `Save ${days.length} plans` : 'Save plan';
  const footer = step === 'what'
    ? (added.length ? <button type="button" onClick={onClose} className="primary-btn">Done, {added.length} added</button> : null)
    : step === 'who'
      ? <button type="button" onClick={() => go('when')} className="primary-btn">{picked.length ? `Continue with ${namesText(picked.map(p => p.name))}` : 'Continue without anyone'} <Kbd onAccent>↵</Kbd></button>
      : <div className="flex items-center gap-2">
          {editing && onDelete && <button type="button" onClick={() => onDelete(editing.id)} className="chip" style={{ color: COLORS.alert, borderColor: COLORS.alert, padding: '12px 16px' }}>Delete</button>}
          {!editing && <button type="button" onClick={() => save(true)} disabled={!canSave} className="chip shrink-0" style={{ padding: '10px 12px' }}>Save + another <Kbd>⇧↵</Kbd></button>}
          <button type="button" onClick={() => save()} disabled={!canSave} className="primary-btn">{saveLabel} <Kbd onAccent>↵</Kbd></button>
        </div>;

  return (
    <Sheet title={titles[step]} onClose={onClose} onBack={BACK[step] ? () => go(BACK[step]) : undefined} onKey={onKey} footer={footer} tall>
      <div key={`${step}${added.length}`} className={dir === 'in' ? 'step-in' : dir === 'back' ? 'step-back' : ''}>
        {step === 'what' && (
          <>
            {added.length > 0 && (
              <div className="rounded-2xl px-3.5 py-2.5 mb-4" style={{ background: COLORS.accentSoft }} role="status" aria-label="Added so far">
                {added.slice(-4).map((line, i) => (
                  <p key={i} className="text-xs flex items-center gap-1.5 py-0.5" style={{ color: COLORS.ink }}><Check size={12} color={COLORS.good} strokeWidth={3} className="shrink-0" /><span className="truncate">{line}</span></p>
                ))}
                {added.length > 4 && <p className="text-xs pl-5" style={{ color: COLORS.inkSoft }}>and {added.length - 4} before that</p>}
              </div>
            )}
            <div className="grid grid-cols-4 gap-2">
              {EVENT_TEMPLATES.map((t, i) => (
                <button key={t.key} type="button" onClick={() => pickTemplate(t)} className="tile py-4 px-1 flex flex-col items-center gap-1.5">
                  <Kbd>{i + 1}</Kbd>
                  <span style={{ fontSize: 26, lineHeight: 1 }}>{t.emoji}</span>
                  <span className="text-xs font-semibold text-center">{t.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'who' && (
          <>
            <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>Tap who it's with, press their number, or type a name. You can pick more than one, or nobody.</p>
            <PeopleGrid keys={peopleKeys} pickedIds={personIds} />
          </>
        )}

        {step === 'when' && (
          <>
            <div className="mb-4" style={{ position: 'relative' }}>
              <input ref={titleRef} value={shownTitle} onChange={e => set({ title: e.target.value, titleTouched: true })}
                onKeyDown={e => { if (e.key === 'Enter' && !e.ctrlKey) { e.preventDefault(); save(e.shiftKey); } }}
                aria-label="Title" className="w-full text-sm font-semibold rounded-xl pl-3 pr-10 py-2.5" style={{ border: `1px solid ${COLORS.line}` }} />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><Kbd>N</Kbd></span>
            </div>
            <Section title={repeat === 'several' ? 'Days (pick as many as you like)' : repeat === 'once' ? 'Day' : 'Starting'} hint="1–7">
              {nextDays.map((d, i) => <Choice key={d} on={isDayOn(d)} onClick={() => pickDay(d)}>{dayLabel(d, i)}</Choice>)}
              {repeat === 'several' && days.filter(d => !nextDays.includes(d)).map(d => <Choice key={d} on onClick={() => pickDay(d)}>{shortDay(d)}</Choice>)}
              <DateDropdown compact other highlight={repeat !== 'several' && !nextDays.includes(day)} value={parseISODay(repeat === 'several' ? days[days.length - 1] || day : day)}
                onChange={(d) => { const iso = toISODate(d); if (repeat !== 'several' || !days.includes(iso)) pickDay(iso); }}
                minDate={editing ? undefined : new Date()} />
            </Section>
            <Section title="Time" hint="T">
              {TIMES.map(t => <Choice key={t} on={!allDay && time === t} onClick={() => pickTime(t)}>{formatTime12(t)}</Choice>)}
              <Choice on={allDay} onClick={() => pickTime('all')}>All day</Choice>
              <TimeDropdown compact highlight={!allDay && !TIMES.includes(time)} value={time} onChange={pickTime} />
            </Section>
            {!allDay && (
              <Section title="How long" hint="L">
                {LENGTHS.map(m => <Choice key={m} on={duration === m} onClick={() => set({ duration: m })}>{lengthLabel(m)}</Choice>)}
              </Section>
            )}
            <Section title="Repeat" hint="R">
              {repeats.map(([k, label]) => <Choice key={k} on={repeat === k} onClick={() => pickRepeat(k)}>{label}</Choice>)}
              {repeat === 'weekly' && (
                <span className="w-full flex flex-wrap gap-1 mt-1">
                  {WEEKDAY_SHORT.map((w, i) => <Choice key={w} label={w} on={weekdays.includes(i)} onClick={() => set(f => ({ weekdays: f.weekdays.includes(i) ? f.weekdays.filter(x => x !== i) : [...f.weekdays, i].sort((a, b) => a - b) }))}>{w[0]}</Choice>)}
                  <Choice on={weekdays.join() === MON_FRI.join()} onClick={() => set({ weekdays: MON_FRI })}>Mon–Fri</Choice>
                </span>
              )}
            </Section>
            <Section title="Remind me" hint="A">
              {ALERTS.map(a => <Choice key={String(a)} on={alert === a} onClick={() => set({ alert: a })}>{alertLabel(a)}</Choice>)}
            </Section>
            {goals.length > 0 && (
              <Section title="Moves a goal (optional)" hint="G">
                {goals.map(g => <Choice key={g.id} on={goalId === g.id} onClick={() => set(f => ({ goalId: f.goalId === g.id ? null : g.id }))}>{g.title}{picked.length > 1 ? ` (${g.personName})` : ''}</Choice>)}
              </Section>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
