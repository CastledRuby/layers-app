// Chat exports for Coach (docs/electron.md, "Chat exports"): the "Layers
// chats" folder in Documents (OneDrive on this laptop), where you save a
// WhatsApp chat export from your phone (its zip, or the .txt) or Instagram's
// "Download your information" zip. Only reads: what's there, and the text of
// one file's chat. A zip is opened here (Node's own inflate, nothing bundled);
// the page reads the chat itself (src/lib/chatImport.js). Files are left as
// they are.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const MAX_FILE = 300 * 1024 * 1024; // a zip or .txt
const MAX_ENTRY = 60 * 1024 * 1024; // one file inside a zip, unpacked
const MAX_TOTAL = 200 * 1024 * 1024; // everything read from one zip
// Instagram's messages, in either layout of its download.
const INSTAGRAM_JSON = /(?:^|\/)messages\/inbox\/[^/]+\/message_\d+\.json$/;
const INSTAGRAM_HTML = /(?:^|\/)messages\/inbox\/[^/]+\/message_\d+\.html$/;

function chatsDir({ documents, userData, env = process.env }) {
  if (env.LAYERS_CHATS_DIR) return env.LAYERS_CHATS_DIR;
  if (env.LAYERS_USER_DATA_DIR) return path.join(userData, 'Chats');
  return path.join(documents, 'Layers chats');
}

// Where a zip's central directory is, from its last 64 KB: { count, size,
// offset }. Throws if it isn't a zip Layers can read.
function zipEnd(tail) {
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) !== 0x06054b50) continue;
    const count = tail.readUInt16LE(i + 10);
    const size = tail.readUInt32LE(i + 12);
    const offset = tail.readUInt32LE(i + 16);
    if (count === 0xffff || offset === 0xffffffff) throw new Error('That zip is too big to read. Download fewer things, or a shorter date range.');
    return { count, size, offset };
  }
  throw new Error("That isn't a zip file.");
}

// The files in a zip, from its central directory: [{ name, method, size,
// compressedSize, offset }].
function centralEntries(cd, count) {
  const entries = [];
  let p = 0;
  for (let i = 0; i < count; i++) {
    if (p + 46 > cd.length || cd.readUInt32LE(p) !== 0x02014b50) throw new Error('That zip is damaged.');
    const nameLength = cd.readUInt16LE(p + 28);
    const extraLength = cd.readUInt16LE(p + 30);
    const commentLength = cd.readUInt16LE(p + 32);
    entries.push({
      name: cd.subarray(p + 46, p + 46 + nameLength).toString('utf8'),
      method: cd.readUInt16LE(p + 10),
      compressedSize: cd.readUInt32LE(p + 20),
      size: cd.readUInt32LE(p + 24),
      offset: cd.readUInt32LE(p + 42),
    });
    p += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

// A zip in memory.
function zipEntries(buf) {
  const end = zipEnd(buf.subarray(Math.max(0, buf.length - 22 - 65535)));
  return centralEntries(buf.subarray(end.offset, end.offset + end.size), end.count);
}

// A zip on disk, reading only its end and central directory (an Instagram
// download can be large).
function zipEntriesOfFile(file, size) {
  const fd = fs.openSync(file, 'r');
  try {
    const tail = Buffer.alloc(Math.min(size, 22 + 65535));
    fs.readSync(fd, tail, 0, tail.length, size - tail.length);
    const end = zipEnd(tail);
    const cd = Buffer.alloc(end.size);
    fs.readSync(fd, cd, 0, end.size, end.offset);
    return centralEntries(cd, end.count);
  } finally {
    fs.closeSync(fd);
  }
}

// One file from a zip, unpacked.
function zipEntryData(buf, entry) {
  if (entry.size > MAX_ENTRY) throw new Error('A file in that zip is too big to read.');
  const p = entry.offset;
  if (buf.readUInt32LE(p) !== 0x04034b50) throw new Error('That zip is damaged.');
  const start = p + 30 + buf.readUInt16LE(p + 26) + buf.readUInt16LE(p + 28);
  const data = buf.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return data;
  if (entry.method === 8) return zlib.inflateRawSync(data, { maxOutputLength: MAX_ENTRY });
  throw new Error("That zip is packed in a way Layers can't read.");
}

// What an export is, from its name and (for a zip) what's in it:
// 'whatsapp', 'instagram', 'instagram-html' (downloaded as HTML), or null.
function kindOf(name, entries) {
  if (/\.txt$/i.test(name)) return 'whatsapp';
  if (!entries) return null;
  if (entries.some(e => INSTAGRAM_JSON.test(e.name))) return 'instagram';
  if (entries.some(e => INSTAGRAM_HTML.test(e.name))) return 'instagram-html';
  if (entries.some(e => /(^|\/)[^/]*\.txt$/i.test(e.name) && !e.name.startsWith('__MACOSX'))) return 'whatsapp';
  return null;
}

// A WhatsApp export's chat name from its file name ("WhatsApp Chat -
// Amelie.zip", "WhatsApp Chat with Amelie (2).txt"), or null.
function whatsAppTitle(name) {
  const m = String(name).match(/^WhatsApp Chat (?:-|with) (.+?)(?:\s*\(\d+\)|\s+\d+)?\.(?:zip|txt)$/i);
  return m ? m[1].trim() : null;
}

// A file in the folder, by its name only: { file, stat }.
function fileIn(dir, name) {
  const file = path.join(dir, String(name));
  if (path.basename(String(name)) !== name || !fs.existsSync(file)) throw new Error("That file isn't in the Layers chats folder.");
  const stat = fs.statSync(file);
  if (!stat.isFile()) throw new Error("That file isn't in the Layers chats folder.");
  if (stat.size > MAX_FILE) throw new Error('That file is too big to read.');
  return { file, stat };
}

// The chat exports in the folder, newest first: [{ name, kind, title, size,
// modified }]. Other files are left out, and the folder is made if it's not
// there yet (so it shows up in OneDrive on your phone).
function listExports(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* listed as empty */ }
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return []; }
  const out = [];
  names.filter(n => /\.(zip|txt)$/i.test(n)).forEach(name => {
    try {
      const { file, stat } = fileIn(dir, name);
      const kind = kindOf(name, /\.zip$/i.test(name) ? zipEntriesOfFile(file, stat.size) : null);
      if (kind) out.push({ name, kind, title: kind === 'whatsapp' ? whatsAppTitle(name) : null, size: stat.size, modified: stat.mtimeMs });
    } catch { /* not a chat export, or damaged: skipped */ }
  });
  return out.sort((a, b) => b.modified - a.modified);
}

