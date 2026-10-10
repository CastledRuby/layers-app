// The Layers chats folder (electron/chatfiles.cjs): which files are chat
// exports, a WhatsApp chat or Instagram's messages read out of a zip, and
// nothing outside the folder read. The zips are made here.
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { chatsDir, listExports, readExport, watchExports, whatsAppTitle } from '../electron/chatfiles.cjs';

// A zip of { name: text }, deflated (or stored with { store: true }).
function zip(files, { store = false } = {}) {
  const locals = [];
  const central = [];
  let offset = 0;
  Object.entries(files).forEach(([name, text]) => {
    const raw = Buffer.from(text, 'utf8');
    const data = store ? raw : zlib.deflateRawSync(raw);
    const nameBuf = Buffer.from(name, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(store ? 0 : 8, 8);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(nameBuf.length, 26);
    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50, 0); head.writeUInt16LE(store ? 0 : 8, 10);
    head.writeUInt32LE(data.length, 20); head.writeUInt32LE(raw.length, 24); head.writeUInt16LE(nameBuf.length, 28); head.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data);
    central.push(head, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  });
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

const dirs = [];
afterEach(() => { dirs.splice(0).forEach(d => fs.rmSync(d, { recursive: true, force: true })); });
function folder(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'layers-chats-'));
  dirs.push(dir);
  Object.entries(files).forEach(([name, data]) => fs.writeFileSync(path.join(dir, name), data));
  return dir;
}
const CHAT = '[6/10/26, 9:41:03 pm] Amelie: I got the job!!';
const INSTA = JSON.stringify({ title: 'Chloe', participants: [{ name: 'Chloe' }], messages: [{ sender_name: 'Chloe', timestamp_ms: 1, content: 'yo' }] });

