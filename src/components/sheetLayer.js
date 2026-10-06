// The DOM node every sheet portals into (set by LayersApp), and the stack of
// open sheets. Kept apart from Sheet.jsx so that file only exports components
// (Fast Refresh).

import { createContext, useEffect, useLayoutEffect, useRef, useState } from 'react';

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

// Registers the calling sheet while it's mounted; Esc calls its latest
// onClose. Returns the sheet's entry, so the sheet can tell whether it's the
// one on top (topSheet() === entry) before acting on a key.
export function useOpenSheet(onClose) {
  const latest = useRef(onClose);
  const [entry] = useState(() => ({ close: () => { if (latest.current) latest.current(); } }));
  useLayoutEffect(() => { latest.current = onClose; });
  useEffect(() => registerSheet(entry), [entry]);
  return entry;
}

// Back to what had focus before a sheet or dialog opened (Sheet,
// ConfirmDialog), if it's still on the page and focus hasn't gone somewhere
// else meanwhile (it's nowhere, or still inside the closed panel).
// A panel still on the page hasn't closed: that's React's StrictMode trying
// the effect twice in development, and focus stays where it is.
export function returnFocus(opener, panel) {
  if (panel && panel.isConnected) return;
  const now = document.activeElement;
  const lost = !now || now === document.body || (panel && panel.contains(now));
  if (lost && opener && opener !== document.body && opener.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
}

// Whether focus last moved by Tab rather than by a click: a clicked button
// keeps focus, and Enter shouldn't press it again.
let tabbing = false;
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => { if (e.key === 'Tab') tabbing = true; }, true);
  window.addEventListener('pointerdown', () => { tabbing = false; }, true);
  window.addEventListener('mousedown', () => { tabbing = false; }, true);
}

// True when a button was reached with Tab (not clicked): Enter then presses
// that button, so a sheet's own Enter action stays out of the way.
export function isTabbedToButton() {
  const el = document.activeElement;
  return Boolean(tabbing && el && el.tagName === 'BUTTON');
}

// True while the user is typing in a text box, where letter and number keys
// (and Enter, Backspace) belong to the text.
export function isTyping() {
  const el = document.activeElement;
  if (!el) return false;
  return el.tagName === 'TEXTAREA' || el.isContentEditable || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'range'].includes(el.type));
}

// "+" (new goal): on a US-style keyboard it's Shift and =, so plain = and the
// number pad's + count too.
export function isPlusKey(e) {
  return e.key === '+' || e.key === '=' || e.code === 'Equal' || e.code === 'NumpadAdd';
}