// One export's chat text: { kind, title, files: [{ path, text }] }: a
// WhatsApp chat's .txt, or every Instagram messages file. { error } if it
// can't be read.
function readExport(dir, name) {
  try {
    const buf = fs.readFileSync(fileIn(dir, name).file);
    if (/\.txt$/i.test(name)) return { kind: 'whatsapp', title: whatsAppTitle(name), files: [{ path: name, text: buf.toString('utf8') }] };
    const entries = zipEntries(buf);
    const kind = kindOf(name, entries);
    if (kind === 'instagram-html') return { error: 'That Instagram download is in HTML. Download it again choosing JSON as the format.' };
    if (!kind) return { error: "That zip doesn't have a WhatsApp or Instagram chat in it." };
    const wanted = kind === 'instagram'
      ? entries.filter(e => INSTAGRAM_JSON.test(e.name))
      : entries.filter(e => /(^|\/)[^/]*\.txt$/i.test(e.name) && !e.name.startsWith('__MACOSX')).slice(0, 1);
    let total = 0;
    const files = wanted.map(e => {
      total += e.size;
      if (total > MAX_TOTAL) throw new Error('That download is too big to read. Choose fewer things, or a shorter date range.');
      return { path: e.name, text: zipEntryData(buf, e).toString('utf8') };
    });
    return { kind, title: kind === 'whatsapp' ? whatsAppTitle(name) : null, files };
  } catch (e) {
    return { error: e.message || "Couldn't read that file." };
  }
}

// Calls onChange (once things settle) when files come and go in the folder,
// such as OneDrive bringing down a new export. Returns a stop function.
function watchExports(dir, onChange, wait = 1500) {
  let timer = null;
  let watcher = null;
  try {
    fs.mkdirSync(dir, { recursive: true });
    watcher = fs.watch(dir, () => { clearTimeout(timer); timer = setTimeout(onChange, wait); });
    watcher.on('error', () => {});
  } catch { /* nothing to watch: Coach still looks when it opens */ }
  return () => { clearTimeout(timer); if (watcher) watcher.close(); };
}

module.exports = { chatsDir, listExports, readExport, watchExports, whatsAppTitle, zipEntries };
