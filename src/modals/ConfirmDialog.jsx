// Confirmation dialog for destructive actions (askConfirm in LayersApp).

import { SheetPortal } from '../components/Sheet.jsx';
import { COLORS } from '../theme.js';

export function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onCancel }) {
  // Portaled like Sheet so it shares its geometry and, opening last, always
  // stacks above any sheet that is already open.
  return (
    <SheetPortal>
      <div className="sheet">
        <div className="sheet-overlay" onClick={onCancel} />
        <div className="sheet-panel sheet-anim" style={{ maxHeight: 'none' }} role="alertdialog" aria-modal="true" aria-label={title}>
          <div className="px-5 pt-5 pb-5">
            <p className="font-display" style={{ fontSize: 19, color: COLORS.ink }}>{title}</p>
            <p className="text-sm mt-2" style={{ color: COLORS.inkSoft }}>{message}</p>
            <div className="flex items-center gap-2 mt-5">
              <button onClick={onCancel} className="flex-1 text-sm font-semibold rounded-full py-3" style={{ background: COLORS.paperRaised, color: COLORS.ink, border: `1px solid ${COLORS.line}` }}>Cancel</button>
              <button onClick={onConfirm} className="flex-1 text-sm font-semibold rounded-full py-3" style={{ background: danger ? COLORS.layer4Deep : COLORS.accent, color: '#fff' }}>{confirmLabel || 'Confirm'}</button>
            </div>
          </div>
        </div>
      </div>
    </SheetPortal>
  );
}
