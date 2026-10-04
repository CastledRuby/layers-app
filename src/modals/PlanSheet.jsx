// Plan something: a new calendar event, or editing one. Three steps, one
// thing at a time, almost all taps:
//   what  a template (Coffee, Call, ...)            keys 1-8
//   who   the people                                Enter goes on
//   when  day, time, length, repeat and reminder    Enter saves
// A plan started from a profile or an idea skips the steps it already knows;
// editing opens straight on "when". See docs/renderer/app-structure.md.

import { useState } from 'react';
import { Sheet } from '../components/Sheet.jsx';
import { isTabbedToButton, isTyping } from '../components/sheetLayer.js';
import { Kbd } from '../components/atoms.jsx';
import { PersonPick } from '../components/PersonPick.jsx';
import { DateDropdown, TimeDropdown } from '../components/pickers.jsx';
import { DEFAULT_DURATION, EVENT_TEMPLATES, alertOf, durationOf, isDaily, templateFor } from '../lib/calendar.js';
import { formatTime12, parseISODay, toISODate, WEEKDAY_SHORT } from '../lib/dates.js';
import { COLORS } from '../theme.js';

const TIMES = [9 * 60, 12 * 60 + 30, 15 * 60 + 30, 18 * 60, 20 * 60];
const LENGTHS = [15, 30, 60, 120, 180];
const ALERTS = [null, 0, 5, 15, 30, 60, 1440];
const STEPS = ['what', 'who', 'when'];
const lengthLabel = (m) => (m < 60 ? `${m} min` : `${m / 60} h`);
const alertLabel = (a) => (a === null ? 'None' : a === 0 ? 'At the time' : a === 1440 ? '1 day before' : a >= 60 ? `${a / 60} h before` : `${a} min before`);
const namesText = (list) => (list.length <= 2 ? list.join(' and ') : `${list.slice(0, 2).join(', ')} and ${list.length - 2} more`);

function Choice({ on, onClick, children, label }) {
  return <button type="button" onClick={onClick} aria-pressed={on} aria-label={label} className={`chip${on ? ' chip--on' : ''}`}>{children}</button>;
}
function Section({ title, children }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-bold mb-2" style={{ color: COLORS.inkSoft, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{title}</p>
      <div className="flex flex-wrap gap-1.5 items-center">{children}</div>
    </div>
  );
}

