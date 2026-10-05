// Picking someone's avatar: their initials on a colour, or an emoji from
// groups (People, Faces, Animals, Things) with skin tones for people, a box
// to find one by name (/), and the keys to do it all without the mouse
// (avatarKeys.js). AvatarPicker goes inside a sheet that passes its keys on
// (adding or editing someone); AvatarSheet is it on its own sheet, for a
// person's card while setting up.

import { Search } from 'lucide-react';
import { Sheet } from './Sheet.jsx';
import { isTabbedToButton, isTyping } from './sheetLayer.js';
import { PICKER_GROUPS, useAvatarPicker } from './avatarKeys.js';
import { Avatar, Kbd } from './atoms.jsx';
import { SKIN_TONES, withTone } from '../data/avatars.js';
import { COLORS } from '../theme.js';

// picker: useAvatarPicker(look, onChange), so the sheet can pass keys on.
// name and layer show the initials as they'll look.
export function AvatarPicker({ picker, name, layer = 1 }) {
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
      <div key={shown.key} className={`avatar-grid fade-anim${shown.cols === 5 ? ' avatar-grid--initials' : ''}`} role="group" aria-label={shown.label}>
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
      </div>
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
      <AvatarPicker picker={picker} name={person.name} layer={person.layer} />
    </Sheet>
  );
}
