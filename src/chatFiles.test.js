// The Layers chats folder (electron/chatfiles.cjs): which files are chat
// exports, a WhatsApp chat or Instagram's messages read out of a zip, and
// nothing outside the folder read. The zips are made here.
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { chatsDir, listExports, readExport, watchExports, whatsAppTitle, zipEntries, zipEntryData } from '../electron/chatfiles.cjs';

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
    expect(readExport(dir, 'photos.zip').error).toMatch(/doesn't have a WhatsApp, Instagram, Messenger or Snapchat chat/);
    expect(readExport(dir, 'bad.zip').error).toMatch(/isn't a zip/);
    fs.writeFileSync(path.join(path.dirname(dir), 'outside.txt'), CHAT);
    expect(readExport(dir, '../outside.txt').error).toMatch(/isn't in the Layers chats folder/);
    expect(readExport(dir, 'missing.zip').error).toMatch(/isn't in the Layers chats folder/);
  });

  it('finds exports in folders of your own, and Instagram downloads unzipped however deep', () => {
    const dir = folder({ 'WhatsApp Chat with Ava.txt': CHAT });
    const put = (rel, data) => { const file = path.join(dir, ...rel.split('/')); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); };
    // Windows' Extract All puts a download in a folder of the same name.
    const inbox = 'instagram-liam-2026-10-09/instagram-liam-2026-10-09/your_instagram_activity/messages/inbox';
    put(`${inbox}/chloe_9/message_1.json`, INSTA);
    put(`${inbox}/chloe_9/message_2.json`, INSTA);
    put(`${inbox}/chloe_9/photos/1.jpg`, 'x');
    put(`${inbox}/max_4/message_1.json`, INSTA);
    put('instagram-liam-2026-10-09/media/posts/202601/notes.txt', 'not looked through');
    put('messages/inbox/zoe_2/message_1.json', INSTA); // only its messages folder
    put('Instagram/part 1/your_instagram_activity/messages/inbox/amy_3/message_1.json', INSTA); // a download in two parts
    put('Instagram/part 2/your_instagram_activity/messages/inbox/amy_3/message_2.json', INSTA);
    put('Instagram/older/instagram-liam-2026-09.zip', zip({ 'your_instagram_activity/messages/inbox/chloe_9/message_1.json': INSTA }));
    put('Mia (Oli’s Sister)/chat.txt', CHAT);
    put('Mia (Oli’s Sister)/chat.md', CHAT);
    put('instagram-html/messages/inbox/a_1/message_1.html', '<html>');
    put('Snapchat/mydata~2/json/chat_history.json', '{"a":[]}'); // Snapchat's, unzipped
    put('Snapchat/mydata~2/json/friends.json', '{"Friends":[]}');
    put('Snapchat/mydata~2/json/account.json', '{"secret":1}');
    put('Snapchat/mydata~2/html/chat_history.html', '<html>');
    put('snap-html/html/chat_history.html', '<html>');
    put('holiday/photos/1.jpg', 'x');
    put('a/b/c/d/e/f/g/too deep.txt', CHAT);
    const t = Date.now() / 1000;
    fs.utimesSync(path.join(dir, 'WhatsApp Chat with Ava.txt'), t - 60, t - 60);
    fs.utimesSync(path.join(dir, ...`${inbox}/max_4/message_1.json`.split('/')), t + 60, t + 60);

    const listed = listExports(dir);
    expect(listed.map(f => [f.name, f.kind]).sort()).toEqual([
      ['Instagram/older/instagram-liam-2026-09.zip', 'instagram'],
      ['Instagram/part 1', 'instagram'],
      ['Instagram/part 2', 'instagram'],
      ['Mia (Oli’s Sister)/chat.txt', 'whatsapp'],
      ['Snapchat/mydata~2', 'snapchat'],
      ['WhatsApp Chat with Ava.txt', 'whatsapp'],
      ['instagram-html', 'instagram-html'],
      ['instagram-liam-2026-10-09/instagram-liam-2026-10-09', 'instagram'],
      ['messages', 'instagram'],
      ['snap-html', 'snapchat-html'],
    ]);
    const download = listed.find(f => f.name === 'instagram-liam-2026-10-09/instagram-liam-2026-10-09');
    expect(listed[0]).toBe(download); // as new as its newest messages file
    expect(download.size).toBe(3 * INSTA.length);
    expect(listed.find(f => f.name === 'WhatsApp Chat with Ava.txt').title).toBe('Ava');

    const read = readExport(dir, 'instagram-liam-2026-10-09/instagram-liam-2026-10-09');
    expect(read.kind).toBe('instagram');
    expect(read.files.map(f => f.path).sort()).toEqual(['messages/inbox/chloe_9/message_1.json', 'messages/inbox/chloe_9/message_2.json', 'messages/inbox/max_4/message_1.json']);
    expect(read.files.every(f => f.text === INSTA)).toBe(true);
    expect(readExport(dir, 'messages').files).toEqual([{ path: 'messages/inbox/zoe_2/message_1.json', text: INSTA }]);
    expect(readExport(dir, 'Instagram/part 2').files).toEqual([{ path: 'messages/inbox/amy_3/message_2.json', text: INSTA }]);
    expect(readExport(dir, 'Instagram/older/instagram-liam-2026-09.zip')).toMatchObject({ kind: 'instagram', files: [{ text: INSTA }] });
    expect(readExport(dir, 'Mia (Oli’s Sister)/chat.txt')).toEqual({ kind: 'whatsapp', title: null, files: [{ path: 'chat.txt', text: CHAT }] });
    expect(readExport(dir, 'instagram-html').error).toMatch(/choosing JSON/);
    expect(readExport(dir, 'Snapchat/mydata~2')).toEqual({ kind: 'snapchat', title: null, files: [{ path: 'json/chat_history.json', text: '{"a":[]}' }, { path: 'json/friends.json', text: '{"Friends":[]}' }] }); // nothing else in it read
    expect(readExport(dir, 'snap-html').error).toMatch(/Export JSON files/);
    for (const name of ['holiday', '..', 'instagram-liam-2026-10-09', '../outside.txt', 'Mia (Oli’s Sister)/chat.md', 'a/b/c/d/e/f/g/too deep.txt']) {
      expect(readExport(dir, name).error).toMatch(/isn't in the Layers chats folder/);
    }
  });

  it("reads Facebook's download as Messenger, with archived and older (e2ee_cutover) chats, but not message requests (2026-10-14)", () => {
    const dir = folder({
      'facebook-liam-2026-10-14.zip': zip({
        'your_facebook_activity/messages/inbox/chloe_9/message_1.json': INSTA,
        'your_facebook_activity/messages/archived_threads/max_4/message_1.json': INSTA,
        'your_facebook_activity/messages/e2ee_cutover/chloe_9/message_1.json': INSTA,
        'your_facebook_activity/messages/message_requests/spam_1/message_1.json': INSTA,
      }),
      'renamed.zip': zip({ 'profile_information/profile_information.json': '{}', 'messages/inbox/zoe_2/message_1.json': INSTA }), // an older Facebook layout
      'facebook-html.zip': zip({ 'your_facebook_activity/messages/inbox/a_1/message_1.html': '<html>' }),
    });
    const put = (rel, data) => { const file = path.join(dir, ...rel.split('/')); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); };
    put('facebook-liam-2026-09/your_facebook_activity/messages/inbox/amy_3/message_1.json', INSTA); // unzipped
    put('facebook-liam-2026-09/your_facebook_activity/messages/archived_threads/old_5/message_1.json', INSTA);
    put('old fb/profile_information/profile_information.json', '{}');
    put('old fb/messages/inbox/ben_6/message_1.json', INSTA);

    expect(listExports(dir).map(f => [f.name, f.kind]).sort()).toEqual([
      ['facebook-html.zip', 'messenger-html'],
      ['facebook-liam-2026-09', 'messenger'],
      ['facebook-liam-2026-10-14.zip', 'messenger'],
      ['old fb', 'messenger'],
      ['renamed.zip', 'messenger'],
    ]);
    const read = readExport(dir, 'facebook-liam-2026-10-14.zip');
    expect(read.kind).toBe('messenger');
    expect(read.files.map(f => f.path).sort()).toEqual([
      'your_facebook_activity/messages/archived_threads/max_4/message_1.json',
      'your_facebook_activity/messages/e2ee_cutover/chloe_9/message_1.json',
      'your_facebook_activity/messages/inbox/chloe_9/message_1.json',
    ]);
    expect(readExport(dir, 'facebook-liam-2026-09').files.map(f => f.path).sort()).toEqual(['messages/archived_threads/old_5/message_1.json', 'messages/inbox/amy_3/message_1.json']);
    expect(readExport(dir, 'old fb').kind).toBe('messenger');
    expect(readExport(dir, 'facebook-html.zip').error).toMatch(/Facebook download is in HTML/);
  });

  it("reads Discord's package for its direct messages only, never a server's channels (2026-10-14)", () => {
    const INDEX = JSON.stringify({ 111: 'Direct Message with sam_lee#0', 222: 'general in Climbing Club', 333: 'Direct Message with zoe' });
    const MSGS = JSON.stringify([{ ID: '1', Timestamp: '2026-10-01 18:33:12.123000+00:00', Contents: 'u free sat?', Attachments: '' }]);
    const dir = folder({
      'package.zip': zip({ 'messages/index.json': INDEX, 'messages/c111/channel.json': '{}', 'messages/c111/messages.json': MSGS, 'messages/c222/messages.json': MSGS, 'messages/333/messages.csv': 'ID,Timestamp,Contents,Attachments\n1,2026-10-02 09:00:00,"hey, you",\n', 'account/user.json': '{"secret":1}' }),
    });
    const put = (rel, data) => { const file = path.join(dir, ...rel.split('/')); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); };
    put('discord/package/messages/index.json', INDEX); // unzipped
    put('discord/package/messages/c111/messages.json', MSGS);
    put('discord/package/messages/c222/messages.json', MSGS);
    expect(listExports(dir).map(f => [f.name, f.kind]).sort()).toEqual([['discord/package', 'discord'], ['package.zip', 'discord']]);
    expect(readExport(dir, 'package.zip').files.map(f => f.path)).toEqual(['messages/index.json', 'messages/c111/messages.json', 'messages/333/messages.csv']);
    expect(readExport(dir, 'discord/package').files.map(f => f.path)).toEqual(['messages/index.json', 'messages/c111/messages.json']);
  });

  it("counts what a zip really unpacks to, not what it claims, and refuses entries sharing their data (audit 2026-10-14)", () => {
    // A crafted zip: several entries point at the same deflated block and say it's 1 byte.
    const json = JSON.stringify({ title: 'x', participants: [], messages: [] }) + ' '.repeat(5000);
    const one = zip({ 'messages/inbox/a_1/message_1.json': json });
    const lying = Buffer.from(one);
    lying.writeUInt32LE(1, one.length - 22 - (46 + 'messages/inbox/a_1/message_1.json'.length) + 24); // its central entry's size
    const shared = (() => {
      const name = (i) => `messages/inbox/t${i}/message_1.json`;
      const names = [0, 1, 2].map(name);
      const raw = Buffer.from(json); const data = zlib.deflateRawSync(raw);
      const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8);
      local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(Buffer.byteLength(names[0]), 26);
      const body = Buffer.concat([local, Buffer.from(names[0]), data]);
      const heads = names.map(n => { const h = Buffer.alloc(46); h.writeUInt32LE(0x02014b50, 0); h.writeUInt16LE(8, 10); h.writeUInt32LE(data.length, 20); h.writeUInt32LE(1, 24); h.writeUInt16LE(Buffer.byteLength(n), 28); h.writeUInt32LE(0, 42); return Buffer.concat([h, Buffer.from(n)]); });
      const cd = Buffer.concat(heads);
      const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(3, 8); end.writeUInt16LE(3, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(body.length, 16);
      return Buffer.concat([body, cd, end]);
    })();
    const badEnd = Buffer.from(one); badEnd.writeUInt32LE(0x7fffffff, one.length - 22 + 12); // a directory far bigger than the file
    // What it really unpacks to is held to the room left, whatever it claims.
    const [entry] = zipEntries(lying);
    expect(entry.size).toBe(1);
    expect(() => zipEntryData(lying, entry, 100)).toThrow(/too big to read/);
    expect(zipEntryData(lying, entry).length).toBe(Buffer.byteLength(json));
    const dir = folder({ 'shared.zip': shared, 'bad-end.zip': badEnd });
    expect(readExport(dir, 'shared.zip').error).toMatch(/damaged/);
    expect(readExport(dir, 'bad-end.zip').error).toMatch(/damaged/);
    expect(listExports(dir).map(f => f.name)).toEqual(['shared.zip']); // listed (only its directory is read then), refused when opened; the bad end isn't listed
  });

  it("never follows a shortcut or junction out of the folder, and finds what's saved beside an unzipped Snapchat download (audit 2026-10-14)", () => {
    const outside = folder({ 'secret.txt': CHAT, 'WhatsApp Chat - Mum.txt': CHAT });
    const dir = folder({});
    const put = (rel, data) => { const file = path.join(dir, ...rel.split('/')); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); };
    let linked = true;
    try { fs.symlinkSync(outside, path.join(dir, 'elsewhere'), 'junction'); } catch { linked = false; }
    put('Snapchat/json/chat_history.json', '{"a":[]}');
    put('Snapchat/WhatsApp Chat - Amelie.zip', zip({ '_chat.txt': CHAT }));
    const names = listExports(dir).map(f => f.name).sort();
    expect(names).toEqual(['Snapchat', 'Snapchat/WhatsApp Chat - Amelie.zip']);
    if (linked) expect(readExport(dir, 'elsewhere/WhatsApp Chat - Mum.txt').error).toMatch(/isn't in the Layers chats folder/);
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

  it('notices messages arriving inside an unzipped download', async () => {
    const dir = folder();
    const thread = path.join(dir, 'instagram-liam', 'messages', 'inbox', 'chloe_9');
    fs.mkdirSync(thread, { recursive: true });
    let calls = 0;
    const stop = watchExports(dir, () => { calls += 1; }, 50);
    fs.writeFileSync(path.join(thread, 'message_1.json'), INSTA);
    await new Promise((resolve) => { setTimeout(resolve, 400); });
    stop();
    expect(calls).toBeGreaterThanOrEqual(1);
  });
});
