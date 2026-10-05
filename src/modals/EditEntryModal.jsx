// Edit or delete one journal entry (from the Journal tab's pencil button).
// It changes the record only: progress the entry already added to the
// person, their goals and your skills stays as it is, because that progress
// may have been built on since.
// Keys: 1-5 how meaningful, N the note, F how it felt, Enter (Ctrl+Enter
// from the note boxes too) saves, Esc or Tab leaves a box.

import { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { isTabbedToButton, isTyping } from '../components/sheetLayer.js';
import { KeyedField, Kbd } from '../components/atoms.jsx';
import { DateDropdown } from '../components/pickers.jsx';
import { TYPE_META, TYPE_ORDER } from '../data/constants.js';
import { parseISODay, toISODate } from '../lib/dates.js';
import { COLORS } from '../theme.js';

export function EditEntryModal({ entry, personName, onClose, onSave, onDelete }) {
  const [date, setDate] = useState(() => parseISODay(entry.at) || new Date());
  const [type, setType] = useState(TYPE_META[entry.type] ? entry.type : 'other');
  const [meaningfulness, setMeaningfulness] = useState(entry.meaningfulness || 3);
  const [note, setNote] = useState(entry.summary || '');
  const [reflection, setReflection] = useState(entry.reflection || '');
  // An analysis keeps its type; the others can be any of the usual kinds.
  const types = entry.type === 'analysed' ? ['analysed'] : TYPE_ORDER;
  const noteRef = useRef(null);
  const reflectionRef = useRef(null);

  function save() {
    onSave({ at: toISODate(date), type, meaningfulness, summary: note.trim() || undefined, reflection: reflection.trim() || undefined });
  }

  function onKey(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); save(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
    if (e.key === 'Enter' && isTabbedToButton()) return;
    const key = e.key.toLowerCase();
    const act = (fn) => { e.preventDefault(); fn(); };
    if (/^[1-5]$/.test(e.key)) act(() => setMeaningfulness(Number(e.key)));
    else if (key === 'n') act(() => noteRef.current && noteRef.current.focus());
    else if (key === 'f') act(() => reflectionRef.current && reflectionRef.current.focus());
    else if (e.key === 'Enter') act(save);
  }

  return (
    <Sheet title="Edit entry" onClose={onClose} onKey={onKey} tall
      footer={<button type="button" onClick={save} className="primary-btn">Save changes <Kbd onAccent>↵</Kbd></button>}>
      <p className="text-xs mb-4" style={{ color: COLORS.inkSoft }}>With {personName || 'someone no longer in your circle'}. Changes update the journal only; progress already added stays as it is.</p>

      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>When was this?</p>
      <div className="mb-5">
        <DateDropdown value={date} onChange={setDate} maxDate={new Date()} />
      </div>

      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>What did you do?</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} className="mb-5">
        {types.map(key => (
          <button key={key} type="button" onClick={() => setType(key)} aria-pressed={type === key} className="text-xs font-semibold rounded-full px-2.5 py-1.5" style={{ background: type === key ? COLORS.accent : COLORS.paperRaised, color: type === key ? COLORS.onAccent : COLORS.inkSoft, border: `1px solid ${type === key ? COLORS.accent : COLORS.line}` }}>{TYPE_META[key].emoji} {TYPE_META[key].label}</button>
        ))}
      </div>

      <p className="text-sm font-semibold mb-2 flex items-center justify-between gap-2" style={{ color: COLORS.ink }}>How meaningful was it?<span className="flex items-center gap-1 text-xs" style={{ color: COLORS.inkSoft }}><Kbd>1</Kbd>–<Kbd>5</Kbd></span></p>
      <div className="flex items-center justify-between gap-2 mb-5">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" onClick={() => setMeaningfulness(n)} aria-pressed={meaningfulness === n} style={{ width: 38, height: 38, borderRadius: '50%', background: meaningfulness === n ? COLORS.accent : COLORS.paperRaised, border: `1.5px solid ${meaningfulness === n ? COLORS.accent : COLORS.line}`, color: meaningfulness === n ? COLORS.onAccent : COLORS.ink, fontWeight: 700, fontSize: 14 }}>{n}</button>
        ))}
      </div>

      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Note</p>
      <KeyedField letter="N" ref={noteRef} wrapClassName="mb-5" value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.ctrlKey) { e.preventDefault(); save(); } }} aria-label="Note" placeholder="e.g. Caught up after school, good chat" className="w-full text-sm rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}` }} />

      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>How did it feel?</p>
      <KeyedField letter="F" multiline ref={reflectionRef} wrapClassName="mb-5" value={reflection} onChange={e => setReflection(e.target.value)} rows={3} aria-label="Reflection" placeholder="What went well, or what you'd try next time" className="w-full text-sm rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}`, resize: 'vertical' }} />

      <button type="button" onClick={onDelete} className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold rounded-full py-3" style={{ background: COLORS.layer4Tint, color: COLORS.layer4Deep }}><Trash2 size={13} /> Delete this entry</button>
    </Sheet>
  );
}
