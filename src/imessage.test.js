// iMessage from an iPhone backup (electron/imessage.cjs): the newest backup
// found, its Messages read with names from Contacts, texts in attributedBody,
// reactions and group changes left out, three months back, an encrypted
// backup explained, and nothing written in the backup. The backup is made up
// (tests/fakeIPhoneBackup.cjs).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { backupRoots, bodyText, contactKey, newestBackup, readIMessages } from '../electron/imessage.cjs';
import { attributedBody, writeBackup } from '../tests/fakeIPhoneBackup.cjs';

const NOW = Date.UTC(2026, 9, 10, 9); // 10 Oct 2026
const DAY = 86400000;
const roots = [];
function root() { const r = fs.mkdtempSync(path.join(os.tmpdir(), 'layers-iphone-test-')); roots.push(r); return r; }
afterEach(() => { while (roots.length) fs.rmSync(roots.pop(), { recursive: true, force: true }); });

const contacts = [{ first: 'Amelie', last: 'Smith', phones: ['021 234 5678'] }, { first: 'Chloe', emails: ['Chloe@Example.com'] }];
const chats = [
  { guid: 'iMessage;-;+64212345678', handles: ['+64212345678'], messages: [
    { at: NOW - 200 * DAY, from: '+64212345678', text: 'ages ago' },
    { at: NOW - 2 * DAY, from: '+64212345678', text: 'I got the job!!' },
    { at: NOW - 2 * DAY + 60000, from: null, text: 'No way, congrats!' },
    { at: NOW - 2 * DAY + 90000, from: '+64212345678', text: 'Loved “No way, congrats!”', reaction: 2000 },
    { at: NOW - 2 * DAY + 120000, from: '+64212345678', body: 'thank youuu (only in attributedBody)' },
    { at: NOW - 2 * DAY + 150000, from: '+64212345678', text: String.fromCharCode(0xfffc), attachment: true },
  ] },
  { guid: 'iMessage;+;chat1234', title: 'Footy crew', handles: ['+64212345678', 'chloe@example.com', '+15550001111'], messages: [
    { at: NOW - DAY, from: 'chloe@example.com', text: 'game on sat?' },
    { at: NOW - DAY + 60000, from: '+15550001111', text: 'yes' },
    { at: NOW - DAY + 90000, from: null, text: 'in' },
  ] },
  { guid: 'SMS;-;+15550002222', handles: ['+15550002222'], messages: [{ at: NOW - 300 * DAY, from: '+15550002222', text: 'too old' }] },
];

describe('iMessage from an iPhone backup', () => {
  it("reads the newest backup's chats from the last three months, with names from Contacts", async () => {
    const r = root();
    writeBackup(r, { udid: 'old', contacts, chats: [] });
    fs.utimesSync(path.join(r, 'old', 'Manifest.db'), new Date(NOW - 10 * DAY), new Date(NOW - 10 * DAY));
    writeBackup(r, { contacts, chats });
    const result = await readIMessages({ roots: [r], now: NOW });
    expect(result.backup).toMatchObject({ name: "Liam's iPhone" });
    expect(result.chats.map(c => c.title)).toEqual(['Amelie Smith', 'Footy crew']); // the old SMS chat has nothing recent
    const [amelie, footy] = result.chats;
    expect(amelie).toMatchObject({ key: 'imessage:iMessage;-;+64212345678', source: 'imessage', participants: ['Amelie Smith'], me: 'Me' });
    expect(amelie.messages.map(m => [m.sender, m.text])).toEqual([
      ['Amelie Smith', 'I got the job!!'],
      ['Me', 'No way, congrats!'],
      ['Amelie Smith', 'thank youuu (only in attributedBody)'],
      ['Amelie Smith', '(attachment)'],
    ]);
    expect(amelie.messages[0].at).toBe(NOW - 2 * DAY);
    expect(footy.participants).toEqual(['Amelie Smith', 'Chloe', '+15550001111']);
    expect(footy.messages.map(m => m.sender)).toEqual(['Chloe', '+15550001111', 'Me']);
  });

  it("only reads again when there's a newer backup, and writes nothing in it", async () => {
    const r = root();
    const dir = writeBackup(r, { contacts, chats });
    const before = fs.readdirSync(dir, { recursive: true }).sort();
    const first = await readIMessages({ roots: [r], now: NOW });
    expect(await readIMessages({ roots: [r], now: NOW, knownAt: first.backup.at })).toEqual({ backup: first.backup, same: true });
    expect(fs.readdirSync(dir, { recursive: true }).sort()).toEqual(before);
  });

  it('says when there is no backup, or it is encrypted', async () => {
    expect(await readIMessages({ roots: [root(), path.join(os.tmpdir(), 'no-such-folder-layers')], now: NOW })).toEqual({ none: true });
    const r = root();
    writeBackup(r, { encrypted: true });
    expect(newestBackup([r]).encrypted).toBe(true);
    expect((await readIMessages({ roots: [r], now: NOW })).error).toMatch(/encrypted/);
  });

  it('finds the text in attributedBody, short or long', () => {
    expect(bodyText(attributedBody('hey'))).toBe('hey');
    const long = 'a'.repeat(300) + ' é';
    expect(bodyText(attributedBody(long))).toBe(long);
    expect(bodyText(null)).toBe('');
    expect(bodyText(Buffer.from('no string here'))).toBe('');
  });

  it('matches numbers however they are written, and emails in any case', () => {
    expect(contactKey('+64 21 234 5678')).toBe(contactKey('021-234-5678'));
    expect(contactKey('Chloe@Example.com')).toBe('chloe@example.com');
  });

  it("looks in Apple Devices' and iTunes' folders, or a test's own", () => {
    expect(backupRoots({ home: 'C:/Users/Liam', appData: 'C:/Users/Liam/AppData/Roaming', userData: 'D', env: {} }).map(p => p.replace(/\\/g, '/')))
      .toEqual(['C:/Users/Liam/Apple/MobileSync/Backup', 'C:/Users/Liam/AppData/Roaming/Apple Computer/MobileSync/Backup']);
    expect(backupRoots({ home: 'H', appData: 'A', userData: 'D', env: { LAYERS_USER_DATA_DIR: 'D' } }).map(p => p.replace(/\\/g, '/'))).toEqual(['D/iPhone backups']);
    expect(backupRoots({ home: 'H', appData: 'A', userData: 'D', env: { LAYERS_IPHONE_BACKUP_DIR: 'X' } })).toEqual(['X']);
  });
});
