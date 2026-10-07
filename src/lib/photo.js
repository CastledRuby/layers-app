// Photos for avatars: reading a picture you chose, and drawing the part in
// the circle at PHOTO_SIZE px as a small JPEG (data/avatars.js has where it
// sits, photoBox). Nothing leaves the computer: the picture is read here and
// only the small crop is kept, in the person.

import { PHOTO_SIZE, photoBox } from '../data/avatars.js';

export const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

// A chosen file as an <img>, or null if it isn't a picture this can read.
export function loadPhoto(file) {
  return new Promise((resolve) => {
    if (!file || !/^image\//.test(file.type) || file.size > MAX_PHOTO_BYTES) { resolve(null); return; }
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth && img.naturalHeight ? img : null);
      img.onerror = () => resolve(null);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Where the faces are in these pictures (File objects), from Windows' own
// face detector through the bridge (electron/faces.cjs): one
// { width, height, faces: [{ x, y, w, h }] } or null per file. null when
// there's no bridge (the browser preview, tests) or it fails.
export async function findFaces(files) {
  const sys = typeof window !== 'undefined' ? window.layersSystem : null;
  if (!sys || typeof sys.findFaces !== 'function' || !files || !files.length) return null;
  try {
    const found = await sys.findFaces(files);
    return Array.isArray(found) ? found : null;
  } catch {
    return null;
  }
}

// A screenshot for chat analysis, at most 1568 px on its long side (the
// most Claude looks at) as JPEG: { mediaType, data } in base64, or null
// where there's no canvas.
export function shrinkForAnalysis(img, longest = 1568) {
  const scale = Math.min(1, longest / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  let ctx = null;
  try { ctx = canvas.getContext('2d'); } catch { ctx = null; }
  if (!ctx) return null;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { mediaType: 'image/jpeg', data: canvas.toDataURL('image/jpeg', 0.85).split(',')[1] };
}

// The crop as a small JPEG data URL, or null where there's no canvas.
export function renderPhoto(img, crop) {
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;
  let ctx = null;
  try { ctx = canvas.getContext('2d'); } catch { ctx = null; }
  if (!ctx) return null;
  const box = photoBox(img.naturalWidth, img.naturalHeight, crop, PHOTO_SIZE);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, PHOTO_SIZE, PHOTO_SIZE);
  ctx.drawImage(img, box.left, box.top, box.width, box.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}
