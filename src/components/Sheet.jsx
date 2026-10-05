// Bottom sheets and the portal they render through. See
// docs/renderer/ui-system.md ("Sheets and dialogs").

import { useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, X } from 'lucide-react';
import { isTyping, SheetLayerContext, topSheet, useOpenSheet } from './sheetLayer.js';
import { COLORS } from '../theme.js';

// Never fall back to document.body: content portaled outside .layers-root
// loses every theme variable and renders transparent with black text (the
// "Edit goal" bug). The layer is set by a ref callback on mount, so this only
// returns null for the single commit before it exists.
export function SheetPortal({ children }) {
  const layer = useContext(SheetLayerContext);
  return layer ? createPortal(children, layer) : null;
}

// How long the closing slide takes (.sheet.is-closing in theme.js).
const CLOSE_MS = 170;
const animate = () => typeof window.matchMedia === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// - onBack: shows a back arrow before the title.
// - onKey(e): keydown while this sheet is the top one (not while a sheet
//   opened over it is showing). Esc is handled for every sheet already.
//   In a sheet with keys, Esc or Tab in a text box leaves the box, so its
//   keys work again; the next Esc closes the sheet.
// - tall: a fixed 80% height, for sheets whose content changes (steps).
// Closing by X, the backdrop or Esc slides the sheet away first; a parent
// that unmounts it directly (after saving) closes it at once.
export function Sheet({ title, onClose, onBack, onKey, children, footer, tall }) {
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  function requestClose() {
    if (closingRef.current) return;
    if (!animate()) { onClose(); return; }
    closingRef.current = true;
    setClosing(true);
    // If the parent keeps the sheet open after all, show it again.
    timer.current = setTimeout(() => { onClose(); closingRef.current = false; setClosing(false); }, CLOSE_MS);
  }
  const entry = useOpenSheet(requestClose);

  const keyHandler = useRef(onKey);
  useEffect(() => { keyHandler.current = onKey; });
  const hasKeys = Boolean(onKey);
  useEffect(() => {
    if (!hasKeys) return;
    // A key something already handled (Enter in a text box that then closed
    // a sheet, say) isn't handled again by the sheet that's now on top.
    function handle(e) {
      if (e.defaultPrevented || topSheet() !== entry || closingRef.current || !keyHandler.current) return;
      if (e.key === 'Tab' && !e.shiftKey && isTyping()) { e.preventDefault(); document.activeElement.blur(); return; }
      keyHandler.current(e);
    }
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [hasKeys, entry]);

  return (
    <SheetPortal>
      <div className={`sheet${closing ? ' is-closing' : ''}`}>
        <div className="sheet-overlay" onClick={requestClose} />
        <div className={`sheet-panel sheet-anim${tall ? ' sheet-panel--tall' : ''}`} role="dialog" aria-modal="true" aria-label={title} data-keys={hasKeys ? '' : undefined}>
          <div className="sheet-handle" aria-hidden="true" />
          <div className="flex items-center gap-1.5 px-5 pt-3 pb-3">
            {onBack && (
              <button type="button" onClick={onBack} aria-label="Back" className="icon-btn -ml-2"><ChevronLeft size={20} color={COLORS.inkSoft} /></button>
            )}
            <p className="font-display sheet-title flex-1 min-w-0">{title}</p>
            <button type="button" onClick={requestClose} aria-label="Close" className="icon-btn -mr-2"><X size={19} color={COLORS.inkSoft} /></button>
          </div>
          <div className="sheet-body no-scrollbar">{children}</div>
          {footer && <div className="sheet-footer">{footer}</div>}
        </div>
      </div>
    </SheetPortal>
  );
}
