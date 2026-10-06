// Photos for several people at once: choose a folder, then go through its
// pictures one at a time. Each starts already placed in the circle (the
// upper middle of a portrait, where a face usually is; startCrop), and you
// pick who it's for. Only the small circle is kept, and nothing leaves this
// computer. See docs/renderer/app-structure.md.
// Keys: U (or Enter) chooses the folder; then 1-9 or a name picks who it's
// for (a picture named after someone starts on them), Shift+arrows move it
// in the circle and + - zoom, Enter uses it and goes on (with nobody picked,
// skips it), Backspace goes back; at the end, Enter adds them all, with one
// Undo.

import { useEffect, useRef, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { Sheet } from '../components/Sheet.jsx';
import { isPlusKey, isTabbedToButton, isTyping } from '../components/sheetLayer.js';
import { Kbd } from '../components/atoms.jsx';
import { PhotoCrop } from '../components/AvatarPicker.jsx';
import { PeopleGrid } from '../components/PersonPick.jsx';
import { usePeopleKeys } from '../components/peopleKeys.js';
import { isPictureFile, personForFile, photoBox, startCrop } from '../data/avatars.js';
import { loadPhoto, renderPhoto } from '../lib/photo.js';
import { COLORS } from '../theme.js';

export function PhotoFolderSheet({ people, onClose, onApply }) {
  const [files, setFiles] = useState(null); // the pictures in the folder, by name
  const [index, setIndex] = useState(0);
  const [photo, setPhoto] = useState(null); // { img, zoom, x, y } for the picture showing
  const [unreadable, setUnreadable] = useState(false);
  const [who, setWho] = useState(null);
  const [chosen, setChosen] = useState([]); // [{ personId, src, file }]
  const [noPictures, setNoPictures] = useState(false);
  const inputRef = useRef(null);
  const peopleKeys = usePeopleKeys(people, who ? [who] : [], (id) => setWho(w => (w === id ? null : id)));
  const file = files && files[index];
  const finished = Boolean(files) && index >= files.length;
  const whoPerson = people.find(p => p.id === who) || null;

  // The picture showing, placed to start, and who it's for: whoever it was
  // given to already, or the person it's named after.
  useEffect(() => {
    if (!file) return undefined;
    let live = true;
    setPhoto(null); setUnreadable(false);
    const before = chosen.find(c => c.file === file.name);
    setWho(before ? before.personId : personForFile(file.name, people));
    loadPhoto(file).then(img => {
      if (!live) return;
      if (!img) { setUnreadable(true); return; }
      setPhoto({ img, ...startCrop(img.naturalWidth, img.naturalHeight) });
    });
    return () => { live = false; };
    // Only when the picture changes; who it's for is then the user's to pick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  function chooseFolder() { if (inputRef.current) inputRef.current.click(); }
  function folderChosen(list) {
    const pictures = [...list].filter(isPictureFile).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    setNoPictures(!pictures.length);
    if (!pictures.length) return;
    setFiles(pictures); setIndex(0); setChosen([]);
  }
  function place(next) { setPhoto(p => (p ? { ...p, ...photoBox(p.img.naturalWidth, p.img.naturalHeight, { ...p, ...next }).crop } : p)); }
  const move = (dx, dy) => photo && place({ x: photo.x + dx, y: photo.y + dy });
  const zoom = (z) => photo && place({ zoom: z });
  // Enter: this picture for whoever's picked, then the next (or skip it).
  function use() {
    if (photo && who) {
      const src = renderPhoto(photo.img, photo);
      if (src) setChosen(list => [...list.filter(c => c.file !== file.name && c.personId !== who), { personId: who, src, file: file.name }]);
    } else if (file) {
      setChosen(list => list.filter(c => c.file !== file.name));
    }
    setIndex(i => i + 1);
  }
  function back() { setIndex(i => Math.max(0, Math.min(i, files.length) - 1)); }
  function apply() { if (chosen.length) onApply(chosen); else onClose(); }

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
    if (e.key === 'Enter' && isTabbedToButton()) return;
    const act = (fn) => { e.preventDefault(); fn(); };
    if (!files) { if (e.key === 'Enter' || e.key.toLowerCase() === 'u') act(chooseFolder); return; }
    if (finished) {
      if (e.key === 'Enter') act(apply);
      else if (e.key === 'Backspace') act(back);
      return;
    }
    const nudges = { ArrowLeft: [0.03, 0], ArrowRight: [-0.03, 0], ArrowUp: [0, 0.03], ArrowDown: [0, -0.03] };
    if (e.shiftKey && e.key in nudges) act(() => move(...nudges[e.key]));
    else if (isPlusKey(e)) act(() => zoom(photo ? photo.zoom + 0.1 : 1));
    else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') act(() => zoom(photo ? photo.zoom - 0.1 : 1));
    else if (peopleKeys.handleKey(e)) return;
    else if (e.key === 'Enter') act(use);
    else if (e.key === 'Backspace' && index > 0) act(back);
  }

  const named = (id) => (people.find(p => p.id === id) || {}).name;
  const footer = !files
    ? <button type="button" onClick={chooseFolder} className="primary-btn"><FolderOpen size={16} /> Choose a folder <Kbd onAccent>U</Kbd></button>
    : finished
      ? <div className="flex items-center gap-2">
          <button type="button" onClick={back} className="chip shrink-0" style={{ padding: '10px 14px' }}>Back <Kbd>⌫</Kbd></button>
          <button type="button" onClick={apply} className="primary-btn">{chosen.length ? `Add ${chosen.length} ${chosen.length === 1 ? 'photo' : 'photos'}` : 'Close'} <Kbd onAccent>↵</Kbd></button>
        </div>
      : <div className="flex items-center gap-2">
          {index > 0 && <button type="button" onClick={back} className="chip shrink-0" style={{ padding: '10px 14px' }}>Back <Kbd>⌫</Kbd></button>}
          <button type="button" onClick={use} className="primary-btn">{whoPerson && photo ? `Use for ${whoPerson.name}` : 'Skip this one'} <Kbd onAccent>↵</Kbd></button>
        </div>;

  return (
    <Sheet title="Photos from a folder" onClose={onClose} onKey={onKey} footer={footer} tall>
      <input ref={inputRef} type="file" accept="image/*" multiple webkitdirectory="" hidden aria-label="Choose a folder of pictures"
        onChange={e => { const list = e.target.files ? [...e.target.files] : []; e.target.value = ''; folderChosen(list); }} />
      {!files && (
        <div className="fade-anim">
          <p className="text-sm" style={{ color: COLORS.ink }}>Choose a folder of pictures, then go through them one at a time: each starts in the circle, and you pick who it's for.</p>
          <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>A picture named after someone ("Kai.jpg") starts on them. Only a small circle of each is kept, on this computer and in your backups.</p>
          {noPictures && <p className="text-xs font-semibold mt-3" style={{ color: COLORS.alert }}>There are no pictures in that folder. Try another (JPEG, PNG or WebP).</p>}
        </div>
      )}

      {file && (
        <div key={index} className="fade-anim">
          <p className="text-xs mb-3 flex items-center gap-1.5 min-w-0" style={{ color: COLORS.inkSoft }} aria-label="Which picture">
            <span className="font-semibold shrink-0" style={{ color: COLORS.ink }}>Picture {index + 1} of {files.length}</span>
            <span className="truncate">· {file.name}</span>
          </p>
          <div className="flex flex-col items-center gap-2 mb-4">
            {photo ? <PhotoCrop photo={photo} onMove={move} onZoom={zoom} />
              : <div className="photo-crop flex items-center justify-center text-xs text-center px-4" style={{ width: 168, height: 168, color: COLORS.inkSoft }}>{unreadable ? "Layers can't read this one. Enter skips it." : 'Opening…'}</div>}
            {photo && <p className="text-xs flex items-center gap-1 flex-wrap justify-center" style={{ color: COLORS.inkSoft }}>Drag, or <Kbd>Shift</Kbd>+<Kbd>←</Kbd><Kbd>→</Kbd><Kbd>↑</Kbd><Kbd>↓</Kbd> to move · <Kbd>+</Kbd><Kbd>−</Kbd> zoom</p>}
          </div>
          <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: COLORS.inkSoft, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Who is it? <Kbd>1–9</Kbd></p>
          <PeopleGrid keys={peopleKeys} pickedIds={who ? [who] : []} />
        </div>
      )}

      {finished && (
        <div className="fade-anim" role="status" aria-label="Photos ready">
          <p className="text-sm font-semibold mb-3" style={{ color: COLORS.ink }}>{chosen.length ? `${chosen.length} ${chosen.length === 1 ? 'photo' : 'photos'} ready` : 'No photos picked'}</p>
          <div className="flex flex-wrap gap-3">
            {chosen.map(c => (
              <div key={c.personId} className="flex flex-col items-center gap-1" style={{ width: 64 }}>
                <img src={c.src} alt="" className="rounded-full" style={{ width: 52, height: 52, border: `2px solid ${COLORS.line}` }} />
                <span className="text-xs truncate" style={{ maxWidth: 64, color: COLORS.ink }}>{named(c.personId)}</span>
              </div>
            ))}
          </div>
          {chosen.length > 0 && <p className="text-xs mt-3" style={{ color: COLORS.inkSoft }}>Enter makes them these people's avatars, with Undo.</p>}
        </div>
      )}
    </Sheet>
  );
}
