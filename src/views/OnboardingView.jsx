// First-run onboarding.

import { useState } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { FOCUS_OPTIONS, PERSON_EMOJIS } from '../data/constants.js';
import { COLORS } from '../theme.js';

export function OnboardingView({ initialName, initialFocus, onComplete }) {
  const [step, setStep] = useState('intro');
  const [name, setName] = useState(initialName || '');
  const [focus, setFocus] = useState(initialFocus || null);
  const [draftPeople, setDraftPeople] = useState([]);
  const [newName, setNewName] = useState('');
  const canContinue = name.trim().length > 0;

  function addDraftPerson() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setDraftPeople(prev => [...prev, { name: trimmed, emoji: PERSON_EMOJIS[prev.length % PERSON_EMOJIS.length] }]);
    setNewName('');
  }
  function removeDraftPerson(i) { setDraftPeople(prev => prev.filter((_, idx) => idx !== i)); }

  if (step === 'people') {
    return (
      <div className="fade-anim px-6 pt-10 pb-8">
        <button onClick={() => setStep('intro')} className="flex items-center gap-1 text-sm font-medium mb-4" style={{ color: COLORS.inkSoft }}><ChevronLeft size={18} /> Back</button>
        <p className="font-display" style={{ fontSize: 24, color: COLORS.ink }}>Who's in your circle?</p>
        <p className="text-sm mt-2" style={{ color: COLORS.inkSoft }}>Add as many as you'd like now — everyone starts at Orientation, and you can adjust or add more any time.</p>

        {draftPeople.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
            {draftPeople.map((p, i) => (
              <span key={i} className="flex items-center gap-1.5 text-sm rounded-full pl-2.5 pr-1.5 py-1.5" style={{ background: COLORS.accentSoft, color: COLORS.accent }}>
                {p.emoji} {p.name}
                <button onClick={() => removeDraftPerson(i)} aria-label={`Remove ${p.name}`} className="p-0.5"><X size={12} /></button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 mt-5">
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDraftPerson(); } }} placeholder="Someone's name" aria-label="Person's name" className="flex-1 text-sm rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}` }} />
          <button onClick={addDraftPerson} className="text-xs font-semibold rounded-full px-4 py-2.5" style={{ background: COLORS.accent, color: '#fff' }}>Add</button>
        </div>

        <div className="mt-9">
          <button onClick={() => onComplete({ name: name.trim(), focus, startFresh: true, newPeople: draftPeople })} className="w-full text-sm font-semibold rounded-full py-3 mb-2.5" style={{ background: COLORS.accent, color: '#fff' }}>{draftPeople.length > 0 ? `Continue with ${draftPeople.length} ${draftPeople.length === 1 ? 'person' : 'people'}` : 'Continue'}</button>
          <button onClick={() => onComplete({ name: name.trim(), focus, startFresh: true, newPeople: [] })} className="w-full text-sm font-semibold rounded-full py-3" style={{ background: COLORS.paperRaised, color: COLORS.inkSoft, border: `1px solid ${COLORS.line}` }}>Skip, I'll add people later</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-anim px-6 pt-10 pb-8">
      <p className="font-display" style={{ fontSize: 28, color: COLORS.ink }}>Welcome to Layers</p>
      <p className="text-sm mt-2" style={{ color: COLORS.inkSoft }}>A private space to be more intentional about your relationships and your own social skills. Everything here stays on this device, only for you.</p>

      <p className="text-sm font-semibold mt-8 mb-2" style={{ color: COLORS.ink }}>What should we call you?</p>
      <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Your name" aria-label="Your name" className="w-full text-sm rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}` }} />

      <p className="text-sm font-semibold mt-6 mb-2" style={{ color: COLORS.ink }}>What brings you here?</p>
      <div className="grid grid-cols-2 gap-2">
        {FOCUS_OPTIONS.map(o => (
          <button key={o.key} onClick={() => setFocus(o.key)} aria-pressed={focus === o.key} className="rounded-2xl p-3 text-left" style={{ background: focus === o.key ? COLORS.accentSoft : COLORS.paperRaised, border: `1.5px solid ${focus === o.key ? COLORS.accent : COLORS.line}` }}>
            <span className="text-xs font-semibold" style={{ color: focus === o.key ? COLORS.accent : COLORS.ink }}>{o.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-9">
        <button onClick={() => canContinue && setStep('people')} disabled={!canContinue} className="w-full text-sm font-semibold rounded-full py-3 mb-2.5" style={{ background: canContinue ? COLORS.accent : COLORS.line, color: canContinue ? '#fff' : COLORS.inkSoft }}>Start fresh with my own people</button>
        <button onClick={() => canContinue && onComplete({ name: name.trim(), focus, startFresh: false })} disabled={!canContinue} className="w-full text-sm font-semibold rounded-full py-3" style={{ background: COLORS.paperRaised, color: canContinue ? COLORS.accent : COLORS.inkSoft, border: `1px solid ${canContinue ? COLORS.accent : COLORS.line}` }}>Explore with example people first</button>
        <p className="text-xs text-center mt-3" style={{ color: COLORS.inkSoft }}>You can clear the examples any time from the Me tab.</p>
      </div>
    </div>
  );
}
