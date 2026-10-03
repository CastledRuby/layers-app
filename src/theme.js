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

export const CSS = `
${FONT_FACES}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
.font-display { font-family: 'Fraunces', Georgia, 'Times New Roman', serif; font-weight: 500; }
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
button { font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif; cursor: pointer; background: none; border: none; padding: 0; }
input, textarea { font-family: 'Manrope', ui-sans-serif, system-ui, sans-serif; }

.layers-root {
  ${cssVarBlock(THEME_LIGHT)}
  transition: background-color .25s ease;
}
.layers-root.dark {
  ${cssVarBlock(THEME_DARK)}
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

.nav-bar { display: flex; align-items: center; justify-content: space-around; padding: 8px 4px 12px; border-top: 1px solid ${COLORS.line}; background: ${COLORS.paperRaised}; position: relative; z-index: 10; }
.nav-btn { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 8px; border-radius: 14px; font-size: 10.5px; }

.fab-btn { position: absolute; right: 18px; bottom: 80px; width: 54px; height: 54px; border-radius: 50%; background: ${COLORS.accent}; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 24px rgba(51,80,107,0.4); z-index: 20; transition: transform .15s ease; }
.fab-btn:active { transform: scale(0.92); }

.sheet { position: absolute; inset: 0; display: flex; align-items: flex-end; justify-content: center; pointer-events: auto; }
.sheet-overlay { position: absolute; inset: 0; background: rgba(35,40,58,0.45); }
.sheet-panel { position: relative; width: 100%; max-height: 88%; display: flex; flex-direction: column; background: ${COLORS.paperRaised}; border-radius: 26px 26px 0 0; box-shadow: 0 -12px 36px rgba(35,40,58,0.2); overflow: hidden; }
.sheet-panel--tall { height: 80%; max-height: 80%; }
.sheet-body { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 4px 20px 10px; }

@keyframes sheetUp { from { transform: translateY(28px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.sheet-anim { animation: sheetUp .3s cubic-bezier(0.22,1,0.36,1); }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.fade-anim { animation: fadeIn .25s ease-out; }
@keyframes toastIn { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

@keyframes levelUpScale { 0% { transform: scale(0.85); } 35% { transform: scale(1.08); } 60% { transform: scale(0.98); } 100% { transform: scale(1); } }
@keyframes levelUpGlow { 0%, 100% { filter: drop-shadow(0 0 0 rgba(0,0,0,0)); } 40% { filter: drop-shadow(0 0 18px currentColor); } }
@keyframes levelUpBannerIn { 0% { opacity: 0; transform: translateX(-50%) translateY(6px) scale(0.9); } 15% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); } 85% { opacity: 1; } 100% { opacity: 0; transform: translateX(-50%) translateY(-4px) scale(0.95); } }
.level-up-pulse { animation: levelUpScale 0.7s cubic-bezier(0.34,1.56,0.64,1), levelUpGlow 1.4s ease-out; }
.level-up-banner { animation: levelUpBannerIn 2.6s ease-in-out forwards; }

.toast-stack { position: absolute; left: 0; right: 0; bottom: 92px; display: flex; flex-direction: column; align-items: center; gap: 8px; z-index: 70; pointer-events: none; padding: 0 20px; }
.toast { background: #23283A; color: #fff; padding: 10px 16px; border-radius: 999px; font-size: 13px; box-shadow: 0 8px 20px rgba(0,0,0,0.35); text-align: center; animation: toastIn .25s ease-out; }

button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid ${COLORS.accent}; outline-offset: 2px; }
input[type="range"] { width: 100%; }

@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 1s linear infinite; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
`;
