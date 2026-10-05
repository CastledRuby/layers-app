// First-run onboarding, and setting up again after starting over. Up to three
// steps, with a progress bar:
//   intro   your name and focus; start fresh, explore the example people, or
//           restore from a backup. Enter starts fresh; out of the name box
//           (Esc or Tab), 1-4 pick what brings you here, E explores and R
//           restores.
//   people  who's in your circle: type a name (Enter) or tap a suggestion.
//           "How close are you two?" (QuizSheet) asks a few questions to place
//           them when you want it: Shift+Enter adds someone and asks, Q (out
//           of the name box) asks about the newest, or a card's Questions.
//           A picks the newest one's avatar (AvatarSheet). Each card's layer
//           can be tapped too. Enter on an empty box goes on.
//   ready   the notifications you want and the keys worth knowing, then Go to
//           Today (Enter) or Plan something first (P)
// The example people skip "people". See docs/renderer/app-structure.md.

import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronLeft, Keyboard, Upload, X } from 'lucide-react';
import { Kbd } from '../components/atoms.jsx';
import { QuizSheet } from '../components/ClosenessQuiz.jsx';
import { AvatarSheet } from '../components/AvatarPicker.jsx';
import { isTyping } from '../components/sheetLayer.js';
import { RingsWelcome } from '../components/illustrations.jsx';
import { FOCUS_OPTIONS, LAYERS, PERSON_EMOJIS } from '../data/constants.js';
import { NOTIFY_DEFAULTS } from '../lib/calendar.js';
import { formatTime12 } from '../lib/dates.js';
import { COLORS } from '../theme.js';

