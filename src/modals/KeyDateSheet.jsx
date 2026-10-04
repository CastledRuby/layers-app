// A key date on someone's profile (a birthday, an exam): pick what it is,
// then the day. Birthdays and anniversaries come round every year; the
// rest happen once. They show on the calendar and in the morning summary.

import { useState } from 'react';
import { Sheet } from '../components/Sheet.jsx';
import { isTyping } from '../components/sheetLayer.js';
import { Kbd } from '../components/atoms.jsx';
import { DateDropdown } from '../components/pickers.jsx';
import { DATE_KINDS } from '../lib/calendar.js';
import { toISODate } from '../lib/dates.js';
import { COLORS } from '../theme.js';

export function KeyDateSheet({ personName, onClose, onSave }) {
  const [kind, setKind] = useState(null);
  const [date, setDate] = useState(() => new Date());
  const [yearly, setYearly] = useState(true);
  const [label, setLabel] = useState('');
  const canSave = kind && (kind.key !== 'custom' || label.trim());

  function pick(k) { setKind(k); setYearly(k.yearly); }
  function save() { if (canSave) onSave({ kind: kind.key, label: label.trim() || undefined, date: toISODate(date), yearly }); }
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
    const n = Number(e.key);
    if (!kind && n >= 1 && n <= DATE_KINDS.length) { e.preventDefault(); pick(DATE_KINDS[n - 1]); }
    else if (kind && e.key === 'Enter') { e.preventDefault(); save(); }
  }

  return (
    <Sheet title={kind ? `${kind.emoji} ${kind.key === 'custom' ? 'A key date' : kind.label}` : `Key date for ${personName}`} onClose={onClose} onBack={kind ? () => setKind(null) : undefined} onKey={onKey}
      footer={kind ? <button type="button" onClick={save} disabled={!canSave} className="primary-btn">Save date <Kbd onAccent>↵</Kbd></button> : null}>
      {!kind ? (
        <div className="grid grid-cols-3 gap-2">
          {DATE_KINDS.map((k, i) => (
            <button key={k.key} type="button" onClick={() => pick(k)} className="tile py-4 px-1 flex flex-col items-center gap-1.5">
              <Kbd>{i + 1}</Kbd>
              <span style={{ fontSize: 24, lineHeight: 1 }}>{k.emoji}</span>
              <span className="text-xs font-semibold text-center">{k.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="fade-anim">
          {kind.key === 'custom' && (
            <input autoFocus value={label} onChange={e => setLabel(e.target.value)} aria-label="What is it?" placeholder="e.g. Driving test" className="w-full text-sm rounded-xl px-3 py-2.5 mb-4" style={{ border: `1px solid ${COLORS.line}` }} />
          )}
          <p className="text-xs font-bold mb-2" style={{ color: COLORS.inkSoft, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Date</p>
          <DateDropdown value={date} onChange={setDate} />
          <div className="flex gap-1.5 mt-4">
            <button type="button" onClick={() => setYearly(true)} aria-pressed={yearly} className={`chip${yearly ? ' chip--on' : ''}`}>Every year</button>
            <button type="button" onClick={() => setYearly(false)} aria-pressed={!yearly} className={`chip${!yearly ? ' chip--on' : ''}`}>Just once</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
