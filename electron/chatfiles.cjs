// Chat exports for Coach (docs/electron.md, "Chat exports"): the "Layers
// chats" folder in Documents (OneDrive on this laptop), where you save a
// WhatsApp chat export from your phone (its zip, or the .txt), Instagram's
// "Download your information" or Snapchat's "My Data" (its zip, or the
// folder it was unzipped to), straight in it or in folders of your own. Only
// reads: what's there, and the text of one export's chat. A zip is opened
// here (Node's own inflate, nothing bundled); the page reads the chat itself
// (src/lib/chatImport.js). Files are left as they are.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const MAX_FILE = 300 * 1024 * 1024; // a zip or .txt
const MAX_ENTRY = 60 * 1024 * 1024; // one file inside a zip, unpacked
const MAX_TOTAL = 200 * 1024 * 1024; // everything read from one zip
// Instagram's messages, in either layout of its download.
const INSTAGRAM_JSON = /(?:^|\/)messages\/inbox\/[^/]+\/message_\d+\.json$/;
const INSTAGRAM_HTML = /(?:^|\/)messages\/inbox\/[^/]+\/message_\d+\.html$/;
// Snapchat's chats (json/chat_history.json) and its friends list (display names).
const SNAPCHAT_JSON = /(?:^|\/)json\/(chat_history|friends)\.json$/;
const SNAPCHAT_HTML = /(?:^|\/)html\/chat_history(\.html|\/)/;

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
// 'whatsapp', 'instagram', 'snapchat', 'instagram-html' or 'snapchat-html'
// (downloaded as HTML), or null.
function kindOf(name, entries) {
  if (/\.txt$/i.test(name)) return 'whatsapp';
  if (!entries) return null;
  if (entries.some(e => INSTAGRAM_JSON.test(e.name))) return 'instagram';
  if (entries.some(e => INSTAGRAM_HTML.test(e.name))) return 'instagram-html';
  if (entries.some(e => /(?:^|\/)json\/chat_history\.json$/.test(e.name))) return 'snapchat';
  if (entries.some(e => SNAPCHAT_HTML.test(e.name))) return 'snapchat-html';
  if (entries.some(e => /(^|\/)[^/]*\.txt$/i.test(e.name) && !e.name.startsWith('__MACOSX'))) return 'whatsapp';
  return null;
}

// A WhatsApp export's chat name from its file name ("WhatsApp Chat -
// Amelie.zip", "WhatsApp Chat with Amelie (2).txt"), or null.
function whatsAppTitle(name) {
  const m = String(name).match(/^WhatsApp Chat (?:-|with) (.+?)(?:\s*\(\d+\)|\s+\d+)?\.(?:zip|txt)$/i);
  return m ? m[1].trim() : null;
}

function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

// How far down the folders in the Layers chats folder are looked through,
// and folders of photos and the like, which never hold a chat.
const MAX_DEPTH = 6;
const MEDIA_DIR = /^(photos|videos|audio|gifs|files|media|stickers_used|__MACOSX)$/i;

// Where an unzipped Instagram download starts, from the path of its
// messages folder: above messages and your_instagram_activity.
function downloadName(rel) {
  const up = rel.replace(/(^|\/)messages$/, '');
  return up.replace(/(^|\/)your_instagram_activity$/, '') || up || rel;
}

// Whether a folder is an unzipped Snapchat "My Data" download: it has
// json/chat_history.json, or (downloaded as HTML only) html/chat_history.
function isSnapchatDownload(folder, names) {
  if (names.has('json') && fs.existsSync(path.join(folder, 'json', 'chat_history.json'))) return true;
  return names.has('html') && (fs.existsSync(path.join(folder, 'html', 'chat_history.html')) || isDir(path.join(folder, 'html', 'chat_history')));
}

