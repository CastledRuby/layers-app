// Faces in pictures (electron/faces.cjs): which paths are asked about, how
// Windows' answers are read, and what happens when it can't answer. Windows
// itself is stood in for (`run`); the end-to-end tests use the real one.
import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanPaths, findFaces, parseFaces } from '../electron/faces.cjs';
import { faceCrop } from './data/avatars.js';

const dirs = [];
const tempDir = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'layers-faces-')); dirs.push(d); return d; };
afterEach(() => { dirs.splice(0).forEach(d => fs.rmSync(d, { recursive: true, force: true })); });

// A stand-in for powershell.exe: answers with `lines`, remembering its input.
function fakeRun(lines, { close = true } = {}) {
  const calls = [];
  const run = (cmd, args) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.kill = () => { child.killed = true; };
    child.stdin = { on() {}, end(text) { calls.push({ cmd, args, text }); setTimeout(() => { child.stdout.emit('data', lines.join('\n')); if (close) child.emit('close', 0); }, 5); } };
    return child;
  };
  return { run, calls };
}

describe('faces in pictures', () => {
  it('asks only about pictures that are there', () => {
    const dir = tempDir();
    const pic = path.join(dir, 'Kai.jpg');
    fs.writeFileSync(pic, 'x');
    expect(cleanPaths([pic, path.join(dir, 'gone.png'), 'Kai.jpg', path.join(dir, 'notes.txt'), 42])).toEqual([pic, null, null, null, null]);
  });

  it("reads Windows' answers, one per picture, in order", () => {
    const out = parseFaces([
      '{"i":1,"width":400,"height":600,"faces":[{"x":10,"y":20,"w":30,"h":40}]}',
      '{"i":0,"width":300,"height":300,"faces":[]}',
      '{"i":7,"width":1,"height":1,"faces":[]}', // not asked about
      'WARNING: something PowerShell said',
    ].join('\r\n'), 3);
    expect(out).toEqual([{ width: 300, height: 300, faces: [] }, { width: 400, height: 600, faces: [{ x: 10, y: 20, w: 30, h: 40 }] }, null]);
  });

  it('sends the pictures to one PowerShell run, and gives nothing back off Windows', async () => {
    const dir = tempDir();
    const a = path.join(dir, 'a.png'); const b = path.join(dir, 'b.png');
    fs.writeFileSync(a, 'x'); fs.writeFileSync(b, 'x');
    const { run, calls } = fakeRun(['{"i":1,"width":10,"height":10,"faces":[{"x":1,"y":1,"w":5,"h":5}]}']);
    const found = await findFaces([a, 'nope', b], { run, platform: 'win32' });
    expect(calls).toHaveLength(1);
    expect(calls[0].cmd).toBe('powershell.exe');
    expect(calls[0].text).toBe(`0\t${a}\n2\t${b}`);
    expect(found).toEqual([null, null, null]); // index 1 was 'nope', so Windows' answer for it is ignored
    expect(await findFaces([a], { run, platform: 'darwin' })).toEqual([null]);
  });

  it("gives up after the time limit if Windows doesn't answer", async () => {
    const dir = tempDir();
    const a = path.join(dir, 'a.png');
    fs.writeFileSync(a, 'x');
    const { run } = fakeRun([], { close: false });
    expect(await findFaces([a], { run, platform: 'win32', timeoutMs: 30 })).toEqual([null]);
  });

  it("starts the circle on the biggest face, unless the picture's size doesn't match", () => {
    const found = { width: 400, height: 600, faces: [{ x: 10, y: 10, w: 20, h: 20 }, { x: 150, y: 100, w: 100, h: 100 }] };
    const crop = faceCrop(found, 400, 600);
    expect(crop.zoom).toBe(2); // the face is a quarter of the width: zoomed so it fills half the circle
    expect(crop.y).toBeGreaterThan(0); // moved down, so the face (in the top part) is in the middle
    expect(faceCrop(found, 600, 400)).toBeNull(); // turned: the face would be in the wrong place
    expect(faceCrop({ width: 400, height: 600, faces: [] }, 400, 600)).toBeNull();
    expect(faceCrop(null, 400, 600)).toBeNull();
  });
});
