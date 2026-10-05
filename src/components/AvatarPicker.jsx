// Picking someone's avatar: groups of emoji (People, Faces, Animals,
// Things), skin tones for people, and the keys to do it all without the
// mouse (avatarKeys.js). AvatarPicker goes inside a sheet that passes its
// keys on (adding or editing someone); AvatarSheet is it on its own sheet,
// for a person's card while setting up.

import { Sheet } from './Sheet.jsx';
import { isTabbedToButton, isTyping } from './sheetLayer.js';
import { useAvatarPicker } from './avatarKeys.js';
import { Kbd } from './atoms.jsx';
import { AVATAR_GROUPS, SKIN_TONES, withTone } from '../data/avatars.js';
import { COLORS } from '../theme.js';

// picker: useAvatarPicker(value, onChange), so the sheet can pass keys on.
export function AvatarPicker({ picker }) {
  const { group, shown, tone, base } = picker;
  return (
    <div className="avatar-picker">
      <div className="flex items-center gap-1.5 flex-wrap mb-2.5" role="group" aria-label="Avatar groups">
        {AVATAR_GROUPS.map((g, i) => (
          <button key={g.key} type="button" onClick={() => picker.showGroup(i)} aria-pressed={i === group} className={`chip${i === group ? ' chip--on' : ''}`} style={{ padding: '3px 10px', fontSize: 12 }}>{g.label}</button>
        ))}
        <span className="flex items-center gap-1 text-xs ml-auto" style={{ color: COLORS.inkSoft }}><Kbd>G</Kbd> group · <Kbd>←</Kbd><Kbd>→</Kbd><Kbd>↑</Kbd><Kbd>↓</Kbd> pick</span>
      </div>
      <div key={shown.key} className="avatar-grid fade-anim" role="group" aria-label={shown.label}>
        {shown.items.map(it => {
          const on = it.emoji === base;
          const face = shown.tone ? withTone(it.emoji, tone) : it.emoji;
          return (
            <button key={it.emoji} type="button" onClick={() => picker.pick(it.emoji)} aria-pressed={on} aria-label={it.name} title={it.name} className={`avatar-choice${on ? ' avatar-choice--on' : ''}`}>{face}</button>
          );
        })}
      </div>
      {shown.tone && (
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
export function AvatarSheet({ name, value, onChange, onClose }) {
  const picker = useAvatarPicker(value, onChange);
  function onKey(e) {
    if (isTyping()) return;
    if (e.key === 'Enter' && !isTabbedToButton()) { e.preventDefault(); onClose(); return; }
    picker.handleKey(e);
  }
  return (
    <Sheet title={`${name}'s avatar`} onClose={onClose} onKey={onKey}
      footer={<button type="button" onClick={onClose} className="primary-btn">Done <Kbd onAccent>↵</Kbd></button>}>
      <div className="flex justify-center mb-4"><span className="avatar-preview" aria-hidden="true">{value}</span></div>
      <AvatarPicker picker={picker} />
    </Sheet>
  );
}
