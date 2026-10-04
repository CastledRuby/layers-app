// A tappable person (avatar and name) for "who" steps: the quick log and
// planning. Their ring shows their layer; a tick shows they're picked.
// PeopleGrid lays them out with their number keys and what's been typed to
// find someone (usePeopleKeys in peopleKeys.js).

import { Check } from 'lucide-react';
import { Avatar, Kbd } from './atoms.jsx';
import { getLayer } from '../data/constants.js';
import { COLORS } from '../theme.js';

export function PersonPick({ person, active, onClick, size = 48, hint }) {
  const l = getLayer(person.layer);
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="flex flex-col items-center gap-1 shrink-0 rounded-2xl py-1.5" style={{ width: 64 }}>
      <span style={{ position: 'relative', display: 'inline-block' }} className={active ? 'pop' : ''}>
        {hint && <span style={{ position: 'absolute', top: -4, left: -6, zIndex: 1 }}><Kbd>{hint}</Kbd></span>}
        <Avatar emoji={person.emoji} size={size} ringColor={active ? COLORS.accent : l.color} />
        {active && (
          <span style={{ position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: '50%', background: COLORS.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${COLORS.paperRaised}` }}>
            <Check size={10} color={COLORS.onAccent} strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="text-xs truncate" style={{ maxWidth: 60, color: active ? COLORS.accent : COLORS.inkSoft, fontWeight: active ? 700 : 500 }}>{person.name}</span>
    </button>
  );
}

// Everyone to pick from, numbered 1-9, narrowed by what's been typed.
export function PeopleGrid({ keys, pickedIds }) {
  const { query, shown } = keys;
  return (
    <>
      {query && (
        <p className="text-xs mb-2 flex items-center gap-1.5" style={{ color: COLORS.inkSoft }} aria-live="polite">
          Finding <span className="chip chip--on" style={{ padding: '1px 8px', fontSize: 12 }}>{query}</span>
          {shown.length ? <>· Enter picks {shown[0].name} <Kbd>↵</Kbd></> : '· nobody by that name'}
        </p>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 6, rowGap: 8, paddingBottom: 4 }}>
        {shown.map((p, i) => <PersonPick key={p.id} person={p} hint={i < 9 ? String(i + 1) : null} active={pickedIds.includes(p.id)} onClick={() => keys.select(p.id)} />)}
      </div>
    </>
  );
}

// A row of small overlapping avatars, for an event's people.
export function AvatarStack({ people, size = 24, max = 4 }) {
  return (
    <span className="flex items-center" aria-hidden="true">
      {people.slice(0, max).map((p, i) => (
        <span key={p.id} style={{ marginLeft: i ? -7 : 0, borderRadius: '50%', boxShadow: `0 0 0 2px ${COLORS.paperRaised}` }}>
          <Avatar emoji={p.emoji} size={size} ringColor={getLayer(p.layer).color} />
        </span>
      ))}
    </span>
  );
}
