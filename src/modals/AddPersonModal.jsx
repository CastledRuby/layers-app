// Add someone new to your circle.

import { useState } from 'react';
import { Sheet } from '../components/Sheet.jsx';
import { LAYERS, PERSON_EMOJIS } from '../data/constants.js';
import { COLORS } from '../theme.js';

export function AddPersonModal({ onClose, onSave }) {
  const [emoji, setEmoji] = useState(PERSON_EMOJIS[0]);
  const [name, setName] = useState('');
  const [layer, setLayer] = useState(1);
  const canSave = name.trim().length > 0;

  return (
    <Sheet title="Add someone new" onClose={onClose}
      footer={<button onClick={() => canSave && onSave({ name: name.trim(), emoji, layer })} disabled={!canSave} className="w-full text-sm font-semibold rounded-full py-3" style={{ background: canSave ? COLORS.accent : COLORS.line, color: canSave ? '#fff' : COLORS.inkSoft }}>Add to my circle</button>}>
      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Choose an avatar</p>
      <div className="grid grid-cols-5 gap-2 mb-4">
        {PERSON_EMOJIS.map(e => (
          <button key={e} onClick={() => setEmoji(e)} className="rounded-xl py-2 flex items-center justify-center" style={{ background: emoji === e ? COLORS.accentSoft : COLORS.paperRaised, border: `1.5px solid ${emoji === e ? COLORS.accent : COLORS.line}`, fontSize: 20 }}>{e}</button>
        ))}
      </div>
      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Name</p>
      <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Their name" className="w-full text-sm rounded-xl px-3 py-2.5 mb-4" style={{ border: `1px solid ${COLORS.line}` }} />
      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Where are you starting from?</p>
      <div className="grid grid-cols-2 gap-2">
        {LAYERS.map(l => (
          <button key={l.id} onClick={() => setLayer(l.id)} className="rounded-2xl p-3 text-left" style={{ background: layer === l.id ? l.tint : COLORS.paperRaised, border: `1.5px solid ${layer === l.id ? l.color : COLORS.line}` }}>
            <p className="text-xs font-semibold" style={{ color: layer === l.id ? l.deep : COLORS.ink }}>Layer {l.id}: {l.name}</p>
          </button>
        ))}
      </div>
      <p className="text-xs mt-3" style={{ color: COLORS.inkSoft }}>Not sure? Start at Orientation. You can log interactions to build things up from there.</p>
    </Sheet>
  );
}
