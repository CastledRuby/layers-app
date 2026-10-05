// Category -> item template picker ("Add detail", "Quick add interest").

import { useRef, useState } from 'react';
import { Sheet } from '../components/Sheet.jsx';
import { isTabbedToButton, isTyping } from '../components/sheetLayer.js';
import { KeyedField, Kbd } from '../components/atoms.jsx';
import { NOTE_TEMPLATES } from '../data/constants.js';
import { COLORS } from '../theme.js';

// Button-only category -> specific-item picker for quick notes (used when
// logging an interaction or a saved event). Tapping an item calls onPick;
// this component doesn't manage its own visibility — the parent toggles it.
// Full-screen category -> item template picker, used for both "Add detail"
// when logging and "Quick add interest" on a person's profile. Big buttons
// filling the sheet rather than a small scrolling strip. onPick receives
// (text, emoji) so callers that need an icon (interests) have one, and
// callers that just want text (notes) can ignore the second argument. The
// third is the NOTE_TEMPLATES category key ('custom' for typed text), which
// the log uses to file a topic on the person's profile.
// Keys: 1-9 and 0 the topics, N your own words (Custom), Backspace back.
export function TemplatePickerModal({ title, subtitle, onClose, onPick, allowMultiple }) {
  const [cat, setCat] = useState(null); // null = category grid | 'custom' | a NOTE_TEMPLATES key
  const [customText, setCustomText] = useState('');
  const [pickedCount, setPickedCount] = useState(0);
  const [dir, setDir] = useState(null); // which way the last screen change went, for its slide
  const customRef = useRef(null);
  function openCat(key) { setDir('in'); setCat(key); }
  function back() { setDir('back'); setCat(null); }
  const catData = cat && cat !== 'custom' ? NOTE_TEMPLATES.find(c => c.key === cat) : null;

  function pickItem(text, emoji, catKey) {
    onPick(text, emoji, catKey);
    if (!allowMultiple) { onClose(); return; }
    setPickedCount(c => c + 1);
    back();
  }
  function saveCustom() {
    if (!customText.trim()) return;
    pickItem(customText.trim(), '✏️', 'custom');
    setCustomText('');
  }

  const screenTitle = cat === 'custom' ? 'Custom' : catData ? catData.label : title;

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
    if (e.key === 'Enter' && isTabbedToButton()) return;
    const key = e.key.toLowerCase();
    if (!cat) {
      const i = e.key === '0' ? 9 : /^[1-9]$/.test(e.key) ? Number(e.key) - 1 : -1;
      if (i >= 0 && NOTE_TEMPLATES[i]) { e.preventDefault(); openCat(NOTE_TEMPLATES[i].key); }
      else if (key === 'n') { e.preventDefault(); openCat('custom'); }
    } else if (e.key === 'Backspace') { e.preventDefault(); back(); }
    else if (cat === 'custom' && key === 'n') { e.preventDefault(); if (customRef.current) customRef.current.focus(); }
  }

  return (
    <Sheet title={screenTitle} onClose={onClose} onBack={cat ? back : undefined} onKey={onKey} tall>
      <div key={cat || 'grid'} className={dir === 'in' ? 'step-in' : dir === 'back' ? 'step-back' : ''}>
        {!cat && (
          <>
            {subtitle && <p className="text-xs mb-4" style={{ color: COLORS.inkSoft }}>{subtitle}{allowMultiple && pickedCount > 0 ? ` — ${pickedCount} added so far` : ''}</p>}
            <div className="grid grid-cols-3 gap-2.5">
              {NOTE_TEMPLATES.map((c, i) => (
                <button key={c.key} type="button" onClick={() => openCat(c.key)} className="tile py-5 px-1 flex flex-col items-center gap-2">
                  {i < 10 && <Kbd>{i === 9 ? 0 : i + 1}</Kbd>}
                  <span style={{ fontSize: 24, lineHeight: 1 }}>{c.emoji}</span>
                  <span className="text-xs font-semibold text-center">{c.label}</span>
                </button>
              ))}
              <button type="button" onClick={() => openCat('custom')} className="tile tile--accent py-5 px-1 flex flex-col items-center gap-2">
                <Kbd>N</Kbd>
                <span style={{ fontSize: 24, lineHeight: 1 }}>✏️</span>
                <span className="text-xs font-semibold text-center">Custom</span>
              </button>
            </div>
          </>
        )}
        {cat === 'custom' && (
          <>
            <KeyedField letter="N" autoFocus ref={customRef} wrapClassName="mb-3" value={customText} onChange={e => setCustomText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveCustom(); } }} aria-label="Your own" placeholder="Type your own..." className="w-full text-sm rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}` }} />
            <button type="button" onClick={saveCustom} disabled={!customText.trim()} className="primary-btn">Add</button>
          </>
        )}
        {catData && (
          <div className="grid grid-cols-2 gap-2.5">
            {catData.items.map(item => (
              <button key={item} type="button" onClick={() => pickItem(item, catData.emoji, catData.key)} className="tile text-sm font-medium py-3.5 px-2 text-center">{item}</button>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