export function PlanSheet({ people, today, prefill = {}, defaultAlert = 15, onClose, onSave, onDelete }) {
  const editing = prefill.event || null;
  const startDay = editing ? (editing.kind === 'oneoff' ? editing.date : (prefill.day || today)) : (prefill.day || today);
  const [template, setTemplate] = useState(() => templateFor(editing ? editing.template : prefill.template));
  const [personIds, setPersonIds] = useState(() => (editing ? editing.personIds || [] : prefill.personIds || []).filter(id => people.some(p => p.id === id)));
  const [step, setStep] = useState(() => (editing ? 'when' : !prefill.template ? 'what' : prefill.personIds ? 'when' : 'who'));
  const [dir, setDir] = useState(null);
  const [title, setTitle] = useState(editing ? editing.title : '');
  const [titleTouched, setTitleTouched] = useState(!!editing);
  const [day, setDay] = useState(startDay);
  const [allDay, setAllDay] = useState(editing ? !!editing.allDay : false);
  const [time, setTime] = useState(() => (editing && typeof editing.time === 'number' ? editing.time : (template ? template.time : 18 * 60)));
  const [duration, setDuration] = useState(() => (editing ? durationOf(editing) : template ? template.duration : DEFAULT_DURATION));
  const [repeat, setRepeat] = useState(() => (editing && editing.kind === 'recurring' ? (isDaily(editing) ? 'daily' : 'weekly') : 'once'));
  const [weekdays, setWeekdays] = useState(() => (editing && editing.kind === 'recurring' ? editing.weekdays : [parseISODay(startDay).getDay()]));
  const [alert, setAlert] = useState(() => (editing ? alertOf(editing) : defaultAlert));
  const [goalId, setGoalId] = useState(editing ? editing.goalId || null : null);

  const picked = personIds.map(id => people.find(p => p.id === id)).filter(Boolean);
  const autoTitle = (template || templateFor('custom')).title(namesText(picked.map(p => p.name)));
  const shownTitle = titleTouched ? title : autoTitle;
  const goals = picked.flatMap(p => p.goals.filter(g => g.progress < 100).map(g => ({ id: g.id, title: g.title, personName: p.name })));
  const canSave = shownTitle.trim().length > 0 && (repeat !== 'weekly' || weekdays.length > 0);

  function go(next) {
    setDir(STEPS.indexOf(next) >= STEPS.indexOf(step) ? 'in' : 'back');
    setStep(next);
  }
  function pickTemplate(t) {
    setTemplate(t);
    if (!editing) { setTime(t.time); setDuration(t.duration); }
    go(prefill.personIds ? 'when' : 'who');
  }
  const BACK = editing ? {} : { who: prefill.template ? null : 'what', when: prefill.personIds ? (prefill.template ? null : 'what') : 'who' };
  function save() {
    if (!canSave) return;
    const kind = repeat === 'once' ? 'oneoff' : 'recurring';
    onSave({
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
    }, editing ? editing.id : null);
  }

  function onKey(e) {
    if (e.metaKey || e.altKey) return;
    if (e.ctrlKey) { if (e.key === 'Enter' && step === 'when') { e.preventDefault(); save(); } return; }
    if (isTyping()) return;
    if (e.key === 'Backspace' && BACK[step]) { e.preventDefault(); go(BACK[step]); return; }
    if (e.key === 'Enter' && isTabbedToButton()) return;
    const num = /^[1-9]$/.test(e.key) ? Number(e.key) : null;
    if (step === 'what' && num && num <= EVENT_TEMPLATES.length) { e.preventDefault(); pickTemplate(EVENT_TEMPLATES[num - 1]); }
    else if (step === 'who' && e.key === 'Enter') { e.preventDefault(); go('when'); }
    else if (step === 'when' && e.key === 'Enter') { e.preventDefault(); save(); }
  }

  const days = Array.from({ length: 7 }, (_, i) => { const d = parseISODay(today); return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + i)); });
  const dayLabel = (d, i) => (i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `${WEEKDAY_SHORT[parseISODay(d).getDay()]} ${parseISODay(d).getDate()}`);
  const titles = { what: 'Plan something', who: 'Who with?', when: editing ? 'Edit plan' : 'When?' };
  const footer = step === 'who'
    ? <button type="button" onClick={() => go('when')} className="primary-btn">{picked.length ? `Continue with ${namesText(picked.map(p => p.name))}` : 'Continue without anyone'} <Kbd onAccent>↵</Kbd></button>
    : step === 'when'
      ? <div className="flex items-center gap-2">
          {editing && onDelete && <button type="button" onClick={() => onDelete(editing.id)} className="chip" style={{ color: COLORS.alert, borderColor: COLORS.alert, padding: '12px 16px' }}>Delete</button>}
          <button type="button" onClick={save} disabled={!canSave} className="primary-btn">{editing ? 'Save changes' : 'Save plan'} <Kbd onAccent>↵</Kbd></button>
        </div>
      : null;

  return (
    <Sheet title={titles[step]} onClose={onClose} onBack={BACK[step] ? () => go(BACK[step]) : undefined} onKey={onKey} footer={footer} tall>
      <div key={step} className={dir === 'in' ? 'step-in' : dir === 'back' ? 'step-back' : ''}>
        {step === 'what' && (
          <div className="grid grid-cols-4 gap-2">
            {EVENT_TEMPLATES.map((t, i) => (
              <button key={t.key} type="button" onClick={() => pickTemplate(t)} className="tile py-4 px-1 flex flex-col items-center gap-1.5">
                <Kbd>{i + 1}</Kbd>
                <span style={{ fontSize: 26, lineHeight: 1 }}>{t.emoji}</span>
                <span className="text-xs font-semibold text-center">{t.label}</span>
              </button>
            ))}
          </div>
        )}

        {step === 'who' && (
          <>
            <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>Tap who it's with. You can pick more than one, or nobody.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 6, rowGap: 8 }}>
              {people.map(p => <PersonPick key={p.id} person={p} active={personIds.includes(p.id)} onClick={() => setPersonIds(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])} />)}
            </div>
          </>
        )}

        {step === 'when' && (
          <>
            <div className="mb-4">
              <input value={shownTitle} onChange={e => { setTitle(e.target.value); setTitleTouched(true); }} aria-label="Title" className="w-full text-sm font-semibold rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}` }} />
            </div>
            <Section title="Day">
              {days.map((d, i) => <Choice key={d} on={day === d} onClick={() => { setDay(d); if (repeat === 'weekly' && weekdays.length === 1) setWeekdays([parseISODay(d).getDay()]); }}>{dayLabel(d, i)}</Choice>)}
              <DateDropdown compact other highlight={!days.includes(day)} value={parseISODay(day)} onChange={(d) => setDay(toISODate(d))} minDate={editing ? undefined : new Date()} />
            </Section>
            <Section title="Time">
              {TIMES.map(t => <Choice key={t} on={!allDay && time === t} onClick={() => { setAllDay(false); setTime(t); }}>{formatTime12(t)}</Choice>)}
              <Choice on={allDay} onClick={() => setAllDay(true)}>All day</Choice>
              <TimeDropdown compact highlight={!allDay && !TIMES.includes(time)} value={time} onChange={(t) => { setAllDay(false); setTime(t); }} />
            </Section>
            {!allDay && (
              <Section title="How long">
                {LENGTHS.map(m => <Choice key={m} on={duration === m} onClick={() => setDuration(m)}>{lengthLabel(m)}</Choice>)}
              </Section>
            )}
            <Section title="Repeat">
              <Choice on={repeat === 'once'} onClick={() => setRepeat('once')}>Once</Choice>
              <Choice on={repeat === 'daily'} onClick={() => setRepeat('daily')}>Every day</Choice>
              <Choice on={repeat === 'weekly'} onClick={() => setRepeat('weekly')}>Every week</Choice>
              {repeat === 'weekly' && (
                <span className="w-full flex gap-1 mt-1">
                  {WEEKDAY_SHORT.map((w, i) => <Choice key={w} label={w} on={weekdays.includes(i)} onClick={() => setWeekdays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].sort((a, b) => a - b))}>{w[0]}</Choice>)}
                </span>
              )}
            </Section>
            <Section title="Remind me">
              {ALERTS.map(a => <Choice key={String(a)} on={alert === a} onClick={() => setAlert(a)}>{alertLabel(a)}</Choice>)}
            </Section>
            {goals.length > 0 && (
              <Section title="Moves a goal (optional)">
                {goals.map(g => <Choice key={g.id} on={goalId === g.id} onClick={() => setGoalId(id => id === g.id ? null : g.id)}>{g.title}{picked.length > 1 ? ` (${g.personName})` : ''}</Choice>)}
              </Section>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
