// The DOM node every sheet portals into (set by LayersApp). Kept apart from
// Sheet.jsx so that file only exports components (Fast Refresh).

import { createContext } from 'react';

// The .sheet-layer node rendered by LayersApp: a sibling of .phone-frame
// inside .app-shell. Sheets portal into it so they escape .phone-frame's
// overflow:hidden and any parent sheet's scrolling body (nested sheets),
// while staying inside .layers-root so the theme's --c-* variables — which
// every COLORS.x resolves through — still apply.
export const SheetLayerContext = createContext(null);
