// Picking someone's avatar: groups of emoji (People, Faces, Animals,
// Things), skin tones for people, a box to find one by name (/), and the
// keys to do it all without the mouse (avatarKeys.js). AvatarPicker goes inside a sheet that passes its
// keys on (adding or editing someone); AvatarSheet is it on its own sheet,
// for a person's card while setting up.

import { Search } from 'lucide-react';
import { Sheet } from './Sheet.jsx';
import { isTabbedToButton, isTyping } from './sheetLayer.js';
import { useAvatarPicker } from './avatarKeys.js';
import { Kbd } from './atoms.jsx';
import { AVATAR_GROUPS, SKIN_TONES, withTone } from '../data/avatars.js';
import { COLORS } from '../theme.js';

// picker: useAvatarPicker(value, onChange), so the sheet can pass keys on.
export function AvatarPicker({ picker }) {
  const { group, shown, tone, base, finding, attachFind } = picker;
  return (
    <div className="avatar-picker">
      <div className="flex items-center gap-2 rounded-xl px-3 mb-2.5" style={{ border: `1px solid ${COLORS.line}` }}>
        <Search size={14} color={COLORS.inkSoft} className="shrink-0" />
        <input ref={attachFind} value={picker.query} onChange={e => picker.setQuery(e.target.value)} onKeyDown={picker.findKey}
          aria-label="Find an avatar" placeholder="Find one: dog, red hair, teacher…" className="flex-1 min-w-0 text-sm py-2" style={{ background: 'transparent', border: 'none', outline: 'none' }} />
        <Kbd>/</Kbd>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap mb-2.5" role="group" aria-label="Avatar groups">
        {AVATAR_GROUPS.map((g, i) => (
          <button key={g.key} type="button" onClick={() => picker.showGroup(i)} aria-pressed={!finding && i === group} className={`chip${!finding && i === group ? ' chip--on' : ''}`} style={{ padding: '3px 10px', fontSize: 12 }}>{g.label}</button>
        ))}
        <span className="flex items-center gap-1 text-xs ml-auto" style={{ color: COLORS.inkSoft }}><Kbd>G</Kbd> group · <Kbd>←</Kbd><Kbd>→</Kbd><Kbd>↑</Kbd><Kbd>↓</Kbd> pick</span>
      </div>
      {finding && shown.items.length === 0 && <p className="text-sm py-3" style={{ color: COLORS.inkSoft }}>No avatar called “{picker.query.trim()}”.</p>}
      <div key={shown.key} className="avatar-grid fade-anim" role="group" aria-label={shown.label}>
        {shown.items.map(it => {
          const on = it.emoji === base;
          const face = it.tone ? withTone(it.emoji, tone) : it.emoji;
          return (
            <button key={it.emoji} type="button" onClick={() => picker.pick(it.emoji)} aria-pressed={on} aria-label={it.name} title={it.name} className={`avatar-choice${on ? ' avatar-choice--on' : ''}`}>{face}</button>
          );
        })}
      </div>
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
