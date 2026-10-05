// One day in a popup, from Enter on Today (or clicking the day that's picked
// already): its plans, key dates and logs, with Coach tips for each plan with
// people (PlanTipsSheet).
// Keys: ↑ ↓ pick a plan, Enter opens it, T its coach tips, ← → the day
// before or after, P plans something that day.

import { useMemo, useState } from 'react';
import { Check, Lightbulb } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { isTabbedToButton, isTyping } from '../components/sheetLayer.js';
import { Kbd } from '../components/atoms.jsx';
import { AvatarStack } from '../components/PersonPick.jsx';
import { TYPE_META } from '../data/constants.js';
import { dayAgenda, templateFor } from '../lib/calendar.js';
import { formatTime12, MONTH_NAMES, parseISODay, toISODate } from '../lib/dates.js';
import { summaryFor } from '../lib/text.js';
import { PlanTipsSheet } from './PlanTipsSheet.jsx';
import { COLORS } from '../theme.js';

const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const addDays = (day, n) => { const d = parseISODay(day); return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
function dayTitle(day, today) {
  const d = parseISODay(day);
  const diff = Math.round((d - parseISODay(today)) / 86400000);
  const rel = diff === 0 ? 'Today, ' : diff === 1 ? 'Tomorrow, ' : diff === -1 ? 'Yesterday, ' : '';
  return `${rel}${WEEKDAY_LONG[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

export function DaySheet({ day, today, people, journal, events, generalGoals, onDay, onOpenEvent, onPlan, onPrepare, onClose }) {
  const agenda = useMemo(() => dayAgenda({ people, journal, events, generalGoals }, day), [people, journal, events, generalGoals, day]);
  const plans = [...agenda.allDay.filter(x => x.kind === 'event'), ...agenda.timed];
  const dates = agenda.allDay.filter(x => x.kind !== 'event');
  const [picked, setPicked] = useState({ day, index: 0 });
  const index = picked.day === day ? Math.min(picked.index, Math.max(plans.length - 1, 0)) : 0;
  const [tipsFor, setTipsFor] = useState(null); // an event id
  const tipsEvent = tipsFor ? events.find(e => e.id === tipsFor) : null;
  const current = plans[index] || null;

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
    if (e.key === 'Enter' && isTabbedToButton()) return;
    const act = (fn) => { e.preventDefault(); fn(); };
    if (e.key === 'ArrowDown' && plans.length) act(() => setPicked({ day, index: Math.min(index + 1, plans.length - 1) }));
    else if (e.key === 'ArrowUp' && plans.length) act(() => setPicked({ day, index: Math.max(index - 1, 0) }));
    else if (e.key === 'ArrowLeft') act(() => onDay(addDays(day, -1)));
    else if (e.key === 'ArrowRight') act(() => onDay(addDays(day, 1)));
    else if (e.key === 'Enter' && current) act(() => onOpenEvent(current.ev.id, day));
    else if ((e.key === 't' || e.key === 'T') && current && current.people.length) act(() => setTipsFor(current.ev.id));
    else if (e.key === 'p' || e.key === 'P') act(() => onPlan({ day }));
  }

  return (
    <Sheet title={dayTitle(day, today)} onClose={onClose} onKey={onKey} tall
      footer={<button type="button" onClick={() => onPlan({ day })} className="primary-btn">Plan something <Kbd onAccent>P</Kbd></button>}>
      <p className="text-xs -mt-1 mb-3 flex items-center gap-1 flex-wrap" style={{ color: COLORS.inkSoft }}>
        <Kbd>←</Kbd><Kbd>→</Kbd> another day{plans.length > 1 && <> · <Kbd>↑</Kbd><Kbd>↓</Kbd> pick a plan</>}{plans.length > 0 && <> · <Kbd>↵</Kbd> open it</>}
      </p>

      {dates.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {dates.map(x => <span key={x.id} className="chip">{x.emoji} {x.label}</span>)}
        </div>
      )}

      {plans.length === 0 && (
        <button type="button" onClick={() => onPlan({ day })} className="w-full rounded-2xl p-5 text-center" style={{ border: `1.5px dashed ${COLORS.line}`, color: COLORS.inkSoft }}>
          <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>Nothing planned</p>
          <p className="text-xs mt-1">Press P to plan something.</p>
        </button>
      )}

      <div className="flex flex-col gap-2" role="list" aria-label="Plans">
        {plans.map((it, i) => {
          const t = templateFor(it.ev.template);
          const on = i === index;
          return (
            <div key={it.ev.id} role="listitem" className={`rounded-2xl px-3 py-2.5${on ? ' pick-cursor' : ''}`} style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}`, opacity: it.done ? 0.7 : 1 }}>
              <button type="button" onClick={() => onOpenEvent(it.ev.id, day)} className="w-full text-left flex items-center gap-2.5">
                <span className="text-xs font-bold shrink-0" style={{ width: 58, color: COLORS.inkSoft, fontVariantNumeric: 'tabular-nums' }}>{it.start === null ? 'All day' : formatTime12(it.start)}</span>
                {it.done ? <Check size={15} color={COLORS.good} strokeWidth={3} /> : <span aria-hidden="true">{t ? t.emoji : '📌'}</span>}
                <span className="flex-1 min-w-0 text-sm font-semibold truncate" style={{ color: COLORS.ink, textDecoration: it.done ? 'line-through' : 'none' }}>{it.ev.title}</span>
                {it.people.length > 0 && <AvatarStack people={it.people} size={22} />}
              </button>
              {it.people.length > 0 && (
                <button type="button" onClick={() => setTipsFor(it.ev.id)} className="chip mt-2" style={{ padding: '4px 6px 4px 10px' }}>
                  <Lightbulb size={13} color={COLORS.accent} />Coach tips{on && <Kbd>T</Kbd>}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {agenda.logged.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-bold mb-1.5" style={{ color: COLORS.inkSoft, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Logged</p>
          {agenda.logged.map(x => (
            <p key={x.id} className="text-sm py-1 flex items-center gap-2" style={{ color: COLORS.ink }}>
              <Check size={13} color={COLORS.good} strokeWidth={3} className="shrink-0" />
              <span>{(TYPE_META[x.entry.type] || TYPE_META.other).emoji} <span className="font-semibold">{x.person.name}:</span> {summaryFor(x.entry)}</span>
            </p>
          ))}
        </div>
      )}

      {tipsEvent && (
        <PlanTipsSheet ev={tipsEvent} day={day} people={people} journal={journal} generalGoals={generalGoals}
          onClose={() => setTipsFor(null)} onPrepare={onPrepare} />
      )}
    </Sheet>
  );
}
