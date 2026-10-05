// The optional "More details" of a log, each in its own small sheet over the
// quick log, so one thing is asked at a time. They edit the log's own state
// as you go: Done (or Enter, or Esc) just closes them. See
// docs/renderer/app-structure.md (LogInteractionModal).

import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { isPlusKey, isTabbedToButton, isTyping } from '../components/sheetLayer.js';
import { KeyedField, Kbd } from '../components/atoms.jsx';
import { AL_ITEMS, CATEGORIES, categoryMeta, DIM_COLORS, DIM_ORDER, DIM_QUESTIONS, INFO_TEMPLATES, NOTE_TEMPLATE_CATEGORY, NOTE_TEMPLATES, REFLECTION_TEMPLATES } from '../data/constants.js';
import { COLORS } from '../theme.js';

function DoneButton({ onClick }) {
  return <button type="button" onClick={onClick} className="primary-btn">Done <Kbd onAccent>↵</Kbd></button>;
}

// Enter closes, unless a button was reached with Tab (then Enter presses it).
function enterCloses(e, onClose) {
  if (e.key !== 'Enter' || isTyping() || isTabbedToButton()) return false;
  e.preventDefault();
  onClose();
  return true;
}

// A tap-to-add suggestion: ticked once it's in.
function Pick({ on, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`chip${on ? ' chip--on' : ''}`} style={{ fontWeight: 600 }}>
      {on && <Check size={12} color={COLORS.accent} strokeWidth={3} />}{children}
    </button>
  );
}

