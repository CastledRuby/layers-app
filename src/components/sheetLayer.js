// The DOM node every sheet portals into (set by LayersApp), and the stack of
// open sheets. Kept apart from Sheet.jsx so that file only exports components
// (Fast Refresh).

import { createContext, useEffect, useLayoutEffect, useRef } from 'react';

// The .sheet-layer node rendered by LayersApp: a sibling of .phone-frame
// inside .app-shell. Sheets portal into it so they escape .phone-frame's
// overflow:hidden and any parent sheet's scrolling body (nested sheets),
// while staying inside .layers-root so the theme's --c-* variables — which
// every COLORS.x resolves through — still apply.
export const SheetLayerContext = createContext(null);

// Every open Sheet and ConfirmDialog, oldest first. Esc closes only the top
// one, and keyboard shortcuts stay off while any is open. LayersApp used to
// keep its own list of which sheets were open, which missed sheets owned by
// a screen ("Prepare to talk", Home's detail picker) and closed a whole
// dialog when Esc was meant for a picker opened inside it.
const openSheets = [];

// `entry.close` is read when Esc is pressed, so callers can update it.
export function registerSheet(entry) {
  openSheets.push(entry);
  return () => {
    const i = openSheets.lastIndexOf(entry);
    if (i !== -1) openSheets.splice(i, 1);
  };
}

export function topSheet() { return openSheets[openSheets.length - 1] || null; }

export function hasOpenSheet() { return openSheets.length > 0; }

// Registers the calling sheet while it's mounted; Esc calls its latest onClose.
export function useOpenSheet(onClose) {
  const latest = useRef(onClose);
  useLayoutEffect(() => { latest.current = onClose; });
  useEffect(() => registerSheet({ close: () => { if (latest.current) latest.current(); } }), []);
}
