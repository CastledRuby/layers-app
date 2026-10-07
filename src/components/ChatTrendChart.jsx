// Skills over time from analysed chats (lib/chatTrend.js): listening, depth,
// balance and naturalness, as Claude scored the chats you logged. With one
// chat it shows the scores; with more, a chart and how each has moved.

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DIM_COLORS } from '../data/constants.js';
import { TREND_LINES, trendChange } from '../lib/chatTrend.js';
import { COLORS } from '../theme.js';

const COLOR = { listening: DIM_COLORS.listening, depth: DIM_COLORS.depth, balance: DIM_COLORS.reciprocity, naturalness: COLORS.teal };
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');

export function ChatTrendChart({ points, label = 'Skills from analysed chats' }) {
  if (!points.length) return null;
  const chats = points.reduce((s, p) => s + p.chats, 0);
  const last = points[points.length - 1];
  const change = trendChange(points);
  return (
    <div aria-label={label}>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {TREND_LINES.map(l => (
          <span key={l.key} className="flex items-center gap-1.5 text-xs" style={{ color: COLORS.ink }}>
            <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: COLOR[l.key] }} />
            {l.label} {last[l.key] ?? '–'}{change && change[l.key] !== null ? <span style={{ color: change[l.key] >= 0 ? COLORS.good : COLORS.alert }}> {signed(change[l.key])}</span> : null}
          </span>
        ))}
      </div>
      {points.length > 1 && (
        <div className="mt-3" style={{ width: '100%', height: 170 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 14, left: -12, bottom: 0 }}>
              <CartesianGrid stroke={COLORS.line} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.inkSoft }} axisLine={{ stroke: COLORS.line }} tickLine={false} padding={{ left: 18, right: 18 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} width={26} />
              <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${COLORS.line}`, fontSize: 12 }} />
              {TREND_LINES.map(l => <Line key={l.key} type="monotone" dataKey={l.key} name={l.label} stroke={COLOR[l.key]} strokeWidth={2} dot={{ r: 2.5, fill: COLOR[l.key] }} connectNulls />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>
        From {chats} analysed {chats === 1 ? 'chat' : 'chats'} you logged{change ? ', and how each has moved since the first' : '. Analyse and log more to see a trend'}. Claude's scores out of 100: a coach's view, not a measure of you.
      </p>
    </div>
  );
}
