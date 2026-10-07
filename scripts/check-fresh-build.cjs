// electron-builder's beforePack (package.json, build.beforePack): refuses to
// package an old build of the page. Electron loads only the built
// electron/app/index.html, so packaging by hand after changing src/ without
// `npm run build:electron` would ship old code that looks current
// (docs/known-issues.md). npm run release, the end-to-end tests and the
// install hook all build first, so this only stops a hand-made package.
//
// sync-app.mjs writes a fingerprint of what the page was built from (src/,
// index.html and public/) into it as a comment; here it's worked out again
// and compared. File times can't be trusted for this: the install hook puts
// the tracked page back after building, which makes an old page look new.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const MARK = /<!-- layers-source: ([0-9a-f]{64}) -->/;

function files(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const p = path.join(dir, entry.name);
    return entry.isDirectory() ? files(p) : [p];
  });
}

// What the page is built from, as one hash. Line endings don't count, so a
// checkout with Windows line endings gives the same.
function sourceHash(base = root) {
  const hash = crypto.createHash('sha256');
  const list = [...files(path.join(base, 'src')), path.join(base, 'index.html'), ...files(path.join(base, 'public'))]
    .filter(p => fs.existsSync(p))
    .map(p => [path.relative(base, p).split(path.sep).join('/'), p])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [name, p] of list) {
    hash.update(name);
    hash.update('\0');
    hash.update(fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n'));
    hash.update('\0');
  }
  return hash.digest('hex');
}

// The comment sync-app.mjs adds to the built page.
const marker = (hash) => `<!-- layers-source: ${hash} -->`;

// Throws when the built page wasn't built from src/ as it is now.
function checkFreshBuild(base = root) {
  const built = path.join(base, 'electron', 'app', 'index.html');
  if (!fs.existsSync(built)) throw new Error('There is no electron/app/index.html. Run "npm run build:electron" before packaging.');
  const found = fs.readFileSync(built, 'utf8').match(MARK);
  if (!found || found[1] !== sourceHash(base)) {
    throw new Error('electron/app/index.html was not built from src/ as it is now, so packaging it would ship old code. Run "npm run build:electron" first.');
  }
}

module.exports = async function beforePack() { checkFreshBuild(); };
module.exports.checkFreshBuild = checkFreshBuild;
module.exports.sourceHash = sourceHash;
module.exports.marker = marker;
