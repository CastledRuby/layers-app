// Closeness over time on a profile (decided 2026-10-10, in place of the old
// Progress chart): one line climbing through the layers (lib/progress.js,
// closenessTrend), so a level-up goes up instead of dropping back to a few
// percent. The height covers just the layers they've been in, each band named.
// "Show the six dimensions" switches to the dimensions by day, kept from
// 2026-10-10 on.

import { useState } from 'react';
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DIM_COLORS, DIM_LABELS, DIM_ORDER, getLayer } from '../data/constants.js';
import { closenessTrend } from '../lib/progress.js';
import { COLORS } from '../theme.js';

const tick = { fontSize: 10, fill: COLORS.inkSoft };
const tipStyle = { borderRadius: 12, border: `1px solid ${COLORS.line}`, fontSize: 12 };

export function ClosenessChart({ person, color }) {
  const [dims, setDims] = useState(false);
  const points = closenessTrend(person);
  const first = points[0];
  const last = points[points.length - 1];
  const withDims = points.filter(p => p.dims).map(p => ({ date: p.date, ...p.dims }));
  return (
    <div aria-label={`Closeness with ${person.name} over time`}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-display" style={{ fontSize: 18, color: COLORS.ink }}>{dims ? 'The six dimensions' : 'Closeness over time'}</p>
        <button type="button" onClick={() => setDims(d => !d)} className="text-xs font-semibold shrink-0" style={{ color: COLORS.accent }}>
          {dims ? 'Show closeness' : 'Show the six dimensions'}
        </button>
      </div>
      {dims ? <DimsChart points={withDims} /> : points.length > 0 && <LayersChart points={points} color={color} />}
      {!dims && first && (
        <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>
          {points.length > 1
            ? `${first.date}: Layer ${first.layer}, ${getLayer(first.layer).name}, at ${first.overall}%. Now Layer ${last.layer}, ${getLayer(last.layer).name}, at ${last.overall}%.`
            : `Layer ${last.layer}, ${getLayer(last.layer).name}, at ${last.overall}% since ${last.date}.`}
          {' '}Relationships don't have to move in a straight line. It's normal to move between layers.
        </p>
      )}
    </div>
  );
}

function LayersChart({ points, color }) {
  const low = Math.min(...points.map(p => p.layer));
  const high = Math.max(...points.map(p => p.layer));
  const centres = Array.from({ length: high - low + 1 }, (_, i) => (low - 1 + i) * 100 + 50);
  return (
    <div className="mt-3" style={{ width: '100%', height: 170 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 14, left: 0, bottom: 0 }}>
          {Array.from({ length: high - low + 2 }, (_, i) => (low - 1 + i) * 100).map(y => <ReferenceLine key={y} y={y} stroke={COLORS.line} strokeDasharray="3 3" />)}
          <XAxis dataKey="date" tick={tick} axisLine={{ stroke: COLORS.line }} tickLine={false} interval="preserveStartEnd" padding={{ left: 18, right: 18 }} />
          <YAxis domain={[(low - 1) * 100, high * 100]} ticks={centres} tickFormatter={(v) => getLayer(Math.floor(v / 100) + 1).name} tick={tick} axisLine={false} tickLine={false} width={74} />
          <Tooltip formatter={(v, n, item) => [`Layer ${item.payload.layer}, ${getLayer(item.payload.layer).name}, at ${item.payload.overall}%`, 'Closeness']} contentStyle={tipStyle} />
          <Line type="monotone" dataKey="closeness" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function DimsChart({ points }) {
  const last = points[points.length - 1];
  return (
    <div className="mt-2">
      {last && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {DIM_ORDER.map(k => (
            <span key={k} className="flex items-center gap-1.5 text-xs" style={{ color: COLORS.ink }}>
              <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: DIM_COLORS[k] }} />
              {DIM_LABELS[k]} {last[k]}
            </span>
          ))}
        </div>
      )}
      {points.length > 1 && (
        <div className="mt-3" style={{ width: '100%', height: 170 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 14, left: 0, bottom: 0 }}>
              {[25, 50, 75].map(y => <ReferenceLine key={y} y={y} stroke={COLORS.line} strokeDasharray="3 3" />)}
              <XAxis dataKey="date" tick={tick} axisLine={{ stroke: COLORS.line }} tickLine={false} interval="preserveStartEnd" padding={{ left: 18, right: 18 }} />
              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={tick} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={tipStyle} />
              {DIM_ORDER.map(k => <Line key={k} type="monotone" dataKey={k} name={DIM_LABELS[k]} stroke={DIM_COLORS[k]} strokeWidth={2} dot={{ r: 2.5, fill: DIM_COLORS[k] }} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>
        {points.length > 1
          ? 'Each day they changed, out of 100. Every 25 points is a layer, as Adjust places them.'
          : 'Kept each day they change, from 10 October 2026 on, so this fills in as you log and adjust.'}
      </p>
    </div>
  );
}
