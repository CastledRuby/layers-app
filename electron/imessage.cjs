// iMessage for Coach (docs/electron.md, "iMessage"; decided 2026-10-10):
// Messages and contacts' names read from the newest iPhone backup made on
// this laptop by Apple Devices (or iTunes). Only reads: the two databases it
// needs are copied to a temporary folder, read and deleted, so nothing is
// ever written in the backup. iMessages and texts (SMS, RCS) alike, from the
// last three months. The page treats the chats like an export's
// (src/lib/chatImport.js).

const fs = require('fs');
const os = require('os');
const path = require('path');

const APPLE_EPOCH = Date.UTC(2001, 0, 1); // Messages counts from 1 Jan 2001
const DAYS = 92; // how far back it reads: three months
const ME = 'Me'; // your messages' sender (the page puts your name in)
const SMS_DB = ['HomeDomain', 'Library/SMS/sms.db'];
const CONTACTS_DB = ['HomeDomain', 'Library/AddressBook/AddressBook.sqlitedb'];

// Where backups are: LAYERS_IPHONE_BACKUP_DIR, or "iPhone backups" in the
// data folder for tests, or Apple Devices' and iTunes' own folders.
function backupRoots({ home, appData, userData, env = process.env }) {
  if (env.LAYERS_IPHONE_BACKUP_DIR) return [env.LAYERS_IPHONE_BACKUP_DIR];
  if (env.LAYERS_USER_DATA_DIR) return [path.join(userData, 'iPhone backups')];
  return [path.join(home, 'Apple', 'MobileSync', 'Backup'), path.join(appData, 'Apple Computer', 'MobileSync', 'Backup')];
}

// The newest backup: { dir, at (ms, when it was made), name (the iPhone's),
// encrypted }, or null. An encrypted backup's file index isn't plain SQLite.
function newestBackup(roots) {
  const found = [];
  roots.forEach(root => {
    let names = [];
    try { names = fs.readdirSync(root); } catch { return; }
    names.forEach(n => {
      const dir = path.join(root, n);
      const manifest = path.join(dir, 'Manifest.db');
      try {
        const stat = fs.statSync(manifest);
        const head = Buffer.alloc(16);
        const fd = fs.openSync(manifest, 'r');
        try { fs.readSync(fd, head, 0, 16, 0); } finally { fs.closeSync(fd); }
        let name = null;
        try { const m = fs.readFileSync(path.join(dir, 'Info.plist'), 'utf8').match(/<key>Device Name<\/key>\s*<string>([^<]*)<\/string>/); if (m) name = m[1].trim() || null; } catch { /* no name */ }
        found.push({ dir, at: stat.mtimeMs, name, encrypted: head.toString('latin1', 0, 15) !== 'SQLite format 3' });
      } catch { /* not a backup */ }
    });
  });
  return found.sort((a, b) => b.at - a.at)[0] || null;
}

// A database in the backup, copied out to read: the copy's path, or null.
// The backup names its files by a hash, listed in Manifest.db.
async function copyOut(sqlite, backup, [domain, relativePath], tmp) {
  const manifest = new sqlite.DatabaseSync(path.join(backup.dir, 'Manifest.db'), { readOnly: true });
  let row;
  try { row = manifest.prepare('SELECT fileID FROM Files WHERE domain = ? AND relativePath = ?').get(domain, relativePath); } finally { manifest.close(); }
  if (!row || typeof row.fileID !== 'string' || !/^[0-9a-f]{40}$/i.test(row.fileID)) return null;
  const from = path.join(backup.dir, row.fileID.slice(0, 2), row.fileID);
  if (!fs.existsSync(from)) return null;
  const to = path.join(tmp, `${path.basename(relativePath)}`);
  await fs.promises.copyFile(from, to);
  return to;
}

// A phone number or email as a key: an email lowercased, a number's last nine
// digits (so +64 21 234 5678 and 021 234 5678 are the same).
function contactKey(handle) {
  const s = String(handle || '').trim();
  if (s.includes('@')) return s.toLowerCase();
  const digits = s.replace(/\D/g, '');
  return digits.length > 9 ? digits.slice(-9) : digits;
}

// Names from Contacts: Map of contactKey → "First Last" (or a nickname or
// company).
function readContacts(sqlite, file) {
  const names = new Map();
  if (!file) return names;
  const db = new sqlite.DatabaseSync(file, { readOnly: true });
  try {
    const people = new Map(db.prepare('SELECT ROWID AS id, First AS first, Last AS last, Nickname AS nick, Organization AS org FROM ABPerson').all()
      .map(p => [p.id, [p.first, p.last].filter(Boolean).join(' ').trim() || p.nick || p.org || '']));
    db.prepare('SELECT record_id AS id, value FROM ABMultiValue WHERE property IN (3, 4)').all().forEach(v => {
      const name = people.get(v.id);
      const key = contactKey(v.value);
      if (name && key && !names.has(key)) names.set(key, name);
    });
  } finally { db.close(); }
  return names;
}

