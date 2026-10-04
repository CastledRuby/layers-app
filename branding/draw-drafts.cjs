// Draws the Layers branding drafts as SVG files into ./drafts/ (run: node branding/draw-drafts.cjs).
// Four directions (rings, arches, onion, overlap), each as:
//   <d>-mark.svg        the mark on a light ground (256 grid, transparent)
//   <d>-mark-dark.svg   the mark on a dark ground
//   <d>-icon.svg        the app icon, navy tile
//   <d>-icon-paper.svg  the app icon, paper tile
//   <d>-tray16-{white,ink}.svg, <d>-tray32-{white,ink}.svg   monochrome tray glyphs,
//                       drawn separately for 16 px and 32 px so each is crisp
// plus the in-app illustrations for direction A.
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'drafts');
fs.mkdirSync(OUT, { recursive: true });

// The app's own colours: navy ink, paper, and the four layer hues (Layer 1 → 4),
// a deeper set for light grounds and a brighter set for dark ones.
const NAVY = '#23283A';
const PAPER = '#F5F6F1';
const ON_LIGHT = { l1: '#5F93AA', l2: '#4F8E6E', l3: '#B87645', l4: '#A8455C' };
const ON_DARK = { l1: '#8FB8C9', l2: '#6FA98C', l3: '#D39462', l4: '#D07E97' };
const MONO = { white: '#FFFFFF', ink: '#1F2433' };

const svg = (size, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">\n${body}\n</svg>\n`;
const ring = (cx, cy, r, w, color) => `  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${w}"/>`;
const dot = (cx, cy, r, color) => `  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`;
const tile = (fill, stroke) => `  <rect x="0" y="0" width="256" height="256" rx="56" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="2"` : ''}/>`;
// Scale a 256-grid mark about a point so it sits inside an icon tile.
const fit = (body, s, cy = 128) => `  <g transform="translate(128 128) scale(${s}) translate(-128 -${cy})">\n${body}\n  </g>`;
const f = (n) => +n.toFixed(2);

// A: concentric rings, the onion model seen from above (and the People view's rings).
const rings = {
  mark: (c) => [ring(128, 128, 104, 18, c.l1), ring(128, 128, 76, 18, c.l2), ring(128, 128, 48, 18, c.l3), dot(128, 128, 20, c.l4)].join('\n'),
  iconScale: 0.82, cy: 128,
  small: (c) => [ring(128, 128, 86, 24, c.l1), ring(128, 128, 46, 24, c.l3), dot(128, 128, 16, c.l4)].join('\n'),
  tray16: (m) => [ring(8, 8, 6.25, 1.5, m), dot(8, 8, 2.4, m)].join('\n'),
  tray32: (m) => [ring(16, 16, 13, 2.5, m), ring(16, 16, 7.5, 2.5, m), dot(16, 16, 3, m)].join('\n'),
};

// B: nested arches, a doorway into closer layers; the filled one is Layer 4.
const arch = (cx, cy, r, base, w, color) => `  <path d="M${f(cx - r)} ${base} V${cy} A${r} ${r} 0 0 1 ${f(cx + r)} ${cy} V${base}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const door = (cx, cy, r, base, color) => `  <path d="M${f(cx - r)} ${base} V${cy} A${r} ${r} 0 0 1 ${f(cx + r)} ${cy} V${base} Z" fill="${color}"/>`;
const arches = {
  mark: (c) => [arch(128, 124, 100, 226, 18, c.l1), arch(128, 124, 72, 226, 18, c.l2), arch(128, 124, 44, 226, 18, c.l3), door(128, 124, 22, 226, c.l4)].join('\n'),
  iconScale: 0.76, cy: 125,
  small: (c) => [arch(128, 124, 92, 226, 26, c.l1), door(128, 130, 34, 226, c.l4)].join('\n'),
  tray16: (m) => [arch(8, 7.5, 6, 14.5, 1.5, m), door(8, 8.5, 2.5, 14.5, m)].join('\n'),
  tray32: (m) => [arch(16, 14, 12.5, 29, 2.5, m), arch(16, 14, 7, 29, 2.5, m), door(16, 16, 2.75, 29, m)].join('\n'),
};

