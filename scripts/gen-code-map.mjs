// Generates docs/generated/code-map.md: a line-numbered index of every
// renderer source file under src/ (components with their props and who
// renders them, functions, constants), the Electron IPC surface and the
// npm scripts. Hand-written docs describe *what* things are and link here
// for *where* they are, and this file is rebuilt from source instead of
// drifting.
//
//   npm run docs:map          regenerate
//   npm run docs:map -- --check   exit 1 if the committed map is stale
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (p) => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n');
const OUT = 'docs/generated/code-map.md';
// Links are relative to docs/generated/.
const link = (file, line) => `[${file.split('/').pop()}:${line}](../../${file}#L${line})`;
const fileLink = (file) => `[${file.replace(/^src\//, '')}](../../${file})`;

/* ---------- src/ ---------- */

function walk(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap(e => {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) return walk(p);
    return /\.jsx?$/.test(e.name) && !/\.test\.jsx?$/.test(e.name) ? [p] : [];
  });
}
// main.jsx and App.jsx first, then folders in dependency order.
const ORDER = ['src/main.jsx', 'src/App.jsx', 'src/theme.js', 'src/data/', 'src/lib/', 'src/components/', 'src/modals/', 'src/views/'];
const rank = (f) => { const i = ORDER.findIndex(o => f === o || f.startsWith(o)); return i < 0 ? ORDER.length : i; };
const files = walk('src').sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
const fileLines = Object.fromEntries(files.map(f => [f, read(f).split('\n')]));

