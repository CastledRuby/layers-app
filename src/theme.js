// Design tokens and the global stylesheet. COLORS maps each token to a CSS
// variable, so the whole app follows .layers-root / .layers-root.dark.

import { FONT_FACES } from './fonts.js';

export const THEME_LIGHT = {
  paper: '#F5F6F1',
  paperRaised: '#FFFFFF',
  ink: '#23283A',
  inkSoft: '#63697E',
  line: '#E4E3DC',
  accent: '#33506B',
  accentSoft: '#E7EEF1',
  // Text and icons on an accent background (selected chips, main buttons).
  onAccent: '#FFFFFF',
  // Big choice buttons (.tile) inside a sheet, a step off the sheet itself.
  tile: '#FAFAF7',
  // The backdrop behind an open sheet.
  overlay: 'rgba(35,40,58,0.42)',
  layer1: '#8FB8C9', layer1Tint: '#E4EEF2', layer1Deep: '#3E6C7D',
  layer2: '#6FA98C', layer2Tint: '#E4EFE8', layer2Deep: '#3B6B54',
  layer3: '#C98A5B', layer3Tint: '#F3E6DA', layer3Deep: '#8C5A34',
  layer4: '#A8455C', layer4Tint: '#F1DEE2', layer4Deep: '#7A3145',
  plum: '#7C6A94',
  teal: '#5B8A8A',
  good: '#4C7F65',
  warn: '#B08B3E',
  alert: '#A8455C',
};

export const THEME_DARK = {
  paper: '#1B1E27',
  paperRaised: '#242836',
  ink: '#EDEDE6',
  inkSoft: '#9A9FB0',
  line: '#363B4A',
  accent: '#7FA8C9',
  accentSoft: '#26313D',
  // White on the light dark-mode accent is about 2.5:1; this is about 6.5:1.
  onAccent: '#122130',
  tile: '#2A2F3E',
  overlay: 'rgba(6,8,14,0.62)',
  layer1: '#8FB8C9', layer1Tint: '#22303A', layer1Deep: '#BFE0EC',
  layer2: '#6FA98C', layer2Tint: '#1F2E28', layer2Deep: '#A9D6BE',
  layer3: '#C98A5B', layer3Tint: '#332420', layer3Deep: '#E8B98D',
  layer4: '#C97690', layer4Tint: '#33232A', layer4Deep: '#E8A9BC',
  plum: '#A08FBE',
  teal: '#7FB0B0',
  good: '#7FBFA0',
  warn: '#D9B168',
  alert: '#C97690',
};

// Every COLORS.x usage throughout the app resolves through a CSS custom
// property, so the whole app can flip between THEME_LIGHT and THEME_DARK
// (see .layers-root / .layers-root.dark in the CSS block) without any
// component needing to know which theme is active.
export const COLORS = Object.fromEntries(Object.keys(THEME_LIGHT).map(k => [k, `var(--c-${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())})`]));

function cssVarBlock(theme) {
  return Object.entries(theme).map(([k, v]) => `--c-${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}: ${v};`).join('\n  ');
}

// The app's easing: quick to start, gentle to settle.
const EASE = 'cubic-bezier(0.22,1,0.36,1)';

