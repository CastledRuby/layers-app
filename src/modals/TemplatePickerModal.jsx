// Category -> item template picker ("Add detail", "Quick add interest").

import { useState } from 'react';
import { Sheet } from '../components/Sheet.jsx';
import { NOTE_TEMPLATES } from '../data/constants.js';
import { COLORS } from '../theme.js';

// Button-only category -> specific-item picker for quick notes (used when
// logging an interaction or a saved event). Tapping an item calls onPick;
// this component doesn't manage its own visibility — the parent toggles it.
// Full-screen category -> item template picker, used for both "Add detail"
// when logging and "Quick add interest" on a person's profile. Big buttons
// filling the sheet rather than a small scrolling strip. onPick receives
// (text, emoji) so callers that need an icon (interests) have one, and
// callers that just want text (notes) can ignore the second argument.
export function TemplatePickerModal({ title, subtitle, onClose, onPick, allowMultiple }) {
  const [cat, setCat] = useState(null); // null = category grid | 'custom' | a NOTE_TEMPLATES key
  const [customText, setCustomText] = useState('');
  const [pickedCount, setPickedCount] = useState(0);
  const catData = cat && cat !== 'custom' ? NOTE_TEMPLATES.find(c => c.key === cat) : null;

  function pickItem(text, emoji) {
    onPick(text, emoji);
    if (!allowMultiple) { onClose(); return; }
    setPickedCount(c => c + 1);
    setCat(null);
  }
  function saveCustom() {
    if (!customText.trim()) return;
    pickItem(customText.trim(), '✏️');
    setCustomText('');
  }

  const screenTitle = cat === 'custom' ? 'Custom' : catData ? catData.label : title;

  return (
    <Sheet title={screenTitle} onClose={onClose} tall>
      {!cat && (
        <>
          {subtitle && <p className="text-xs mb-4" style={{ color: COLORS.inkSoft }}>{subtitle}{allowMultiple && pickedCount > 0 ? ` — ${pickedCount} added so far` : ''}</p>}
          <div className="grid grid-cols-3 gap-2.5">
            {NOTE_TEMPLATES.map(c => (
              <button key={c.key} onClick={() => setCat(c.key)} className="rounded-2xl py-5 flex flex-col items-center gap-1.5" style={{ background: COLORS.paperRaised, border: `1.5px solid ${COLORS.line}` }}>
                <span style={{ fontSize: 22 }}>{c.emoji}</span>
                <span className="text-xs font-semibold text-center" style={{ color: COLORS.ink }}>{c.label}</span>
              </button>
            ))}
            <button onClick={() => setCat('custom')} className="rounded-2xl py-5 flex flex-col items-center gap-1.5" style={{ background: COLORS.accentSoft, border: `1.5px solid ${COLORS.accent}` }}>
              <span style={{ fontSize: 22 }}>✏️</span>
              <span className="text-xs font-semibold text-center" style={{ color: COLORS.accent }}>Custom</span>
            </button>
          </div>
        </>
      )}
      {cat === 'custom' && (
        <>
          <button onClick={() => setCat(null)} className="text-xs font-semibold mb-3" style={{ color: COLORS.inkSoft }}>‹ Back</button>
          <input autoFocus value={customText} onChange={e => setCustomText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveCustom(); }} placeholder="Type your own..." className="w-full text-sm rounded-xl px-3 py-2.5 mb-3" style={{ border: `1px solid ${COLORS.accent}` }} />
          <button onClick={saveCustom} disabled={!customText.trim()} className="w-full text-sm font-semibold rounded-full py-3" style={{ background: customText.trim() ? COLORS.accent : COLORS.line, color: customText.trim() ? '#fff' : COLORS.inkSoft }}>Add</button>
        </>
      )}
      {catData && (
        <>
          <button onClick={() => setCat(null)} className="text-xs font-semibold mb-3" style={{ color: COLORS.inkSoft }}>‹ Back</button>
          <div className="grid grid-cols-2 gap-2.5">
            {catData.items.map(item => (
              <button key={item} onClick={() => pickItem(item, catData.emoji)} className="text-sm font-medium rounded-xl py-3.5 px-2 text-center" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>{item}</button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}
