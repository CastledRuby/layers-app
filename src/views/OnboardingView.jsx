// First-run onboarding, and setting up again after starting over. Up to three
// steps, with a progress bar:
//   intro   your name and focus; start fresh, explore the example people, or
//           restore from a backup. Enter starts fresh.
//   people  who's in your circle: type a name or tap a suggestion, then tap
//           how close each person is (their layer) and their emoji
//   ready   the notifications you want, then Go to Today (Enter) or Plan
//           something first (P)
// The example people skip "people". See docs/renderer/app-structure.md.

import { useEffect, useState } from 'react';
import { Bell, ChevronLeft, Upload, X } from 'lucide-react';
import { Kbd } from '../components/atoms.jsx';
import { RingsWelcome } from '../components/illustrations.jsx';
import { FOCUS_OPTIONS, LAYERS, PERSON_EMOJIS } from '../data/constants.js';
import { NOTIFY_DEFAULTS } from '../lib/calendar.js';
import { formatTime12 } from '../lib/dates.js';
import { COLORS } from '../theme.js';

const QUICK_NAMES = ['Mum', 'Dad', 'Partner', 'Best friend', 'Brother', 'Sister', 'Flatmate', 'Workmate'];
const STEP_LABELS = { intro: 'You', people: 'Your people', ready: 'Ready' };
const listNames = (names) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

function Progress({ step, samples }) {
  const steps = samples ? ['intro', 'ready'] : ['intro', 'people', 'ready'];
  const at = steps.indexOf(step);
  return (
    <div className="mb-6" aria-label={`Step ${at + 1} of ${steps.length}: ${STEP_LABELS[step]}`}>
      <div className="flex gap-1.5">
        {steps.map((s, i) => <span key={s} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= at ? COLORS.accent : COLORS.line, transition: 'background .3s ease' }} />)}
      </div>
      <p className="text-xs mt-2 font-semibold" style={{ color: COLORS.inkSoft }}>Step {at + 1} of {steps.length} · {STEP_LABELS[step]}</p>
    </div>
  );
}

function Switch({ on, onChange, label, detail }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="w-full flex items-center gap-3 py-2.5 text-left">
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold" style={{ color: COLORS.ink }}>{label}</span>
        {detail && <span className="block text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>{detail}</span>}
      </span>
      <span style={{ width: 40, height: 24, borderRadius: 12, padding: 3, flexShrink: 0, background: on ? COLORS.accent : COLORS.line, transition: 'background .2s ease' }}>
        <span style={{ display: 'block', width: 18, height: 18, borderRadius: '50%', background: COLORS.paperRaised, transform: on ? 'translateX(16px)' : 'none', transition: 'transform .2s ease' }} />
      </span>
    </button>
  );
}

