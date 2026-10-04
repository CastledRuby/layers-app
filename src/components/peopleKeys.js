// Keys for a "who" step (the quick log and planning), so picking people
// doesn't need the mouse:
//   1-9        pick or unpick one of the first nine people shown
//   letters    find someone by name; Backspace takes a letter off
//   Enter      while finding: pick the first person found
// The sheet calls handleKey from its own onKey and carries on with its keys
// (Enter to go on, Backspace to go back) when it returns false.

import { useState } from 'react';

export function usePeopleKeys(people, pickedIds, toggle) {
  const [query, setQuery] = useState('');
  const q = query.toLowerCase();
  const shown = !q ? people : people
    .filter(p => p.name.toLowerCase().includes(q))
    .sort((a, b) => Number(!a.name.toLowerCase().split(/\s+/).some(w => w.startsWith(q))) - Number(!b.name.toLowerCase().split(/\s+/).some(w => w.startsWith(q))));

  function pick(p) {
    toggle(p.id);
    setQuery('');
  }
  function handleKey(e) {
    const key = e.key;
    if (/^[1-9]$/.test(key)) {
      e.preventDefault();
      const p = shown[Number(key) - 1];
      if (p) pick(p);
      return true;
    }
    if (key.length === 1 && /\p{L}/u.test(key)) { e.preventDefault(); setQuery(s => s + key); return true; }
    if (key === ' ' && query) { e.preventDefault(); setQuery(s => s + ' '); return true; }
    if (key === 'Backspace' && query) { e.preventDefault(); setQuery(s => s.slice(0, -1)); return true; }
    if (key === 'Enter' && query) {
      e.preventDefault();
      if (shown[0] && !pickedIds.includes(shown[0].id)) pick(shown[0]);
      else setQuery('');
      return true;
    }
    return false;
  }
  return { query, shown, handleKey, select: (id) => { toggle(id); setQuery(''); } };
}
