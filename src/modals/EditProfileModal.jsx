// Edit your name and focus after onboarding (Me tab).
// Keys: N your name (Esc or Tab leaves it), 1-4 what you're focusing on,
// Enter saves.

import { useState } from 'react';
import { Sheet } from '../components/Sheet.jsx';
import { isTabbedToButton, isTyping } from '../components/sheetLayer.js';
import { KeyedField, Kbd } from '../components/atoms.jsx';
import { FOCUS_OPTIONS } from '../data/constants.js';
import { COLORS } from '../theme.js';

export function EditProfileModal({ profile, onClose, onSave }) {
  const [name, setName] = useState(profile.name || '');
  const [focus, setFocus] = useState(profile.focus || null);
  const canSave = name.trim().length > 0;
  function save() { if (canSave) onSave({ name: name.trim(), focus }); }

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
    if (e.key === 'Enter' && isTabbedToButton()) return;
    const num = /^[1-9]$/.test(e.key) ? Number(e.key) : null;
    const act = (fn) => { e.preventDefault(); fn(); };
    if (e.key === 'Enter') act(save);
    else if (num && FOCUS_OPTIONS[num - 1]) act(() => setFocus(FOCUS_OPTIONS[num - 1].key));
    else if (e.key.toLowerCase() === 'n') act(() => { const el = document.getElementById('profile-name'); if (el) { el.focus(); el.select(); } });
  }

  return (
    <Sheet title="Your profile" onClose={onClose} onKey={onKey}
      footer={<button onClick={save} disabled={!canSave} className="w-full flex items-center justify-center gap-2 text-sm font-semibold rounded-full py-3" style={{ background: canSave ? COLORS.accent : COLORS.line, color: canSave ? COLORS.onAccent : COLORS.inkSoft }}>Save changes{canSave && <Kbd onAccent>↵</Kbd>}</button>}>
      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>What should we call you?</p>
      <KeyedField letter="N" id="profile-name" wrapClassName="mb-5" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
        aria-label="Your name" placeholder="Your name" className="w-full text-sm rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}` }} />
      <p className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: COLORS.ink }}>What are you focusing on? <Kbd>1–{FOCUS_OPTIONS.length}</Kbd></p>
      <p className="text-xs mb-2" style={{ color: COLORS.inkSoft }}>Today's "Try this next" suggestion follows this.</p>
      <div className="grid grid-cols-2 gap-2">
        {FOCUS_OPTIONS.map((o, i) => (
          <button key={o.key} type="button" onClick={() => setFocus(o.key)} aria-pressed={focus === o.key} aria-label={o.label} className="rounded-2xl p-3 text-left flex items-center gap-2" style={{ background: focus === o.key ? COLORS.accentSoft : COLORS.paperRaised, border: `1.5px solid ${focus === o.key ? COLORS.accent : COLORS.line}` }}>
            <span className="text-xs font-semibold flex-1" style={{ color: focus === o.key ? COLORS.accent : COLORS.ink }}>{o.label}</span>
            <Kbd>{i + 1}</Kbd>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
