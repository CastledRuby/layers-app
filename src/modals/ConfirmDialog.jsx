// Confirmation dialog for destructive actions (askConfirm in LayersApp).

import { useEffect, useRef, useState } from 'react';
import { SheetPortal } from '../components/Sheet.jsx';
import { returnFocus, useOpenSheet } from '../components/sheetLayer.js';
import { COLORS } from '../theme.js';

// altLabel and onAlt: a second choice beside the main one ("Only tomorrow"
// beside "Every time").
// Focus starts on Cancel when the action can't be taken back lightly
// (danger), otherwise on the main button, so Enter does the safe thing; it
// goes back to where it was afterwards.
export function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onCancel, hideCancel, altLabel, onAlt }) {
  useOpenSheet(onCancel);
  const first = useRef(null);
  const panelRef = useRef(null);
  const [opener] = useState(() => (typeof document === 'undefined' ? null : document.activeElement));
  useEffect(() => {
    const panel = panelRef.current;
    if (first.current) first.current.focus({ preventScroll: true });
    return () => { returnFocus(opener, panel); };
  }, [opener]);
  const startOnCancel = danger && !hideCancel;
  // Portaled like Sheet so it shares its geometry and, opening last, always
  // stacks above any sheet that is already open.
  return (
    <SheetPortal>
      <div className="sheet">
        <div className="sheet-overlay" onClick={onCancel} />
        <div ref={panelRef} className="sheet-panel sheet-anim" style={{ maxHeight: 'none' }} role="alertdialog" aria-modal="true" aria-label={title}>
          <div className="sheet-handle" aria-hidden="true" />
          <div className="px-5 pt-3 pb-5">
            <p className="font-display sheet-title">{title}</p>
            <p className="text-sm mt-2" style={{ color: COLORS.inkSoft }}>{message}</p>
            <div className="flex items-center gap-2 mt-5">
              {!hideCancel && <button ref={startOnCancel ? first : undefined} onClick={onCancel} className="flex-1 text-sm font-semibold rounded-full py-3" style={{ background: COLORS.paperRaised, color: COLORS.ink, border: `1px solid ${COLORS.line}` }}>Cancel</button>}
              {onAlt && <button onClick={onAlt} className="flex-1 text-sm font-semibold rounded-full py-3" style={{ background: COLORS.paperRaised, color: danger ? COLORS.alert : COLORS.accent, border: `1px solid ${danger ? COLORS.alert : COLORS.accent}` }}>{altLabel}</button>}
              <button ref={startOnCancel ? undefined : first} onClick={onConfirm} className="flex-1 text-sm font-semibold rounded-full py-3" style={{ background: danger ? COLORS.layer4Deep : COLORS.accent, color: COLORS.onAccent }}>{confirmLabel || 'Confirm'}</button>
            </div>
          </div>
        </div>
      </div>
    </SheetPortal>
  );
}
