// Today's week view (decided 2026-10-11): Monday to Sunday side by side with
// the times down the side, each plan a block at its time and length (plans at
// the same time share the width). Drag a block to another day or time, in
// 15-minute steps, to move it (components/planDrag.js; a repeating plan moves
// for that day only); all-day plans sit in a strip on top and move between
// days. Clicking a block opens it; clicking a day's name shows that day.

import { useMemo, useState } from 'react';
import { dayAgenda } from '../lib/calendar.js';
import { formatTime12, parseISODay, toISODate, WEEKDAY_SHORT } from '../lib/dates.js';
import { getLayer } from '../data/constants.js';
import { canDragPlan, isPlanDrag, readPlanDrag, startPlanDrag } from './planDrag.js';
import { COLORS } from '../theme.js';

const HOUR = 44; // px an hour
const STEP = 15; // minutes a drop snaps to
const addDays = (day, n) => { const d = parseISODay(day); return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };

// Each timed item's lane among the day's overlapping ones: { item, lane, lanes }.
function lanesOf(timed) {
  const out = [];
  let group = [];
  let groupEnd = -1;
  const flush = () => { const lanes = Math.max(1, ...group.map(g => g.lane + 1)); group.forEach(g => out.push({ ...g, lanes })); group = []; };
  timed.forEach(item => {
    if (group.length && item.start >= groupEnd) flush();
    const used = new Set(group.filter(g => g.item.end > item.start).map(g => g.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    group.push({ item, lane });
    groupEnd = Math.max(groupEnd, item.end);
  });
  if (group.length) flush();
  return out;
}

export function WeekGrid({ selected, today, state, nowMinutes, onOpenEvent, onMove, onSelectDay }) {
  const d = parseISODay(selected);
  const monday = addDays(selected, -((d.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const agendas = useMemo(() => days.map(day => dayAgenda(state, day)), [state, monday]); // eslint-disable-line react-hooks/exhaustive-deps
  const timed = agendas.flatMap(a => a.timed);
  const first = Math.max(0, Math.min(7, ...timed.map(it => Math.floor(it.start / 60))));
  const last = Math.min(24, Math.max(22, ...timed.map(it => Math.ceil(it.end / 60))));
  const hours = Array.from({ length: last - first }, (_, i) => first + i);
  const [over, setOver] = useState(null); // the day a drag is over
  const colour = (it) => (it.people.length ? getLayer(Math.max(...it.people.map(p => p.layer))).color : it.ev.source === 'google' ? COLORS.inkSoft : COLORS.accent);

  function dropOn(day, e, timedDrop) {
    const data = readPlanDrag(e);
    setOver(null);
    if (!data) return;
    e.preventDefault();
    if (!timedDrop || !Number.isFinite(e.clientY)) { onMove(data.eventId, data.day, day, null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top - (data.offsetY || 0);
    const minutes = Math.round((first * 60 + (y / HOUR) * 60) / STEP) * STEP;
    onMove(data.eventId, data.day, day, Math.max(0, Math.min(24 * 60 - STEP, minutes)));
  }
  const dropProps = (day, timedDrop) => ({
    onDragOver: (e) => { if (isPlanDrag(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (over !== day) setOver(day); } },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(o => (o === day ? null : o)); },
    onDrop: (e) => dropOn(day, e, timedDrop),
  });

  return (
    <div className="week-grid mt-4 rounded-3xl p-2" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }} aria-label="Week">
      <div className="week-row">
        <span />
        {days.map(day => {
          const dd = parseISODay(day);
          const isSel = day === selected;
          return (
            <button key={day} type="button" onClick={() => onSelectDay(day)} aria-pressed={isSel} aria-label={`Show ${WEEKDAY_SHORT[dd.getDay()]} ${dd.getDate()}`} className="flex flex-col items-center py-1 rounded-xl">
              <span className="text-xs font-semibold" style={{ color: isSel ? COLORS.accent : COLORS.inkSoft }}>{WEEKDAY_SHORT[dd.getDay()]}</span>
              <span className="text-sm" style={{ fontWeight: day === today || isSel ? 700 : 500, color: day === today ? COLORS.accent : COLORS.ink }}>{dd.getDate()}</span>
            </button>
          );
        })}
      </div>
      {agendas.some(a => a.allDay.some(x => x.kind === 'event')) && (
        <div className="week-row mb-1" aria-label="All day">
          <span className="text-xs self-center text-right pr-1" style={{ color: COLORS.inkSoft }}>all day</span>
          {days.map((day, i) => (
            <div key={day} className={`week-allday${over === day ? ' drop-over' : ''}`} {...dropProps(day, false)}>
              {agendas[i].allDay.filter(x => x.kind === 'event').map(x => (
                <button key={x.id} type="button" draggable={canDragPlan(x)} onDragStart={(e) => startPlanDrag(e, x)} onClick={() => onOpenEvent(x.ev.id, day)} className="week-chip truncate" style={{ borderColor: colour(x), opacity: x.done || x.missed ? 0.55 : 1 }} aria-label={x.ev.title}>{x.ev.title}</button>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="week-row" style={{ height: hours.length * HOUR }}>
        <div className="relative">
          {hours.map(h => <span key={h} className="week-hour" style={{ top: (h - first) * HOUR }}>{formatTime12(h * 60).replace(':00', '')}</span>)}
        </div>
        {days.map((day, i) => (
          <div key={day} className={`week-col${over === day ? ' drop-over' : ''}`} {...dropProps(day, true)} role="group" aria-label={`${WEEKDAY_SHORT[parseISODay(day).getDay()]} ${parseISODay(day).getDate()}`}>
            {hours.map(h => <span key={h} className="week-line" style={{ top: (h - first) * HOUR }} />)}
            {day === today && nowMinutes !== null && nowMinutes >= first * 60 && nowMinutes <= last * 60 && <span className="week-now" style={{ top: ((nowMinutes - first * 60) / 60) * HOUR }} />}
            {lanesOf(agendas[i].timed).map(({ item, lane, lanes }) => (
              <button key={item.ev.id} type="button" draggable={canDragPlan(item)}
                onDragStart={(e) => startPlanDrag(e, item, e.clientY - e.currentTarget.getBoundingClientRect().top)}
                onClick={() => onOpenEvent(item.ev.id, day)} aria-label={`${item.ev.title}, ${formatTime12(item.start)}`}
                className="week-block" style={{ top: ((item.start - first * 60) / 60) * HOUR, height: Math.max(18, ((item.end - item.start) / 60) * HOUR - 2), left: `${(lane / lanes) * 100}%`, width: `calc(${100 / lanes}% - 2px)`, borderLeftColor: colour(item), opacity: item.done || item.missed ? 0.55 : 1, cursor: canDragPlan(item) ? 'grab' : 'pointer' }}>
                <span className="block truncate font-semibold">{item.ev.title}</span>
                {item.end - item.start >= 45 && <span className="block truncate" style={{ color: COLORS.inkSoft }}>{formatTime12(item.start)}</span>}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
