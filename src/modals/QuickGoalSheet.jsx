// A new goal without leaving what you're doing: "+ New goal" when planning
// (Moves a goal) and when logging (Goals moved). It's for one of the people
// in the plan or log; pick a suggestion or write your own, and maybe a due
// date. The goal is saved at once and comes back picked, so the plan moves it
// or the log counts towards it. GoalModal stays the full editor.
// Keys: 1-7 a suggestion, V a more specific version of it (Shift+V back),
// N your own words, D the due date, ← → who it's for (when there's more than
// one person), Enter creates it.

import { useState } from 'react';
import { Target } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { isTabbedToButton, isTyping } from '../components/sheetLayer.js';
import { Avatar, Kbd } from '../components/atoms.jsx';
import { getLayer, PRESET_VARIANTS, presetMeta, PRESETS } from '../data/constants.js';
import { formatAbsoluteDate, parseISODay, toISODate } from '../lib/dates.js';
import { generateGoalDescription } from '../lib/progress.js';
import { uid } from '../lib/util.js';
import { COLORS } from '../theme.js';

const SUGGESTIONS = PRESETS.filter(p => p.category === 'relationship');
const DUES = [null, 14, 30, 90];
const dueLabel = (d) => (d === null ? 'No date' : d === 14 ? 'In 2 weeks' : d === 30 ? 'In a month' : 'In 3 months');

