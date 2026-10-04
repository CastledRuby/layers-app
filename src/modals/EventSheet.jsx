// One plan on one day, opened from the day plan: when, who, how it repeats
// and its reminder. Before it starts: Edit, Plan it again (a copy) and
// Delete; Log it and Mark done come once it has started, since there's
// nothing to log before then.
// Keys: E edit, C plan it again; once started, L log it and Enter done.

import { Bell, Clock, Copy, Repeat, Target } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { isTabbedToButton, isTyping } from '../components/sheetLayer.js';
import { Kbd } from '../components/atoms.jsx';
import { AvatarStack } from '../components/PersonPick.jsx';
import { alertOf, durationOf, isDaily, isDoneOn, templateFor } from '../lib/calendar.js';
import { formatCalendarDate, formatTime12, formatWeekdays, parseISODay } from '../lib/dates.js';
import { COLORS } from '../theme.js';

function Row({ Icon, children }) {
  return (
    <p className="flex items-center gap-2.5 text-sm py-1.5" style={{ color: COLORS.ink }}>
      <Icon size={15} color={COLORS.inkSoft} className="shrink-0" />{children}
    </p>
  );
}

// Whether this day's plan has started: an earlier day, today's all-day plans,
// or today once its time has come.
function hasStarted(ev, day, today, now = new Date()) {
  if (day !== today) return day < today;
  return ev.allDay || typeof ev.time !== 'number' || ev.time <= now.getHours() * 60 + now.getMinutes();
}

export function EventSheet({ ev, day, today, people, goals, onClose, onLog, onDone, onEdit, onCopy, onDelete }) {
  const who = (ev.personIds || []).map(id => people.find(p => p.id === id)).filter(Boolean);
  const goal = ev.goalId ? goals.find(g => g.id === ev.goalId) : null;
  const done = isDoneOn(ev, day);
  const started = hasStarted(ev, day, today);
  const alert = alertOf(ev);
  const template = templateFor(ev.template);
  const when = ev.allDay || typeof ev.time !== 'number'
    ? `${formatCalendarDate(parseISODay(day))}, all day`
    : `${formatCalendarDate(parseISODay(day))} · ${formatTime12(ev.time)} to ${formatTime12(ev.time + durationOf(ev))}`;

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping() || isTabbedToButton()) return;
    const key = e.key.toLowerCase();
    if (key === 'l' && started && who.length) { e.preventDefault(); onLog(); }
    else if (e.key === 'Enter' && started && !done) { e.preventDefault(); onDone(); }
    else if (key === 'e') { e.preventDefault(); onEdit(); }
    else if (key === 'c') { e.preventDefault(); onCopy(); }
  }

  const copyButton = <button type="button" onClick={onCopy} className="text-xs font-semibold flex items-center gap-1.5" style={{ color: COLORS.accent }}><Copy size={13} />Plan it again <Kbd>C</Kbd></button>;
  return (
    <Sheet title={`${template ? `${template.emoji} ` : ''}${ev.title}`} onClose={onClose} onKey={onKey}
      footer={
        <div className="flex flex-col gap-2">
          {started ? (
            <div className="flex items-center gap-2">
              {who.length > 0 && <button type="button" onClick={onLog} className="primary-btn">Log it <Kbd onAccent>L</Kbd></button>}
              {!done
                ? <button type="button" onClick={onDone} className={who.length ? 'chip' : 'primary-btn'} style={who.length ? { padding: '12px 16px', flexShrink: 0 } : undefined}>{ev.kind === 'recurring' ? 'Done for this day' : 'Mark done'}{!who.length && <Kbd onAccent>↵</Kbd>}</button>
                : <span className="chip chip--on" style={{ padding: '12px 16px', flexShrink: 0 }}>Done ✓</span>}
            </div>
          ) : (
            <button type="button" onClick={onEdit} className="primary-btn">Edit <Kbd onAccent>E</Kbd></button>
          )}
          <div className="flex items-center justify-between gap-3">
            {started && <button type="button" onClick={onEdit} className="text-xs font-semibold flex items-center gap-1.5" style={{ color: COLORS.accent }}>Edit <Kbd>E</Kbd></button>}
            {copyButton}
            <button type="button" onClick={onDelete} className="text-xs font-semibold ml-auto" style={{ color: COLORS.alert }}>Delete</button>
          </div>
        </div>
      }>
      <Row Icon={Clock}>{when}</Row>
      {ev.kind === 'recurring' && <Row Icon={Repeat}>{isDaily(ev) ? 'Every day' : formatWeekdays(ev.weekdays || [])}</Row>}
      <Row Icon={Bell}>{alert === null ? 'No reminder' : alert === 0 ? 'Reminder at the time' : alert === 1440 ? 'Reminder the day before' : `Reminder ${alert >= 60 ? `${alert / 60} hour${alert > 60 ? 's' : ''}` : `${alert} minutes`} before`}</Row>
      {goal && <Row Icon={Target}>Moves "{goal.title}"</Row>}
      {who.length > 0 && (
        <div className="flex items-center gap-2.5 mt-2">
          <AvatarStack people={who} size={30} />
          <span className="text-sm" style={{ color: COLORS.ink }}>{who.map(p => p.name).join(', ')}</span>
        </div>
      )}
    </Sheet>
  );
}
