// The sync file (docs/roadmap.md, "The plan from here"): Layers' data,
// encrypted with your passphrase, in OneDrive, and one round of syncing with
// it. Plain Web Crypto, so the phone can run the same code later; the
// laptop's main process only reads and writes the file (electron/sync.cjs).
//
// The file: { layersSync: 1, salt, iv, iterations, data } in JSON, with
// `data` the payload (people, journal, events, goals, profile, skills,
// achievements, deleted, savedAt) as JSON, encrypted with AES-GCM under a key
// made from the passphrase (PBKDF2, SHA-256). Without the passphrase it's
// noise; changing a byte makes it unreadable rather than wrong.

import { validateBackup } from './backup.js';
import { mergeData } from './sync.js';

export const SYNC_FORMAT = 1;
export const ITERATIONS = 310000;
export const MAIN_FILE = 'layers-sync.json';

// Why a sync file couldn't be used: 'wrong-passphrase', 'not-sync-file',
// 'newer' (made by a newer Layers) or 'damaged'.
export class SyncError extends Error {
  constructor(code) { super(code); this.code = code; }
}

const subtle = () => globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();
function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(text) {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// Making the key is slow on purpose (that's what makes guessing slow), so
// it's done once per passphrase and salt.
const keys = new Map();
async function keyFor(passphrase, salt, iterations) {
  const id = `${iterations}:${salt}:${passphrase}`;
  if (!keys.has(id)) {
    keys.set(id, (async () => {
      const base = await subtle().importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
      return subtle().deriveKey({ name: 'PBKDF2', salt: fromB64(salt), iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    })());
  }
  return keys.get(id);
}

// The payload as the file's text. `salt` keeps the file's own (so the key
// doesn't have to be made again); a new file gets a new one.
export async function sealSyncFile(payload, passphrase, { salt = null, iterations = ITERATIONS } = {}) {
  const useSalt = salt || toB64(globalThis.crypto.getRandomValues(new Uint8Array(16)));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFor(passphrase, useSalt, iterations);
  const sealed = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(payload))));
  return JSON.stringify({ layersSync: SYNC_FORMAT, salt: useSalt, iv: toB64(iv), iterations, data: toB64(sealed) });
}

// The file's text as { payload, salt }, or a SyncError.
export async function openSyncFile(text, passphrase) {
  let file = null;
  try { file = JSON.parse(text); } catch { throw new SyncError('not-sync-file'); }
  if (!file || typeof file !== 'object' || typeof file.layersSync !== 'number') throw new SyncError('not-sync-file');
  if (file.layersSync > SYNC_FORMAT) throw new SyncError('newer');
  if (![file.salt, file.iv, file.data].every(v => typeof v === 'string') || !Number.isInteger(file.iterations)) throw new SyncError('damaged');
  let plain;
  try {
    const key = await keyFor(passphrase, file.salt, file.iterations);
    plain = await subtle().decrypt({ name: 'AES-GCM', iv: fromB64(file.iv) }, key, fromB64(file.data));
  } catch {
    // AES-GCM can't tell a wrong passphrase from a changed file: both fail the check.
    throw new SyncError('wrong-passphrase');
  }
  try { return { payload: JSON.parse(dec.decode(plain)), salt: file.salt }; } catch { throw new SyncError('damaged'); }
}

const KEYS = ['people', 'journal', 'events', 'generalGoals', 'profile', 'skills', 'achievements', 'deleted'];
// Whether two copies of the data say the same (the time they were saved
// aside). Order doesn't count: each device keeps its own order for lists and
// for a record's fields, so both are put in one order before comparing.
export function sameData(a, b) {
  return KEYS.every(k => canonical(a[k] == null ? null : a[k]) === canonical(b[k] == null ? null : b[k]));
}
function canonical(value) {
  const walk = (v) => {
    if (Array.isArray(v)) {
      const items = v.map(walk);
      return v.every(x => x && typeof x === 'object' && typeof x.id === 'string')
        ? items.map((x, i) => [`${v[i].kind || ''}:${v[i].id}`, x]).sort(([p], [q]) => (p < q ? -1 : p > q ? 1 : 0)).map(([, x]) => x)
        : items;
    }
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(key => [key, walk(v[key])]));
    return v;
  };
  return JSON.stringify(walk(value));
}

// One round of syncing. bridge: { readSyncFiles(), writeSyncFile(text),
// removeSyncCopies(names), setAsideSyncFile() } (electron/sync.cjs through the preload). local:
// this computer's data as saved (stamped, with deleted). Every sync file is
// read, checked like a backup, and merged with local, record by record; the
// result is written back if it differs from the file, and copies OneDrive
// made are removed once merged. Returns { merged, changed } (changed: the
// merged data differs from local, so the app should take it), or throws a
// SyncError (a wrong passphrase stops it before anything is written).
export async function syncOnce({ bridge, passphrase, local, now = new Date().toISOString() }) {
  const files = (await bridge.readSyncFiles()) || [];
  let merged = local;
  let mainPayload = null;
  let salt = null;
  const used = [];
  for (const f of files) {
    let opened = null;
    let checked = null;
    try {
      opened = await openSyncFile(f.text, passphrase);
      checked = validateBackup({ ...opened.payload, version: 1 }, { source: 'sync' });
      if (!checked.ok) throw new SyncError('damaged');
    } catch (e) {
      if (f.name !== MAIN_FILE) continue; // a stray copy that won't open is left alone
      // A wrong passphrase, or a file from a newer Layers, stops everything.
      // One that can't be read at all is put aside (kept, renamed) and a new
      // one written, so syncing doesn't stay stuck.
      if (!(e instanceof SyncError) || e.code === 'wrong-passphrase' || e.code === 'newer') throw e;
      await bridge.setAsideSyncFile();
      continue;
    }
    if (f.name === MAIN_FILE) { mainPayload = pick(checked.data); salt = opened.salt; }
    merged = mergeData(merged, checked.data, now);
    used.push(f.name);
  }
  // Compared and written in the same tidied form a backup is read in (and
  // saved data at startup), so two devices agree on what "the same" is and
  // don't keep rewriting the file for differences that don't matter.
  const result = tidy(merged);
  if (!mainPayload || !sameData(result, mainPayload)) {
    const text = await sealSyncFile({ ...result, savedAt: now }, passphrase, { salt });
    const wrote = await bridge.writeSyncFile(text);
    if (wrote && wrote.error) throw new SyncError('write');
  }
  const copies = used.filter(n => n !== MAIN_FILE);
  if (copies.length) await bridge.removeSyncCopies(copies);
  return { merged: result, changed: !sameData(result, tidy(local)) };
}

function pick(data) {
  return Object.fromEntries(KEYS.map(k => [k, data[k] == null ? (k === 'profile' || k === 'skills' || k === 'achievements' ? {} : []) : data[k]]));
}
function tidy(data) {
  const checked = validateBackup({ ...data, version: 1 }, { source: 'sync' });
  return pick(checked.ok ? checked.data : data);
}

// What to say about a SyncError.
export function syncErrorText(e) {
  const code = e && e.code;
  if (code === 'wrong-passphrase') return "That passphrase doesn't open the sync file (or the file was changed). Check it's the one you chose first.";
  if (code === 'newer') return 'The sync file was made by a newer Layers. Update Layers here.';
  if (code === 'no-passphrase') return 'Sync needs its passphrase again: turn it off and on in Me.';
  if (code === 'write') return "Couldn't write the sync file. Is OneDrive running?";
  return "Couldn't sync just now. It'll try again.";
}