// Every chat export in the folder and the folders in it (however you've
// arranged them, up to MAX_DEPTH down), each named by its path from the
// folder ("Instagram/instagram-liam.zip"): [{ name, file }] for a zip or
// .txt, [{ name, inbox }] for an unzipped Instagram download (named from
// where it starts, since Windows' Extract All adds a folder of the same name
// and newer downloads put messages under your_instagram_activity), and [{
// name, snapchat }] for an unzipped Snapchat download.
function findExports(dir) {
  const found = [];
  (function walk(folder, rel, depth) {
    let entries = [];
    try { entries = fs.readdirSync(folder, { withFileTypes: true }); } catch { return; }
    if (rel && isSnapchatDownload(folder, new Set(entries.map(e => e.name)))) { found.push({ name: rel, snapchat: folder }); return; }
    entries.forEach(e => {
      if (e.name.startsWith('.')) return;
      const full = path.join(folder, e.name);
      const name = rel ? `${rel}/${e.name}` : e.name;
      if (!(e.isDirectory() || (e.isSymbolicLink() && isDir(full)))) {
        if (/\.(zip|txt)$/i.test(e.name)) found.push({ name, file: full });
        return;
      }
      if (e.name === 'messages' && isDir(path.join(full, 'inbox'))) { found.push({ name: downloadName(name), inbox: path.join(full, 'inbox') }); return; }
      if (depth < MAX_DEPTH && (depth === 0 || !MEDIA_DIR.test(e.name))) walk(full, name, depth + 1);
    });
  })(dir, '', 0);
  return found;
}

// An unzipped Instagram download's messages files, each named as it is in
// the zip so the page reads it the same way: { kind ('instagram', or
// 'instagram-html' if downloaded as HTML), files: [{ path, file, size,
// modified }] }, or null if there are none.
function inboxFiles(inbox) {
  const files = [];
  let html = false;
  let threads = [];
  try { threads = fs.readdirSync(inbox); } catch { return null; }
  threads.forEach(thread => {
    let names = [];
    try { names = fs.readdirSync(path.join(inbox, thread)); } catch { return; }
    names.forEach(name => {
      if (/^message_\d+\.html$/.test(name)) html = true;
      if (!/^message_\d+\.json$/.test(name)) return;
      const file = path.join(inbox, thread, name);
      try {
        const stat = fs.statSync(file);
        if (stat.isFile()) files.push({ path: `messages/inbox/${thread}/${name}`, file, size: stat.size, modified: stat.mtimeMs });
      } catch { /* gone since it was listed */ }
    });
  });
  if (files.length) return { kind: 'instagram', files };
  return html ? { kind: 'instagram-html', files } : null;
}

// An unzipped Snapchat download's chats and friends list, named as in its
// zip: { kind ('snapchat', or 'snapchat-html' if it has no JSON), files }.
function snapchatFiles(folder) {
  const files = [];
  ['chat_history.json', 'friends.json'].forEach(name => {
    const file = path.join(folder, 'json', name);
    try {
      const stat = fs.statSync(file);
      if (stat.isFile()) files.push({ path: `json/${name}`, file, size: stat.size, modified: stat.mtimeMs });
    } catch { /* not in this download */ }
  });
  return files.some(f => f.path === 'json/chat_history.json') ? { kind: 'snapchat', files } : { kind: 'snapchat-html', files: [] };
}

// What's in an unzipped download that was found ({ kind, files }), or null
// for a zip or .txt.
function unzippedFiles(found) {
  if (found.inbox) return inboxFiles(found.inbox) || { kind: 'instagram', files: [] };
  if (found.snapchat) return snapchatFiles(found.snapchat);
  return null;
}

// A zip or .txt found in the folder: { stat }, or it throws.
function statOf(file) {
  const stat = fs.statSync(file);
  if (!stat.isFile()) throw new Error("That file isn't in the Layers chats folder.");
  if (stat.size > MAX_FILE) throw new Error('That file is too big to read.');
  return stat;
}

// The chat exports in the folder and the folders in it, newest first: [{
// name, kind, title, size, modified }]. An unzipped download is one too, as
// big as its chat files and as new as the newest of them. Other files are
// left out, and the folder is made if it's not there yet (so it shows up in
// OneDrive on your phone).
function listExports(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* listed as empty */ }
  const out = [];
  findExports(dir).forEach(found => {
    try {
      const unzipped = unzippedFiles(found);
      if (unzipped) {
        if (!unzipped.files.length && !/-html$/.test(unzipped.kind)) return;
        const modified = unzipped.files.length ? Math.max(...unzipped.files.map(f => f.modified)) : fs.statSync(found.inbox || found.snapchat).mtimeMs;
        out.push({ name: found.name, kind: unzipped.kind, title: null, size: unzipped.files.reduce((n, f) => n + f.size, 0), modified });
        return;
      }
      const stat = statOf(found.file);
      const base = path.basename(found.file);
      const kind = kindOf(base, /\.zip$/i.test(base) ? zipEntriesOfFile(found.file, stat.size) : null);
      if (kind) out.push({ name: found.name, kind, title: kind === 'whatsapp' ? whatsAppTitle(base) : null, size: stat.size, modified: stat.mtimeMs });
    } catch { /* not a chat export, or damaged: skipped */ }
  });
  return out.sort((a, b) => b.modified - a.modified);
}

