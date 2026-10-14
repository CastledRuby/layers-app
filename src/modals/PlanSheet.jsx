// Plan something: a new calendar event, or editing one. Three steps, one
// thing at a time, almost all taps, and every tap has a key:
//   what  a template (Coffee, Call, ...)            keys 1-8, or one of your
//         recent plans under "Plan again"           Q W E R; or T to type
//         it ("gym tue thu fri 7am", read as Ctrl+K reads it), and Enter
//         fills in every step and goes on to "when" to check it
//   who   the people                                1-9 or type a name, Enter goes on
//   when  day, time, length, repeat and reminder    1-7 the day (on certain days,
//                                                   Mon-Sun on or off); T, L, R, A and G
//                                                   step through time, length,
//                                                   repeat, reminder and goal
//                                                   (with Shift, backwards);
//                                                   N the title (Esc or Tab
//                                                   leaves it); + a new goal
//                                                   (QuickGoalSheet); Enter saves
// Shift+Enter (or "Save + another") saves and starts the next plan in the same
// sheet, for putting in a lot at once; what's been added shows on the first
// step. "Several days" saves one plan for each day picked; "Every weekday"
// repeats Monday to Friday; "On certain days" repeats on the weekdays picked
// (Tue, Thu and Fri, say), with Mon-Fri and Weekends to start from.
// "When?" sums the plan up in a sentence and warns when it overlaps a plan
// you already have. Editing one of several copies of a plan (the same title,
// people and time, as "Several days" saves them): a copy isn't an overlap, and
// making it repeat replaces the copies on the days it now covers.
// Editing a repeating plan from one of its days asks what to change (O):
// only that day (it becomes a plan of its own, and the repeat skips the day)
// or every time.
// A plan started from a profile or an idea skips the steps it already knows;
// editing opens straight on "when", and so does a copy (prefill.copyOf).
// See docs/renderer/app-structure.md.

import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Copy } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { isPlusKey, isTabbedToButton, isTyping } from '../components/sheetLayer.js';
import { Kbd, KeyedField } from '../components/atoms.jsx';
import { planFieldsOf, readSentence } from '../lib/sentence.js';
import { AvatarStack, PeopleGrid } from '../components/PersonPick.jsx';
import { usePeopleKeys } from '../components/peopleKeys.js';
import { DateDropdown, TimeDropdown } from '../components/pickers.jsx';
import { QuickGoalSheet } from './QuickGoalSheet.jsx';
import { DEFAULT_DURATION, EVENT_TEMPLATES, alertOf, clashesOn, durationOf, isDaily, occursOn, ordinal, recentPlans, repeatText, templateFor, timesText } from '../lib/calendar.js';
import { formatCalendarDate, formatTime12, parseISODay, toISODate, WEEKDAY_FULL, WEEKDAY_SHORT } from '../lib/dates.js';
import { COLORS } from '../theme.js';