export function QuickGoalSheet({ people, forIds, today, onClose, onCreate }) {
  const forPeople = forIds.map(id => people.find(p => p.id === id)).filter(Boolean);
  const [personId, setPersonId] = useState(forPeople[0] ? forPeople[0].id : null);
  const [presetKey, setPresetKey] = useState(null);
  const [variant, setVariant] = useState(null); // index into PRESET_VARIANTS, or null for the general version
  const [own, setOwn] = useState('');
  const [due, setDue] = useState(null);
  const person = forPeople.find(p => p.id === personId) || null;
  const preset = presetKey ? presetMeta(presetKey) : null;
  const variants = (presetKey && PRESET_VARIANTS[presetKey]) || [];
  const writing = own.trim().length > 0;
  const title = writing ? own.trim() : preset ? preset.label : '';
  const description = writing ? '' : preset ? (variant !== null ? variants[variant] : generateGoalDescription(preset, person)) : '';
  const canCreate = Boolean(person && title);

  function pickPreset(key) { setPresetKey(key); setVariant(null); setOwn(''); }
  function cycleVariant(back) {
    if (!variants.length) return;
    setVariant(v => {
      const order = [null, ...variants.map((_, i) => i)];
      const i = order.indexOf(v);
      return order[(i + (back ? order.length - 1 : 1)) % order.length];
    });
  }
  function create() {
    if (!canCreate) return;
    const at = today || toISODate(new Date());
    const start = parseISODay(at);
    const dueDate = due === null ? null : toISODate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + due));
    const goal = {
      id: uid(), personId, category: writing ? 'custom' : preset.category, type: writing ? 'custom' : presetKey,
      title, description: description || title, dueDate, progress: 0,
      history: [{ date: formatAbsoluteDate(parseISODay(at)), at, value: 0 }],
    };
    onCreate(personId, goal);
  }

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTyping()) return;
    if (e.key === 'Enter' && isTabbedToButton()) return;
    const key = e.key.toLowerCase();
    const num = /^[1-9]$/.test(e.key) ? Number(e.key) : null;
    const act = (fn) => { e.preventDefault(); fn(); };
    if (num && SUGGESTIONS[num - 1]) act(() => pickPreset(SUGGESTIONS[num - 1].key));
    else if (key === 'v') act(() => cycleVariant(e.shiftKey));
    else if (key === 'n') act(() => document.getElementById('quick-goal-own')?.focus());
    else if (key === 'd') act(() => setDue(d => DUES[(DUES.indexOf(d) + (e.shiftKey ? DUES.length - 1 : 1)) % DUES.length]));
    else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && forPeople.length > 1) {
      act(() => {
        const i = forPeople.findIndex(p => p.id === personId);
        setPersonId(forPeople[(i + (e.key === 'ArrowLeft' ? forPeople.length - 1 : 1)) % forPeople.length].id);
      });
    } else if (e.key === 'Enter') act(create);
  }

  const label = (text, hint) => (
    <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: COLORS.inkSoft, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{text}{hint}</p>
  );
  return (
    <Sheet title={person ? `New goal with ${person.name}` : 'New goal'} onClose={onClose} onKey={onKey} tall
      footer={<button type="button" onClick={create} disabled={!canCreate} className="primary-btn">Create goal <Kbd onAccent>↵</Kbd></button>}>
      {forPeople.length > 1 && (
        <div className="mb-4">
          {label('Who it’s for', <><Kbd>←</Kbd><Kbd>→</Kbd></>)}
          <div className="flex flex-wrap gap-1.5">
            {forPeople.map(p => (
              <button key={p.id} type="button" onClick={() => setPersonId(p.id)} aria-pressed={p.id === personId} className={`chip${p.id === personId ? ' chip--on' : ''}`} style={{ padding: '4px 10px 4px 4px' }}>
                <Avatar emoji={p.emoji} size={22} ringColor={getLayer(p.layer).color} />{p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {label('Pick one', <Kbd>1–{SUGGESTIONS.length}</Kbd>)}
      <div className="grid grid-cols-2 gap-1.5 mb-4">
        {SUGGESTIONS.map((s, i) => {
          const on = !writing && presetKey === s.key;
          return (
            <button key={s.key} type="button" onClick={() => pickPreset(s.key)} aria-pressed={on} className="tile flex items-center gap-2 px-2.5 py-2 text-left" style={on ? { borderColor: COLORS.accent, background: COLORS.accentSoft } : undefined}>
              <span className="shrink-0"><Kbd>{i + 1}</Kbd></span>
              <span aria-hidden="true">{s.emoji}</span>
              <span className="flex-1 min-w-0 text-xs font-semibold" style={{ lineHeight: 1.25 }}>{s.label}</span>
            </button>
          );
        })}
      </div>

      {label('Or in your own words', <Kbd>N</Kbd>)}
      <input id="quick-goal-own" value={own} onChange={e => setOwn(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); create(); } }}
        aria-label="Your own goal" placeholder="e.g. Meet their family" className="w-full text-sm rounded-xl px-3 py-2.5 mb-4" style={{ border: `1px solid ${COLORS.line}` }} />

      {title && (
        <div className="rounded-2xl p-3 flex items-start gap-2.5 mb-4 fade-anim" style={{ background: COLORS.accentSoft }} role="status" aria-label="New goal">
          <Target size={16} color={COLORS.accent} className="shrink-0" style={{ marginTop: 2 }} />
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: COLORS.ink }}>{title}</p>
            {description && <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>{description}</p>}
            {due !== null && <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>Due {dueLabel(due).toLowerCase()}</p>}
          </div>
        </div>
      )}
      {preset && !writing && variants.length > 0 && (
        <div className="mb-4 fade-anim">
          {label('More specific (optional)', <Kbd>V</Kbd>)}
          <div className="flex flex-wrap gap-1.5">
            {variants.map((v, i) => (
              <button key={v} type="button" onClick={() => setVariant(variant === i ? null : i)} aria-pressed={variant === i} className={`chip${variant === i ? ' chip--on' : ''}`} style={{ textAlign: 'left' }}>{v}</button>
            ))}
          </div>
        </div>
      )}

      {label('Due', <Kbd>D</Kbd>)}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {DUES.map(d => <button key={String(d)} type="button" onClick={() => setDue(d)} aria-pressed={due === d} className={`chip${due === d ? ' chip--on' : ''}`}>{dueLabel(d)}</button>)}
      </div>

    </Sheet>
  );
}
