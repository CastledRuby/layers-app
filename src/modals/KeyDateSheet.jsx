// A key date on someone's profile (a birthday, an exam): pick what it is,
// then the day. Birthdays and anniversaries come round every year; the
// rest happen once. They show on the calendar and in the morning summary.
// Keys: 1-5 what it is; then type the day in the box (T: "14 Mar", "14/3",
// with a year if you like), Y every year or just once, Enter saves,
// Backspace goes back. initialKind starts on one (setting up starts on
// Birthday).

import { useState } from 'react';
import { Sheet } from '../components/Sheet.jsx';
import { isTabbedToButton, isTyping } from '../components/sheetLayer.js';
import { KeyedField, Kbd } from '../components/atoms.jsx';
import { DateDropdown } from '../components/pickers.jsx';
import { DATE_KINDS } from '../lib/calendar.js';
import { dayMonthToDate, MONTH_NAMES, readDayMonth, toISODate } from '../lib/dates.js';
import { COLORS } from '../theme.js';

export function KeyDateSheet({ personName, initialKind, onClose, onSave }) {
  const [kind, setKind] = useState(() => DATE_KINDS.find(k => k.key === initialKind) || null);
  const [date, setDate] = useState(() => new Date());
  const [yearly, setYearly] = useState(() => (DATE_KINDS.find(k => k.key === initialKind) || { yearly: true }).yearly);
  const [label, setLabel] = useState('');
  const [typed, setTyped] = useState(''); // the day typed in the box
  const read = typed.trim() ? readDayMonth(typed) : null;
  const typedBad = Boolean(typed.trim()) && !read;
  const canSave = kind && !typedBad && (kind.key !== 'custom' || label.trim());

  function pick(k) { setKind(k); setYearly(k.yearly); if (read) setDate(dayMonthToDate(read, k.yearly)); }
  function type(text) {
    setTyped(text);
    const r = text.trim() ? readDayMonth(text) : null;
    if (r) setDate(dayMonthToDate(r, yearly));
  }
  function chooseYearly(on) { setYearly(on); if (read) setDate(dayMonthToDate(read, on)); }
  function save() { if (canSave) onSave({ kind: kind.key, label: label.trim() || undefined, date: toISODate(date), yearly }); }
  const focusTyped = () => { const el = document.getElementById('key-date-typed'); if (el) el.focus(); };
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
    const n = Number(e.key);
    const key = e.key.toLowerCase();
    const act = (fn) => { e.preventDefault(); fn(); };
    if (!kind) { if (n >= 1 && n <= DATE_KINDS.length) act(() => pick(DATE_KINDS[n - 1])); return; }
    if (e.key === 'Enter' && !isTabbedToButton()) act(save);
    else if (e.key === 'Backspace') act(() => setKind(null));
    else if (key === 'y') act(() => chooseYearly(!yearly));
    else if (key === 't') act(focusTyped);
  }
  const shown = `${date.getDate()} ${MONTH_NAMES[date.getMonth()]}${yearly ? ', every year' : ` ${date.getFullYear()}`}`;

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
            <input autoFocus value={label} onChange={e => setLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focusTyped(); } }}
              aria-label="What is it?" placeholder="e.g. Driving test" className="w-full text-sm rounded-xl px-3 py-2.5 mb-4" style={{ border: `1px solid ${COLORS.line}` }} />
          )}
          <p className="text-xs font-bold mb-2" style={{ color: COLORS.inkSoft, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Date</p>
          <KeyedField letter="T" id="key-date-typed" autoFocus={kind.key !== 'custom'} value={typed} onChange={e => type(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
            aria-label="Type the day" placeholder="Type it: 14 Mar, or 14/3" className="w-full text-sm rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}` }} />
          <p className="text-xs mt-1.5 mb-3" role="status" aria-label="The date" style={{ color: typedBad ? COLORS.alert : COLORS.inkSoft }}>{typedBad ? 'Try 14 Mar, 14/3 or 14 March 2008' : shown}</p>
          <DateDropdown value={date} onChange={(d) => { setDate(d); setTyped(''); }} />
          <div className="flex items-center gap-1.5 mt-4">
            <button type="button" onClick={() => chooseYearly(true)} aria-pressed={yearly} className={`chip${yearly ? ' chip--on' : ''}`}>Every year</button>
            <button type="button" onClick={() => chooseYearly(false)} aria-pressed={!yearly} className={`chip${!yearly ? ' chip--on' : ''}`}>Just once</button>
            <Kbd>Y</Kbd>
          </div>
        </div>
      )}
    </Sheet>
  );
}
