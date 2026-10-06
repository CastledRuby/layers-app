// Picking someone's avatar: their initials on a colour, a photo you choose
// and crop to the circle, or an emoji from groups (People, Faces, Animals,
// Things) with skin tones for people, a box to find one by name (/), and the
// keys to do it all without the mouse (avatarKeys.js). AvatarPicker goes inside a sheet that passes its keys on
// (adding or editing someone); AvatarSheet is it on its own sheet, for a
// person's card while setting up.

import { useRef } from 'react';
import { ImagePlus, Search } from 'lucide-react';
import { Sheet } from './Sheet.jsx';
import { isTabbedToButton, isTyping } from './sheetLayer.js';
import { PICKER_GROUPS, useAvatarPicker } from './avatarKeys.js';
import { Avatar, Kbd } from './atoms.jsx';
import { isPhoto, photoBox, SKIN_TONES, withTone } from '../data/avatars.js';
import { COLORS } from '../theme.js';

const VIEW = 168; // the crop circle, in px

// A picture in its circle: drag or the wheel to move and zoom it, and the
// slider under it. photo: { img, zoom, x, y }; onMove(dx, dy) in parts of the
// circle; onZoom(zoom).
export function PhotoCrop({ photo: p, onMove, onZoom }) {
  const last = useRef(null);
  const box = photoBox(p.img.naturalWidth, p.img.naturalHeight, p, VIEW);
  function down(e) { last.current = { x: e.clientX, y: e.clientY }; if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId); }
  function move(e) {
    if (!last.current) return;
    onMove((e.clientX - last.current.x) / VIEW, (e.clientY - last.current.y) / VIEW);
    last.current = { x: e.clientX, y: e.clientY };
  }
  function up() { last.current = null; }
  return (
    <>
      <div className="photo-crop" style={{ width: VIEW, height: VIEW }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onWheel={e => onZoom(p.zoom + (e.deltaY < 0 ? 0.1 : -0.1))} role="img" aria-label="The photo in its circle">
        <img src={p.img.src} alt="" draggable={false} style={{ position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height, maxWidth: 'none' }} />
      </div>
      <input type="range" min="1" max="4" step="0.05" value={p.zoom} onChange={e => onZoom(Number(e.target.value))} aria-label="Zoom" style={{ width: VIEW, accentColor: COLORS.accent }} />
    </>
  );
}

