// The optional "More details" of a log, each in its own small sheet over the
// quick log, so one thing is asked at a time. They edit the log's own state
// as you go: Done (or Enter, or Esc) just closes them. See
// docs/renderer/app-structure.md (LogInteractionModal).

import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { isPlusKey, isTabbedToButton, isTyping } from '../components/sheetLayer.js';
import { KeyedField, Kbd } from '../components/atoms.jsx';
import { AL_ITEMS, CATEGORIES, categoryMeta, DIM_COLORS, DIM_LABELS, DIM_ORDER, INFO_TEMPLATES, NOTE_TEMPLATE_CATEGORY, NOTE_TEMPLATES, REFLECTION_TEMPLATES } from '../data/constants.js';
import { followUps, rateRows } from '../lib/logQuestions.js';
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

// Whose part this is, in a log with several people (decided 2026-10-12):
// their tabs, ticked once theirs is done (doneFor), and ← → to switch.
// Nothing with one person.
export function PersonTabs({ people, at, onPick, doneFor }) {
  if (people.length < 2) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap mb-3">
      <div role="tablist" aria-label="Who" className="flex items-center gap-1.5 flex-wrap">
        {people.map((p, i) => (
          <button key={p.id} type="button" role="tab" aria-selected={i === at} onClick={() => onPick(i)} className={`chip${i === at ? ' chip--on' : ''}`}>
            {doneFor && doneFor(p) && <Check size={12} color={COLORS.accent} strokeWidth={3} />}{p.name}
          </button>
        ))}
      </div>
      <span className="keys-hint flex items-center gap-1 text-xs ml-auto" style={{ color: COLORS.inkSoft }}><Kbd>←</Kbd><Kbd>→</Kbd></span>
    </div>
  );
}
// ← → moved to the person before or after; true when it did.
function switchPerson(e, count, at, pick) {
  if (count < 2 || isTyping() || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return false;
  e.preventDefault();
  pick(Math.max(0, Math.min(count - 1, at + (e.key === 'ArrowRight' ? 1 : -1))));
  return true;
}

// What's asked in "How did each part go?" for one person: their six parts
// (lib/logQuestions.js), then a yes or no for each thing worth asking after.
function rateRowsFor(person, day) {
  return [
    ...rateRows(person).map(r => ({ kind: 'part', key: r.dim, ...r })),
    ...followUps(person, day).map(f => ({ kind: 'ask', key: f.id, ...f })),
  ];
}

// "How did each part go?": a 1-5 rating per part, asked for each person in
// their own words, then "Did you ask about…?" for what's saved about them.
// Typing a number rates the highlighted row and moves down, Y or N answers
// a question, Backspace steps back up and clears that row, ↑ ↓ move the
// highlight. With several people, each has their own: the last row of one
// moves on to the next, and ← → or their tabs switch. Skipped parts use
// "How meaningful". at: { who, row }, kept by the log so it carries on
// where it was.
export function RateSheet({ people, day, ratingsBy, setRating, answersBy, setAnswer, at, setAt, onClose }) {
  const rowsBy = people.map(p => rateRowsFor(p, day));
  const who = Math.min(at.who, people.length - 1);
  const person = people[who];
  const rows = rowsBy[who];
  const row = Math.min(at.row, rows.length);
  const ratings = ratingsBy[person.id] || {};
  const answers = answersBy[person.id] || {};
  const valueOf = (r, id = person.id) => (r.kind === 'part' ? (ratingsBy[id] || {})[r.key] : (answersBy[id] || {})[r.key]);
  const firstOpen = (i) => { const open = rowsBy[i].findIndex(r => valueOf(r, people[i].id) === undefined); return open < 0 ? 0 : open; };

  function advance(index) {
    if (index + 1 < rows.length) setAt({ who, row: index + 1 });
    else if (who + 1 < people.length) setAt({ who: who + 1, row: 0 });
    else setAt({ who, row: rows.length });
  }
  function rate(index, value) { setRating(person.id, rows[index].key, value); advance(index); }
  function answer(index, yes) { setAnswer(person.id, rows[index], yes); advance(index); }
  function clear(i, index) {
    const r = rowsBy[i][index];
    if (r.kind === 'part') setRating(people[i].id, r.key, undefined);
    else setAnswer(people[i].id, r, undefined);
  }
  function stepBack() {
    if (row > 0) { setAt({ who, row: row - 1 }); clear(who, row - 1); return; }
    if (who > 0) { const last = rowsBy[who - 1].length - 1; setAt({ who: who - 1, row: last }); clear(who - 1, last); }
  }
  const pick = (i) => setAt({ who: i, row: firstOpen(i) });
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (enterCloses(e, onClose)) return;
    if (switchPerson(e, people.length, who, pick)) return;
    const current = rows[row];
    const letter = e.key.toLowerCase();
    if (/^[1-5]$/.test(e.key) && current && current.kind === 'part') { e.preventDefault(); rate(row, Number(e.key)); return; }
    if ((letter === 'y' || letter === 'n') && current && current.kind === 'ask') { e.preventDefault(); answer(row, letter === 'y'); return; }
    if (e.key === 'Backspace') { e.preventDefault(); stepBack(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setAt({ who, row: Math.min(row + 1, rows.length - 1) }); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setAt({ who, row: Math.max(Math.min(row, rows.length) - 1, 0) }); }
  }
  // Keep the highlighted row in view as typing moves it down the list.
  useEffect(() => {
    const el = document.getElementById(`rate-row-${Math.min(row, rows.length - 1)}`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [row, who, rows.length]);

  const rated = DIM_ORDER.filter(k => ratings[k]).length;
  const hasAsk = rows.some(r => r.kind === 'ask');
  const tag = (text, color) => <span className="font-semibold rounded-full px-1.5" style={{ fontSize: 10, color, border: `1px solid ${color}` }}>{text}</span>;
  return (
    <Sheet title="How did each part go?" onClose={onClose} onKey={onKey} footer={<DoneButton onClick={onClose} />}>
      <PersonTabs people={people} at={who} onPick={pick} doneFor={p => DIM_ORDER.every(k => (ratingsBy[p.id] || {})[k])} />
      <p className="keys-hint text-xs mb-1 flex items-center gap-1.5 flex-wrap" style={{ color: COLORS.inkSoft }}>
        Type <Kbd>1</Kbd>–<Kbd>5</Kbd> for each, top to bottom{hasAsk ? <>, <Kbd>Y</Kbd> or <Kbd>N</Kbd> for a question</> : null}. <Kbd>⌫</Kbd> goes back.
      </p>
      <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>Any you skip use "How meaningful"{people.length > 1 ? ` with ${person.name}` : ''}.</p>
      <div key={person.id} role="group" aria-label={people.length > 1 ? `How did each part go with ${person.name}?` : 'How did each part go?'} className={people.length > 1 ? 'fade-anim' : ''}>
        {rows.map((r, i) => {
          const active = row === i;
          const color = r.kind === 'part' ? DIM_COLORS[r.key] : COLORS.accent;
          const value = r.kind === 'part' ? ratings[r.key] : answers[r.key];
          return (
            <div key={r.key} id={`rate-row-${i}`} onClick={() => setAt({ who, row: i })} className="rate-row flex items-center justify-between gap-2 rounded-xl px-3 py-2 mb-1" style={{ background: active ? COLORS.accentSoft : 'transparent', boxShadow: active ? `inset 3px 0 0 ${COLORS.accent}` : 'none', cursor: 'pointer' }}>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <span className="font-bold" style={{ fontSize: 10, color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{r.kind === 'part' ? DIM_LABELS[r.key] : 'Follow-up'}</span>
                  {r.goal && tag(`Your goal: ${r.goal}`, COLORS.accent)}
                  {r.weakest && tag('Weakest', COLORS.inkSoft)}
                </p>
                <span className="text-sm" style={{ color: COLORS.ink, fontWeight: active ? 700 : 500 }}>{r.question}</span>
              </div>
              {r.kind === 'part' ? (
                <div role="radiogroup" aria-label={r.question} className="flex items-center gap-1 shrink-0">
                  {[1, 2, 3, 4, 5].map(n => {
                    const on = value === n;
                    // The scale fills up to the rating, so each row shows where it sat at a glance.
                    const filled = value >= n;
                    return (
                      <button key={n} type="button" role="radio" aria-checked={on} aria-label={String(n)} onClick={(e) => { e.stopPropagation(); rate(i, n); }} className={on ? 'pop' : ''}
                        style={{ width: 26, height: 26, borderRadius: '50%', fontSize: 11, fontWeight: 700, background: on ? color : filled ? `color-mix(in srgb, ${color} 28%, transparent)` : COLORS.paperRaised, color: on ? '#fff' : COLORS.ink, border: `1.5px solid ${filled ? color : COLORS.line}` }}>{n}</button>
                    );
                  })}
                </div>
              ) : (
                <div role="radiogroup" aria-label={r.question} className="flex items-center gap-1 shrink-0">
                  {[['Yes', true, 'Y'], ['No', false, 'N']].map(([label, yes, k]) => (
                    <button key={label} type="button" role="radio" aria-checked={value === yes} onClick={(e) => { e.stopPropagation(); answer(i, yes); }} className={`chip${value === yes ? ' chip--on pop' : ''}`} style={{ padding: active ? '4px 5px 4px 10px' : '4px 10px' }}>
                      {label}{active && <Kbd>{k}</Kbd>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs mt-2 text-right" style={{ color: rated === DIM_ORDER.length ? COLORS.good : COLORS.inkSoft, fontWeight: 600 }}>{rated} of {DIM_ORDER.length} rated{people.length > 1 ? ` for ${person.name}` : ''}</p>
    </Sheet>
  );
}

// "Did you practise active listening?" Number keys tick the items. With
// several people, each has their own ticks (← → or the tabs switch).
export function ListeningSheet({ people, alBy, toggle, onClose }) {
  const [who, setWho] = useState(0);
  const person = people[Math.min(who, people.length - 1)];
  const al = alBy[person.id] || [];
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (enterCloses(e, onClose)) return;
    if (switchPerson(e, people.length, who, setWho)) return;
    const i = Number(e.key) - 1;
    if (i >= 0 && i < AL_ITEMS.length) { e.preventDefault(); toggle(person.id, AL_ITEMS[i].key); }
  }
  return (
    <Sheet title="Did you practise active listening?" onClose={onClose} onKey={onKey} footer={<DoneButton onClick={onClose} />}>
      <PersonTabs people={people} at={who} onPick={setWho} doneFor={p => (alBy[p.id] || []).length > 0} />
      <p className="text-xs mb-2" style={{ color: COLORS.inkSoft }}>{people.length > 1 ? `Tick what you did with ${person.name}.` : 'Tick what you did.'} Each one builds that skill.</p>
      <div key={person.id} className={people.length > 1 ? 'fade-anim' : ''}>
        {AL_ITEMS.map((item, i) => (
          <CheckRow key={item.key} checked={al.includes(item.key)} onClick={() => toggle(person.id, item.key)} label={item.label} hint={String(i + 1)} />
        ))}
      </div>
    </Sheet>
  );
}

// "Something new about <name>?": saved to their profile in the category picked.
// Mostly tapping: each category offers common things to add (interests use the
// topic lists), and typing is there for anything else. Number keys 1-5 pick
// the category. With several people, each has their own (← → or the tabs
// switch); itemsBy: { [personId]: [{ category, text, emoji? }] }.
export function NewInfoSheet({ people, itemsBy, setItemsFor, category, setCategory, text, setText, onClose }) {
  const [group, setGroup] = useState(null); // an interest topic group, opened to show its items
  const [who, setWho] = useState(0);
  const person = people[Math.min(who, people.length - 1)];
  const items = itemsBy[person.id] || [];
  const setItems = (fn) => setItemsFor(person.id, fn);
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
  // Anything typed but not added yet stays with the person it was typed for,
  // and closing (Esc, Enter, Done) adds it, as picks are (audit 2026-10-14:
  // Esc, or Enter after picking, dropped it).
  function moveTo(i) { add(); setWho(i); }
  function close() { add(); onClose(); }
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (enterCloses(e, close)) return;
    if (switchPerson(e, people.length, who, moveTo)) return;
    if (!isTyping() && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); if (textRef.current) textRef.current.focus(); return; }
    const i = Number(e.key) - 1;
    if (!isTyping() && i >= 0 && i < CATEGORIES.length) { e.preventDefault(); setCategory(CATEGORIES[i].key); }
  }
  const openGroup = INTEREST_GROUPS.find(g => g.key === group);
  return (
    <Sheet title={`Something new about ${person.name}?`} onClose={close} onKey={onKey} footer={<DoneButton onClick={close} />}>
      <PersonTabs people={people} at={who} onPick={moveTo} doneFor={p => (itemsBy[p.id] || []).length > 0} />
      <p className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>Tap what's new. It's added to {people.length > 1 ? `${person.name}'s` : 'their'} profile when you save the log.</p>
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
