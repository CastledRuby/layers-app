// Add an item to one of a person's info categories.

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { categoryMeta, EMOJI_CHOICES } from '../data/constants.js';
import { COLORS } from '../theme.js';

export function AddInfoModal({ personName, category, onClose, onSave }) {
  const cat = categoryMeta(category);
  const [emoji, setEmoji] = useState(cat.emoji);
  const [text, setText] = useState('');
  const [temporary, setTemporary] = useState(category === 'important');
  const canSave = text.trim().length > 0;

  return (
    <Sheet title={`Add to ${cat.label}`} onClose={onClose}
      footer={<button onClick={() => canSave && onSave({ emoji, text: text.trim(), temporary })} disabled={!canSave} className="w-full text-sm font-semibold rounded-full py-3" style={{ background: canSave ? COLORS.accent : COLORS.line, color: canSave ? COLORS.onAccent : COLORS.inkSoft }}>Save</button>}>
      <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>Adding to {personName}'s profile</p>
      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Choose an icon</p>
      <div className="grid grid-cols-5 gap-2 mb-4">
        {EMOJI_CHOICES.map(e => (
          <button key={e} onClick={() => setEmoji(e)} className="rounded-xl py-2 flex items-center justify-center" style={{ background: emoji === e ? COLORS.accentSoft : COLORS.paperRaised, border: `1.5px solid ${emoji === e ? COLORS.accent : COLORS.line}`, fontSize: 18 }}>{e}</button>
        ))}
      </div>
      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Details</p>
      <input autoFocus value={text} onChange={e => setText(e.target.value)} placeholder={cat.placeholder} className="w-full text-sm rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}` }} />
      <button onClick={() => setTemporary(t => !t)} className="w-full flex items-center gap-3 mt-4">
        <span style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${temporary ? COLORS.accent : COLORS.line}`, background: temporary ? COLORS.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {temporary && <Check size={13} color={COLORS.onAccent} />}
        </span>
        <span className="text-sm" style={{ color: COLORS.ink }}>This is temporary (e.g. a one-off event)</span>
      </button>
    </Sheet>
  );
}
