// Keyboard shortcuts reference (opened with ?, or a sheet's ? button). Since
// 2026-10-11 it starts with the keys for where you are (`here`: the sheet on
// top, a profile or the tab, as each shortcut's `where` in SHORTCUTS says),
// then the ones that work everywhere, then the rest.

import { Sheet } from '../components/Sheet.jsx';
import { SHORTCUTS } from '../data/constants.js';
import { COLORS } from '../theme.js';

const HERE_NAMES = {
  today: 'Today', people: 'People', person: 'A profile', coach: 'Coach', journal: 'Journal', me: 'Me',
  plan: 'Planning', log: 'Logging', event: 'This plan', day: 'This day', goal: 'A goal', info: 'Adding info',
  avatar: 'Picking an avatar', setup: 'Setting up', jump: 'Ctrl+K', queue: 'Ready to review', review: 'Your week',
};

function ShortcutKey({ label }) {
  return <span style={{ display: 'inline-block', minWidth: 22, textAlign: 'center', padding: '3px 7px', borderRadius: 7, background: COLORS.paper, border: `1px solid ${COLORS.line}`, fontSize: 11, fontWeight: 700, color: COLORS.ink, fontFamily: 'monospace' }}>{label}</span>;
}

function Group({ title, list }) {
  if (!list.length) return null;
  return (
    <section aria-label={title} className="mb-3">
      <p className="text-xs font-bold mt-2 mb-1" style={{ color: COLORS.inkSoft, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{title}</p>
      {list.map((s, i) => (
        <div key={i} className="flex items-center justify-between py-2.5" style={{ borderBottom: i < list.length - 1 ? `1px solid ${COLORS.line}` : 'none' }}>
          <p className="text-sm" style={{ color: COLORS.ink }}>{s.desc}</p>
          <div className="flex items-center gap-1 shrink-0 ml-3">
            {s.keys.map((k, ki) => (
              <span key={ki} className="flex items-center gap-1">
                <ShortcutKey label={k} />
                {ki < s.keys.length - 1 && <span style={{ color: COLORS.inkSoft, fontSize: 11 }}>{s.or ? '/' : '+'}</span>}
              </span>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

export function ShortcutsModal({ here = null, onClose }) {
  const isHere = (s) => !!here && (s.where || []).includes(here);
  const everywhere = (s) => (s.where || ['everywhere']).includes('everywhere');
  const hereList = SHORTCUTS.filter(isHere);
  const everywhereList = SHORTCUTS.filter(s => !isHere(s) && everywhere(s));
  const rest = SHORTCUTS.filter(s => !isHere(s) && !everywhere(s));
  return (
    <Sheet title="Keyboard shortcuts" onClose={onClose}>
      <Group title={hereList.length ? `Here: ${HERE_NAMES[here] || here}` : ''} list={hereList} />
      <Group title="Everywhere" list={everywhereList} />
      <Group title={hereList.length ? 'Everything else' : 'On each screen'} list={rest} />
      <p className="text-xs mt-4" style={{ color: COLORS.inkSoft }}>Shortcuts are disabled while you're typing in a text field, and only active once you've finished onboarding. In a sheet, ? (or its ? button) shows its keys first.</p>
    </Sheet>
  );
}
