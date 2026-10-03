// Edit or delete one journal entry (from the Journal tab's pencil button).
// It changes the record only: progress the entry already added to the
// person, their goals and your skills stays as it is, because that progress
// may have been built on since.

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
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

  function save() {
    onSave({ at: toISODate(date), type, meaningfulness, summary: note.trim() || undefined, reflection: reflection.trim() || undefined });
  }

  return (
    <Sheet title="Edit entry" onClose={onClose} tall
      footer={<button onClick={save} className="w-full text-sm font-semibold rounded-full py-3" style={{ background: COLORS.accent, color: '#fff' }}>Save changes</button>}>
      <p className="text-xs mb-4" style={{ color: COLORS.inkSoft }}>With {personName || 'someone no longer in your circle'}. Changes update the journal only; progress already added stays as it is.</p>

      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>When was this?</p>
      <div className="mb-5" style={{ position: 'relative', zIndex: 20 }}>
        <DateDropdown value={date} onChange={setDate} maxDate={new Date()} />
      </div>

      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>What did you do?</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} className="mb-5">
        {types.map(key => (
          <button key={key} type="button" onClick={() => setType(key)} aria-pressed={type === key} className="text-xs font-semibold rounded-full px-2.5 py-1.5" style={{ background: type === key ? COLORS.accent : COLORS.paperRaised, color: type === key ? '#fff' : COLORS.inkSoft, border: `1px solid ${type === key ? COLORS.accent : COLORS.line}` }}>{TYPE_META[key].emoji} {TYPE_META[key].label}</button>
        ))}
      </div>

      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>How meaningful was it?</p>
      <div className="flex items-center justify-between gap-2 mb-5">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" onClick={() => setMeaningfulness(n)} aria-pressed={meaningfulness === n} style={{ width: 38, height: 38, borderRadius: '50%', background: meaningfulness === n ? COLORS.accent : COLORS.paperRaised, border: `1.5px solid ${meaningfulness === n ? COLORS.accent : COLORS.line}`, color: meaningfulness === n ? '#fff' : COLORS.ink, fontWeight: 700, fontSize: 14 }}>{n}</button>
        ))}
      </div>

      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Note</p>
      <input value={note} onChange={e => setNote(e.target.value)} aria-label="Note" placeholder="e.g. Caught up after school, good chat" className="w-full text-sm rounded-xl px-3 py-2.5 mb-5" style={{ border: `1px solid ${COLORS.line}` }} />

      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>How did it feel?</p>
      <textarea value={reflection} onChange={e => setReflection(e.target.value)} rows={3} aria-label="Reflection" placeholder="What went well, or what you'd try next time" className="w-full text-sm rounded-xl px-3 py-2.5 mb-5" style={{ border: `1px solid ${COLORS.line}`, resize: 'vertical' }} />

      <button type="button" onClick={onDelete} className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold rounded-full py-3" style={{ background: COLORS.layer4Tint, color: COLORS.layer4Deep }}><Trash2 size={13} /> Delete this entry</button>
    </Sheet>
  );
}
