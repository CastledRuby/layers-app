// Keys for a "who" step (the quick log and planning), so picking people
// doesn't need the mouse, however many there are:
//   1-9        pick or unpick one of the first nine people shown
//   letters    find someone by name; Backspace takes a letter off
//   arrows     move a highlight through everyone shown; Space picks or
//              unpicks the highlighted person
//   Enter      while finding: pick the highlighted (or first) person found
// People are shown closest first, as on the People tab, so the number keys
// land on the people you're likeliest to want.
// The sheet calls handleKey from its own onKey and carries on with its keys
// (Enter to go on, Backspace to go back) when it returns false.

import { useCallback, useMemo, useRef, useState } from 'react';

const startsWord = (name, q) => name.toLowerCase().split(/\s+/).some(w => w.startsWith(q));

// How many people fit on a row of the grid, for the up and down arrows.
function columns(grid) {
  const kids = grid ? [...grid.children] : [];
  if (kids.length < 2) return 1;
  const next = kids.findIndex(k => k.offsetTop !== kids[0].offsetTop);
  return next > 0 ? next : kids.length;
}

export function usePeopleKeys(people, pickedIds, toggle) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(null); // index into shown, once an arrow is pressed
  const grid = useRef(null);
  const attachGrid = useCallback((el) => { grid.current = el; }, []); // PeopleGrid's element
  const ordered = useMemo(() => [...people].sort((a, b) => (b.layer - a.layer) || ((b.overall || 0) - (a.overall || 0))), [people]);
  const q = query.toLowerCase();
  const shown = !q ? ordered : ordered
    .filter(p => p.name.toLowerCase().includes(q))
    .sort((a, b) => Number(!startsWord(a.name, q)) - Number(!startsWord(b.name, q)));
  const at = cursor === null || !shown.length ? null : Math.min(cursor, shown.length - 1);

  function find(next) { setQuery(next); setCursor(null); }
  function pick(p) {
    toggle(p.id);
    if (query) find('');
  }
  function move(by) {
    setCursor(c => {
      if (c === null) return 0;
      const n = Math.min(c, shown.length - 1) + by;
      return Math.max(0, Math.min(shown.length - 1, n));
    });
  }
  function handleKey(e) {
    const key = e.key;
    if (/^[1-9]$/.test(key)) {
      e.preventDefault();
      const p = shown[Number(key) - 1];
      if (p) pick(p);
      return true;
    }
    if (key.startsWith('Arrow') && shown.length) {
      e.preventDefault();
      const rows = key === 'ArrowUp' || key === 'ArrowDown' ? columns(grid.current) : 1;
      move((key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1) * rows);
      return true;
    }
    if (key.length === 1 && /\p{L}/u.test(key)) { e.preventDefault(); find(query + key); return true; }
    if (key === ' ' && query) { e.preventDefault(); find(query + ' '); return true; }
    if (key === ' ' && at !== null) { e.preventDefault(); pick(shown[at]); return true; }
    if (key === 'Backspace' && query) { e.preventDefault(); find(query.slice(0, -1)); return true; }
    if (key === 'Enter' && query) {
      e.preventDefault();
      const p = shown[at ?? 0];
      if (p && !pickedIds.includes(p.id)) pick(p);
      else find('');
      return true;
    }
    return false;
  }
  return { query, shown, cursor: at, attachGrid, handleKey, select: (id) => { toggle(id); if (query) find(''); } };
}
