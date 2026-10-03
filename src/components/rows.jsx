// List rows for goals and saved info items.

import { useState } from 'react';
import { Archive, BellPlus, Check, Clock, Pencil, Trash2, TrendingUp } from 'lucide-react';
import { ProgressBar } from './atoms.jsx';
import { presetMeta } from '../data/constants.js';
import { infoItemDateLabel, parseISODay, startOfDay } from '../lib/dates.js';
import { COLORS } from '../theme.js';

// `today` ('YYYY-MM-DD', from useToday) keeps "Due in 2 days" correct after
// midnight; it used to be worked out once and kept until something else changed.
export function GoalRow({ goal, color, today, onBump, onEdit, onDelete }) {
  const done = goal.progress >= 100;
  const preset = presetMeta(goal.type);
  let dueInfo = null;
  if (goal.dueDate && !done) {
    const due = new Date(goal.dueDate + 'T00:00:00');
    const daysUntil = Math.round((due - startOfDay(parseISODay(today) || new Date())) / 86400000);
    const dueColor = daysUntil < 0 ? COLORS.alert : daysUntil <= 3 ? COLORS.warn : COLORS.good;
    const label = daysUntil < 0 ? `${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'} overdue` : daysUntil === 0 ? 'Due today' : `Due in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`;
    dueInfo = { dueColor, label };
  }
  return (
    <div className="rounded-2xl p-3 mb-2" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}`, borderLeft: `4px solid ${color}` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>{goal.title}</p>
          <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>{goal.description}</p>
          {dueInfo && (
            <p className="text-xs mt-1 flex items-center gap-1.5" style={{ color: dueInfo.dueColor }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: dueInfo.dueColor, display: 'inline-block' }} />
              {dueInfo.label}
            </p>
          )}
        </div>
        <span className="font-display shrink-0" style={{ fontSize: 18, color }}>{goal.progress}%</span>
      </div>
      <div className="mt-2"><ProgressBar percent={goal.progress} color={color} height={7} /></div>
      <div className="flex items-center gap-1 mt-1.5">
        {[25, 50, 75, 100].map(m => (<div key={m} style={{ flex: 1, height: 3, borderRadius: 2, background: goal.progress >= m ? color : COLORS.line }} />))}
      </div>
      {preset && preset.suggestion && (
        <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>Next step: {preset.suggestion}</p>
      )}
      <div className="flex items-center gap-3 mt-2.5">
        {done ? (
          <span className="flex items-center gap-1 text-xs font-medium" style={{ color }}><Check size={13} /> Completed</span>
        ) : (
          <button onClick={onBump} className="flex items-center gap-1 text-xs font-medium" style={{ color: COLORS.accent }}><TrendingUp size={13} /> Mark progress</button>
        )}
        <button onClick={onEdit} className="flex items-center gap-1 text-xs" style={{ color: COLORS.inkSoft }}><Pencil size={13} /> Edit</button>
        <button onClick={onDelete} className="flex items-center gap-1 text-xs" style={{ color: COLORS.inkSoft }}><Trash2 size={13} /> Delete</button>
      </div>
    </div>
  );
}

// `onRemind` (temporary items only) sets a "how did it go?" reminder.
export function InfoItemRow({ item, onSave, onDelete, onToggleTemporary, onToggleArchive, onRemind }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  return (
    <div className="flex items-start justify-between gap-2 py-2.5" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
      <div className="flex items-start gap-2 min-w-0 flex-1">
        <span style={{ fontSize: 16, lineHeight: '22px' }}>{item.emoji}</span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) { onSave(draft.trim()); setEditing(false); } if (e.key === 'Escape') { setDraft(item.text); setEditing(false); } }}
              className="w-full text-sm rounded-lg px-2 py-1" style={{ border: `1px solid ${COLORS.accent}`, color: COLORS.ink }} />
          ) : (
            <p className="text-sm" style={{ color: COLORS.ink }}>{item.text}{item.temporary && <span className="text-xs ml-1.5" style={{ color: COLORS.warn }}>(temporary)</span>}</p>
          )}
          <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>Last mentioned: {infoItemDateLabel(item)}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 pt-0.5">
        {editing ? (
          <button onClick={() => { if (draft.trim()) { onSave(draft.trim()); } setEditing(false); }} aria-label="Save" className="p-1"><Check size={14} color={COLORS.accent} /></button>
        ) : (
          <button onClick={() => setEditing(true)} aria-label={`Edit "${item.text}"`} className="p-1"><Pencil size={14} color={COLORS.inkSoft} /></button>
        )}
        <button onClick={onToggleTemporary} aria-pressed={item.temporary} aria-label={item.temporary ? 'Marked temporary, click to unmark' : 'Mark as temporary'} className="p-1"><Clock size={14} color={item.temporary ? COLORS.warn : COLORS.inkSoft} /></button>
        {item.temporary && onRemind && (<button onClick={onRemind} aria-label={`Remind me to ask about "${item.text}"`} title="Remind me to follow up" className="p-1"><BellPlus size={14} color={COLORS.accent} /></button>)}
        <button onClick={onToggleArchive} aria-label="Archive" className="p-1"><Archive size={14} color={COLORS.inkSoft} /></button>
        <button onClick={onDelete} aria-label={`Delete "${item.text}"`} className="p-1"><Trash2 size={14} color={COLORS.inkSoft} /></button>
      </div>
    </div>
  );
}