// Choosing a picture, then moving it (drag or arrows) and zooming it (the
// slider, the wheel, or + and -) inside the circle.
function PhotoPanel({ picker, current }) {
  const { photo: p, photoError, attachFile, choosePhoto, photoChosen, movePhoto, zoomPhoto } = picker;
  return (
    <div className="photo-panel">
      <input ref={attachFile} type="file" accept="image/*" hidden aria-label="Choose a picture"
        onChange={e => { const file = e.target.files && e.target.files[0]; e.target.value = ''; if (file) photoChosen(file); }} />
      {p ? (
        <div className="flex flex-col items-center gap-3">
          <PhotoCrop photo={p} onMove={movePhoto} onZoom={zoomPhoto} />
          <p className="text-xs flex items-center gap-1 flex-wrap justify-center" style={{ color: COLORS.inkSoft }}>
            Drag or <Kbd>←</Kbd><Kbd>→</Kbd><Kbd>↑</Kbd><Kbd>↓</Kbd> to move · <Kbd>+</Kbd><Kbd>−</Kbd> zoom ·
            <button type="button" onClick={choosePhoto} className="font-semibold" style={{ color: COLORS.accent }}>another picture</button><Kbd>U</Kbd>
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          {isPhoto(current) && <img src={current.src} alt="Their photo now" className="rounded-full" style={{ width: 88, height: 88 }} />}
          <button type="button" onClick={choosePhoto} className="chip" style={{ padding: '8px 10px 8px 14px', fontSize: 13 }}>
            <ImagePlus size={15} color={COLORS.accent} /> {isPhoto(current) ? 'Choose a different picture' : 'Choose a picture'} <Kbd>U</Kbd>
          </button>
          <p className="text-xs" style={{ color: COLORS.inkSoft, maxWidth: 340 }}>Then move and zoom it in the circle. Only that small circle is kept, on this computer and in your backups.</p>
          {photoError && <p className="text-xs font-semibold" style={{ color: COLORS.alert }}>That file isn't a picture Layers can read. Try a JPEG or PNG.</p>}
        </div>
      )}
    </div>
  );
}

// picker: useAvatarPicker(look, onChange), so the sheet can pass keys on.
// name and layer show the initials as they'll look; current is the avatar
// now (a photo shows in the Photo group).
export function AvatarPicker({ picker, name, layer = 1, current = null }) {
  const { group, shown, tone, finding, attachFind } = picker;
  const initialsShown = shown.items.some(it => it.color);
  return (
    <div className="avatar-picker">
      <div className="flex items-center gap-2 rounded-xl px-3 mb-2.5" style={{ border: `1px solid ${COLORS.line}` }}>
        <Search size={14} color={COLORS.inkSoft} className="shrink-0" />
        <input ref={attachFind} value={picker.query} onChange={e => picker.setQuery(e.target.value)} onKeyDown={picker.findKey}
          aria-label="Find an avatar" placeholder="Find one: initials, dog, red hair…" className="flex-1 min-w-0 text-sm py-2" style={{ background: 'transparent', border: 'none', outline: 'none' }} />
        <Kbd>/</Kbd>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap mb-2.5" role="group" aria-label="Avatar groups">
        {PICKER_GROUPS.map((g, i) => (
          <button key={g.key} type="button" onClick={() => picker.showGroup(i)} aria-pressed={!finding && i === group} className={`chip${!finding && i === group ? ' chip--on' : ''}`} style={{ padding: '3px 10px', fontSize: 12 }}>{g.label}</button>
        ))}
        <span className="flex items-center gap-1 text-xs ml-auto" style={{ color: COLORS.inkSoft }}><Kbd>G</Kbd> group · <Kbd>←</Kbd><Kbd>→</Kbd><Kbd>↑</Kbd><Kbd>↓</Kbd> pick</span>
      </div>
      {finding && shown.items.length === 0 && <p className="text-sm py-3" style={{ color: COLORS.inkSoft }}>No avatar called “{picker.query.trim()}”.</p>}
      {shown.photo && <PhotoPanel picker={picker} current={current} />}
      {!shown.photo && <div key={shown.key} className={`avatar-grid fade-anim${shown.cols === 5 ? ' avatar-grid--initials' : ''}`} role="group" aria-label={shown.label}>
        {shown.items.map(it => {
          const on = picker.isOn(it);
          if (it.color) {
            return (
              <button key={it.color} type="button" onClick={() => picker.pick(it)} aria-pressed={on} aria-label={`Initials, ${it.name.toLowerCase()}`} title={`Initials · ${it.name}`} className={`avatar-choice avatar-choice--initials${on ? ' avatar-choice--on' : ''}`}>
                <Avatar person={{ name: name || '?', layer, avatar: { style: 'initials', color: it.color } }} size={40} ringColor="transparent" />
                <span className="avatar-choice-name">{it.name}</span>
              </button>
            );
          }
          return (
            <button key={it.emoji} type="button" onClick={() => picker.pick(it)} aria-pressed={on} aria-label={it.name} title={it.name} className={`avatar-choice${on ? ' avatar-choice--on' : ''}`}>{it.tone ? withTone(it.emoji, tone) : it.emoji}</button>
          );
        })}
      </div>}
      {initialsShown && !finding && <p className="text-xs mt-2.5" style={{ color: COLORS.inkSoft }}>Their layer’s colours change as they move between layers.</p>}
      {(finding ? shown.items.some(it => it.tone) : shown.tone) && (
        <div className="flex items-center gap-2 mt-3" role="group" aria-label="Skin tone">
          <span className="text-xs font-semibold" style={{ color: COLORS.inkSoft }}>Skin tone</span>
          {SKIN_TONES.map(t => (
            <button key={t.name} type="button" onClick={() => picker.chooseTone(t.mod)} aria-pressed={t.mod === tone} aria-label={`${t.name} skin tone`} title={t.name} className={`tone-swatch${t.mod === tone ? ' tone-swatch--on' : ''}`} style={{ background: t.swatch }} />
          ))}
          <Kbd>T</Kbd>
        </div>
      )}
    </div>
  );
}

// The picker on its own sheet: Enter (or Done) keeps the avatar picked.
// person: { name, layer, emoji, avatar }; onChange({ emoji, avatar }).
export function AvatarSheet({ person, onChange, onClose }) {
  const picker = useAvatarPicker({ emoji: person.emoji, avatar: person.avatar || null }, onChange);
  function onKey(e) {
    if (isTyping()) return;
    if (e.key === 'Enter' && !isTabbedToButton()) { e.preventDefault(); onClose(); return; }
    picker.handleKey(e);
  }
  return (
    <Sheet title={`${person.name}'s avatar`} onClose={onClose} onKey={onKey}
      footer={<button type="button" onClick={onClose} className="primary-btn">Done <Kbd onAccent>↵</Kbd></button>}>
      <div className="flex justify-center mb-4"><Avatar person={person} size={64} /></div>
      <AvatarPicker picker={picker} name={person.name} layer={person.layer} current={person.avatar} />
    </Sheet>
  );
}
