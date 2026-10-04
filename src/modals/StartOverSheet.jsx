// "Delete my data and start over", from Me. Three steps, one thing at a time:
//   what     what to clear; everything starts ticked. 1-5 tick or untick,
//            A ticks everything, Enter goes on
//   backup   save a backup first (B), or go on without one
//   confirm  what goes and what stays, then press and hold to delete (the
//            mouse, or Enter or Space held down)
// Clearing people clears their journal too, and Layers goes back to the
// welcome screen to set up again. See docs/renderer/app-structure.md.

import { useEffect, useRef, useState } from 'react';
import { Check, Download } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { isTabbedToButton, isTyping } from '../components/sheetLayer.js';
import { Kbd } from '../components/atoms.jsx';
import { COLORS } from '../theme.js';

const STEPS = ['what', 'backup', 'confirm'];
const HOLD_MS = 1500;
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const PARTS = [
  { key: 'people', emoji: '👥', label: 'People', detail: (c) => `${count(c.people, 'person', 'people')}, with their details, goals, key dates and journal` },
  { key: 'journal', emoji: '📖', label: 'Journal', detail: (c) => count(c.journal, 'entry', 'entries') },
  { key: 'plans', emoji: '📅', label: 'Plans and reminders', detail: (c) => `${count(c.events, 'plan', 'plans')}; their notifications are cancelled` },
  { key: 'progress', emoji: '🌱', label: 'Skills, achievements and your own goals', detail: (c) => `${count(c.goals, 'goal', 'goals')}, your skill levels and achievements` },
  { key: 'settings', emoji: '⚙️', label: 'Your name, focus and settings', detail: () => 'Notification times and switches, and the theme' },
];

// A button that only acts once it's been held down for `ms`.
function HoldButton({ label, ms, onDone }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  function start() {
    if (timer.current) return;
    setHolding(true);
    timer.current = setTimeout(() => { timer.current = null; setHolding(false); onDone(); }, ms);
  }
  function stop() { clearTimeout(timer.current); timer.current = null; setHolding(false); }
  const isHoldKey = (e) => e.key === 'Enter' || e.key === ' ';
  return (
    <button type="button" autoFocus className={`hold-btn${holding ? ' is-holding' : ''}`} style={{ '--hold-ms': `${ms}ms` }}
      aria-label={`${label}: press and hold`}
      onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
      onKeyDown={(e) => { if (isHoldKey(e)) { e.preventDefault(); if (!e.repeat) start(); } }}
      onKeyUp={(e) => { if (isHoldKey(e)) stop(); }}
      onBlur={stop}>
      <span className="hold-fill" aria-hidden="true" />
      <span>{holding ? 'Keep holding…' : label}</span>
    </button>
  );
}