// Top-level declarations only (column 0, optionally exported), so nested
// helpers inside components don't show up as their own entries.
const decls = [];
for (const file of files) {
  fileLines[file].forEach((text, i) => {
    const line = i + 1;
    const exported = text.startsWith('export ');
    const fn = text.match(/^(?:export )?function (\w+)\s*\((.*)/);
    if (fn) { decls.push({ file, name: fn[1], line, exported, kind: /^[A-Z]/.test(fn[1]) ? 'component' : 'function', props: parseProps(fn[2]) }); return; }
    const c = text.match(/^(?:export )?(?:const|let) (\w+)\s*=/);
    if (c) decls.push({ file, name: c[1], line, exported, kind: /^[A-Z][A-Z0-9_]*$/.test(c[1]) ? 'constant' : (/^[A-Z]/.test(c[1]) ? 'component' : 'function'), props: [] });
  });
}

// "({ a, b = 1, c })" -> ['a', 'b', 'c']; tolerates defaults containing
// commas/braces by only splitting at brace depth 1.
function parseProps(rest) {
  const start = rest.indexOf('{');
  if (start !== 0) return [];
  const names = [];
  let depth = 0, cur = '';
  for (const ch of rest) {
    if (ch === '{' || ch === '(' || ch === '[') { depth++; if (depth === 1) continue; }
    if (ch === '}' || ch === ')' || ch === ']') { depth--; if (depth === 0) break; }
    if (ch === ',' && depth === 1) { names.push(cur); cur = ''; continue; }
    if (depth >= 1) cur += ch;
  }
  names.push(cur);
  return names.map(s => s.trim().split(/[=:\s]/)[0]).filter(Boolean);
}

function ownerOf(file, line) {
  let owner = null;
  for (const d of decls) if (d.file === file && d.line <= line) owner = d;
  return owner ? owner.name : null;
}

// Where each component is rendered: every `<Name` / `<Name.Provider`
// occurrence, attributed to the top-level declaration that contains it.
const components = decls.filter(d => d.kind === 'component');
const usedBy = Object.fromEntries(components.map(c => [c.name, new Set()]));
for (const file of files) {
  fileLines[file].forEach((text, i) => {
    for (const m of text.matchAll(/<([A-Z]\w*)[\s/>.]/g)) {
      if (!usedBy[m[1]]) continue;
      const owner = ownerOf(file, i + 1) || file.split('/').pop();
      if (owner !== m[1]) usedBy[m[1]].add(owner);
    }
  });
}

// Local imports per file, for the file table.
const importsOf = Object.fromEntries(files.map(f => [f, [...read(f).matchAll(/^import .* from '(\.[^']+)';$/gm)].map(m => m[1])]));

// Names the unit tests import.
const testedExports = readdirSync(join(root, 'src'))
  .filter(n => /\.test\.jsx?$/.test(n))
  .flatMap(n => [...read(`src/${n}`).matchAll(/import\s*\{([^}]+)\}\s*from/g)])
  .flatMap(m => m[1].split(',').map(s => s.trim()).filter(Boolean));

/* ---------- Electron ---------- */

const MAIN = 'electron/main.cjs';
const PRELOAD = 'electron/preload.cjs';
const mainLines = read(MAIN).split('\n');
const ipcMain = [];
mainLines.forEach((text, i) => {
  for (const m of text.matchAll(/ipcMain\.(handle|on)\('([\w-]+)'/g)) ipcMain.push({ channel: m[2], how: m[1] === 'handle' ? 'invoke → handle' : 'send → on', line: i + 1 });
  for (const m of text.matchAll(/webContents\.send\('([\w-]+)'/g)) ipcMain.push({ channel: m[1], how: 'main → renderer push', line: i + 1 });
});
const preloadLines = read(PRELOAD).split('\n');
const bridges = [];
let bridge = null;
preloadLines.forEach((text, i) => {
  const b = text.match(/exposeInMainWorld\('(\w+)'/);
  if (b) { bridge = b[1]; return; }
  const m = text.match(/^\s+(\w+):\s*\(/);
  if (m && bridge) {
    // The channel is often on the same line; otherwise look a few lines ahead.
    const ahead = preloadLines.slice(i, i + 4).join(' ');
    const ch = ahead.match(/ipcRenderer\.(?:invoke|send|on)\('([\w-]+)'/);
    bridges.push({ api: `window.${bridge}.${m[1]}`, channel: ch ? ch[1] : '—', line: i + 1 });
  }
});

/* ---------- package.json ---------- */

const pkg = JSON.parse(read('package.json'));

/* ---------- render ---------- */

const out = [];
const totalLines = files.reduce((n, f) => n + fileLines[f].length, 0);
out.push('# Code map (generated)', '');
out.push('> **Auto-generated by `scripts/gen-code-map.mjs` — do not edit by hand.**');
out.push('> Run `npm run docs:map` after changing anything under `src/`, `electron/*.cjs` or `package.json` scripts.');
out.push('> Hand-written explanations live in the other files under [`docs/`](../README.md).', '');
out.push(`Package: \`${pkg.name}\` v${pkg.version} · \`src/\`: ${files.length} files, ${totalLines} lines, ${components.length} components, ${decls.filter(d => d.kind === 'function').length} top-level functions, ${decls.filter(d => d.kind === 'constant').length} constants.`, '');

out.push('## Source files', '');
out.push('| File | Lines | Declares | Imports from |', '|---|---|---|---|');
files.forEach(f => {
  const inside = decls.filter(d => d.file === f).map(d => d.name);
  const shown = inside.length > 10 ? inside.slice(0, 10).join(', ') + `, … (+${inside.length - 10})` : (inside.join(', ') || '—');
  const deps = importsOf[f].map(p => `\`${posix.join(posix.dirname(f), p).replace(/^src\//, '').replace(/\.jsx?$/, '')}\``).join(', ') || '—';
  out.push(`| ${fileLink(f)} | ${fileLines[f].length} | ${shown} | ${deps} |`);
});
out.push('');

out.push('## Components', '');
out.push('| Component | Defined | Props | Rendered by |', '|---|---|---|---|');
components.forEach(c => {
  const by = [...usedBy[c.name]];
  out.push(`| \`${c.name}\` | ${link(c.file, c.line)} | ${c.props.length ? c.props.map(p => `\`${p}\``).join(', ') : '—'} | ${by.length ? by.map(b => `\`${b}\``).join(', ') : '—'} |`);
});
out.push('');

out.push('## Functions', '');
out.push('| Function | Defined | Exported | Unit-tested |', '|---|---|---|---|');
decls.filter(d => d.kind === 'function').forEach(d => out.push(`| \`${d.name}\` | ${link(d.file, d.line)} | ${d.exported ? '✓' : ''} | ${testedExports.includes(d.name) ? '✓' : ''} |`));
out.push('');

out.push('## Constants', '');
out.push('| Constant | Defined |', '|---|---|');
decls.filter(d => d.kind === 'constant').forEach(d => out.push(`| \`${d.name}\` | ${link(d.file, d.line)} |`));
out.push('');

out.push('## Electron IPC', '');
out.push('### Main process channels', '');
out.push('| Channel | Direction | Defined |', '|---|---|---|');
ipcMain.forEach(c => out.push(`| \`${c.channel}\` | ${c.how} | ${link(MAIN, c.line)} |`));
out.push('');
out.push('### Preload bridges (what the renderer can call)', '');
out.push('| Renderer API | IPC channel | Defined |', '|---|---|---|');
bridges.forEach(b => out.push(`| \`${b.api}()\` | \`${b.channel}\` | ${link(PRELOAD, b.line)} |`));
out.push('');
// A channel used on only one side is dead code or a missing handler.
const mainChannels = new Set(ipcMain.map(c => c.channel));
const preloadChannels = new Set(bridges.map(b => b.channel).filter(c => c !== '—'));
const orphans = [
  ...[...preloadChannels].filter(c => !mainChannels.has(c)).map(c => `\`${c}\` is used in preload.cjs but never handled or sent by main.cjs`),
  ...[...mainChannels].filter(c => !preloadChannels.has(c)).map(c => `\`${c}\` is defined in main.cjs but not exposed by preload.cjs`),
];
out.push('### Channel mismatches', '');
out.push(...(orphans.length ? orphans.map(o => `- ⚠️ ${o}`) : ['None — every channel is wired on both sides.']));
out.push('');

out.push('## npm scripts', '');
out.push('| Script | Command |', '|---|---|');
Object.entries(pkg.scripts).forEach(([k, v]) => out.push(`| \`npm run ${k}\` | \`${v.replace(/\|/g, '\\|')}\` |`));
out.push('');

const text = out.join('\n');
const outPath = join(root, OUT);

if (process.argv.includes('--check')) {
  const current = existsSync(outPath) ? readFileSync(outPath, 'utf8').replace(/\r\n/g, '\n') : '';
  if (current !== text) {
    console.error(`[docs:map] ${OUT} is out of date. Run "npm run docs:map".`);
    process.exit(1);
  }
  console.log(`[docs:map] ${OUT} is up to date.`);
} else {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, text);
  console.log(`[docs:map] Wrote ${OUT} (${files.length} source files, ${components.length} components).`);
}
