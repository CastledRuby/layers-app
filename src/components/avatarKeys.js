// The avatar picker's state and keys (components/AvatarPicker.jsx shows
// it). The avatar itself is the sheet's: a look, { emoji, avatar }, where
// avatar is null for the emoji, { style: 'initials', color } for initials or
// { style: 'photo', src } for a photo (data/avatars.js); onChange(look) sets
// it. This keeps which group is showing, the skin tone to use for people,
// and a picture being cropped.
//   ← → ↑ ↓  pick the next one in the group (it's picked as you move)
//   T        the next skin tone (Shift+T the one before), for people
//   G        the next group (Shift+G the one before): Initials, Photo,
//            People, Faces, Animals, Things
//   Photo:   U chooses a picture; then the arrows move it in the circle and
//            + and - zoom (dragging and the slider do the same)
//   /        find one by typing ("dog", "red hair", "initials"): Enter or ↓
//            picks the first match and leaves the box, the arrows then move
//            through the matches
// handleKey(e) returns true when it used the key. The sheet calls it only
// while you're not typing.

import { useCallback, useRef, useState } from 'react';
import { AVATAR_COLS, AVATAR_GROUPS, findAvatars, groupOf, INITIALS_GROUP, isInitials, isPhoto, PHOTO_GROUP, photoBox, SKIN_TONES, splitTone, withTone } from '../data/avatars.js';
import { loadPhoto, renderPhoto } from '../lib/photo.js';

export const PICKER_GROUPS = [INITIALS_GROUP, PHOTO_GROUP, ...AVATAR_GROUPS];
const EMOJI_FROM = 2; // where the emoji groups start in PICKER_GROUPS

export function useAvatarPicker(look, onChange) {
  const initials = isInitials(look.avatar);
  const [group, setGroup] = useState(() => (initials ? 0 : isPhoto(look.avatar) ? 1 : groupOf(look.emoji) + EMOJI_FROM));
  // A picture chosen here, being cropped: { img, zoom, x, y }.
  const [photo, setPhoto] = useState(null);
  const [photoError, setPhotoError] = useState(false);
  const fileRef = useRef(null);
  const attachFile = useCallback((el) => { fileRef.current = el; }, []);
  const [tone, setTone] = useState(() => splitTone(look.emoji).mod);
  const [query, setQuery] = useState('');
  const findRef = useRef(null);
  const attachFind = useCallback((el) => { findRef.current = el; }, []);
  const { base } = splitTone(look.emoji);
  const finding = query.trim().length > 0;
  const words = query.toLowerCase().split(/[\s,]+/).filter(Boolean);
  // What the grid shows: the matches while finding, or the group.
  const shown = finding
    ? { key: 'found', label: 'Matches', items: [...INITIALS_GROUP.items.filter(it => words.every(w => it.words.includes(w))), ...findAvatars(query)] }
    : PICKER_GROUPS[group];

  // Whether a choice is the one picked.
  function isOn(it) { return it.color ? initials && look.avatar.color === it.color : !initials && it.emoji === base; }
  function pick(it, mod = tone) {
    if (it.color) onChange({ emoji: look.emoji, avatar: { style: 'initials', color: it.color } });
    else onChange({ emoji: it.tone ? withTone(it.emoji, mod) : it.emoji, avatar: null });
  }
  function showGroup(i) { setQuery(''); setGroup((i + PICKER_GROUPS.length) % PICKER_GROUPS.length); }
  // The find box's own keys: Enter or ↓ picks the first match and leaves it.
  function findKey(e) {
    if ((e.key === 'Enter' || e.key === 'ArrowDown') && shown.items.length) {
      e.preventDefault();
      e.stopPropagation();
      pick(shown.items[0]);
      e.currentTarget.blur();
    }
  }
  // Photos: choose one (the file box), then move and zoom it.
  function choosePhoto() { if (fileRef.current) fileRef.current.click(); }
  async function photoChosen(file) {
    const img = await loadPhoto(file);
    setPhotoError(!img);
    if (img) applyPhoto({ img, zoom: 1, x: 0, y: 0 });
  }
  function applyPhoto(next) {
    const { crop } = photoBox(next.img.naturalWidth, next.img.naturalHeight, next);
    const placed = { img: next.img, ...crop };
    setPhoto(placed);
    const src = renderPhoto(placed.img, crop);
    if (src) onChange({ emoji: look.emoji, avatar: { style: 'photo', src } });
  }
  function movePhoto(dx, dy) { if (photo) applyPhoto({ ...photo, x: photo.x + dx, y: photo.y + dy }); }
  function zoomPhoto(zoom) { if (photo) applyPhoto({ ...photo, zoom }); }
  function chooseTone(mod) {
    setTone(mod);
    if (!initials && AVATAR_GROUPS[0].items.some(it => it.emoji === base)) onChange({ emoji: withTone(base, mod), avatar: null });
  }

  function handleKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const cols = shown.cols || AVATAR_COLS;
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols };
    const key = e.key.toLowerCase();
    if (e.key === '/') {
      e.preventDefault();
      if (findRef.current) findRef.current.focus();
      return true;
    }
    if (shown.photo) {
      const nudges = { ArrowLeft: [-0.03, 0], ArrowRight: [0.03, 0], ArrowUp: [0, -0.03], ArrowDown: [0, 0.03] };
      if (key === 'u') { e.preventDefault(); choosePhoto(); return true; }
      if (photo && e.key in nudges) { e.preventDefault(); movePhoto(...nudges[e.key]); return true; }
      if (photo && (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd')) { e.preventDefault(); zoomPhoto(photo.zoom + 0.1); return true; }
      if (photo && (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract')) { e.preventDefault(); zoomPhoto(photo.zoom - 0.1); return true; }
    }
    if (e.key in moves && !shown.photo) {
      e.preventDefault();
      const items = shown.items;
      if (!items.length) return true;
      const at = items.findIndex(isOn);
      pick(items[at < 0 ? 0 : Math.max(0, Math.min(items.length - 1, at + moves[e.key]))]);
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
      showGroup(group + (e.shiftKey ? -1 : 1));
      return true;
    }
    return false;
  }

  return {
    group, shown, tone, finding, query, setQuery, attachFind, findKey, isOn, pick, chooseTone, showGroup, handleKey,
    photo, photoError, attachFile, choosePhoto, photoChosen, movePhoto, zoomPhoto,
  };
}
