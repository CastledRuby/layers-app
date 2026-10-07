// The last six months of logs as a grid of days (lib/activity.js): darker for
// more, and more meaningful, logs. A day with logs can be tapped (onPickDay),
// which opens the Journal on it. `color` is the shade's colour: a person's
// layer on their profile, the accent on the Journal.

import { useMemo } from 'react';
import { activityGrid } from '../lib/activity.js';
import { formatCalendarDate, parseISODay } from '../lib/dates.js';
import { COLORS } from '../theme.js';

const CELL = 10;
const GAP = 2;
const shade = (color, level) => (level === 0 ? COLORS.line : `color-mix(in srgb, ${color} ${[0, 30, 55, 78, 100][level]}%, ${COLORS.paperRaised})`);

export function ActivityCalendar({ journal, today, color = COLORS.accent, onPickDay, label = 'Activity' }) {
  const grid = useMemo(() => activityGrid(journal, today), [journal, today]);
  const width = grid.weeks.length * (CELL + GAP);
  return (
    <div role="group" aria-label={label}>
      <div className="overflow-x-auto no-scrollbar">
        <div style={{ width: width + 18 }}>
          <div className="relative" style={{ height: 14, marginLeft: 18 }} aria-hidden="true">
            {grid.months.map(m => <span key={`${m.col}${m.label}`} className="absolute text-xs" style={{ left: m.col * (CELL + GAP), fontSize: 10, color: COLORS.inkSoft }}>{m.label}</span>)}
          </div>
          <div className="flex">
            <div className="flex flex-col shrink-0" style={{ width: 18, gap: GAP }} aria-hidden="true">
              {['M', '', 'W', '', 'F', '', ''].map((d, i) => <span key={i} style={{ height: CELL, fontSize: 9, lineHeight: `${CELL}px`, color: COLORS.inkSoft }}>{d}</span>)}
            </div>
            <div className="flex" style={{ gap: GAP }}>
              {grid.weeks.map((week, w) => (
                <div key={w} className="flex flex-col" style={{ gap: GAP }}>
                  {week.map(cell => {
                    const style = { width: CELL, height: CELL, borderRadius: 2, background: cell.future ? 'transparent' : shade(color, cell.level) };
                    if (!cell.count || !onPickDay) return <span key={cell.day} style={style} aria-hidden="true" />;
                    const name = `${formatCalendarDate(parseISODay(cell.day))}: ${cell.count} ${cell.count === 1 ? 'log' : 'logs'}`;
                    return <button key={cell.day} type="button" onClick={() => onPickDay(cell.day)} aria-label={name} title={name} className="activity-cell" style={style} />;
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="text-xs mt-2 flex items-center gap-1.5" style={{ color: COLORS.inkSoft }}>
        {grid.total} {grid.total === 1 ? 'log' : 'logs'} in six months
        <span className="ml-auto flex items-center gap-0.5" aria-hidden="true">Less{[0, 1, 2, 3, 4].map(l => <span key={l} style={{ width: CELL, height: CELL, borderRadius: 2, background: shade(color, l), display: 'inline-block' }} />)}More</span>
      </p>
    </div>
  );
}
