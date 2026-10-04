// Rename / re-emoji / remove a person.

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { PERSON_EMOJIS } from '../data/constants.js';
import { COLORS } from '../theme.js';

export function EditPersonModal({ person, onClose, onSave, onDelete }) {
  const [emoji, setEmoji] = useState(person.emoji);
  const [name, setName] = useState(person.name);
  const canSave = name.trim().length > 0;

  return (
    <Sheet title="Edit person" onClose={onClose}
      footer={<button onClick={() => canSave && onSave({ name: name.trim(), emoji })} disabled={!canSave} className="w-full text-sm font-semibold rounded-full py-3" style={{ background: canSave ? COLORS.accent : COLORS.line, color: canSave ? COLORS.onAccent : COLORS.inkSoft }}>Save changes</button>}>
      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Avatar</p>
      <div className="grid grid-cols-5 gap-2 mb-4">
        {PERSON_EMOJIS.map(e => (
          <button key={e} onClick={() => setEmoji(e)} className="rounded-xl py-2 flex items-center justify-center" style={{ background: emoji === e ? COLORS.accentSoft : COLORS.paperRaised, border: `1.5px solid ${emoji === e ? COLORS.accent : COLORS.line}`, fontSize: 20 }}>{e}</button>
        ))}
      </div>
      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Name</p>
      <input autoFocus value={name} onChange={e => setName(e.target.value)} className="w-full text-sm rounded-xl px-3 py-2.5 mb-6" style={{ border: `1px solid ${COLORS.line}` }} />
      <button onClick={onDelete} className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold rounded-full py-3" style={{ background: COLORS.layer4Tint, color: COLORS.layer4Deep }}><Trash2 size={13} /> Remove this person</button>
    </Sheet>
  );
}