export function StartOverSheet({ counts, onExport, onClose, onConfirm }) {
  const [step, setStep] = useState('what');
  const [dir, setDir] = useState(null);
  const [picked, setPicked] = useState(() => new Set(PARTS.map(p => p.key)));
  const [backedUp, setBackedUp] = useState(false);
  // Journal entries belong to people, so clearing people clears them too.
  const clears = (key) => picked.has(key) || (key === 'journal' && picked.has('people'));
  const going = PARTS.filter(p => clears(p.key));
  const staying = PARTS.filter(p => !clears(p.key));
  const everything = staying.length === 0;

  function go(next) {
    setDir(STEPS.indexOf(next) >= STEPS.indexOf(step) ? 'in' : 'back');
    setStep(next);
  }
  const back = { backup: 'what', confirm: 'backup' }[step];
  function toggle(key) {
    if (key === 'journal' && picked.has('people')) return;
    setPicked(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }
  function saveBackup() { onExport(); setBackedUp(true); }
  function confirm() { onConfirm(Object.fromEntries(PARTS.map(p => [p.key, clears(p.key)]))); }

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
    if (e.key === 'Backspace' && back) { e.preventDefault(); go(back); return; }
    if (e.key === 'Enter' && isTabbedToButton()) return;
    const key = e.key.toLowerCase();
    if (step === 'what') {
      const num = /^[1-5]$/.test(e.key) ? Number(e.key) : null;
      if (num) { e.preventDefault(); toggle(PARTS[num - 1].key); }
      else if (key === 'a') { e.preventDefault(); setPicked(new Set(PARTS.map(p => p.key))); }
      else if (e.key === 'Enter' && going.length) { e.preventDefault(); go('backup'); }
    } else if (step === 'backup') {
      if (key === 'b') { e.preventDefault(); saveBackup(); }
      else if (e.key === 'Enter') { e.preventDefault(); go('confirm'); }
    }
  }

  const titles = { what: 'Start over', backup: 'Save a backup first?', confirm: 'Delete for good?' };
  const footer = step === 'what'
    ? <button type="button" onClick={() => go('backup')} disabled={!going.length} className="primary-btn">{everything ? 'Clear everything' : `Clear ${going.length} of ${PARTS.length}`} <Kbd onAccent>↵</Kbd></button>
    : step === 'backup'
      ? <button type="button" onClick={() => go('confirm')} className={backedUp ? 'primary-btn' : 'chip'} style={backedUp ? undefined : { width: '100%', justifyContent: 'center', padding: '12px 16px' }}>{backedUp ? 'Continue' : 'Continue without a backup'} <Kbd onAccent={backedUp}>↵</Kbd></button>
      : <HoldButton label={everything ? 'Hold to delete everything' : 'Hold to delete'} ms={HOLD_MS} onDone={confirm} />;

  return (
    <Sheet title={titles[step]} onClose={onClose} onBack={back ? () => go(back) : undefined} onKey={onKey} footer={footer} tall>
      <div key={step} className={dir === 'in' ? 'step-in' : dir === 'back' ? 'step-back' : ''}>
        {step === 'what' && (
          <>
            <p className="text-sm mb-3" style={{ color: COLORS.inkSoft }}>Everything is ticked. Untick anything you want to keep.</p>
            <div className="flex flex-col gap-2">
              {PARTS.map((p, i) => {
                const on = clears(p.key);
                const locked = p.key === 'journal' && picked.has('people');
                return (
                  <button key={p.key} type="button" role="checkbox" aria-checked={on} aria-disabled={locked || undefined} onClick={() => toggle(p.key)}
                    className="tile flex items-center gap-3 px-3.5 py-3 text-left" style={{ borderColor: on ? COLORS.alert : undefined, opacity: locked ? 0.75 : 1 }}>
                    {/* Wrapped, so it sits in the row, not in the tile's corner. */}
                    <span className="shrink-0"><Kbd>{i + 1}</Kbd></span>
                    <span style={{ fontSize: 22, lineHeight: 1 }} aria-hidden="true">{p.emoji}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold" style={{ color: COLORS.ink }}>{p.label}</span>
                      <span className="block text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>{locked ? 'Goes with people' : p.detail(counts)}</span>
                    </span>
                    <span style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? COLORS.alert : 'transparent', border: `1.5px solid ${on ? COLORS.alert : COLORS.line}` }}>
                      {on && <Check size={14} color={COLORS.paperRaised} strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
            {!everything && <button type="button" onClick={() => setPicked(new Set(PARTS.map(p => p.key)))} className="chip mt-3">Tick everything <Kbd>A</Kbd></button>}
          </>
        )}

        {step === 'backup' && (
          <>
            <p className="text-sm" style={{ color: COLORS.inkSoft }}>A backup file lets you bring all of this back later: in Me under Backup, or with <b>Restore from a backup</b> on the welcome screen.</p>
            <button type="button" onClick={saveBackup} className="tile w-full flex items-center gap-3 px-4 py-4 mt-4 text-left">
              <span className="tile-icon">{backedUp ? <Check size={20} color={COLORS.good} strokeWidth={3} /> : <Download size={20} color={COLORS.accent} />}</span>
              <span className="flex-1">
                <span className="block text-sm font-bold" style={{ color: COLORS.ink }}>{backedUp ? 'Backup saved' : 'Save a backup'}</span>
                <span className="block text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>{backedUp ? 'You can save another if you like.' : 'Recommended. One file with everything in it.'}</span>
              </span>
              <Kbd>B</Kbd>
            </button>
          </>
        )}

        {step === 'confirm' && (
          <>
            <p className="text-xs font-bold mb-1.5" style={{ color: COLORS.alert, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Deleted</p>
            {going.map(p => <p key={p.key} className="text-sm py-1" style={{ color: COLORS.ink }}><span aria-hidden="true">{p.emoji}</span> {p.label} <span style={{ color: COLORS.inkSoft }}>· {p.detail(counts)}</span></p>)}
            {staying.length > 0 && (
              <>
                <p className="text-xs font-bold mt-4 mb-1.5" style={{ color: COLORS.good, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Kept</p>
                {staying.map(p => <p key={p.key} className="text-sm py-1" style={{ color: COLORS.ink }}><span aria-hidden="true">{p.emoji}</span> {p.label}</p>)}
              </>
            )}
            <p className="text-sm mt-4" style={{ color: COLORS.inkSoft }}>
              {backedUp ? 'Your backup is saved. ' : "There's no backup, so this can't be undone. "}
              {clears('people') ? "Then you'll set Layers up again." : ''}
            </p>
            <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>Press and hold the button (or hold Enter) until it fills.</p>
          </>
        )}
      </div>
    </Sheet>
  );
}
