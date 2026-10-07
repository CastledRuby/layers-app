// The stale-build guard (scripts/check-fresh-build.cjs, electron-builder's
// beforePack): packaging stops unless the built page carries the fingerprint
// of src/ as it is now.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkFreshBuild, marker, sourceHash } from '../scripts/check-fresh-build.cjs';

const dirs = [];
afterEach(() => { dirs.splice(0).forEach(d => fs.rmSync(d, { recursive: true, force: true })); });
function project() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'layers-fresh-')); dirs.push(base);
  fs.mkdirSync(path.join(base, 'src', 'lib'), { recursive: true });
  fs.mkdirSync(path.join(base, 'electron', 'app'), { recursive: true });
  fs.writeFileSync(path.join(base, 'src', 'lib', 'a.js'), 'export const a = 1;\n');
  fs.writeFileSync(path.join(base, 'index.html'), '<div id="root"></div>\n');
  return base;
}
const build = (base) => fs.writeFileSync(path.join(base, 'electron', 'app', 'index.html'), `<html></html>\n${marker(sourceHash(base))}\n`);

describe('the stale-build guard', () => {
  it('lets a page built from src/ as it is now be packaged', () => {
    const base = project();
    build(base);
    expect(() => checkFreshBuild(base)).not.toThrow();
  });

  it('stops a page built before src/ changed, however new the file looks', () => {
    const base = project();
    build(base);
    fs.writeFileSync(path.join(base, 'src', 'lib', 'a.js'), 'export const a = 2;\n');
    expect(() => checkFreshBuild(base)).toThrow(/npm run build:electron/);
  });

  it('stops a page without a fingerprint, or no page at all', () => {
    const base = project();
    expect(() => checkFreshBuild(base)).toThrow(/no electron\/app\/index.html/);
    fs.writeFileSync(path.join(base, 'electron', 'app', 'index.html'), '<html></html>');
    expect(() => checkFreshBuild(base)).toThrow(/not built from src/);
  });

  it("doesn't count line endings", () => {
    const base = project();
    build(base);
    fs.writeFileSync(path.join(base, 'src', 'lib', 'a.js'), 'export const a = 1;\r\n');
    expect(() => checkFreshBuild(base)).not.toThrow();
  });
});
