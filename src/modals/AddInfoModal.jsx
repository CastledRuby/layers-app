// Add an item to one of a person's info categories.
// Keys: the details box is ready to type in (N gets back into it, Esc or Tab
// leaves it); ← → pick the icon, T marks it temporary, Enter saves.

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { isTabbedToButton, isTyping } from '../components/sheetLayer.js';
import { KeyedField, Kbd } from '../components/atoms.jsx';
import { categoryMeta, EMOJI_CHOICES } from '../data/constants.js';
import { COLORS } from '../theme.js';

export function AddInfoModal({ personName, category, onClose, onSave }) {
  const cat = categoryMeta(category);
  const [emoji, setEmoji] = useState(cat.emoji);
  const [text, setText] = useState('');
  const [temporary, setTemporary] = useState(category === 'important');
  const canSave = text.trim().length > 0;
  function save() { if (canSave) onSave({ emoji, text: text.trim(), temporary }); }

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
    if (e.key === 'Enter' && isTabbedToButton()) return;
    const key = e.key.toLowerCase();
    const act = (fn) => { e.preventDefault(); fn(); };
    if (e.key === 'Enter') act(save);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      act(() => {
        const i = EMOJI_CHOICES.indexOf(emoji);
        const n = EMOJI_CHOICES.length;
        setEmoji(EMOJI_CHOICES[i < 0 ? 0 : (i + (e.key === 'ArrowLeft' ? n - 1 : 1)) % n]);
      });
    } else if (key === 't') act(() => setTemporary(t => !t));
    else if (key === 'n') act(() => { const el = document.getElementById('add-info-text'); if (el) el.focus(); });
  }

  return (
    <Sheet title={`Add to ${cat.label}`} onClose={onClose} onKey={onKey}
      footer={<button onClick={save} disabled={!canSave} className="w-full flex items-center justify-center gap-2 text-sm font-semibold rounded-full py-3" style={{ background: canSave ? COLORS.accent : COLORS.line, color: canSave ? COLORS.onAccent : COLORS.inkSoft }}>Save{canSave && <Kbd onAccent>↵</Kbd>}</button>}>
      <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>Adding to {personName}'s profile</p>
      <p className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: COLORS.ink }}>Choose an icon <Kbd>←</Kbd><Kbd>→</Kbd></p>
      <div className="grid grid-cols-5 gap-2 mb-4" role="group" aria-label="Icon">
        {EMOJI_CHOICES.map(e => (
          <button key={e} type="button" onClick={() => setEmoji(e)} aria-pressed={emoji === e} className="rounded-xl py-2 flex items-center justify-center" style={{ background: emoji === e ? COLORS.accentSoft : COLORS.paperRaised, border: `1.5px solid ${emoji === e ? COLORS.accent : COLORS.line}`, fontSize: 18 }}>{e}</button>
        ))}
      </div>
      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>Details</p>
      <KeyedField letter="N" id="add-info-text" autoFocus value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
        aria-label="Details" placeholder={cat.placeholder} className="w-full text-sm rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}` }} />
      <button type="button" role="checkbox" aria-checked={temporary} onClick={() => setTemporary(t => !t)} className="w-full flex items-center gap-3 mt-4">
        <span style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${temporary ? COLORS.accent : COLORS.line}`, background: temporary ? COLORS.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {temporary && <Check size={13} color={COLORS.onAccent} />}
        </span>
        <span className="text-sm flex-1 text-left" style={{ color: COLORS.ink }}>This is temporary (e.g. a one-off event)</span>
        <Kbd>T</Kbd>
      </button>
    </Sheet>
  );
}
