// Keyboard shortcuts reference (opened with ?).

import { Sheet } from '../components/Sheet.jsx';
import { SHORTCUTS } from '../data/constants.js';
import { COLORS } from '../theme.js';

function ShortcutKey({ label }) {
  return <span style={{ display: 'inline-block', minWidth: 22, textAlign: 'center', padding: '3px 7px', borderRadius: 7, background: COLORS.paper, border: `1px solid ${COLORS.line}`, fontSize: 11, fontWeight: 700, color: COLORS.ink, fontFamily: 'monospace' }}>{label}</span>;
}

export function ShortcutsModal({ onClose }) {
  return (
    <Sheet title="Keyboard shortcuts" onClose={onClose}>
      <div className="flex flex-col gap-1">
        {SHORTCUTS.map((s, i) => (
          <div key={i} className="flex items-center justify-between py-2.5" style={{ borderBottom: i < SHORTCUTS.length - 1 ? `1px solid ${COLORS.line}` : 'none' }}>
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
      </div>
      <p className="text-xs mt-4" style={{ color: COLORS.inkSoft }}>Shortcuts are disabled while you're typing in a text field, and only active once you've finished onboarding.</p>
    </Sheet>
  );
}
