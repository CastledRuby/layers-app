// A tappable person (avatar and name) for "who" steps: the quick log and
// planning. Their ring shows their layer; a tick shows they're picked, and an
// outline that the arrow keys are on them.
// PeopleGrid lays them out with their number keys and what's been typed to
// find someone (usePeopleKeys in peopleKeys.js).

import { Check } from 'lucide-react';
import { Avatar, Kbd } from './atoms.jsx';
import { getLayer } from '../data/constants.js';
import { COLORS } from '../theme.js';

export function PersonPick({ person, active, onClick, size = 48, hint, cursor }) {
  const l = getLayer(person.layer);
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`flex flex-col items-center gap-1 shrink-0 rounded-2xl py-1.5${cursor ? ' pick-cursor' : ''}`} style={{ width: 64 }}>
      <span style={{ position: 'relative', display: 'inline-block' }} className={active ? 'pop' : ''}>
        {hint && <span className="pick-key" aria-hidden="true">{hint}</span>}
        <Avatar person={person} size={size} ringColor={active ? COLORS.accent : l.color} />
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

// Everyone to pick from, closest first and numbered 1-9, narrowed by what's
// been typed. With more than nine people, the line above says how to reach
// the rest: type a name, or the arrows and Space.
export function PeopleGrid({ keys, pickedIds }) {
  const { query, shown, cursor, attachGrid } = keys;
  const target = shown[cursor ?? 0];
  return (
    <>
      {query ? (
        <p className="text-xs mb-2 flex items-center gap-1.5" style={{ color: COLORS.inkSoft }} aria-live="polite">
          Finding <span className="chip chip--on" style={{ padding: '1px 8px', fontSize: 12 }}>{query}</span>
          {target ? <>· Enter picks {target.name} <Kbd>↵</Kbd></> : '· nobody by that name'}
        </p>
      ) : shown.length > 9 && (
        <p className="keys-hint text-xs mb-2 flex items-center gap-1 flex-wrap" style={{ color: COLORS.inkSoft }}>
          <Kbd>1</Kbd>–<Kbd>9</Kbd> the first nine · the rest: type a name, or <Kbd>←</Kbd><Kbd>→</Kbd> then <Kbd>Space</Kbd>
        </p>
      )}
      <div ref={attachGrid} style={{ display: 'flex', flexWrap: 'wrap', columnGap: 6, rowGap: 8, paddingBottom: 4 }}>
        {shown.map((p, i) => <PersonPick key={p.id} person={p} hint={i < 9 ? String(i + 1) : null} cursor={i === cursor} active={pickedIds.includes(p.id)} onClick={() => keys.select(p.id)} />)}
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
          <Avatar person={p} size={size} ringColor={getLayer(p.layer).color} />
        </span>
      ))}
    </span>
  );
}