// C: an onion (or a bud) cut through: nested layers around a core.
function onionPath(cx, cy, R) {
  const d = 1.9 * R;
  return `M${f(cx)} ${f(cy - d)} C${f(cx + 0.28 * R)} ${f(cy - d + 0.62 * R)} ${f(cx + R)} ${f(cy - 0.95 * R)} ${f(cx + R)} ${f(cy)} A${f(R)} ${f(R)} 0 0 1 ${f(cx - R)} ${f(cy)} C${f(cx - R)} ${f(cy - 0.95 * R)} ${f(cx - 0.28 * R)} ${f(cy - d + 0.62 * R)} ${f(cx)} ${f(cy - d)} Z`;
}
const onionLine = (cx, cy, R, w, color) => `  <path d="${onionPath(cx, cy, R)}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linejoin="round"/>`;
const onionFill = (cx, cy, R, color) => `  <path d="${onionPath(cx, cy, R)}" fill="${color}"/>`;
const ONION_CY = 128 + 0.45 * 66;
const onion = {
  mark: (c) => [onionLine(128, ONION_CY, 66, 11, c.l1), onionLine(128, ONION_CY, 48, 11, c.l2), onionLine(128, ONION_CY, 30, 11, c.l3), onionFill(128, ONION_CY, 13, c.l4)].join('\n'),
  iconScale: 0.8, cy: 128,
  small: (c) => [onionLine(128, ONION_CY, 64, 20, c.l1), onionFill(128, ONION_CY, 26, c.l4)].join('\n'),
  tray16: (m) => [onionLine(8, 8 + 0.45 * 4.4, 4.4, 1.4, m), onionFill(8, 8 + 0.45 * 4.4, 1.9, m)].join('\n'),
  tray32: (m) => [onionLine(16, 16 + 0.45 * 9.6, 9.6, 2.4, m), onionFill(16, 16 + 0.45 * 9.6, 4.2, m)].join('\n'),
};

// D: two people overlapping; the shared part is filled.
function lens(cxL, cxR, cy, r) {
  const half = (cxR - cxL) / 2;
  const h = Math.sqrt(r * r - half * half);
  const x = (cxL + cxR) / 2;
  return `M${f(x)} ${f(cy - h)} A${r} ${r} 0 0 1 ${f(x)} ${f(cy + h)} A${r} ${r} 0 0 1 ${f(x)} ${f(cy - h)} Z`;
}
const overlap = {
  mark: (c) => [`  <path d="${lens(94, 162, 128, 66)}" fill="${c.l4}"/>`, ring(94, 128, 66, 16, c.l1), ring(162, 128, 66, 16, c.l3)].join('\n'),
  iconScale: 0.8, cy: 128,
  small: (c) => [`  <path d="${lens(94, 162, 128, 66)}" fill="${c.l4}"/>`, ring(94, 128, 66, 22, c.l1), ring(162, 128, 66, 22, c.l3)].join('\n'),
  tray16: (m) => [`  <path d="${lens(5.6, 10.4, 8, 4.4)}" fill="${m}"/>`, ring(5.6, 8, 4.4, 1.4, m), ring(10.4, 8, 4.4, 1.4, m)].join('\n'),
  tray32: (m) => [`  <path d="${lens(11.2, 20.8, 16, 9)}" fill="${m}"/>`, ring(11.2, 16, 9, 2.4, m), ring(20.8, 16, 9, 2.4, m)].join('\n'),
};

const DIRECTIONS = { rings, arches, onion, overlap };
const write = (name, content) => fs.writeFileSync(path.join(OUT, name), content);