const TIMES = [9 * 60, 12 * 60 + 30, 15 * 60 + 30, 18 * 60, 20 * 60];
const LENGTHS = [15, 30, 60, 120, 180];
const ALERTS = [null, 0, 5, 15, 30, 60, 1440];
const REPEATS = [['once', 'Once'], ['several', 'Several days'], ['daily', 'Every day'], ['weekdays', 'Every weekday'], ['weekly', 'On certain days'], ['monthly', 'Monthly']];
const INTERVALS = [[1, 'Every week'], [2, 'Every 2 weeks'], [3, 'Every 3 weeks'], [4, 'Every 4 weeks']];
// A monthly plan from its first day: on that date, that weekday of the month
// ("the third Friday"), or the last one; { by, rule, label } for each that fits.
const NTH_WORDS = ['first', 'second', 'third', 'fourth'];
function monthlyChoices(day) {
  const d = parseISODay(day);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const name = WEEKDAY_FULL[d.getDay()];
  const out = [{ by: 'date', rule: { day: d.getDate() }, label: `On the ${ordinal(d.getDate())}` }];
  if (d.getDate() <= 28) out.push({ by: 'nth', rule: { nth: Math.ceil(d.getDate() / 7), weekday: d.getDay() }, label: `On the ${NTH_WORDS[Math.ceil(d.getDate() / 7) - 1]} ${name}` });
  if (d.getDate() + 7 > last) out.push({ by: 'last', rule: { nth: -1, weekday: d.getDay() }, label: `On the last ${name}` });
  return out;
}
const monthlyRule = (day, by) => { const list = monthlyChoices(day); return (list.find(c => c.by === by) || list[0]).rule; };
// The first day on or after `from` that a weekly repeat falls on.
function firstDayOn(shape, from) {
  if (shape.monthly || !shape.weekdays.length) return from;
  for (let i = 0; i < 7; i++) { const d = addDaysTo(from, i); if (shape.weekdays.includes(parseISODay(d).getDay())) return d; }
  return from;
}
const addDaysTo = (day, n) => { const d = parseISODay(day); return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
const MON_FRI = [1, 2, 3, 4, 5];
const WEEKENDS = [0, 6];
// The week as the day chips show it, Monday first: 1-7 toggle these.
const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];
const isMonFri = (days) => (days || []).length === 5 && MON_FRI.every(d => days.includes(d));
// The weekdays a repeating plan falls on; null when it doesn't repeat.
const repeatDaysOf = (repeat, weekdays) => (repeat === 'daily' ? ALL_WEEK : repeat === 'weekdays' ? MON_FRI : repeat === 'weekly' ? weekdays : null);
const STEPS = ['what', 'who', 'when'];
const AGAIN_KEYS = ['q', 'w', 'e', 'r'];
const lengthLabel = (m) => (m < 60 ? `${m} min` : `${m / 60} h`);
const alertLabel = (a) => (a === null ? 'None' : a === 0 ? 'At the time' : a === 1440 ? '1 day before' : a >= 60 ? `${a / 60} h before` : `${a} min before`);
const namesText = (list) => (list.length <= 2 ? list.join(' and ') : `${list.slice(0, 2).join(', ')} and ${list.length - 2} more`);
const addDays = (day, n) => { const d = parseISODay(day); return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
const shortDay = (d) => `${WEEKDAY_SHORT[parseISODay(d).getDay()]} ${parseISODay(d).getDate()}`;
const daysText = (list) => { const s = [...list].sort().map(shortDay); return s.length > 5 ? `${s.slice(0, 4).join(', ')} and ${s.length - 4} more` : s.length > 1 ? `${s.slice(0, -1).join(', ')} and ${s[s.length - 1]}` : s.join(''); };
// Another copy of `of`, the plan being edited: a one-off with the same title,
// people and time, as "Several days" saves them.
function isCopyOf(ev, of) {
  const ids = (x) => [...(x.personIds || [])].sort().join();
  return ev.id !== of.id && ev.kind === 'oneoff' && ev.title === of.title && ids(ev) === ids(of) && !!ev.allDay === !!of.allDay && (!!ev.allDay || ev.time === of.time);
}
// A typed plan's when, as "Type it" reads it back: "Every Tue, Thu and Fri, 7:00 AM".
function typedWhen(r) {
  const day = r.repeat === 'once' ? formatCalendarDate(parseISODay(r.day)) : repeatText({ kind: 'recurring', weekdays: r.weekdays || [], interval: r.interval, monthly: r.monthly });
  return `${day}, ${r.allDay ? 'all day' : formatTime12(r.time)}`;
}
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
// again (from the day after), or { draft } for a plan typed as a sentence
// (Ctrl+K's "open it in full": the fields readSentence gave, on their day).
function firstStep(start) {
  return start.event || start.copyOf || start.draft ? 'when' : !start.template ? 'what' : start.personIds ? 'when' : 'who';
}
function freshForm(start, people, today, defaultAlert) {
  const editing = start.event || null;
  const source = editing || start.copyOf || start.draft || null;
  const template = templateFor(source ? source.template : start.template);
  const day = editing ? (editing.kind === 'oneoff' ? editing.date : start.day || today)
    : start.draft ? start.draft.date || start.draft.from || today
      : start.copyOf && start.copyOf.kind === 'oneoff' ? addDays(start.day && start.day > today ? start.day : today, 1)
        : start.day || today;
  const personIds = (source ? source.personIds || [] : start.personIds || []).filter(id => people.some(p => p.id === id));
  const recurring = source && source.kind === 'recurring';
  // Days at times of their own show under "On certain days", so a plan
  // that has them opens there, every day or Mon-Fri included (audit
  // 2026-10-14: editing one used to drop them).
  const hasTimes = !!(recurring && source.times && Object.keys(source.times).length);
  const monthlyBy = source && source.monthly ? (typeof source.monthly.day === 'number' ? 'date' : source.monthly.nth === -1 ? 'last' : 'nth') : 'date';
  return {
    template,
    personIds,
    title: source ? source.title : '',
    // A copy keeps a title that was typed, and follows the people otherwise.
    titleTouched: !!editing || (!!(start.copyOf || start.draft) && source.title !== autoTitleFor(template, people, personIds)),
    titleAgain: false, // the title came from "Plan again", not typed
    day,
    days: [day], // for "Several days"
    allDay: source ? !!source.allDay : false,
    time: source && typeof source.time === 'number' ? source.time : template ? template.time : 18 * 60,
    duration: source ? durationOf(source) : template ? template.duration : DEFAULT_DURATION,
    repeat: !recurring ? 'once' : source.monthly ? 'monthly' : source.interval > 1 || hasTimes ? 'weekly' : isDaily(source) ? 'daily' : isMonFri(source.weekdays) ? 'weekdays' : 'weekly',
    weekdays: recurring && !source.monthly && (!isDaily(source) || source.interval > 1 || hasTimes) ? source.weekdays : [parseISODay(day).getDay()],
    // Every 2-4 weeks, which day of the month, and days at times of their own (2026-10-11).
    interval: recurring && source.interval > 1 ? source.interval : 1,
    monthlyBy,
    // A monthly plan's own rule (the 31st, say) is kept while its day and
    // choice stay as they opened: opened on the 30 Nov occurrence, it used to
    // become "the 30th" (audit 2026-10-14).
    keptMonthly: source && source.monthly ? { rule: source.monthly, day, by: monthlyBy } : null,
    startDay: day, // the day it opened on, to tell a Starting day changed
    ownTimes: !!(recurring && source.times && Object.keys(source.times).length),
    times: recurring && source.times ? { ...source.times } : {},
    alert: source ? alertOf(source) : defaultAlert,
    goalId: source ? source.goalId || null : null,
    only: false, // a repeating plan: change only the day it was opened on
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

export function PlanSheet({ people, events = [], today, prefill = {}, defaultAlert = 15, onClose, onSave, onDelete, onCreateGoal }) {
  // After "Save + another", the next plan starts from `start` (the same day,
  // and the same person when planning from a profile).
  const [start, setStart] = useState(prefill);
  const [form, setForm] = useState(() => freshForm(prefill, people, today, defaultAlert));
  const [step, setStep] = useState(() => firstStep(prefill));
  const [dir, setDir] = useState(null);
  const [added, setAdded] = useState([]); // what "Save + another" has saved so far
  const titleRef = useRef(null);
  const [titleFocus, setTitleFocus] = useState(false);
  const [newGoal, setNewGoal] = useState(false);
  // "Type it" on the first step: a plan as a sentence (lib/sentence.js).
  const [typed, setTyped] = useState('');
  const typedRef = useRef(null);
  const read = useMemo(() => (typed.trim() ? readSentence(typed, { people, today }) : null), [typed, people, today]);
  const set = (patch) => setForm(f => ({ ...f, ...(typeof patch === 'function' ? patch(f) : patch) }));
  function fillFromTyped() {
    if (!read || read.kind !== 'plan') return;
    setForm(freshForm({ draft: planFieldsOf(read, defaultAlert) }, people, today, defaultAlert));
    setTyped('');
    go('when');
  }

  const editing = start.event || null;
  const copyOf = !editing && (start.copyOf || start.draft) ? start.copyOf || start.draft : null;
  // The day a repeating plan was opened on, when editing it: "Only Thu 8".
  const occurrence = editing && editing.kind === 'recurring' && start.day ? start.day : null;
  const { template, personIds, day, days, allDay, time, duration, repeat, weekdays, alert, goalId } = form;
  const picked = personIds.map(id => people.find(p => p.id === id)).filter(Boolean);
  const shownTitle = form.titleTouched ? form.title : autoTitleFor(template, people, personIds);
  const goals = picked.flatMap(p => p.goals.filter(g => g.progress < 100).map(g => ({ id: g.id, title: g.title, personName: p.name })));
  const canSave = shownTitle.trim().length > 0 && (repeat !== 'weekly' || weekdays.length > 0) && (repeat !== 'several' || days.length > 0);
  const repeats = editing ? REPEATS.filter(([k]) => k !== 'several') : REPEATS;
  const nextDays = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const recent = useMemo(() => recentPlans(events.filter(ev => !ev.source)), [events]);
  const repeatDays = repeatDaysOf(repeat, weekdays);
  // Editing one of several copies into a repeat: the copies on the days it
  // now covers (from its first day) go when it's saved, so it isn't on any
  // day twice. Copies already ticked off stay.
  // Each copy is checked against how it will really repeat (every 2-4 weeks,
  // monthly), not just its weekdays (audit 2026-10-14).
  const replaced = useMemo(() => {
    if (!editing || !(repeatDays || repeat === 'monthly')) return [];
    const kept = form.keptMonthly && form.keptMonthly.day === day && form.keptMonthly.by === form.monthlyBy ? form.keptMonthly.rule : null;
    const shape = { kind: 'recurring', from: day, weekdays: repeat === 'monthly' ? [] : [...(repeatDays || [])], interval: repeat === 'weekly' && form.interval > 1 ? form.interval : null, monthly: repeat === 'monthly' ? kept || monthlyRule(day, form.monthlyBy) : null };
    return events.filter(ev => !ev.source && isCopyOf(ev, editing) && !ev.doneAt && ev.date >= day && occursOn(shape, ev.date));
  }, [events, editing, repeat, repeatDays, day, form.interval, form.monthlyBy, form.keptMonthly]);
  // Plans already on the day (or days) that this one would overlap. A copy
  // of the plan being edited is the same plan twice, so it's said that way.
  const clashes = useMemo(() => (allDay ? [] : (repeat === 'several' ? days : [day])
    .flatMap(d => clashesOn({ events, people }, d, time, duration, editing && editing.id).map(it => ({ day: d, it })))
    .filter(c => !replaced.includes(c.it.ev))), [events, people, allDay, repeat, days, day, time, duration, editing, replaced]);
  const copyClashes = editing ? clashes.filter(c => isCopyOf(c.it.ev, editing)) : [];
  const overlaps = clashes.filter(c => !copyClashes.includes(c)).slice(0, 3);
  // How it repeats, as a plan would have it (for the summary and the save).
  const repeating = repeat !== 'once' && repeat !== 'several';
  const repeatShape = {
    kind: 'recurring',
    weekdays: repeat === 'monthly' ? [] : [...(repeatDays || [])],
    interval: repeat === 'weekly' && form.interval > 1 ? form.interval : null,
    monthly: repeat === 'monthly' ? (form.keptMonthly && form.keptMonthly.day === day && form.keptMonthly.by === form.monthlyBy ? form.keptMonthly.rule : monthlyRule(day, form.monthlyBy)) : null,
  };
  // Days at times of their own: only those that differ from the plan's time.
  const ownTimes = repeat === 'weekly' && form.ownTimes && !allDay
    ? Object.fromEntries(weekdays.filter(d => typeof form.times[d] === 'number' && form.times[d] !== time).map(d => [d, form.times[d]]))
    : {};
  const peopleKeys = usePeopleKeys(people, personIds, (id) => set(f => ({ personIds: f.personIds.includes(id) ? f.personIds.filter(x => x !== id) : [...f.personIds, id] })));

  function go(next) {
    setDir(STEPS.indexOf(next) >= STEPS.indexOf(step) ? 'in' : 'back');
    setStep(next);
  }
  // "Plan again": the same plan (as a one-off) on the day being planned.
  function pickAgain(ev) {
    const t = templateFor(ev.template);
    const ids = (ev.personIds || []).filter(id => people.some(p => p.id === id));
    set(fm => ({
      template: t, personIds: ids, title: ev.title, titleTouched: ev.title !== autoTitleFor(t, people, ids), titleAgain: true,
      allDay: !!ev.allDay, time: typeof ev.time === 'number' ? ev.time : fm.time, duration: durationOf(ev),
      repeat: 'once', days: [fm.day], alert: alertOf(ev), goalId: ev.goalId || null,
    }));
    go('when');
  }
  // Going back and picking a template drops a title "Plan again" brought,
  // so it can't follow you into a different plan; a typed one stays.
  function pickTemplate(t) {
    const fromAgain = form.titleAgain ? { title: '', titleTouched: false, titleAgain: false } : {};
    set(editing || copyOf ? { template: t, ...fromAgain } : { template: t, time: t.time, duration: t.duration, ...fromAgain });
    go(start.personIds ? 'when' : 'who');
  }
  const BACK = editing ? {} : { who: start.template ? null : 'what', when: start.personIds ? (start.template ? null : 'what') : 'who' };

  function pickDay(d) {
    if (repeat === 'several') set(f => ({ days: f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d].sort() }));
    else set(f => ({ day: d, weekdays: f.repeat === 'weekly' && f.weekdays.length === 1 ? [parseISODay(d).getDay()] : f.weekdays }));
  }
  function toggleWeekday(i) {
    set(f => ({ weekdays: f.weekdays.includes(i) ? f.weekdays.filter(x => x !== i) : [...f.weekdays, i].sort((a, b) => a - b) }));
  }
  function pickRepeat(r) {
    set(f => ({
      repeat: r,
      days: r === 'several' && f.repeat !== 'several' ? [f.day] : f.days,
      day: f.repeat === 'several' && r !== 'several' && f.days.length ? f.days[0] : f.day,
    }));
  }
  // Only that day: a one-off on it (which can still move to another day);
  // back to every time puts the repeat as it was.
  function pickOnly(on) {
    set(f => (on === f.only ? {} : on
      ? { only: true, before: { repeat: f.repeat, day: f.day }, repeat: 'once', day: occurrence }
      : { only: false, ...f.before }));
  }
  function pickTime(t) { set(t === 'all' ? { allDay: true } : { allDay: false, time: t }); }

  // "Coffee with Priya · Tue 6, 6:00 PM", for the list of plans just added.
  function summary() {
    const at = allDay ? 'all day' : formatTime12(time);
    const when = repeat === 'once' ? `${day === today ? 'today' : shortDay(day)}, ${at}`
      : repeat === 'several' ? `${days.length} days, ${at}`
        : `${repeatText(repeatShape).replace(/^(Every|Monthly)/, w => w.toLowerCase())}, ${at}`;
    return `${shownTitle.trim()} · ${when}`;
  }
  function save(another = false) {
    if (!canSave) return;
    const kind = repeating ? 'recurring' : 'oneoff';
    const fields = {
      title: shownTitle.trim(),
      template: template ? template.key : 'custom',
      personIds,
      kind,
      date: kind === 'oneoff' ? day : null,
      weekdays: kind === 'recurring' ? [...repeatShape.weekdays] : null,
      interval: kind === 'recurring' ? repeatShape.interval : null,
      monthly: kind === 'recurring' ? repeatShape.monthly : null,
      times: kind === 'recurring' && Object.keys(ownTimes).length ? ownTimes : null,
      // Editing keeps the start it had (so every 2-4 weeks keeps its weeks, and
      // a monthly plan its earlier days and ticks) unless Starting was changed;
      // a new start is the first day it's on from there, so every 2-4 weeks
      // doesn't skip its first week (audit 2026-10-14).
      from: kind === 'recurring' ? (editing && editing.from && day === form.startDay ? editing.from : firstDayOn(repeatShape, day)) : undefined,
      allDay,
      time: allDay ? null : time,
      duration: allDay ? null : duration,
      alert,
      goalId: goals.some(g => g.id === goalId) ? goalId : null,
    };
    const next = !editing && another;
    onSave(repeat === 'several' ? days.map(d => ({ ...fields, date: d })) : fields, editing ? editing.id : null, { another: next, replaceIds: replaced.map(ev => ev.id), onlyDay: form.only ? occurrence : undefined });
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
      const again = recent[AGAIN_KEYS.indexOf(e.key.toLowerCase())];
      if (num && num <= EVENT_TEMPLATES.length) act(() => pickTemplate(EVENT_TEMPLATES[num - 1]));
      else if (again) act(() => pickAgain(again));
      else if (e.key.toLowerCase() === 't' && typedRef.current) act(() => typedRef.current.focus());
      return;
    }
    if (step === 'who') {
      if (e.key === 'Enter') act(() => go('when'));
      return;
    }
    const back = e.shiftKey;
    const letter = e.key.length === 1 ? e.key.toLowerCase() : null;
    if (e.key === 'Enter') act(() => save(e.shiftKey));
    else if (num && num <= 7 && repeat === 'weekly' && !form.only) act(() => toggleWeekday(MON_FIRST[num - 1]));
    else if (num && num <= 7) act(() => pickDay(nextDays[num - 1]));
    else if (letter === 't') act(() => pickTime(cycle([...TIMES, 'all'], allDay ? 'all' : time, back)));
    else if (letter === 'l' && !allDay) act(() => set({ duration: cycle(LENGTHS, duration, back) }));
    else if (letter === 'r' && !form.only) act(() => pickRepeat(cycle(repeats.map(([k]) => k), repeat, back)));
    else if (letter === 'e' && repeat === 'weekly' && !form.only) act(() => set({ interval: cycle(INTERVALS.map(([n]) => n), form.interval, back) }));
    else if (letter === 'e' && repeat === 'monthly' && !form.only) act(() => set({ monthlyBy: cycle(monthlyChoices(day).map(c => c.by), form.monthlyBy, back) }));
    else if (letter === 'o' && occurrence) act(() => pickOnly(!form.only));
    else if (letter === 'a') act(() => set({ alert: cycle(ALERTS, alert, back) }));
    else if (letter === 'g' && goals.length) act(() => set({ goalId: cycle([null, ...goals.map(g => g.id)], goalId, back) }));
    else if (isPlusKey(e) && picked.length && onCreateGoal) act(() => setNewGoal(true));
    else if (letter === 'n') act(() => { const el = titleRef.current; if (el) { el.focus(); el.select(); } });
  }

  const dayLabel = (d, i) => (i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : shortDay(d));
  const span = (s, e) => `${formatTime12(s)}–${formatTime12(e)}`;
  const whenText = [
    repeat === 'once' ? formatCalendarDate(parseISODay(day))
      : repeat === 'several' ? `${days.length} ${days.length === 1 ? 'day' : 'days'}: ${days.map(shortDay).join(', ')}`
        : `${repeatText(repeatShape) || 'Every week'} from ${formatCalendarDate(parseISODay(day))}`,
    allDay ? 'all day' : Object.keys(ownTimes).length ? timesText({ ...repeatShape, time, times: ownTimes }) : span(time, time + duration),
  ].join(', ') + ` · ${alert === null ? 'no reminder' : alert === 0 ? 'reminder at the time' : `reminder ${alertLabel(alert)}`}`;
  const isDayOn = (d) => (repeat === 'several' ? days.includes(d) : day === d);
  const titles = { what: added.length ? 'Plan another' : 'Plan something', who: 'Who with?', when: editing ? 'Edit plan' : start.copyOf ? 'Plan it again' : 'When?' };
  const saveLabel = editing ? 'Save changes' : repeat === 'several' && days.length > 1 ? `Save ${days.length} plans` : 'Save plan';
  const footer = step === 'what'
    ? (added.length ? <button type="button" onClick={onClose} className="primary-btn">Done, {added.length} added</button> : null)
    : step === 'who'
      ? <button type="button" onClick={() => go('when')} className="primary-btn">{picked.length ? `Continue with ${namesText(picked.map(p => p.name))}` : 'Continue without anyone'} <Kbd onAccent>↵</Kbd></button>
      : <div className="flex items-center gap-2">
          {editing && onDelete && <button type="button" onClick={() => onDelete(editing.id, occurrence)} className="chip" style={{ color: COLORS.alert, borderColor: COLORS.alert, padding: '12px 16px' }}>Delete</button>}
          {!editing && <button type="button" onClick={() => save(true)} disabled={!canSave} className="chip shrink-0" style={{ padding: '10px 12px' }}>Save + another <Kbd>⇧↵</Kbd></button>}
          <button type="button" onClick={() => save()} disabled={!canSave} className="primary-btn">{saveLabel} <Kbd onAccent>↵</Kbd></button>
        </div>;

  return (
    <Sheet title={titles[step]} onClose={onClose} onBack={BACK[step] ? () => go(BACK[step]) : undefined} onKey={onKey} keysFor="plan" footer={footer} tall>
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
            <div className="mb-4">
              <KeyedField letter="T" ref={typedRef} value={typed} onChange={e => setTyped(e.target.value)} aria-label="Type it"
                placeholder='Type it: "gym tue thu fri 7am"'
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); fillFromTyped(); } }}
                className="w-full text-sm rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}` }} />
              {read && (
                <p className="text-xs mt-1.5 flex items-center gap-1.5 flex-wrap" style={{ color: read.kind === 'plan' ? COLORS.inkSoft : COLORS.alert }} role="status" aria-label="What it reads">
                  {read.kind !== 'plan' ? 'That reads as a log: press N to log it, or use Ctrl+K.' : (
                    <>
                      <span><span className="font-semibold" style={{ color: COLORS.ink }}>{read.title}</span> · {typedWhen(read)}</span>
                      {read.unknown.length > 0 && <span style={{ color: COLORS.warn }}>Not in Layers: {read.unknown.join(', ')}</span>}
                      <span className="flex items-center gap-1">fill it in <Kbd>↵</Kbd></span>
                    </>
                  )}
                </p>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {EVENT_TEMPLATES.map((t, i) => (
                <button key={t.key} type="button" onClick={() => pickTemplate(t)} className="tile py-4 px-1 flex flex-col items-center gap-1.5">
                  <Kbd>{i + 1}</Kbd>
                  <span style={{ fontSize: 26, lineHeight: 1 }}>{t.emoji}</span>
                  <span className="text-xs font-semibold text-center">{t.label}</span>
                </button>
              ))}
            </div>
            {recent.length > 0 && (
              <>
                <p className="text-xs font-bold mt-5 mb-2" style={{ color: COLORS.inkSoft, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Plan again</p>
                <div className="flex flex-col gap-1.5">
                  {recent.map((ev, i) => {
                    const t = templateFor(ev.template);
                    const who = (ev.personIds || []).map(id => people.find(p => p.id === id)).filter(Boolean);
                    return (
                      <button key={ev.id} type="button" onClick={() => pickAgain(ev)} className="tile flex items-center gap-2.5 px-3 py-2.5 text-left">
                        <span className="shrink-0"><Kbd>{AGAIN_KEYS[i].toUpperCase()}</Kbd></span>
                        <span aria-hidden="true">{t ? t.emoji : '📌'}</span>
                        <span className="flex-1 min-w-0 text-sm font-semibold truncate">{ev.title}</span>
                        <span className="text-xs shrink-0" style={{ color: COLORS.inkSoft }}>{ev.allDay || typeof ev.time !== 'number' ? 'All day' : formatTime12(ev.time)}</span>
                        {who.length > 0 && <AvatarStack people={who} size={20} />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
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
              <input ref={titleRef} value={shownTitle} onChange={e => set({ title: e.target.value, titleTouched: true, titleAgain: false })}
                onKeyDown={e => { if (e.key === 'Enter' && !e.ctrlKey) { e.preventDefault(); save(e.shiftKey); } }}
                onFocus={() => setTitleFocus(true)} onBlur={() => setTitleFocus(false)}
                aria-label="Title" className="w-full text-sm font-semibold rounded-xl pl-3 pr-12 py-2.5" style={{ border: `1px solid ${COLORS.line}` }} />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><Kbd>{titleFocus ? 'Esc' : 'N'}</Kbd></span>
            </div>
            <p className="text-xs -mt-2 mb-2" style={{ color: COLORS.inkSoft }} aria-label="Summary">{whenText}</p>
            {overlaps.length > 0 && (
              <p className="text-xs mb-3 flex items-start gap-1.5 fade-anim" role="status" style={{ color: COLORS.warn }}>
                <AlertTriangle size={13} className="shrink-0" style={{ marginTop: 1 }} />
                <span>Overlaps {overlaps.map(c => `${c.it.ev.title} (${repeat === 'several' ? `${shortDay(c.day)}, ` : ''}${span(c.it.start, c.it.end)})`).join(', ')}</span>
              </p>
            )}
            {copyClashes.length > 0 && (
              <p className="text-xs mb-3 flex items-start gap-1.5 fade-anim" role="status" style={{ color: COLORS.warn }}>
                <AlertTriangle size={13} className="shrink-0" style={{ marginTop: 1 }} />
                <span>{shortDay(copyClashes[0].day)} already has a copy of this plan, so it would be on there twice.</span>
              </p>
            )}
            {replaced.length > 0 && (
              <p className="text-xs mb-3 flex items-start gap-1.5 fade-anim" role="status" style={{ color: COLORS.inkSoft }}>
                <Copy size={13} className="shrink-0" style={{ marginTop: 1 }} />
                <span>Replaces its {replaced.length === 1 ? 'copy' : `${replaced.length} copies`} on {daysText(replaced.map(ev => ev.date))}, so it's on each day once.</span>
              </p>
            )}
            <div className="mb-2" />
            {occurrence && (
              <Section title="Change" hint="O">
                <Choice on={form.only} onClick={() => pickOnly(true)}>Only {shortDay(occurrence)}</Choice>
                <Choice on={!form.only} onClick={() => pickOnly(false)}>Every time</Choice>
              </Section>
            )}
            <Section title={repeat === 'several' ? 'Days (pick as many as you like)' : repeat === 'once' ? 'Day' : 'Starting'} hint={repeat === 'weekly' && !form.only ? null : '1–7'}>
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
            {!form.only && <Section title="Repeat" hint="R">
              {repeats.map(([k, label]) => <Choice key={k} on={repeat === k} onClick={() => pickRepeat(k)}>{label}</Choice>)}
              {repeat === 'weekly' && (
                <span className="w-full mt-1.5" role="group" aria-label="Repeat on">
                  <span className="text-xs mb-1.5 flex items-center gap-1.5" style={{ color: COLORS.inkSoft }}>Pick as many days as you like <Kbd>1–7</Kbd></span>
                  <span className="flex flex-wrap gap-1.5">
                    {MON_FIRST.map(i => <Choice key={i} label={WEEKDAY_FULL[i]} on={weekdays.includes(i)} onClick={() => toggleWeekday(i)}>{WEEKDAY_SHORT[i]}</Choice>)}
                    <Choice on={weekdays.join() === MON_FRI.join()} onClick={() => set({ weekdays: MON_FRI })}>Mon–Fri</Choice>
                    <Choice on={weekdays.join() === WEEKENDS.join()} onClick={() => set({ weekdays: WEEKENDS })}>Weekends</Choice>
                  </span>
                  {!weekdays.length && <span className="text-xs mt-1.5 block" style={{ color: COLORS.alert }}>Pick at least one day.</span>}
                </span>
              )}
              {repeat === 'weekly' && (
                <span className="w-full flex flex-wrap items-center gap-1.5 mt-1.5" role="group" aria-label="How often">
                  {INTERVALS.map(([n, label]) => <Choice key={n} on={form.interval === n} onClick={() => set({ interval: n })}>{label}</Choice>)}
                  <Kbd>E</Kbd>
                </span>
              )}
              {repeat === 'weekly' && !allDay && weekdays.length > 1 && (
                <span className="w-full mt-1.5" role="group" aria-label="Times">
                  <Choice on={form.ownTimes} onClick={() => set(f => ({ ownTimes: !f.ownTimes }))}>A different time on some days</Choice>
                  {form.ownTimes && (
                    <span className="flex flex-wrap gap-x-3 gap-y-1.5 mt-1.5">
                      {MON_FIRST.filter(d => weekdays.includes(d)).map(d => (
                        <span key={d} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: COLORS.ink }} aria-label={`${WEEKDAY_FULL[d]}'s time`}>
                          {WEEKDAY_SHORT[d]}
                          <TimeDropdown compact value={typeof form.times[d] === 'number' ? form.times[d] : time} onChange={(t) => set(f => ({ times: { ...f.times, [d]: t } }))} />
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              )}
              {repeat === 'monthly' && (
                <span className="w-full flex flex-wrap items-center gap-1.5 mt-1.5" role="group" aria-label="Each month">
                  {monthlyChoices(day).map(c => <Choice key={c.by} on={monthlyChoices(day).some(x => x.by === form.monthlyBy) ? form.monthlyBy === c.by : c.by === 'date'} onClick={() => set({ monthlyBy: c.by })}>{c.by === 'date' && form.keptMonthly && form.keptMonthly.day === day && form.keptMonthly.by === 'date' && typeof form.keptMonthly.rule.day === 'number' ? `On the ${ordinal(form.keptMonthly.rule.day)}` : c.label}</Choice>)}
                  <Kbd>E</Kbd>
                </span>
              )}
            </Section>}
            <Section title="Remind me" hint="A">
              {ALERTS.map(a => <Choice key={String(a)} on={alert === a} onClick={() => set({ alert: a })}>{alertLabel(a)}</Choice>)}
            </Section>
            {picked.length > 0 && (goals.length > 0 || onCreateGoal) && (
              <Section title="Moves a goal (optional)" hint={goals.length ? 'G' : null}>
                {goals.map(g => <Choice key={g.id} on={goalId === g.id} onClick={() => set(f => ({ goalId: f.goalId === g.id ? null : g.id }))}>{g.title}{picked.length > 1 ? ` (${g.personName})` : ''}</Choice>)}
                {onCreateGoal && <button type="button" onClick={() => setNewGoal(true)} className="chip" style={{ padding: '4px 6px 4px 10px' }}>+ New goal <Kbd>+</Kbd></button>}
              </Section>
            )}
            {newGoal && (
              <QuickGoalSheet people={people} forIds={personIds} today={today} onClose={() => setNewGoal(false)}
                onCreate={(personId, goal) => { onCreateGoal(personId, goal); set({ goalId: goal.id }); setNewGoal(false); }} />
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
