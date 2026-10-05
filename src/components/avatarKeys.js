// The avatar picker's state and keys (components/AvatarPicker.jsx shows
// it). The avatar itself is the sheet's (value / onChange); this keeps which
// group is showing and the skin tone to use for people.
//   ← → ↑ ↓  pick the next avatar in the group (it's picked as you move)
//   T        the next skin tone (Shift+T the one before), for people
//   G        the next group (Shift+G the one before)
//   /        find one by typing ("dog", "red hair"): Enter or ↓ picks the
//            first match and leaves the box, the arrows then move through
//            the matches
// handleKey(e) returns true when it used the key. The sheet calls it only
// while you're not typing.

import { useCallback, useRef, useState } from 'react';
import { AVATAR_COLS, AVATAR_GROUPS, findAvatars, groupOf, SKIN_TONES, splitTone, withTone } from '../data/avatars.js';

export function useAvatarPicker(value, onChange) {
  const [group, setGroup] = useState(() => groupOf(value));
  const [tone, setTone] = useState(() => splitTone(value).mod);
  const [query, setQuery] = useState('');
  const findRef = useRef(null);
  const attachFind = useCallback((el) => { findRef.current = el; }, []);
  const { base } = splitTone(value);
  const finding = query.trim().length > 0;
  // What the grid shows: the matches while finding, or the group.
  const shown = finding ? { key: 'found', label: 'Matches', tone: true, items: findAvatars(query) } : AVATAR_GROUPS[group];

  function pick(emoji, mod = tone) {
    const inPeople = AVATAR_GROUPS[0].items.some(it => it.emoji === emoji);
    onChange(inPeople ? withTone(emoji, mod) : emoji);
  }
  function showGroupAndClear(i) { setQuery(''); setGroup((i + AVATAR_GROUPS.length) % AVATAR_GROUPS.length); }
  // The find box's own keys: Enter or ↓ picks the first match and leaves it.
  function findKey(e) {
    if ((e.key === 'Enter' || e.key === 'ArrowDown') && shown.items.length) {
      e.preventDefault();
      e.stopPropagation();
      pick(shown.items[0].emoji);
      e.currentTarget.blur();
    }
  }
  function chooseTone(mod) {
    setTone(mod);
    if (AVATAR_GROUPS[0].items.some(it => it.emoji === base)) onChange(withTone(base, mod));
  }

  function handleKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -AVATAR_COLS, ArrowDown: AVATAR_COLS };
    const key = e.key.toLowerCase();
    if (e.key === '/') {
      e.preventDefault();
      if (findRef.current) findRef.current.focus();
      return true;
    }
    if (e.key in moves) {
      e.preventDefault();
      const items = shown.items;
      if (!items.length) return true;
      const at = items.findIndex(it => it.emoji === base);
      const next = at < 0 ? 0 : Math.max(0, Math.min(items.length - 1, at + moves[e.key]));
      pick(items[next].emoji);
      return true;
    }
    if (key === 't') {
      e.preventDefault();
      const i = SKIN_TONES.findIndex(t => t.mod === tone);
      chooseTone(SKIN_TONES[(i + (e.shiftKey ? SKIN_TONES.length - 1 : 1)) % SKIN_TONES.length].mod);
      return true;
    }
    if (key === 'g') {
      e.preventDefault();
      showGroupAndClear(group + (e.shiftKey ? -1 : 1));
      return true;
    }
    return false;
  }

  return { group, shown, tone, base, finding, query, setQuery, attachFind, findKey, pick, chooseTone, showGroup: showGroupAndClear, handleKey };
}