export function OnboardingView({ initialName, initialFocus, initialNotify = NOTIFY_DEFAULTS, onComplete, onRestore }) {
  const [step, setStep] = useState('intro');
  const [samples, setSamples] = useState(false);
  const [name, setName] = useState(initialName || '');
  const [focus, setFocus] = useState(initialFocus || null);
  const [draftPeople, setDraftPeople] = useState([]); // [{ name, emoji, layer }]
  const [newName, setNewName] = useState('');
  const [notify, setNotify] = useState(() => ({
    reminderNotifications: initialNotify.reminderNotifications,
    morningSummary: initialNotify.morningSummary,
    eveningHeadsUp: initialNotify.eveningHeadsUp,
  }));
  const canContinue = name.trim().length > 0;

  function addDraftPerson(raw) {
    const trimmed = (raw === undefined ? newName : raw).trim();
    if (!trimmed) return;
    setDraftPeople(prev => [...prev, { name: trimmed, emoji: PERSON_EMOJIS[prev.length % PERSON_EMOJIS.length], layer: 1 }]);
    if (raw === undefined) setNewName('');
  }
  const updateDraft = (i, changes) => setDraftPeople(prev => prev.map((p, idx) => idx === i ? { ...p, ...changes } : p));
  const removeDraftPerson = (i) => setDraftPeople(prev => prev.filter((_, idx) => idx !== i));
  function startFresh() { if (canContinue) { setSamples(false); setStep('people'); } }
  function explore() { if (canContinue) { setSamples(true); setDraftPeople([]); setStep('ready'); } }
  function finish(then) {
    onComplete({ name: name.trim(), focus, startFresh: !samples, newPeople: samples ? [] : draftPeople, notify, then });
  }

  // On "ready", Enter goes to Today and P plans something first.
  useEffect(() => {
    if (step !== 'ready') return undefined;
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      const el = document.activeElement;
      if (el && el.tagName === 'BUTTON' && e.key === 'Enter') return;
      if (e.key === 'Enter') { e.preventDefault(); finish('today'); }
      else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); finish('plan'); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (step === 'people') {
    const unused = QUICK_NAMES.filter(n => !draftPeople.some(p => p.name.toLowerCase() === n.toLowerCase()));
    return (
      <div className="step-in px-6 pt-8 pb-8">
        <Progress step="people" samples={false} />
        <button type="button" onClick={() => setStep('intro')} className="flex items-center gap-1 text-sm font-medium mb-3" style={{ color: COLORS.inkSoft }}><ChevronLeft size={18} /> Back</button>
        <p className="font-display" style={{ fontSize: 24, color: COLORS.ink }}>Who's in your circle?</p>
        <p className="text-sm mt-2" style={{ color: COLORS.inkSoft }}>Type a name and press Enter, or tap one below. Then tap how close you are; you can change it any time. Enter on an empty box goes on.</p>

        <div className="flex items-center gap-2 mt-5">
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newName.trim()) addDraftPerson(); else if (!e.repeat) setStep('ready'); } }}
            placeholder="Someone's name" aria-label="Person's name" className="flex-1 text-sm rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}` }} />
          <button type="button" onClick={() => addDraftPerson()} className="text-xs font-semibold rounded-full px-4 py-2.5" style={{ background: COLORS.accent, color: COLORS.onAccent }}>Add</button>
        </div>
        {unused.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {unused.map(n => <button key={n} type="button" onClick={() => addDraftPerson(n)} className="chip">+ {n}</button>)}
          </div>
        )}

        {draftPeople.length > 0 && (
          <div className="flex flex-col gap-2 mt-5">
            {draftPeople.map((p, i) => (
              <div key={i} className="rounded-2xl p-3 chip-in" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => updateDraft(i, { emoji: PERSON_EMOJIS[(PERSON_EMOJIS.indexOf(p.emoji) + 1) % PERSON_EMOJIS.length] })} aria-label={`Change ${p.name}'s emoji`} style={{ fontSize: 22, lineHeight: 1 }}>{p.emoji}</button>
                  <span className="flex-1 min-w-0 text-sm font-semibold truncate" style={{ color: COLORS.ink }}>{p.name}</span>
                  <button type="button" onClick={() => removeDraftPerson(i)} aria-label={`Remove ${p.name}`} className="icon-btn"><X size={15} color={COLORS.inkSoft} /></button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2" role="group" aria-label={`How close are you to ${p.name}?`}>
                  {LAYERS.map(l => (
                    <button key={l.id} type="button" onClick={() => updateDraft(i, { layer: l.id })} aria-pressed={p.layer === l.id} className="chip" style={{ padding: '3px 9px', fontSize: 11.5, ...(p.layer === l.id ? { background: l.tint, color: l.deep, borderColor: l.color } : {}) }}>{l.name}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8">
          <button type="button" onClick={() => setStep('ready')} className="w-full text-sm font-semibold rounded-full py-3 mb-2.5" style={{ background: COLORS.accent, color: COLORS.onAccent }}>{draftPeople.length > 0 ? `Continue with ${draftPeople.length} ${draftPeople.length === 1 ? 'person' : 'people'}` : 'Continue'}</button>
          {draftPeople.length === 0 && <button type="button" onClick={() => setStep('ready')} className="w-full text-sm font-semibold rounded-full py-3" style={{ background: COLORS.paperRaised, color: COLORS.inkSoft, border: `1px solid ${COLORS.line}` }}>Skip, I'll add people later</button>}
        </div>
      </div>
    );
  }

  if (step === 'ready') {
    const who = samples ? 'Alex, Jamie, Priya, Noah and Sam are here to explore. Remove them any time in Me.'
      : draftPeople.length ? `${listNames(draftPeople.map(p => p.name))} ${draftPeople.length === 1 ? 'is' : 'are'} in your circle.`
        : 'Add people any time from People.';
    return (
      <div className="step-in px-6 pt-8 pb-8">
        <Progress step="ready" samples={samples} />
        <button type="button" onClick={() => setStep(samples ? 'intro' : 'people')} className="flex items-center gap-1 text-sm font-medium mb-3" style={{ color: COLORS.inkSoft }}><ChevronLeft size={18} /> Back</button>
        <p className="font-display" style={{ fontSize: 26, color: COLORS.ink }}>You're all set, {name.trim()}</p>
        <p className="text-sm mt-2" style={{ color: COLORS.inkSoft }}>{who}</p>

        <div className="rounded-2xl px-4 py-2 mt-6" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }}>
          <p className="text-xs font-bold pt-2 flex items-center gap-1.5" style={{ color: COLORS.inkSoft, letterSpacing: '0.06em', textTransform: 'uppercase' }}><Bell size={12} /> Notifications</p>
          <Switch on={notify.reminderNotifications} onChange={v => setNotify(n => ({ ...n, reminderNotifications: v }))} label="Reminders before plans" detail={`${NOTIFY_DEFAULTS.defaultAlert} minutes before, unless you pick another time`} />
          <Switch on={notify.morningSummary} onChange={v => setNotify(n => ({ ...n, morningSummary: v }))} label="Morning summary" detail={`Your day at ${formatTime12(initialNotify.morningTime || NOTIFY_DEFAULTS.morningTime)}`} />
          <Switch on={notify.eveningHeadsUp} onChange={v => setNotify(n => ({ ...n, eveningHeadsUp: v }))} label="Evening heads-up" detail={`Tomorrow's plans at ${formatTime12(initialNotify.eveningTime || NOTIFY_DEFAULTS.eveningTime)}`} />
        </div>
        <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>Change these, and their times, any time in Me.</p>

        <div className="mt-8">
          <button type="button" onClick={() => finish('today')} className="w-full flex items-center justify-center gap-2 text-sm font-semibold rounded-full py-3 mb-2.5" style={{ background: COLORS.accent, color: COLORS.onAccent }}>Go to Today <Kbd onAccent>↵</Kbd></button>
          <button type="button" onClick={() => finish('plan')} className="w-full flex items-center justify-center gap-2 text-sm font-semibold rounded-full py-3" style={{ background: COLORS.paperRaised, color: COLORS.accent, border: `1px solid ${COLORS.accent}` }}>Plan something first <Kbd>P</Kbd></button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-anim px-6 pt-8 pb-8">
      <Progress step="intro" samples={samples} />
      <div className="mb-4" style={{ display: 'flex', justifyContent: 'center' }}><RingsWelcome width={210} /></div>
      <p className="font-display" style={{ fontSize: 28, color: COLORS.ink }}>Welcome to Layers</p>
      <p className="text-sm mt-2" style={{ color: COLORS.inkSoft }}>A private space to be more intentional about your relationships and your own social skills. Everything here stays on this device, only for you.</p>

      <p className="text-sm font-semibold mt-8 mb-2" style={{ color: COLORS.ink }}>What should we call you?</p>
      <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); startFresh(); } }} placeholder="Your name" aria-label="Your name" className="w-full text-sm rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}` }} />

      <p className="text-sm font-semibold mt-6 mb-2" style={{ color: COLORS.ink }}>What brings you here?</p>
      <div className="grid grid-cols-2 gap-2">
        {FOCUS_OPTIONS.map(o => (
          <button key={o.key} type="button" onClick={() => setFocus(o.key)} aria-pressed={focus === o.key} className="rounded-2xl p-3 text-left" style={{ background: focus === o.key ? COLORS.accentSoft : COLORS.paperRaised, border: `1.5px solid ${focus === o.key ? COLORS.accent : COLORS.line}` }}>
            <span className="text-xs font-semibold" style={{ color: focus === o.key ? COLORS.accent : COLORS.ink }}>{o.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-9">
        <button type="button" onClick={startFresh} disabled={!canContinue} className="w-full text-sm font-semibold rounded-full py-3 mb-2.5" style={{ background: canContinue ? COLORS.accent : COLORS.line, color: canContinue ? COLORS.onAccent : COLORS.inkSoft }}>Start fresh with my own people</button>
        <button type="button" onClick={explore} disabled={!canContinue} className="w-full text-sm font-semibold rounded-full py-3" style={{ background: COLORS.paperRaised, color: canContinue ? COLORS.accent : COLORS.inkSoft, border: `1px solid ${canContinue ? COLORS.accent : COLORS.line}` }}>Explore with example people first</button>
        <p className="text-xs text-center mt-3" style={{ color: COLORS.inkSoft }}>You can clear the examples any time from the Me tab.</p>
        {onRestore && (
          <button type="button" onClick={onRestore} className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold mt-5" style={{ color: COLORS.accent }}><Upload size={13} /> Restore from a backup</button>
        )}
      </div>
    </div>
  );
}