// An unzipped download's chat files, as from its zip.
function readUnzipped(found) {
  if (found.kind === 'instagram-html') return { error: 'That Instagram download is in HTML. Download it again choosing JSON as the format.' };
  if (found.kind === 'snapchat-html') return { error: 'That Snapchat download is only HTML. Request it again with "Export JSON files" turned on.' };
  if (!found.files.length) return { error: "That download doesn't have any messages in it." };
  let total = 0;
  const files = found.files.map(f => {
    if (f.size > MAX_ENTRY) throw new Error('A file in that download is too big to read.');
    total += f.size;
    if (total > MAX_TOTAL) throw new Error('That download is too big to read. Choose fewer things, or a shorter date range.');
    return { path: f.path, text: fs.readFileSync(f.file, 'utf8') };
  });
  return { kind: found.kind, title: null, files };
}

// One export's chat text, by the name it was listed with (so nothing outside
// the folder can be read): { kind, title, files: [{ path, text }] }: a
// WhatsApp chat's .txt, every Instagram messages file, or Snapchat's chats
// and friends list (from a zip or its unzipped folder). { error } if it
// can't be read.
function readExport(dir, name) {
  try {
    const found = findExports(dir).find(f => f.name === name);
    if (!found) throw new Error("That file isn't in the Layers chats folder.");
    const unzipped = unzippedFiles(found);
    if (unzipped) return readUnzipped(unzipped);
    statOf(found.file);
    const buf = fs.readFileSync(found.file);
    const base = path.basename(found.file);
    if (/\.txt$/i.test(base)) return { kind: 'whatsapp', title: whatsAppTitle(base), files: [{ path: base, text: buf.toString('utf8') }] };
    const entries = zipEntries(buf);
    const kind = kindOf(base, entries);
    if (kind === 'instagram-html') return { error: 'That Instagram download is in HTML. Download it again choosing JSON as the format.' };
    if (kind === 'snapchat-html') return { error: 'That Snapchat download is only HTML. Request it again with "Export JSON files" turned on.' };
    if (!kind) return { error: "That zip doesn't have a WhatsApp, Instagram or Snapchat chat in it." };
    const wanted = kind === 'instagram' ? entries.filter(e => INSTAGRAM_JSON.test(e.name))
      : kind === 'snapchat' ? entries.filter(e => SNAPCHAT_JSON.test(e.name))
        : entries.filter(e => /(^|\/)[^/]*\.txt$/i.test(e.name) && !e.name.startsWith('__MACOSX')).slice(0, 1);
    let total = 0;
    const files = wanted.map(e => {
      total += e.size;
      if (total > MAX_TOTAL) throw new Error('That download is too big to read. Choose fewer things, or a shorter date range.');
      return { path: e.name, text: zipEntryData(buf, e).toString('utf8') };
    });
    return { kind, title: kind === 'whatsapp' ? whatsAppTitle(base) : null, files };
  } catch (e) {
    return { error: e.message || "Couldn't read that file." };
  }
}

// Calls onChange (once things settle) when files come and go in the folder or
// the folders in it, such as OneDrive bringing down a new export or an
// unzipped download. Returns a stop function.
function watchExports(dir, onChange, wait = 1500) {
  let timer = null;
  let watcher = null;
  try {
    fs.mkdirSync(dir, { recursive: true });
    watcher = fs.watch(dir, { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(onChange, wait); });
    watcher.on('error', () => {});
  } catch { /* nothing to watch: Coach still looks when it opens */ }
  return () => { clearTimeout(timer); if (watcher) watcher.close(); };
}

module.exports = { chatsDir, listExports, readExport, watchExports, whatsAppTitle, zipEntries };