export const CSS = `
${FONT_FACES}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
.font-display { font-family: 'Fraunces', Georgia, 'Times New Roman', serif; font-weight: 500; letter-spacing: -0.012em; }
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
button { font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif; cursor: pointer; background: none; border: none; padding: 0; }
input, textarea { font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif; }

.layers-root {
  ${cssVarBlock(THEME_LIGHT)}
  transition: background-color .25s ease;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.layers-root.dark {
  ${cssVarBlock(THEME_DARK)}
  color-scheme: dark;
}

/* .app-shell sizes and places the phone; .phone-frame and .sheet-layer both
   fill it exactly, so sheets always line up with the frame at any window size. */
.app-shell { position: relative; width: 100%; max-width: 428px; margin: 0 auto; }
.phone-frame {
  width: 100%;
  background: ${COLORS.paper}; position: relative; overflow: hidden;
  border-radius: 0px; box-shadow: 0 0 0 1px ${COLORS.line};
  height: 100vh; display: flex; flex-direction: column;
  font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif;
  transition: background-color .25s ease;
}
.sheet-layer { position: absolute; inset: 0; z-index: 50; overflow: hidden; pointer-events: none; font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif; }
@media (min-width: 480px) {
  .app-shell { margin-top: 20px; margin-bottom: 20px; }
  .phone-frame { height: 860px; max-height: 92vh; border-radius: 40px; box-shadow: 0 0 0 1px ${COLORS.line}, 0 24px 60px rgba(35,40,58,0.16); }
  .sheet-layer { border-radius: 40px; }
}
.scroll-area { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }

/* The bottom tabs. The page you're on sits on a glowing pill with a bar on
   the top edge; the pill slides to a new tab with a little overshoot, a ring
   ripples out from it and its icon hops (BottomNav.jsx). */
.nav-bar { display: grid; grid-template-columns: repeat(5, 1fr); align-items: center; padding: 8px 6px 12px; border-top: 1px solid ${COLORS.line}; background: ${COLORS.paperRaised}; position: relative; z-index: 10; overflow: hidden; }
.nav-btn { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 4px; border-radius: 14px; font-size: 10.5px; font-weight: 500; color: ${COLORS.inkSoft}; }
.nav-btn:hover:not(.nav-btn--on) { color: ${COLORS.ink}; }
.nav-btn--on { color: ${COLORS.accent}; font-weight: 800; }
.nav-btn--on .nav-icon { animation: navHop .5s cubic-bezier(.34,1.56,.64,1); }
.nav-icon { display: flex; }
.nav-indicator { position: absolute; top: 5px; bottom: 9px; left: 6px; width: calc((100% - 12px) / 5); pointer-events: none; transition: transform .45s cubic-bezier(.34,1.35,.5,1); }
.nav-indicator::after { content: ''; position: absolute; inset: 0 7px; border-radius: 16px; background: color-mix(in srgb, ${COLORS.accent} 17%, ${COLORS.paperRaised}); box-shadow: 0 0 0 1.5px color-mix(in srgb, ${COLORS.accent} 35%, transparent), 0 6px 18px color-mix(in srgb, ${COLORS.accent} 24%, transparent); }
.nav-indicator::before { content: ''; position: absolute; top: -6px; left: 50%; width: 28px; height: 3px; margin-left: -14px; border-radius: 0 0 4px 4px; background: ${COLORS.accent}; box-shadow: 0 0 12px ${COLORS.accent}; }
.nav-ripple { position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%; border: 2px solid ${COLORS.accent}; opacity: 0; pointer-events: none; animation: navRipple .7s ease-out; }
@keyframes navHop { 0% { transform: none; } 35% { transform: translateY(-4px) scale(1.2); } 70% { transform: translateY(1px) scale(.96); } 100% { transform: none; } }
@keyframes navRipple { 0% { transform: scale(.4); opacity: .7; } 100% { transform: scale(2.2); opacity: 0; } }

/* A new page slides in from the side its tab is on (forward from the right,
   back from the left), sharpening from a blur, so it's clear where you went. */
.page-anim--fwd { animation: pageInFwd .34s cubic-bezier(.2,.8,.2,1); }
.page-anim--back { animation: pageInBack .34s cubic-bezier(.2,.8,.2,1); }
@keyframes pageInFwd { from { opacity: 0; transform: translateX(32px) scale(.985); filter: blur(5px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes pageInBack { from { opacity: 0; transform: translateX(-32px) scale(.985); filter: blur(5px); } to { opacity: 1; transform: none; filter: none; } }

/* Press and hold to confirm something that can't be undone (StartOverSheet). */
.hold-btn { position: relative; overflow: hidden; width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; border-radius: 999px; padding: 13px 18px; font-size: 14px; font-weight: 700; background: ${COLORS.layer4Tint}; color: ${COLORS.alert}; border: 1.5px solid ${COLORS.alert}; user-select: none; touch-action: none; }
.hold-btn > * { position: relative; }
.hold-btn .hold-fill { position: absolute; inset: 0; background: ${COLORS.alert}; transform: scaleX(0); transform-origin: left; transition: transform .2s ease-out; }
.hold-btn.is-holding { color: ${COLORS.paperRaised}; }
.hold-btn.is-holding .hold-fill { transform: scaleX(1); transition: transform var(--hold-ms, 1.5s) linear; }

.fab-btn { position: absolute; right: 18px; bottom: 80px; width: 54px; height: 54px; border-radius: 50%; background: ${COLORS.accent}; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 24px rgba(51,80,107,0.4); z-index: 20; transition: transform .15s ease, box-shadow .15s ease; }
.fab-btn:hover { transform: translateY(-1px); box-shadow: 0 14px 28px rgba(51,80,107,0.45); }
.fab-btn:active { transform: scale(0.92); }

/* Buttons respond to a press everywhere. Inline transforms (positioned
   avatars) win over this, so nothing is moved that shouldn't be. */
button { transition: transform .12s ease, background-color .16s ease, border-color .16s ease, color .16s ease, box-shadow .16s ease, opacity .16s ease; }
button:active:not(:disabled) { transform: scale(0.97); }
.icon-btn { width: 34px; height: 34px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.icon-btn:hover { background: color-mix(in srgb, ${COLORS.ink} 7%, transparent); }

/* Sheets. Each .sheet is its own stacking context, so nothing inside one
   (a positioned date button with a z-index, say) can paint over a sheet
   opened on top of it. */
.sheet { position: absolute; inset: 0; display: flex; align-items: flex-end; justify-content: center; pointer-events: auto; isolation: isolate; }
.sheet-overlay { position: absolute; inset: 0; background: ${COLORS.overlay}; animation: fadeIn .24s ease-out; }
.sheet-panel { position: relative; width: 100%; max-height: 88%; display: flex; flex-direction: column; background: ${COLORS.paperRaised}; color: ${COLORS.ink}; border-radius: 26px 26px 0 0; box-shadow: 0 -1px 0 color-mix(in srgb, ${COLORS.ink} 7%, transparent), 0 -16px 40px rgba(10,12,20,0.22); overflow: hidden; }
.sheet-panel--tall { height: 80%; max-height: 80%; }
.sheet-handle { width: 38px; height: 4px; border-radius: 2px; background: ${COLORS.line}; margin: 9px auto 0; flex-shrink: 0; }
.sheet-title { font-size: 20px; line-height: 1.2; color: ${COLORS.ink}; }
.sheet-body { flex: 1; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; padding: 4px 20px 12px; }
.sheet-footer { padding: 14px 20px 22px; border-top: 1px solid ${COLORS.line}; }
.sheet.is-closing { pointer-events: none; }
.sheet.is-closing .sheet-overlay { animation: fadeOut .17s ease-in forwards; }
.sheet.is-closing .sheet-panel { animation: sheetDown .17s cubic-bezier(0.4,0,1,1) forwards; }

@keyframes sheetUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes sheetDown { from { transform: translateY(0); opacity: 1; } to { transform: translateY(40px); opacity: 0; } }
.sheet-anim { animation: sheetUp .32s ${EASE}; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
.fade-anim { animation: fadeIn .25s ease-out; }
@keyframes toastIn { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

/* Moving between the steps of a sheet: forward slides in from the right,
   back from the left. */
@keyframes stepIn { from { opacity: 0; transform: translateX(22px); } to { opacity: 1; transform: none; } }
@keyframes stepBack { from { opacity: 0; transform: translateX(-22px); } to { opacity: 1; transform: none; } }
.step-in { animation: stepIn .28s ${EASE}; }
.step-back { animation: stepBack .28s ${EASE}; }

/* Big choice buttons. */
.tile { position: relative; background: ${COLORS.tile}; border: 1.5px solid ${COLORS.line}; border-radius: 18px; color: ${COLORS.ink}; transition: transform .18s ${EASE}, border-color .16s ease, background-color .16s ease, box-shadow .18s ease; }
.tile:hover:not(:disabled) { border-color: color-mix(in srgb, ${COLORS.accent} 55%, ${COLORS.line}); background: color-mix(in srgb, ${COLORS.accent} 7%, ${COLORS.tile}); transform: translateY(-2px); box-shadow: 0 8px 18px rgba(10,12,20,0.10); }
.tile:active:not(:disabled) { transform: scale(0.97); box-shadow: none; }
.tile:disabled { opacity: 0.55; cursor: default; }
.tile--accent { background: ${COLORS.accentSoft}; border-color: ${COLORS.accent}; color: ${COLORS.accent}; }
.tile-icon { width: 46px; height: 46px; border-radius: 15px; display: flex; align-items: center; justify-content: center; background: ${COLORS.accentSoft}; }

/* Small pill buttons and chips. */
.chip { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 6px 12px; font-size: 12px; font-weight: 600; background: ${COLORS.tile}; color: ${COLORS.ink}; border: 1px solid ${COLORS.line}; }
.chip:hover:not(:disabled) { border-color: color-mix(in srgb, ${COLORS.accent} 55%, ${COLORS.line}); }
.chip--on { background: ${COLORS.accentSoft}; color: ${COLORS.accent}; border-color: color-mix(in srgb, ${COLORS.accent} 45%, transparent); }
@keyframes chipIn { from { opacity: 0; transform: scale(0.88); } to { opacity: 1; transform: scale(1); } }
.chip-in { animation: chipIn .22s ${EASE}; }

/* A key you can press, shown next to what it does. */
.kbd { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 5px; font: 600 10px/1 ui-monospace, 'Cascadia Mono', Consolas, monospace; color: ${COLORS.inkSoft}; background: color-mix(in srgb, ${COLORS.ink} 5%, transparent); border: 1px solid ${COLORS.line}; border-bottom-width: 2px; flex-shrink: 0; }
.kbd--on-accent { color: ${COLORS.onAccent}; background: color-mix(in srgb, ${COLORS.onAccent} 16%, transparent); border-color: color-mix(in srgb, ${COLORS.onAccent} 35%, transparent); }
.tile > .kbd { position: absolute; top: 9px; right: 9px; }

/* A value just picked: a quick, springy pop. */
@keyframes pop { 0% { transform: scale(0.86); } 60% { transform: scale(1.08); } 100% { transform: scale(1); } }
.pop { animation: pop .3s cubic-bezier(0.34,1.56,0.64,1); }

/* A 1-5 scale ("How meaningful was it?"): one track, the pick filled in. */
.seg { display: flex; gap: 4px; padding: 4px; border-radius: 999px; background: ${COLORS.tile}; border: 1px solid ${COLORS.line}; }
.seg-btn { flex: 1; height: 38px; border-radius: 999px; font-size: 14px; font-weight: 700; color: ${COLORS.ink}; font-variant-numeric: tabular-nums; }
.seg--sm .seg-btn { height: 30px; font-size: 12px; }
.seg-btn:hover:not(.seg-btn--on) { background: color-mix(in srgb, ${COLORS.accent} 10%, transparent); }
.seg-btn--on { background: ${COLORS.accent}; color: ${COLORS.onAccent}; box-shadow: 0 4px 12px color-mix(in srgb, ${COLORS.accent} 32%, transparent); }

/* Rows in the log's detail sheets. */
.check-row:hover, .rate-row:hover { background: color-mix(in srgb, ${COLORS.accent} 6%, transparent); }

/* The main button of a sheet. */
.primary-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; border-radius: 999px; padding: 12px 18px; font-size: 14px; font-weight: 700; background: ${COLORS.accent}; color: ${COLORS.onAccent}; box-shadow: 0 6px 16px color-mix(in srgb, ${COLORS.accent} 28%, transparent); }
.primary-btn:hover:not(:disabled) { box-shadow: 0 8px 22px color-mix(in srgb, ${COLORS.accent} 38%, transparent); }
.primary-btn:disabled { background: ${COLORS.line}; color: ${COLORS.inkSoft}; box-shadow: none; cursor: default; }

/* Text boxes: a soft glow in the accent colour while you type. */
input:not([type="range"]):not([type="checkbox"]):not([type="radio"]), textarea { color: ${COLORS.ink}; background-color: ${COLORS.paperRaised}; transition: border-color .16s ease, box-shadow .16s ease; }
input::placeholder, textarea::placeholder { color: color-mix(in srgb, ${COLORS.inkSoft} 80%, transparent); }
input:focus, textarea:focus { outline: none; border-color: ${COLORS.accent} !important; box-shadow: 0 0 0 3px color-mix(in srgb, ${COLORS.accent} 20%, transparent); }

@keyframes levelUpScale { 0% { transform: scale(0.85); } 35% { transform: scale(1.08); } 60% { transform: scale(0.98); } 100% { transform: scale(1); } }
@keyframes levelUpGlow { 0%, 100% { filter: drop-shadow(0 0 0 rgba(0,0,0,0)); } 40% { filter: drop-shadow(0 0 18px currentColor); } }
@keyframes levelUpBannerIn { 0% { opacity: 0; transform: translateX(-50%) translateY(6px) scale(0.9); } 15% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); } 85% { opacity: 1; } 100% { opacity: 0; transform: translateX(-50%) translateY(-4px) scale(0.95); } }
.level-up-pulse { animation: levelUpScale 0.7s cubic-bezier(0.34,1.56,0.64,1), levelUpGlow 1.4s ease-out; }
.level-up-banner { animation: levelUpBannerIn 2.6s ease-in-out forwards; }

.toast-stack { position: absolute; left: 0; right: 0; bottom: 92px; display: flex; flex-direction: column; align-items: center; gap: 8px; z-index: 70; pointer-events: none; padding: 0 20px; }
.toast { background: #23283A; color: #fff; padding: 10px 16px; border-radius: 999px; font-size: 13px; box-shadow: 0 8px 20px rgba(0,0,0,0.35); text-align: center; animation: toastIn .25s ease-out; }
.layers-root.dark .toast { background: #EDEDE6; color: #1B1E27; }
.toast--undo { pointer-events: auto; display: flex; align-items: center; gap: 14px; padding-right: 8px; }
.toast-undo { font-weight: 800; color: #A9CBE6; padding: 4px 10px; border-radius: 999px; }
.toast-undo:hover { background: rgba(255,255,255,0.12); }
.layers-root.dark .toast-undo { color: #33506B; }
.layers-root.dark .toast-undo:hover { background: rgba(0,0,0,0.08); }

button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid ${COLORS.accent}; outline-offset: 2px; }
input:focus-visible, textarea:focus-visible { outline: none; }
input[type="range"] { width: 100%; }

@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 1s linear infinite; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
`;