const sectionLabel = (text) => <p className="text-xs font-bold mb-2 mt-1" style={{ color: COLORS.inkSoft, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{text}</p>;

// The topic groups that are filed as interests ("Sports", "Music", ...).
const INTEREST_GROUPS = NOTE_TEMPLATES.filter(g => NOTE_TEMPLATE_CATEGORY[g.key] === 'interests');

function CheckRow({ checked, onClick, label, hint }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={onClick} className="w-full flex items-center gap-3 rounded-xl px-2 py-2.5 text-left check-row">
      <span className={checked ? 'pop' : ''} style={{ width: 22, height: 22, borderRadius: 7, border: `1.5px solid ${checked ? COLORS.accent : COLORS.line}`, background: checked ? COLORS.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background-color .15s, border-color .15s' }}>
        {checked && <Check size={14} color={COLORS.onAccent} strokeWidth={3} />}
      </span>
      <span className="text-sm flex-1" style={{ color: COLORS.ink }}>{label}</span>
      {hint && <Kbd>{hint}</Kbd>}
    </button>
  );
}

// "How did each part go?": a 1-5 rating per dimension. Typing a number rates
// the highlighted row and moves down; Backspace steps back up and clears that
// row; the arrows move the highlight. Skipped rows use "How meaningful".
export function RateSheet({ ratings, setRatings, cursor, setCursor, onClose }) {
  function rate(index, value) {
    setRatings(r => ({ ...r, [DIM_ORDER[index]]: value }));
    setCursor(index + 1);
  }
  function stepBack() {
    const prev = Math.max(cursor - 1, 0);
    setCursor(prev);
    setRatings(r => { const next = { ...r }; delete next[DIM_ORDER[prev]]; return next; });
  }
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (enterCloses(e, onClose)) return;
    if (/^[1-5]$/.test(e.key) && cursor < DIM_ORDER.length) { e.preventDefault(); rate(cursor, Number(e.key)); return; }
    if (e.key === 'Backspace') { e.preventDefault(); stepBack(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, DIM_ORDER.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(Math.min(c, DIM_ORDER.length) - 1, 0)); }
  }
  // Keep the highlighted row in view as typing moves it down the list.
  useEffect(() => {
    const row = document.getElementById(`rate-row-${Math.min(cursor, DIM_ORDER.length - 1)}`);
    if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const rated = DIM_ORDER.filter(k => ratings[k]).length;
  return (
    <Sheet title="How did each part go?" onClose={onClose} onKey={onKey} footer={<DoneButton onClick={onClose} />}>
      <p className="text-xs mb-1 flex items-center gap-1.5 flex-wrap" style={{ color: COLORS.inkSoft }}>
        Type <Kbd>1</Kbd>–<Kbd>5</Kbd> for each, top to bottom. <Kbd>⌫</Kbd> goes back.
      </p>
      <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>Any you skip use "How meaningful".</p>
      <div role="group" aria-label="How did each part go?">
        {DIM_ORDER.map((k, i) => {
          const active = cursor === i;
          return (
            <div key={k} id={`rate-row-${i}`} onClick={() => setCursor(i)} className="rate-row flex items-center justify-between gap-2 rounded-xl px-3 py-2 mb-1" style={{ background: active ? COLORS.accentSoft : 'transparent', boxShadow: active ? `inset 3px 0 0 ${COLORS.accent}` : 'none', cursor: 'pointer' }}>
              <span className="text-sm" style={{ color: COLORS.ink, fontWeight: active ? 700 : 500 }}>{DIM_QUESTIONS[k]}</span>
              <div role="radiogroup" aria-label={DIM_QUESTIONS[k]} className="flex items-center gap-1 shrink-0">
                {[1, 2, 3, 4, 5].map(n => {
                  const on = ratings[k] === n;
                  // The scale fills up to the rating, so each row shows where it sat at a glance.
                  const filled = ratings[k] >= n;
                  return (
                    <button key={n} type="button" role="radio" aria-checked={on} aria-label={String(n)} onClick={(e) => { e.stopPropagation(); rate(i, n); }} className={on ? 'pop' : ''}
                      style={{ width: 26, height: 26, borderRadius: '50%', fontSize: 11, fontWeight: 700, background: on ? DIM_COLORS[k] : filled ? `color-mix(in srgb, ${DIM_COLORS[k]} 28%, transparent)` : COLORS.paperRaised, color: on ? '#fff' : COLORS.ink, border: `1.5px solid ${filled ? DIM_COLORS[k] : COLORS.line}` }}>{n}</button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs mt-2 text-right" style={{ color: rated === DIM_ORDER.length ? COLORS.good : COLORS.inkSoft, fontWeight: 600 }}>{rated} of {DIM_ORDER.length} rated</p>
    </Sheet>
  );
}

// "Did you practise active listening?" Number keys tick the items.
export function ListeningSheet({ al, toggle, onClose }) {
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (enterCloses(e, onClose)) return;
    const i = Number(e.key) - 1;
    if (i >= 0 && i < AL_ITEMS.length) { e.preventDefault(); toggle(AL_ITEMS[i].key); }
  }
  return (
    <Sheet title="Did you practise active listening?" onClose={onClose} onKey={onKey} footer={<DoneButton onClick={onClose} />}>
      <p className="text-xs mb-2" style={{ color: COLORS.inkSoft }}>Tick what you did. Each one builds that skill.</p>
      {AL_ITEMS.map((item, i) => (
        <CheckRow key={item.key} checked={al.includes(item.key)} onClick={() => toggle(item.key)} label={item.label} hint={String(i + 1)} />
      ))}
    </Sheet>
  );
}

// "Something new about <name>?": saved to their profile in the category picked.
// Mostly tapping: each category offers common things to add (interests use the
// topic lists), and typing is there for anything else. Number keys 1-5 pick
// the category.
export function NewInfoSheet({ personName, items, setItems, category, setCategory, text, setText, onClose }) {
  const [group, setGroup] = useState(null); // an interest topic group, opened to show its items
  const textRef = useRef(null);
  const has = (cat, t) => items.some(n => n.category === cat && n.text === t);
  function toggle(cat, t, emoji) {
    setItems(prev => has(cat, t) ? prev.filter(n => !(n.category === cat && n.text === t)) : [...prev, emoji ? { category: cat, text: t, emoji } : { category: cat, text: t }]);
  }
  function add() {
    const t = text.trim();
    if (!t) return false;
    if (!has(category, t)) setItems(prev => [...prev, { category, text: t }]);
    setText('');
    return true;
  }
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (enterCloses(e, onClose)) return;
    if (!isTyping() && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); if (textRef.current) textRef.current.focus(); return; }
    const i = Number(e.key) - 1;
    if (!isTyping() && i >= 0 && i < CATEGORIES.length) { e.preventDefault(); setCategory(CATEGORIES[i].key); }
  }
  const openGroup = INTEREST_GROUPS.find(g => g.key === group);
  return (
    <Sheet title={`Something new about ${personName}?`} onClose={onClose} onKey={onKey} footer={<DoneButton onClick={() => { add(); onClose(); }} />}>
      <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>Tap what's new. It's added to their profile when you save the log.</p>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {CATEGORIES.map((c, i) => (
          <button key={c.key} type="button" onClick={() => setCategory(c.key)} aria-pressed={category === c.key} className={`chip${category === c.key ? ' chip--on' : ''}`}>{c.emoji} {c.label}<Kbd>{i + 1}</Kbd></button>
        ))}
      </div>

      {category === 'interests' ? (
        <>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {INTEREST_GROUPS.map(g => (
              <button key={g.key} type="button" onClick={() => setGroup(k => k === g.key ? null : g.key)} aria-pressed={group === g.key} className={`chip${group === g.key ? ' chip--on' : ''}`}>{g.emoji} {g.label}</button>
            ))}
          </div>
          {openGroup && (
            <div key={openGroup.key} className="flex flex-wrap gap-1.5 mb-3 fade-anim">
              {openGroup.items.map(t => <Pick key={t} on={has('interests', t)} onClick={() => toggle('interests', t, openGroup.emoji)}>{t}</Pick>)}
            </div>
          )}
        </>
      ) : (
        <div key={category} className="flex flex-wrap gap-1.5 mb-3 fade-anim">
          {(INFO_TEMPLATES[category] || []).map(t => <Pick key={t} on={has(category, t)} onClick={() => toggle(category, t)}>{t}</Pick>)}
        </div>
      )}

      <div className="flex items-center gap-2 mt-1">
        <KeyedField letter="N" ref={textRef} wrapClassName="flex-1 min-w-0" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (!add()) onClose(); } }} placeholder={`Or type your own: ${categoryMeta(category).placeholder.replace(/^e\.g\. /, '')}`} aria-label="Something new" className="w-full text-sm rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}` }} />
        <button type="button" onClick={add} disabled={!text.trim()} className="chip" style={{ opacity: text.trim() ? 1 : 0.5 }}>Add</button>
      </div>
      {items.length > 0 && (
        <div className="mt-4">
          {sectionLabel(`Adding (${items.length})`)}
          <div className="flex flex-wrap gap-1.5">
            {items.map((n, i) => (
              <span key={i} className="chip chip--on chip-in" style={{ paddingRight: 6 }}>
                {n.emoji || categoryMeta(n.category).emoji} {n.text}
                <button type="button" onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))} aria-label={`Remove "${n.text}"`} className="p-0.5"><X size={12} /></button>
              </span>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}

// "Goals this moved": every active goal moves unless it's unticked here.
// "+ New goal" (or +) starts one with the people logged (QuickGoalSheet,
// opened by the log), and it comes back ticked.
export function GoalsSheet({ goals, unticked, toggle, showNames, onNewGoal, onClose }) {
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (enterCloses(e, onClose)) return;
    if (isPlusKey(e) && onNewGoal) { e.preventDefault(); onNewGoal(); return; }
    const i = Number(e.key) - 1;
    if (i >= 0 && i < Math.min(goals.length, 9)) { e.preventDefault(); toggle(goals[i].id); }
  }
  return (
    <Sheet title={goals.length ? 'Goals this moved' : 'Goals'} onClose={onClose} onKey={onKey} footer={<DoneButton onClick={onClose} />}>
      <p className="text-xs mb-2" style={{ color: COLORS.inkSoft }}>{goals.length ? "Untick any it didn't help. Unticked goals stay where they are." : 'No goals with them yet. Start one, and this log counts towards it.'}</p>
      {goals.map((g, i) => (
        <CheckRow key={g.id} checked={!unticked.includes(g.id)} onClick={() => toggle(g.id)} label={`${g.title}${showNames ? ` (${g.personName})` : ''}`} hint={i < 9 ? String(i + 1) : null} />
      ))}
      {onNewGoal && <button type="button" onClick={onNewGoal} className="chip mt-3" style={{ padding: '6px 6px 6px 10px' }}>+ New goal <Kbd>+</Kbd></button>}
    </Sheet>
  );
}
// "How did it feel?": a reflection for the journal, mostly by tapping. The
// picked phrases come first in the saved reflection, then anything typed.
// N goes into the text box, Esc or Tab leaves it, and Ctrl+Enter closes.
export function ReflectionSheet({ tags, toggleTag, value, setValue, onClose }) {
  const textRef = useRef(null);
  function onKey(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onClose(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!isTyping() && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); if (textRef.current) textRef.current.focus(); return; }
    enterCloses(e, onClose);
  }
  return (
    <Sheet title="How did it feel?" onClose={onClose} onKey={onKey} footer={<DoneButton onClick={onClose} />}>
      {sectionLabel('How it went')}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {REFLECTION_TEMPLATES.went.map(t => <Pick key={t} on={tags.includes(t)} onClick={() => toggleTag(t)}>{t}</Pick>)}
      </div>
      {sectionLabel('Next time')}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {REFLECTION_TEMPLATES.next.map(t => <Pick key={t} on={tags.includes(t)} onClick={() => toggleTag(t)}>{t}</Pick>)}
      </div>
      <KeyedField letter="N" multiline ref={textRef} value={value} onChange={e => setValue(e.target.value)} rows={2} aria-label="Reflection" placeholder="Anything else? (optional)" className="w-full text-sm rounded-xl px-3 py-2.5" style={{ border: `1px solid ${COLORS.line}`, resize: 'vertical' }} />
    </Sheet>
  );
}