for (const [key, d] of Object.entries(DIRECTIONS)) {
  write(`${key}-mark.svg`, svg(256, d.mark(ON_LIGHT)));
  write(`${key}-mark-dark.svg`, svg(256, d.mark(ON_DARK)));
  write(`${key}-icon.svg`, svg(256, [tile(NAVY), fit(d.mark(ON_DARK), d.iconScale, d.cy)].join('\n')));
  write(`${key}-icon-small.svg`, svg(256, [tile(NAVY), fit(d.small(ON_DARK), d.iconScale, d.cy)].join('\n')));
  write(`${key}-icon-paper.svg`, svg(256, [tile(PAPER, '#E4E3DC'), fit(d.mark(ON_LIGHT), d.iconScale, d.cy)].join('\n')));
  for (const [tone, color] of Object.entries(MONO)) {
    write(`${key}-tray16-${tone}.svg`, svg(16, d.tray16(color)));
    write(`${key}-tray32-${tone}.svg`, svg(32, d.tray32(color)));
  }
}

// In-app illustrations for direction A.
const TINT = { l1: '#E4EEF2', l2: '#E4EFE8', l3: '#F3E6DA', l4: '#F1DEE2' };
const wide = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n${body}\n</svg>\n`;

// Empty People view: the rings drawn dashed, waiting; you at the centre and
// one empty seat on the outer ring.
write('empty-people.svg', wide(320, 220, [
  `  <circle cx="160" cy="110" r="100" fill="none" stroke="${ON_LIGHT.l1}" stroke-width="2.5" stroke-dasharray="2 9" stroke-linecap="round"/>`,
  `  <circle cx="160" cy="110" r="74" fill="none" stroke="${ON_LIGHT.l2}" stroke-width="2.5" stroke-dasharray="2 9" stroke-linecap="round"/>`,
  `  <circle cx="160" cy="110" r="48" fill="none" stroke="${ON_LIGHT.l3}" stroke-width="2.5" stroke-dasharray="2 9" stroke-linecap="round"/>`,
  `  <circle cx="160" cy="110" r="22" fill="none" stroke="${ON_LIGHT.l4}" stroke-width="2.5" stroke-dasharray="2 9" stroke-linecap="round"/>`,
  dot(160, 110, 9, NAVY),
  `  <circle cx="230.7" cy="39.3" r="15" fill="#FFFFFF" stroke="${ON_LIGHT.l1}" stroke-width="2.5" stroke-dasharray="4 4"/>`,
  `  <path d="M230.7 33.3 V45.3 M224.7 39.3 H236.7" stroke="${ON_LIGHT.l1}" stroke-width="2.5" stroke-linecap="round"/>`,
].join('\n')));

// Onboarding: the four layers as soft discs, people placed on them.
const person = (cx, cy, color) => `  <circle cx="${cx}" cy="${cy}" r="11" fill="${color}" stroke="#FFFFFF" stroke-width="3"/>`;
const at = (r, deg) => [f(180 + r * Math.cos((deg * Math.PI) / 180)), f(120 + r * Math.sin((deg * Math.PI) / 180))];
write('onboarding-hero.svg', wide(360, 240, [
  dot(180, 120, 112, TINT.l1), dot(180, 120, 84, TINT.l2), dot(180, 120, 56, TINT.l3), dot(180, 120, 28, TINT.l4),
  dot(180, 120, 9, NAVY),
  person(...at(98, -35), ON_LIGHT.l1), person(...at(98, 160), ON_LIGHT.l1),
  person(...at(70, 40), ON_LIGHT.l2), person(...at(42, -120), ON_LIGHT.l3), person(...at(16, 75), ON_LIGHT.l4),
].join('\n')));

// Installer sidebar art (164 × 314): big rings rising from the bottom corner.
write('installer-sidebar.svg', wide(164, 314, [
  `  <rect width="164" height="314" fill="${NAVY}"/>`,
  ring(140, 300, 150, 16, ON_DARK.l1), ring(140, 300, 118, 16, ON_DARK.l2), ring(140, 300, 86, 16, ON_DARK.l3), dot(140, 300, 40, ON_DARK.l4),
].join('\n')));

console.log(fs.readdirSync(OUT).length, 'files in', OUT);
