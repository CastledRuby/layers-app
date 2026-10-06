// Date and time picker buttons; each opens its own sheet.

import { useState } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Sheet } from './Sheet.jsx';
import { formatCalendarDate, formatTime12, MONTH_NAMES, startOfDay, WEEKDAY_SHORT } from '../lib/dates.js';
import { COLORS } from '../theme.js';

// compact: a small chip ("Today ⌄") for forms that should stay short (the
// quick log), instead of the full button with its hint. `other` turns it
// into an "Other day" chip beside quick choices, showing the date (ticked)
// once one of its own is picked.
export function DateDropdown({ value, onChange, maxDate, minDate, compact, other, highlight }) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));

  const today = startOfDay(new Date());
  const year = viewDate.getFullYear(); const month = viewDate.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const maxD = maxDate ? startOfDay(maxDate) : null;
  const minD = minDate ? startOfDay(minDate) : null;
  const todayDisabled = (maxD && today > maxD) || (minD && today < minD);

  const openPicker = () => { setViewDate(new Date(value.getFullYear(), value.getMonth(), 1)); setOpen(true); };

  return (
    <>
      {compact ? (
        <button type="button" onClick={openPicker} aria-label={other && !highlight ? 'Other day' : `Date: ${formatCalendarDate(value)}. Change it`} className={`chip${other && highlight ? ' chip--on' : ''}`}>
          <Calendar size={14} color={COLORS.accent} />
          {other && !highlight ? 'Other day' : formatCalendarDate(value)}
          <ChevronDown size={14} color={COLORS.inkSoft} />
        </button>
      ) : (
        <button type="button" onClick={openPicker} className="flex items-center gap-2.5 rounded-2xl pl-2 pr-4 py-2" style={{ border: `1.5px solid ${COLORS.line}`, color: COLORS.ink, background: COLORS.paperRaised }}>
          <span style={{ width: 34, height: 34, borderRadius: 12, background: COLORS.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Calendar size={17} color={COLORS.accent} />
          </span>
          <span>
            <span className="block text-sm font-semibold">{formatCalendarDate(value)}</span>
            <span className="block" style={{ fontSize: 10, color: COLORS.inkSoft }}>Tap to change date</span>
          </span>
        </button>
      )}
      {open && (
        <Sheet title="Pick a date" onClose={() => setOpen(false)}>
          <div className="flex items-center justify-between mb-4">
            <button type="button" aria-label="Previous month" title="Previous month" onClick={() => setViewDate(v => new Date(v.getFullYear(), v.getMonth() - 1, 1))} style={{ width: 34, height: 34, borderRadius: '50%', background: COLORS.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={18} color={COLORS.accent} /></button>
            <span className="text-base font-semibold" style={{ color: COLORS.ink }}>{MONTH_NAMES[month]} {year}</span>
            <button type="button" aria-label="Next month" title="Next month" onClick={() => setViewDate(v => new Date(v.getFullYear(), v.getMonth() + 1, 1))} style={{ width: 34, height: 34, borderRadius: '50%', background: COLORS.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={18} color={COLORS.accent} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAY_SHORT.map(w => (<span key={w} className="text-center" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: COLORS.inkSoft }}>{w[0]}</span>))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {cells.map((d, i) => {
              if (d === null) return <span key={i} />;
              const cellDate = startOfDay(new Date(year, month, d));
              const disabled = (maxD && cellDate > maxD) || (minD && cellDate < minD);
              const isSelected = cellDate.getTime() === startOfDay(value).getTime();
              const isToday = cellDate.getTime() === today.getTime();
              return (
                <button key={i} type="button" disabled={disabled} onClick={() => { onChange(cellDate); setOpen(false); }}
                  style={{ width: '100%', aspectRatio: '1', borderRadius: '50%', fontSize: 14, fontWeight: isSelected ? 700 : 500, background: isSelected ? COLORS.accent : 'transparent', color: disabled ? COLORS.line : (isSelected ? COLORS.onAccent : COLORS.ink), border: isToday && !isSelected ? `1.5px solid ${COLORS.accent}` : '1.5px solid transparent', opacity: disabled ? 0.35 : 1, cursor: disabled ? 'default' : 'pointer', boxShadow: isSelected ? `0 4px 10px ${COLORS.accentSoft}` : 'none' }}>
                  {d}
                </button>
              );
            })}
          </div>
          <button type="button" disabled={todayDisabled} onClick={() => { onChange(today); setOpen(false); }} className="w-full text-sm font-semibold rounded-xl py-3 mt-5" style={{ background: COLORS.accentSoft, color: COLORS.accent, opacity: todayDisabled ? 0.4 : 1 }}>
            Jump to today
          </button>
        </Sheet>
      )}
    </>
  );
}

// compact: a chip ("Other time" until a time that isn't one of the
// `highlight`ed presets is picked, then that time, ticked).
export function TimeDropdown({ value, onChange, compact, highlight }) {
  const [open, setOpen] = useState(false);
  const hours12 = Array.from({ length: 12 }, (_, i) => i + 1);
  const minuteOptions = Array.from({ length: 12 }, (_, i) => i * 5);
  let currentH = Math.floor(value / 60) % 12; if (currentH === 0) currentH = 12;
  const currentM = value % 60;
  const currentPeriod = Math.floor(value / 60) >= 12 ? 'PM' : 'AM';

  function setPart(h12, m, period) {
    let h = h12 % 12; if (period === 'PM') h += 12;
    onChange(h * 60 + m);
  }

  return (
    <>
      {compact ? (
        <button type="button" onClick={() => setOpen(true)} aria-pressed={!!highlight} aria-label={highlight ? `Time: ${formatTime12(value)}. Change it` : 'Other time'} className={`chip${highlight ? ' chip--on' : ''}`}>
          <Clock size={13} color={COLORS.accent} />
          {highlight ? formatTime12(value) : 'Other time'}
          <ChevronDown size={13} color={COLORS.inkSoft} />
        </button>
      ) : (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2.5 rounded-2xl pl-2 pr-4 py-2" style={{ border: `1.5px solid ${COLORS.line}`, color: COLORS.ink, background: COLORS.paperRaised }}>
        <span style={{ width: 34, height: 34, borderRadius: 12, background: COLORS.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Clock size={17} color={COLORS.accent} />
        </span>
        <span>
          <span className="block text-sm font-semibold">{formatTime12(value)}</span>
          <span className="block" style={{ fontSize: 10, color: COLORS.inkSoft }}>Tap to set a time</span>
        </span>
      </button>
      )}
      {open && (
        <Sheet title="Pick a time" onClose={() => setOpen(false)}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1.1, maxHeight: 280, overflowY: 'auto' }} className="no-scrollbar">
              {hours12.map(h => (
                <button key={h} type="button" onClick={() => setPart(h, currentM, currentPeriod)} className="w-full text-center py-3 text-base" style={{ borderRadius: 12, background: h === currentH ? COLORS.accentSoft : 'transparent', color: h === currentH ? COLORS.accent : COLORS.ink, fontWeight: h === currentH ? 700 : 500 }}>{h}</button>
              ))}
            </div>
            <div style={{ flex: 1.1, maxHeight: 280, overflowY: 'auto' }} className="no-scrollbar">
              {minuteOptions.map(m => (
                <button key={m} type="button" onClick={() => setPart(currentH, m, currentPeriod)} className="w-full text-center py-3 text-base" style={{ borderRadius: 12, background: m === currentM ? COLORS.accentSoft : 'transparent', color: m === currentM ? COLORS.accent : COLORS.ink, fontWeight: m === currentM ? 700 : 500 }}>{String(m).padStart(2, '0')}</button>
              ))}
            </div>
            <div style={{ flex: 0.8 }}>
              {['AM', 'PM'].map(p => (
                <button key={p} type="button" onClick={() => setPart(currentH, currentM, p)} className="w-full text-center py-3 text-base" style={{ borderRadius: 12, background: p === currentPeriod ? COLORS.accentSoft : 'transparent', color: p === currentPeriod ? COLORS.accent : COLORS.ink, fontWeight: p === currentPeriod ? 700 : 500 }}>{p}</button>
              ))}
            </div>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="w-full text-sm font-semibold rounded-xl py-3 mt-5" style={{ background: COLORS.accent, color: COLORS.onAccent }}>Done</button>
        </Sheet>
      )}
    </>
  );
}