const QUICK_NAMES = ['Mum', 'Dad', 'Partner', 'Best friend', 'Brother', 'Sister', 'Flatmate', 'Workmate'];
const STEP_LABELS = { intro: 'You', people: 'Your people', ready: 'Ready' };
// The keys worth knowing, on "ready".
const KEYS_TO_KNOW = [
  { keys: ['Ctrl', 'K'], text: 'Jump to anyone or anything, or type a plan: "coffee w Sam fri 10am"' },
  { keys: ['N'], text: 'Log time with someone' },
  { keys: ['P'], text: 'Plan something' },
  { keys: ['Ctrl', 'Shift', 'L'], text: 'From any app: the quick-add box' },
  { keys: ['?'], text: 'Every shortcut' },
];
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
  const [draftPeople, setDraftPeople] = useState([]); // [{ name, emoji, layer, overall }]
  const [newName, setNewName] = useState('');
  const [quizFor, setQuizFor] = useState(null); // the draft person the quiz is asking about
  const [avatarFor, setAvatarFor] = useState(null); // the draft person whose avatar is being picked
  const nameRef = useRef(null);
  const [notify, setNotify] = useState(() => ({
    reminderNotifications: initialNotify.reminderNotifications,
    morningSummary: initialNotify.morningSummary,
    eveningHeadsUp: initialNotify.eveningHeadsUp,
  }));
  const canContinue = name.trim().length > 0;

  // Added, and with `ask` (Shift+Enter) straight into how close you are.
  function addDraftPerson(raw, ask = false) {
    const trimmed = (raw === undefined ? newName : raw).trim();
    if (!trimmed) return;
    setDraftPeople(prev => [...prev, { name: trimmed, emoji: PERSON_EMOJIS[prev.length % PERSON_EMOJIS.length], layer: 1, overall: null }]);
    if (ask) setQuizFor(draftPeople.length);
    if (raw === undefined) setNewName('');
  }
  function closeQuiz() {
    setQuizFor(null);
    if (nameRef.current) nameRef.current.focus();
  }
  function closeAvatar() {
    setAvatarFor(null);
    if (nameRef.current) nameRef.current.focus();
  }
  const updateDraft = (i, changes) => setDraftPeople(prev => prev.map((p, idx) => idx === i ? { ...p, ...changes } : p));
  const removeDraftPerson = (i) => setDraftPeople(prev => prev.filter((_, idx) => idx !== i));
  function startFresh() { if (canContinue) { setSamples(false); setStep('people'); } }
  function explore() { if (canContinue) { setSamples(true); setDraftPeople([]); setStep('ready'); } }
  function finish(then) {
    onComplete({ name: name.trim(), focus, startFresh: !samples, newPeople: samples ? [] : draftPeople, notify, then });
  }

  // Out of the name box on "intro": 1-4 what brings you here, E explore,
  // R restore, Enter start fresh, Esc leaves the box. On "people", Q asks
  // the newest person's questions again.
  useEffect(() => {
    if (step === 'ready') return undefined;
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || quizFor !== null || avatarFor !== null) return;
      const el = document.activeElement;
      if (e.key === 'Escape' && isTyping()) { el.blur(); return; }
      if (isTyping() || (el && el.tagName === 'BUTTON' && e.key === 'Enter')) return;
      const key = e.key.toLowerCase();
      if (step === 'intro') {
        if (/^[1-9]$/.test(e.key) && FOCUS_OPTIONS[Number(e.key) - 1]) { e.preventDefault(); setFocus(FOCUS_OPTIONS[Number(e.key) - 1].key); }
        else if (e.key === 'Enter') { e.preventDefault(); startFresh(); }
        else if (key === 'e') { e.preventDefault(); explore(); }
        else if (key === 'r' && onRestore) { e.preventDefault(); onRestore(); }
      } else if (step === 'people') {
        if (key === 'q' && draftPeople.length) { e.preventDefault(); setQuizFor(draftPeople.length - 1); }
        else if (key === 'a' && draftPeople.length) { e.preventDefault(); setAvatarFor(draftPeople.length - 1); }
        else if (key === 'n' && nameRef.current) { e.preventDefault(); nameRef.current.focus(); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

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
        <p className="text-sm mt-2" style={{ color: COLORS.inkSoft }}>Type a name and press Enter, or tap one below, then tap how close you are. Shift+Enter adds someone and asks a few quick questions to place them instead. Out of the box (Esc), Q asks about the newest person and A picks their avatar. Enter on an empty box goes on.</p>

        <div className="flex items-center gap-2 mt-5">
          <input ref={nameRef} autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newName.trim()) addDraftPerson(undefined, e.shiftKey); else if (!e.repeat) setStep('ready'); } }}
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
                  <button type="button" onClick={() => setAvatarFor(i)} aria-label={`Change ${p.name}'s avatar`} title="Change avatar" className="avatar-choice shrink-0" style={{ width: 36, fontSize: 21 }}>{p.emoji}</button>
                  {i === draftPeople.length - 1 && <Kbd>A</Kbd>}
                  <span className="flex-1 min-w-0 text-sm font-semibold truncate" style={{ color: COLORS.ink }}>{p.name}{p.overall !== null && p.overall !== undefined && <span className="text-xs font-medium" style={{ color: COLORS.inkSoft }}> · {p.overall}% into Layer {p.layer}</span>}</span>
                  <button type="button" onClick={() => setQuizFor(i)} className="chip" style={{ padding: '3px 6px 3px 9px', fontSize: 11.5 }}>Questions{i === draftPeople.length - 1 && <Kbd>Q</Kbd>}</button>
                  <button type="button" onClick={() => removeDraftPerson(i)} aria-label={`Remove ${p.name}`} className="icon-btn"><X size={15} color={COLORS.inkSoft} /></button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2" role="group" aria-label={`How close are you to ${p.name}?`}>
                  {LAYERS.map(l => (
                    <button key={l.id} type="button" onClick={() => updateDraft(i, { layer: l.id, overall: p.layer === l.id ? p.overall : null })} aria-pressed={p.layer === l.id} className="chip" style={{ padding: '3px 9px', fontSize: 11.5, ...(p.layer === l.id ? { background: l.tint, color: l.deep, borderColor: l.color } : {}) }}>{l.name}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {avatarFor !== null && draftPeople[avatarFor] && (
          <AvatarSheet name={draftPeople[avatarFor].name} value={draftPeople[avatarFor].emoji} onChange={(emoji) => updateDraft(avatarFor, { emoji })} onClose={closeAvatar} />
        )}
        {quizFor !== null && draftPeople[quizFor] && (
          <QuizSheet key={quizFor} name={draftPeople[quizFor].name} emoji={draftPeople[quizFor].emoji} onClose={closeQuiz}
            onDone={(placement) => { updateDraft(quizFor, placement); closeQuiz(); }} />
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

        <div className="rounded-2xl px-4 py-3 mt-5" style={{ background: COLORS.paperRaised, border: `1px solid ${COLORS.line}` }} aria-label="Keys worth knowing">
          <p className="text-xs font-bold pb-1 flex items-center gap-1.5" style={{ color: COLORS.inkSoft, letterSpacing: '0.06em', textTransform: 'uppercase' }}><Keyboard size={12} /> Keys worth knowing</p>
          {KEYS_TO_KNOW.map(k => (
            <p key={k.keys.join('+')} className="flex items-center gap-3 py-1.5 text-sm" style={{ color: COLORS.ink }}>
              <span className="flex items-center gap-1 shrink-0" style={{ minWidth: 104 }}>{k.keys.map(x => <Kbd key={x}>{x}</Kbd>)}</span>
              <span className="min-w-0">{k.text}</span>
            </p>
          ))}
        </div>

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

      <p className="text-sm font-semibold mt-6 mb-2 flex items-center justify-between gap-2" style={{ color: COLORS.ink }}>What brings you here?<span className="text-xs font-medium" style={{ color: COLORS.inkSoft }}>Esc, then 1–{FOCUS_OPTIONS.length}</span></p>
      <div className="grid grid-cols-2 gap-2">
        {FOCUS_OPTIONS.map((o, i) => (
          <button key={o.key} type="button" onClick={() => setFocus(o.key)} aria-pressed={focus === o.key} className="rounded-2xl p-3 text-left flex items-center gap-2" style={{ background: focus === o.key ? COLORS.accentSoft : COLORS.paperRaised, border: `1.5px solid ${focus === o.key ? COLORS.accent : COLORS.line}` }}>
            <span className="text-xs font-semibold flex-1" style={{ color: focus === o.key ? COLORS.accent : COLORS.ink }}>{o.label}</span>
            <Kbd>{i + 1}</Kbd>
          </button>
        ))}
      </div>

      <div className="mt-9">
        <button type="button" onClick={startFresh} disabled={!canContinue} aria-label="Start fresh with my own people" className="w-full flex items-center justify-center gap-2 text-sm font-semibold rounded-full py-3 mb-2.5" style={{ background: canContinue ? COLORS.accent : COLORS.line, color: canContinue ? COLORS.onAccent : COLORS.inkSoft }}>Start fresh with my own people {canContinue && <Kbd onAccent>↵</Kbd>}</button>
        <button type="button" onClick={explore} disabled={!canContinue} aria-label="Explore with example people first" className="w-full flex items-center justify-center gap-2 text-sm font-semibold rounded-full py-3" style={{ background: COLORS.paperRaised, color: canContinue ? COLORS.accent : COLORS.inkSoft, border: `1px solid ${canContinue ? COLORS.accent : COLORS.line}` }}>Explore with example people first {canContinue && <Kbd>E</Kbd>}</button>
        <p className="text-xs text-center mt-3" style={{ color: COLORS.inkSoft }}>You can clear the examples any time from the Me tab.</p>
        {onRestore && (
          <button type="button" onClick={onRestore} aria-label="Restore from a backup" className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold mt-5" style={{ color: COLORS.accent }}><Upload size={13} /> Restore from a backup <Kbd>R</Kbd></button>
        )}
      </div>
    </div>
  );
}
