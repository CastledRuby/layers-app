// The app's two typefaces, bundled so Layers works offline and makes no
// network request on launch (they used to come from fonts.googleapis.com).
// Vite turns each import into a URL, and the single-file Electron build
// inlines them as data URIs. Latin + Latin Extended only, the subsets the UI
// uses (~160 KB in total). The families keep their plain names ('Fraunces',
// 'Manrope'), so the font-family rules in theme.js didn't change.
//
// Fraunces uses the weight + optical-size file (what the Google Fonts import
// asked for); Manrope is weight only. Source: @fontsource-variable/*, SIL OFL.
import frauncesLatin from '@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2';
import frauncesLatinExt from '@fontsource-variable/fraunces/files/fraunces-latin-ext-opsz-normal.woff2';
import manropeLatin from '@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2';
import manropeLatinExt from '@fontsource-variable/manrope/files/manrope-latin-ext-wght-normal.woff2';

const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

function face(family, weights, url, range) {
  return `@font-face { font-family: '${family}'; font-style: normal; font-display: swap; font-weight: ${weights}; src: url("${url}") format('woff2-variations'); unicode-range: ${range}; }`;
}

export const FONT_FACES = [
  face('Fraunces', '100 900', frauncesLatinExt, LATIN_EXT),
  face('Fraunces', '100 900', frauncesLatin, LATIN),
  face('Manrope', '200 800', manropeLatinExt, LATIN_EXT),
  face('Manrope', '200 800', manropeLatin, LATIN),
].join('\n');
