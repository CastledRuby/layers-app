// Confirmation dialog for destructive actions (askConfirm in LayersApp).

import { SheetPortal } from '../components/Sheet.jsx';
import { useOpenSheet } from '../components/sheetLayer.js';
import { COLORS } from '../theme.js';

// altLabel and onAlt: a second choice beside the main one ("Only tomorrow"
// beside "Every time").
export function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onCancel, hideCancel, altLabel, onAlt }) {
  useOpenSheet(onCancel);
  // Portaled like Sheet so it shares its geometry and, opening last, always
  // stacks above any sheet that is already open.
  return (
    <SheetPortal>
      <div className="sheet">
        <div className="sheet-overlay" onClick={onCancel} />
        <div className="sheet-panel sheet-anim" style={{ maxHeight: 'none' }} role="alertdialog" aria-modal="true" aria-label={title}>
          <div className="sheet-handle" aria-hidden="true" />
          <div className="px-5 pt-3 pb-5">
            <p className="font-display sheet-title">{title}</p>
            <p className="text-sm mt-2" style={{ color: COLORS.inkSoft }}>{message}</p>
            <div className="flex items-center gap-2 mt-5">
              {!hideCancel && <button onClick={onCancel} className="flex-1 text-sm font-semibold rounded-full py-3" style={{ background: COLORS.paperRaised, color: COLORS.ink, border: `1px solid ${COLORS.line}` }}>Cancel</button>}
              {onAlt && <button onClick={onAlt} className="flex-1 text-sm font-semibold rounded-full py-3" style={{ background: COLORS.paperRaised, color: danger ? COLORS.alert : COLORS.accent, border: `1px solid ${danger ? COLORS.alert : COLORS.accent}` }}>{altLabel}</button>}
              <button onClick={onConfirm} className="flex-1 text-sm font-semibold rounded-full py-3" style={{ background: danger ? COLORS.layer4Deep : COLORS.accent, color: COLORS.onAccent }}>{confirmLabel || 'Confirm'}</button>
            </div>
          </div>
        </div>
      </div>
    </SheetPortal>
  );
}
