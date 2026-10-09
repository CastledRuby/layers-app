// A made-up iPhone backup, laid out the way Apple Devices writes one (only the
// parts Layers reads): Manifest.db listing files by a hash, the Messages
// database (sms.db) and Contacts (AddressBook.sqlitedb) under those hashes,
// and Info.plist with the iPhone's name. For src/imessage.test.js and the
// end-to-end tests. Everything in it is invented.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const APPLE_EPOCH = Date.UTC(2001, 0, 1);
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex');
// A Messages date, in nanoseconds since 2001 (as iOS 11 and later keep it).
const appleDate = (ms) => BigInt(Math.round(ms - APPLE_EPOCH)) * 1000000n;

// attributedBody as iOS 16 keeps a message's text: some typedstream bytes,
// "NSString", five more, then the length (one byte, or 0x81 and two) and the text.
function attributedBody(text) {
  const t = Buffer.from(text, 'utf8');
  const len = t.length < 0x80 ? Buffer.from([t.length]) : Buffer.concat([Buffer.from([0x81]), Buffer.from([t.length & 0xff, t.length >> 8])]);
  return Buffer.concat([Buffer.from([0x04, 0x0b, 0x73, 0x74, 0x72, 0x65, 0x61, 0x6d]), Buffer.from('NSAttributedString\0NSObject\0NSString', 'latin1'), Buffer.from([0x01, 0x94, 0x84, 0x01, 0x2b]), len, t, Buffer.from([0x86, 0x84, 0x02, 0x69, 0x49])]);
}

// contacts: [{ first, last, phones: [], emails: [] }]. chats: [{ guid, title?,
// handles: [], messages: [{ at (ms), from (a handle, or null for you), text?,
// body? (text only in attributedBody), reaction?, attachment? }] }].
function writeBackup(root, { udid = '00008110-000A1B2C3D4E5F6A', name = "Liam's iPhone", contacts = [], chats = [], encrypted = false, sqlite = require('node:sqlite') } = {}) {
  const dir = path.join(root, udid);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict><key>Device Name</key><string>${name}</string></dict></plist>\n`);
  if (encrypted) { fs.writeFileSync(path.join(dir, 'Manifest.db'), crypto.randomBytes(4096)); return dir; }
  const place = (domain, rel) => { const id = hash(`${domain}-${rel}`); fs.mkdirSync(path.join(dir, id.slice(0, 2)), { recursive: true }); return { id, file: path.join(dir, id.slice(0, 2), id) }; };

  const sms = place('HomeDomain', 'Library/SMS/sms.db');
  const db = new sqlite.DatabaseSync(sms.file);
  db.exec(`CREATE TABLE handle (ROWID INTEGER PRIMARY KEY, id TEXT, service TEXT);
    CREATE TABLE chat (ROWID INTEGER PRIMARY KEY, guid TEXT, display_name TEXT, chat_identifier TEXT);
    CREATE TABLE message (ROWID INTEGER PRIMARY KEY, guid TEXT, text TEXT, attributedBody BLOB, handle_id INTEGER, date INTEGER, is_from_me INTEGER, service TEXT, associated_message_type INTEGER DEFAULT 0, item_type INTEGER DEFAULT 0, cache_has_attachments INTEGER DEFAULT 0);
    CREATE TABLE chat_message_join (chat_id INTEGER, message_id INTEGER, message_date INTEGER);
    CREATE TABLE chat_handle_join (chat_id INTEGER, handle_id INTEGER);`);
  const handles = new Map();
  const handleId = (h) => { if (!handles.has(h)) { db.prepare('INSERT INTO handle (id, service) VALUES (?, ?)').run(h, 'iMessage'); handles.set(h, handles.size + 1); } return handles.get(h); };
  let n = 0;
  chats.forEach((c, ci) => {
    db.prepare('INSERT INTO chat (ROWID, guid, display_name, chat_identifier) VALUES (?, ?, ?, ?)').run(ci + 1, c.guid, c.title || '', c.handles[0] || '');
    c.handles.forEach(h => db.prepare('INSERT INTO chat_handle_join VALUES (?, ?)').run(ci + 1, handleId(h)));
    c.messages.forEach(m => {
      n += 1;
      db.prepare('INSERT INTO message (ROWID, guid, text, attributedBody, handle_id, date, is_from_me, service, associated_message_type, cache_has_attachments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(n, `m${n}`, m.body ? null : (m.text ?? null), m.body ? attributedBody(m.body) : null, m.from ? handleId(m.from) : 0, appleDate(m.at), m.from ? 0 : 1, 'iMessage', m.reaction || 0, m.attachment ? 1 : 0);
      db.prepare('INSERT INTO chat_message_join VALUES (?, ?, ?)').run(ci + 1, n, appleDate(m.at));
    });
  });
  db.close();

  const book = place('HomeDomain', 'Library/AddressBook/AddressBook.sqlitedb');
  const ab = new sqlite.DatabaseSync(book.file);
  ab.exec(`CREATE TABLE ABPerson (ROWID INTEGER PRIMARY KEY, First TEXT, Last TEXT, Nickname TEXT, Organization TEXT);
    CREATE TABLE ABMultiValue (UID INTEGER PRIMARY KEY, record_id INTEGER, property INTEGER, identifier INTEGER, label INTEGER, value TEXT);`);
  contacts.forEach((p, i) => {
    ab.prepare('INSERT INTO ABPerson (ROWID, First, Last) VALUES (?, ?, ?)').run(i + 1, p.first || null, p.last || null);
    (p.phones || []).forEach(v => ab.prepare('INSERT INTO ABMultiValue (record_id, property, value) VALUES (?, 3, ?)').run(i + 1, v));
    (p.emails || []).forEach(v => ab.prepare('INSERT INTO ABMultiValue (record_id, property, value) VALUES (?, 4, ?)').run(i + 1, v));
  });
  ab.close();

  const manifest = new sqlite.DatabaseSync(path.join(dir, 'Manifest.db'));
  manifest.exec('CREATE TABLE Files (fileID TEXT PRIMARY KEY, domain TEXT, relativePath TEXT, flags INTEGER, file BLOB)');
  manifest.prepare('INSERT INTO Files VALUES (?, ?, ?, 1, NULL)').run(sms.id, 'HomeDomain', 'Library/SMS/sms.db');
  manifest.prepare('INSERT INTO Files VALUES (?, ?, ?, 1, NULL)').run(book.id, 'HomeDomain', 'Library/AddressBook/AddressBook.sqlitedb');
  manifest.close();
  return dir;
}

module.exports = { attributedBody, writeBackup };