// A message's text from attributedBody, where iOS 16 and later often keep it
// (text is empty then): the string after "NSString", its length in one byte,
// or 0x81 and two.
function bodyText(blob) {
  if (!blob) return '';
  const b = Buffer.from(blob);
  const at = b.indexOf('NSString', 0, 'latin1');
  if (at < 0) return '';
  let i = at + 8 + 5;
  let length = b[i];
  if (length === 0x81) { length = b.readUInt16LE(i + 1); i += 3; } else i += 1;
  return b.toString('utf8', i, Math.min(b.length, i + length));
}

const OBJECT = String.fromCharCode(0xfffc); // where an attachment sits in a message

// The chats from Messages, the last DAYS days: [{ key, source: 'imessage',
// title, participants, me, messages: [{ at, sender, text }] }], each with a
// message. Reactions, group changes and empty messages are left out.
function readMessages(sqlite, file, contacts, now) {
  const db = new sqlite.DatabaseSync(file, { readOnly: true });
  try {
    const cols = new Set(db.prepare('PRAGMA table_info(message)').all().map(c => c.name));
    const has = (c) => cols.has(c);
    const maxDate = db.prepare('SELECT max(date) AS d FROM message');
    maxDate.setReadBigInts(true);
    const nanos = Number((maxDate.get() || {}).d || 0n) > 1e12; // iOS 11 on counts in nanoseconds
    const since = now - DAYS * 86400000;
    const sinceRaw = nanos ? BigInt(Math.round(since - APPLE_EPOCH)) * 1000000n : BigInt(Math.round((since - APPLE_EPOCH) / 1000));
    const name = (handle) => contacts.get(contactKey(handle)) || handle;
    const chats = new Map(db.prepare('SELECT ROWID AS id, guid, display_name AS title FROM chat').all().map(c => [c.id, { id: c.id, guid: c.guid, title: c.title || '', members: [], messages: [] }]));
    db.prepare('SELECT j.chat_id AS chat, h.id AS handle FROM chat_handle_join j JOIN handle h ON h.ROWID = j.handle_id').all().forEach(r => {
      const chat = chats.get(r.chat);
      if (chat && r.handle) chat.members.push(name(r.handle));
    });
    const query = db.prepare(`SELECT m.text AS text, ${has('attributedBody') ? 'm.attributedBody' : 'NULL'} AS body, m.date AS date, m.is_from_me AS mine,
      ${has('associated_message_type') ? 'm.associated_message_type' : '0'} AS reaction, ${has('item_type') ? 'm.item_type' : '0'} AS kind,
      ${has('cache_has_attachments') ? 'm.cache_has_attachments' : '0'} AS attached, h.id AS handle, j.chat_id AS chat
      FROM message m JOIN chat_message_join j ON j.message_id = m.ROWID LEFT JOIN handle h ON h.ROWID = m.handle_id
      WHERE m.date >= ? ORDER BY m.date`);
    query.setReadBigInts(true);
    query.all(sinceRaw).forEach(r => {
      const chat = chats.get(Number(r.chat));
      if (!chat || Number(r.reaction) !== 0 || Number(r.kind) !== 0) return;
      let text = String(r.text || bodyText(r.body) || '');
      const attachment = text.includes(OBJECT) || Number(r.attached) === 1;
      text = text.split(OBJECT).join('').trim();
      if (!text && attachment) text = '(attachment)';
      if (!text) return;
      const at = nanos ? Number(BigInt(r.date) / 1000000n) + APPLE_EPOCH : Number(r.date) * 1000 + APPLE_EPOCH;
      const sender = Number(r.mine) ? ME : name(r.handle || '');
      if (!sender) return;
      chat.messages.push({ at, sender, text });
    });
    return [...chats.values()].filter(c => c.messages.length).map(c => {
      const participants = [...new Set([...c.members, ...c.messages.map(m => m.sender).filter(s => s !== ME)])];
      return { key: `imessage:${c.guid}`, source: 'imessage', title: c.title || participants.join(', ') || 'Messages', participants, me: ME, messages: c.messages };
    });
  } finally { db.close(); }
}

// Everything the page needs (a promise): { backup: { name, at }, chats } | { backup,
// error } | { none: true }. knownAt: when the backup the page already has
// was made; if it's still the newest, { backup, same: true } (nothing re-read).
// sqlite is node:sqlite (passed in, so a test can use its own Node's).
async function readIMessages({ roots, knownAt = null, now = Date.now(), sqlite = require('node:sqlite') } = {}) {
  const backup = newestBackup(roots);
  if (!backup) return { none: true };
  const info = { name: backup.name, at: backup.at };
  if (backup.encrypted) return { backup: info, error: "Your iPhone backup is encrypted, so Layers can't read its messages. In Apple Devices, untick Encrypt local backup and back up again." };
  if (knownAt === backup.at) return { backup: info, same: true };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'layers-imessage-'));
  try {
    const sms = await copyOut(sqlite, backup, SMS_DB, tmp);
    if (!sms) return { backup: info, error: 'That iPhone backup has no messages in it.' };
    const contacts = readContacts(sqlite, await copyOut(sqlite, backup, CONTACTS_DB, tmp));
    return { backup: info, chats: readMessages(sqlite, sms, contacts, now) };
  } catch {
    return { backup: info, error: "Couldn't read the messages in your iPhone backup." };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

module.exports = { backupRoots, bodyText, contactKey, newestBackup, readIMessages, DAYS, ME };
