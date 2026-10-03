// Bottom sheets and the portal they render through. See
// docs/renderer/ui-system.md ("Sheets and dialogs").

import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { SheetLayerContext, useOpenSheet } from './sheetLayer.js';
import { COLORS } from '../theme.js';

// Never fall back to document.body: content portaled outside .layers-root
// loses every theme variable and renders transparent with black text (the
// "Edit goal" bug). The layer is set by a ref callback on mount, so this only
// returns null for the single commit before it exists.
export function SheetPortal({ children }) {
  const layer = useContext(SheetLayerContext);
  return layer ? createPortal(children, layer) : null;
}

export function Sheet({ title, onClose, children, footer, tall }) {
  useOpenSheet(onClose);
  return (
    <SheetPortal>
      <div className="sheet">
        <div className="sheet-overlay" onClick={onClose} />
        <div className={`sheet-panel sheet-anim${tall ? ' sheet-panel--tall' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <p className="font-display" style={{ fontSize: 19, color: COLORS.ink }}>{title}</p>
            <button onClick={onClose} aria-label="Close" className="p-1"><X size={20} color={COLORS.inkSoft} /></button>
          </div>
          <div className="sheet-body no-scrollbar">{children}</div>
          {footer && <div style={{ padding: '14px 20px 22px', borderTop: `1px solid ${COLORS.line}` }}>{footer}</div>}
        </div>
      </div>
    </SheetPortal>
  );
}
