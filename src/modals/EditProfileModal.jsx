// Edit your name and focus after onboarding (Me tab).

import { useState } from 'react';
import { Sheet } from '../components/Sheet.jsx';
import { FOCUS_OPTIONS } from '../data/constants.js';
import { COLORS } from '../theme.js';

export function EditProfileModal({ profile, onClose, onSave }) {
  const [name, setName] = useState(profile.name || '');
  const [focus, setFocus] = useState(profile.focus || null);
  const canSave = name.trim().length > 0;

  return (
    <Sheet title="Your profile" onClose={onClose}
      footer={<button onClick={() => canSave && onSave({ name: name.trim(), focus })} disabled={!canSave} className="w-full text-sm font-semibold rounded-full py-3" style={{ background: canSave ? COLORS.accent : COLORS.line, color: canSave ? '#fff' : COLORS.inkSoft }}>Save changes</button>}>
      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>What should we call you?</p>
      <input value={name} onChange={e => setName(e.target.value)} aria-label="Your name" placeholder="Your name" className="w-full text-sm rounded-xl px-3 py-2.5 mb-5" style={{ border: `1px solid ${COLORS.line}` }} />
      <p className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>What are you focusing on?</p>
      <p className="text-xs mb-2" style={{ color: COLORS.inkSoft }}>Home's "Try this next" suggestion follows this.</p>
      <div className="grid grid-cols-2 gap-2">
        {FOCUS_OPTIONS.map(o => (
          <button key={o.key} type="button" onClick={() => setFocus(o.key)} aria-pressed={focus === o.key} className="rounded-2xl p-3 text-left" style={{ background: focus === o.key ? COLORS.accentSoft : COLORS.paperRaised, border: `1.5px solid ${focus === o.key ? COLORS.accent : COLORS.line}` }}>
            <span className="text-xs font-semibold" style={{ color: focus === o.key ? COLORS.accent : COLORS.ink }}>{o.label}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
