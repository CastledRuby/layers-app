// Small presentational building blocks.

import { useState } from 'react';
import { CONV_STATES, getLayer } from '../data/constants.js';
import { INITIAL_COLORS, initialsOf, isInitials, isPhoto } from '../data/avatars.js';
import { timelineDateLabel } from '../lib/dates.js';
import { clamp } from '../lib/util.js';
import { COLORS } from '../theme.js';

export function CircularProgress({ percent, size = 140, stroke = 12, color = COLORS.accent, track = COLORS.line, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamp(percent, 0, 100) / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset .9s cubic-bezier(0.22,1,0.36,1)' }} />
      </svg>
      <div className="absolute flex flex-col items-center justify-center px-2">
        <span className="font-display" style={{ fontSize: size * 0.24, color: COLORS.ink, lineHeight: 1 }}>{Math.round(percent)}%</span>
        {label && <span className="text-xs mt-1.5 text-center" style={{ color: COLORS.inkSoft, maxWidth: size * 0.75 }}>{label}</span>}
      </div>
    </div>
  );
}

export function ProgressBar({ percent, color = COLORS.accent, height = 8, track = COLORS.line }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: track }}>
      <div className="h-full rounded-full" style={{ width: `${clamp(percent, 0, 100)}%`, background: color, transition: 'width .8s cubic-bezier(0.22,1,0.36,1)' }} />
    </div>
  );
}

export function LabeledBar({ label, percent, color, size = 'sm' }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className={size === 'lg' ? 'text-sm font-medium' : 'text-xs font-medium'} style={{ color: COLORS.ink }}>{label}</span>
        <span className={size === 'lg' ? 'text-sm font-semibold' : 'text-xs font-semibold'} style={{ color }}>{Math.round(percent)}%</span>
      </div>
      <ProgressBar percent={percent} color={color} height={size === 'lg' ? 8 : 7} />
    </div>
  );
}

// A person's avatar (pass `person`): their emoji, or their initials on a
// colour or their photo when person.avatar says so (data/avatars.js).
// `emoji` alone draws just that emoji.
export function Avatar({ person, emoji, size = 44, ringColor, bg = COLORS.paperRaised }) {
  const box = { width: size, height: size, border: `2px solid ${ringColor || COLORS.line}` };
  if (person && isPhoto(person.avatar)) {
    return (
      <div className="rounded-full shrink-0 overflow-hidden" style={{ ...box, background: bg }}>
        <img src={person.avatar.src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    );
  }
  if (person && isInitials(person.avatar)) {
    const text = initialsOf(person.name);
    const c = INITIAL_COLORS.find(x => x.key === person.avatar.color);
    const l = getLayer(person.layer);
    const colors = c.bg ? { background: c.bg, color: '#FFFFFF' } : { background: l.tint, color: l.deep };
    return (
      <div className="flex items-center justify-center rounded-full shrink-0 font-display avatar-initials" style={{ ...box, ...colors, fontSize: size * (text.length > 1 ? 0.4 : 0.48) }}>
        {text}
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center rounded-full shrink-0" style={{ ...box, background: bg, fontSize: size * 0.46 }}>
      {person ? person.emoji : emoji}
    </div>
  );
}

export function LayerBadge({ layerId }) {
  const l = getLayer(layerId);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: l.tint }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: l.color }} />
      <span className="text-xs font-semibold" style={{ color: l.deep }}>Layer {l.id}: {l.name}</span>
    </span>
  );
}

export function ChatBubble({ who, text, name }) {
  const isYou = who === 'you';
  return (
    <div className="flex mb-2" style={{ justifyContent: isYou ? 'flex-end' : 'flex-start' }}>
      <div style={{ maxWidth: '78%', background: isYou ? COLORS.accent : COLORS.paperRaised, color: isYou ? COLORS.onAccent : COLORS.ink, border: isYou ? 'none' : `1px solid ${COLORS.line}`, borderRadius: isYou ? '16px 16px 4px 16px' : '16px 16px 16px 4px', padding: '8px 12px' }}>
        {name && !isYou && <p className="text-xs font-semibold mb-0.5" style={{ color: COLORS.inkSoft }}>{name}</p>}
        <p className="text-sm">{text}</p>
      </div>
    </div>
  );
}

export function Timeline({ steps }) {
  return (
    <div>
      {steps.map((s, i) => (
        <div key={i} className="flex items-stretch gap-3">
          <div className="flex flex-col items-center">
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.current ? COLORS.accent : COLORS.paperRaised, border: `2px solid ${s.current ? COLORS.accent : COLORS.line}`, flexShrink: 0 }} />
            {i < steps.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 22, background: COLORS.line }} />}
          </div>
          <div className="pb-4">
            <p className="text-sm font-medium" style={{ color: s.current ? COLORS.accent : COLORS.ink }}>{s.label}</p>
            <p className="text-xs" style={{ color: COLORS.inkSoft }}>{s.prefix || ''}{timelineDateLabel(s)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConvStateBadge({ stateKey }) {
  const s = CONV_STATES[stateKey] || CONV_STATES.unclear;
  return (
    <div className="rounded-2xl p-3.5 flex items-start gap-2.5" style={{ background: COLORS.accentSoft }}>
      <span style={{ fontSize: 20 }}>{s.emoji}</span>
      <div>
        <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>{s.label}</p>
        <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>{s.desc}</p>
      </div>
    </div>
  );
}

// A key you can press for the thing next to it. Hidden from screen readers
// (the button's own label says what it does), so it never changes a name.
export function Kbd({ children, onAccent }) {
  return <span className={`kbd${onAccent ? ' kbd--on-accent' : ''}`} aria-hidden="true">{children}</span>;
}

// A text box with its key on the right: the letter the sheet's keys use to
// get into it (N for a note), then Esc once you're in, which leaves it again
// (Sheet.jsx; Tab too). Takes <input> props, or <textarea> ones with
// `multiline`; `wrapClassName` spaces it from what's around it.
export function KeyedField({ letter, multiline = false, wrapClassName = '', style, onFocus, onBlur, ...props }) {
  const [focused, setFocused] = useState(false);
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <div className={`keyed-field${multiline ? ' keyed-field--multi' : ''}${wrapClassName ? ` ${wrapClassName}` : ''}`}>
      <Tag {...props} style={{ ...style, paddingRight: 48 }}
        onFocus={(e) => { setFocused(true); if (onFocus) onFocus(e); }}
        onBlur={(e) => { setFocused(false); if (onBlur) onBlur(e); }} />
      <span className="keyed-field-key"><Kbd>{focused ? 'Esc' : letter}</Kbd></span>
    </div>
  );
}
