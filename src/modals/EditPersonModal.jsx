// Rename / change the avatar of / remove a person. Out of the name box (Esc
// or Tab), the avatar picker's keys work (arrows, T, G) and Enter saves.

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { isTabbedToButton, isTyping } from '../components/sheetLayer.js';
import { Kbd } from '../components/atoms.jsx';
import { AvatarPicker } from '../components/AvatarPicker.jsx';
import { useAvatarPicker } from '../components/avatarKeys.js';
import { COLORS } from '../theme.js';

export function EditPersonModal({ person, onClose, onSave, onDelete }) {
  const [emoji, setEmoji] = useState(person.emoji);
  const [name, setName] = useState(person.name);
  const canSave = name.trim().length > 0;
  const picker = useAvatarPicker(emoji, setEmoji);
  function save() { if (canSave) onSave({ name: name.trim(), emoji }); }
  function onKey(e) {
    if (isTyping()) return;
    if (e.key === 'Enter' && !e.ctrlKey && !isTabbedToButton()) { e.preventDefault(); save(); return; }
    picker.handleKey(e);
  }

  return (
    <Sheet title="Edit person" onClose={onClose} onKey={onKey} tall
      footer={<button type="button" onClick={save} disabled={!canSave} className="primary-btn">Save changes <Kbd onAccent>↵</Kbd></button>}>
      <div className="flex items-center gap-3 mb-5">
        <span className="avatar-preview shrink-0" aria-hidden="true">{emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold mb-1.5" style={{ color: COLORS.ink }}>Name</p>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }} aria-label="Name" className="w-full text-sm rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}` }} />
        </div>
      </div>
      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Avatar</p>
      <div className="mb-6"><AvatarPicker picker={picker} /></div>
      <button onClick={onDelete} className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold rounded-full py-3" style={{ background: COLORS.layer4Tint, color: COLORS.layer4Deep }}><Trash2 size={13} /> Remove this person</button>
    </Sheet>
  );
}