describe('the Layers chats folder', () => {
  it('is in Documents (OneDrive here), or the test data folder', () => {
    expect(chatsDir({ documents: 'D', userData: 'U', env: {} })).toBe(path.join('D', 'Layers chats'));
    expect(chatsDir({ documents: 'D', userData: 'U', env: { LAYERS_USER_DATA_DIR: 'U' } })).toBe(path.join('U', 'Chats'));
    expect(chatsDir({ documents: 'D', userData: 'U', env: { LAYERS_CHATS_DIR: 'X' } })).toBe('X');
  });

  it('names a WhatsApp chat from its file', () => {
    expect(whatsAppTitle('WhatsApp Chat - Amelie.zip')).toBe('Amelie');
    expect(whatsAppTitle('WhatsApp Chat with Amelie R (2).txt')).toBe('Amelie R');
    expect(whatsAppTitle('holiday.zip')).toBeNull();
  });

  it('lists only chat exports, newest first, and makes the folder if it is missing', () => {
    const dir = folder({
      'WhatsApp Chat - Amelie.zip': zip({ '_chat.txt': CHAT }),
      'instagram-liam-2026-10-07.zip': zip({ 'your_instagram_activity/messages/inbox/chloe_9/message_1.json': INSTA, 'media/x.txt': 'not a chat' }),
      'instagram-html.zip': zip({ 'messages/inbox/chloe_9/message_1.html': '<html>' }),
      'mydata~1.zip': zip({ 'json/chat_history.json': '{}', 'json/friends.json': '{}', 'json/account.json': '{}' }),
      'snap-html.zip': zip({ 'html/chat_history.html': '<html>' }),
      'photos.zip': zip({ 'a.jpg': 'x' }),
      'notes.pdf': 'x',
      'broken.zip': 'not a zip',
    });
    const t = Date.now() / 1000;
    fs.utimesSync(path.join(dir, 'WhatsApp Chat - Amelie.zip'), t, t);
    fs.utimesSync(path.join(dir, 'instagram-liam-2026-10-07.zip'), t - 60, t - 60);
    fs.utimesSync(path.join(dir, 'instagram-html.zip'), t - 120, t - 120);
    fs.utimesSync(path.join(dir, 'mydata~1.zip'), t - 180, t - 180);
    fs.utimesSync(path.join(dir, 'snap-html.zip'), t - 240, t - 240);
    expect(listExports(dir).map(f => [f.name, f.kind, f.title])).toEqual([
      ['WhatsApp Chat - Amelie.zip', 'whatsapp', 'Amelie'],
      ['instagram-liam-2026-10-07.zip', 'instagram', null],
      ['instagram-html.zip', 'instagram-html', null],
      ['mydata~1.zip', 'snapchat', null],
      ['snap-html.zip', 'snapchat-html', null],
    ]);
    const missing = path.join(folder(), 'Layers chats');
    expect(listExports(missing)).toEqual([]);
    expect(fs.existsSync(missing)).toBe(true);
  });

  it("reads a WhatsApp chat from its zip (packed or not) or its .txt, and Instagram's messages", () => {
    const dir = folder({
      'WhatsApp Chat - Amelie.zip': zip({ '_chat.txt': CHAT, '00000001-PHOTO.jpg': 'x' }),
      'WhatsApp Chat - Zoe.zip': zip({ '_chat.txt': CHAT }, { store: true }),
      'WhatsApp Chat with Ava.txt': CHAT,
      'insta.zip': zip({ 'messages/inbox/chloe_9/message_1.json': INSTA, 'messages/inbox/chloe_9/message_2.json': INSTA }),
    });
    expect(readExport(dir, 'WhatsApp Chat - Amelie.zip')).toEqual({ kind: 'whatsapp', title: 'Amelie', files: [{ path: '_chat.txt', text: CHAT }] });
    expect(readExport(dir, 'WhatsApp Chat - Zoe.zip').files[0].text).toBe(CHAT);
    expect(readExport(dir, 'WhatsApp Chat with Ava.txt')).toMatchObject({ kind: 'whatsapp', title: 'Ava' });
    expect(readExport(dir, 'insta.zip')).toMatchObject({ kind: 'instagram', files: [{ text: INSTA }, { text: INSTA }] });
    const snap = path.join(folder({ 'mydata~1.zip': zip({ 'json/chat_history.json': '{"a":[]}', 'json/friends.json': '{"Friends":[]}', 'json/account.json': '{"secret":1}' }) }), 'mydata~1.zip');
    expect(readExport(path.dirname(snap), 'mydata~1.zip')).toEqual({ kind: 'snapchat', title: null, files: [{ path: 'json/chat_history.json', text: '{"a":[]}' }, { path: 'json/friends.json', text: '{"Friends":[]}' }] }); // nothing else in the download is read
  });

  it("says why it can't read something, and reads nothing outside the folder", () => {
    const dir = folder({ 'html.zip': zip({ 'messages/inbox/a_1/message_1.html': 'x' }), 'photos.zip': zip({ 'a.jpg': 'x' }), 'bad.zip': 'nope' });
    expect(readExport(dir, 'html.zip').error).toMatch(/choosing JSON/);
    expect(readExport(dir, 'photos.zip').error).toMatch(/doesn't have a WhatsApp, Instagram or Snapchat chat/);
    expect(readExport(dir, 'bad.zip').error).toMatch(/isn't a zip/);
    fs.writeFileSync(path.join(path.dirname(dir), 'outside.txt'), CHAT);
    expect(readExport(dir, '../outside.txt').error).toMatch(/isn't in the Layers chats folder/);
    expect(readExport(dir, 'missing.zip').error).toMatch(/isn't in the Layers chats folder/);
  });

  it('notices a new export arriving', async () => {
    const dir = folder();
    let calls = 0;
    const stop = watchExports(dir, () => { calls += 1; }, 50);
    fs.writeFileSync(path.join(dir, 'WhatsApp Chat - Amelie.zip'), zip({ '_chat.txt': CHAT }));
    await new Promise((resolve) => { setTimeout(resolve, 400); });
    stop();
    expect(calls).toBeGreaterThanOrEqual(1);
  });
});
