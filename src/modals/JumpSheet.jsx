// Ctrl+K: jump to anything. A box at the top with the cursor in it; the rows
// come from jumpResults (lib/jump.js) and LayersApp runs the one picked
// (onRun). Keys, all in the box: ↑ ↓ move, Enter runs the row (Ctrl+Enter
// opens a typed plan or log in its full sheet instead of saving it), → or Tab
// on a person shows Open, Log, Plan and Prepare, ← (or Backspace in an empty
// box) goes back, Esc closes.
// What you jump to is remembered on this computer for next time (browser
// storage, a convenience only).

import { useMemo, useRef, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { Kbd } from '../components/atoms.jsx';
import { jumpResults, personActionRows } from '../lib/jump.js';
import { COLORS } from '../theme.js';

const RECENT_KEY = 'layers-jump-recent';
const GROUP_LABEL = { person: 'Person', plan: 'Plan', page: 'Page', action: 'Action', sentence: 'Save' };

function loadRecent() {
  try { const list = JSON.parse(window.localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(list) ? list : []; } catch { return []; }
}
function saveRecent(row) {
  if (row.group === 'sentence') return;
  try {
    const { id, group, label, sub, emoji, run } = row;
    const list = [{ id, group, label, sub, emoji, run }, ...loadRecent().filter(r => r.id !== id)].slice(0, 4);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch { /* no storage: nothing to remember */ }
}

export function JumpSheet({ people, events, today, has, onRun, onClose }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [personFor, setPersonFor] = useState(null); // a person whose actions are showing
  const inputRef = useRef(null);
  // Recent rows only stand for people and plans that still exist.
  const recent = useMemo(() => loadRecent().filter(r => (r.run.type !== 'person' && r.run.type !== 'personAction') || people.some(p => p.id === r.run.id))
    .filter(r => r.run.type !== 'plan' || events.some(e => e.id === r.run.eventId)), [people, events]);
  const rows = useMemo(() => (personFor ? personActionRows(personFor) : jumpResults(query, { people, events, today, recent, has })), [personFor, query, people, events, today, recent, has]);
  const at = Math.min(active, Math.max(rows.length - 1, 0));
  const current = rows[at] || null;

  function run(row, full = false) {
    if (!row) return;
    saveRecent(row);
    onRun(row, { full });
  }
  function showActions(p) { setPersonFor(p); setActive(0); }
  function back() { setPersonFor(null); setActive(0); }

  function onKeyDown(e) {
    const caretAtEnd = e.target.selectionStart === e.target.value.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(at + 1, rows.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(at - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(current, e.ctrlKey || e.metaKey); }
    else if ((e.key === 'ArrowRight' && caretAtEnd) || e.key === 'Tab') {
      if (current && current.group === 'person' && !personFor) { e.preventDefault(); showActions(current.person); } else if (e.key === 'Tab') e.preventDefault();
    } else if (personFor && (e.key === 'ArrowLeft' || (e.key === 'Backspace' && !query))) { e.preventDefault(); back(); }
  }

  return (
    <Sheet title="Jump to" onClose={onClose} top>
      <div className="flex items-center gap-2 rounded-2xl px-3 py-2.5 mb-2" style={{ border: `1.5px solid ${COLORS.accent}`, background: COLORS.paper }}>
        <Search size={17} color={COLORS.accent} className="shrink-0" />
        {personFor && <span className="chip chip--on shrink-0" style={{ padding: '1px 8px', fontSize: 12 }}>{personFor.name}</span>}
        <input ref={inputRef} autoFocus value={query} onChange={e => { setQuery(e.target.value); setActive(0); setPersonFor(null); }} onKeyDown={onKeyDown}
          aria-label="Jump to" placeholder={personFor ? 'Pick what to do' : 'A person, plan or page, or type a plan'} className="jump-input flex-1 min-w-0 text-sm"
          style={{ background: 'transparent', border: 'none', outline: 'none', color: COLORS.ink }} />
        <Kbd>Esc</Kbd>
      </div>

      <div role="listbox" aria-label="Results" className="flex flex-col gap-0.5">
        {rows.length === 0 && <p className="text-sm px-2 py-3" style={{ color: COLORS.inkSoft }}>Nothing matches “{query}”.</p>}
        {rows.map((row, i) => {
          const on = i === at;
          return (
            <button key={row.id} type="button" role="option" aria-selected={on} onClick={() => run(row)} onMouseMove={() => { if (!on) setActive(i); }}
              className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left" style={{ background: on ? COLORS.accentSoft : 'transparent' }}>
              <span className="shrink-0 text-center" style={{ width: 24, fontSize: 17 }} aria-hidden="true">{row.emoji}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold truncate" style={{ color: COLORS.ink }}>{row.label}</span>
                {row.sub && <span className="block text-xs truncate" style={{ color: COLORS.inkSoft }}>{row.sub}</span>}
              </span>
              {row.group === 'person' && !personFor && on && <span className="flex items-center gap-1 text-xs shrink-0" style={{ color: COLORS.inkSoft }}>more <Kbd>→</Kbd></span>}
              {row.group !== 'person' && <span className="text-xs shrink-0" style={{ color: COLORS.inkSoft }}>{GROUP_LABEL[row.group]}</span>}
              {on && <ChevronRight size={15} color={COLORS.accent} className="shrink-0" />}
            </button>
          );
        })}
      </div>

      <p className="text-xs mt-3 flex items-center gap-1 flex-wrap" style={{ color: COLORS.inkSoft }}>
        <Kbd>↑</Kbd><Kbd>↓</Kbd> move · <Kbd>↵</Kbd> go
        {current && current.group === 'sentence' && <> · <Kbd>Ctrl</Kbd><Kbd>↵</Kbd> open it in full</>}
        {personFor && <> · <Kbd>←</Kbd> back</>}
      </p>
    </Sheet>
  );
}
