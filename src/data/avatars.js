// The avatars a person can have (AvatarPicker): groups of emoji, and the
// skin tones the people in the first group can take. A person's avatar is
// still one emoji string (person.emoji), with any tone inside it, so older
// avatars and backups need nothing new.

export const AVATAR_COLS = 8; // the picker's grid, for ↑ ↓

export const AVATAR_GROUPS = [
  {
    key: 'people', label: 'People', tone: true, items: [
      ['🧑', 'Person'], ['👩', 'Woman'], ['👨', 'Man'], ['🧒', 'Child'], ['👧', 'Girl'], ['👦', 'Boy'], ['🧓', 'Older person'], ['👵', 'Older woman'],
      ['👴', 'Older man'], ['🧑‍🦱', 'Curly hair'], ['👩‍🦱', 'Woman, curly hair'], ['👨‍🦱', 'Man, curly hair'], ['🧑‍🦰', 'Red hair'], ['👩‍🦰', 'Woman, red hair'], ['👨‍🦰', 'Man, red hair'], ['👱', 'Blond hair'],
      ['👱‍♀️', 'Woman, blond hair'], ['🧑‍🦳', 'White hair'], ['👩‍🦳', 'Woman, white hair'], ['👨‍🦳', 'Man, white hair'], ['🧑‍🦲', 'Bald'], ['👨‍🦲', 'Man, bald'], ['🧔', 'Beard'], ['🧕', 'Headscarf'],
      ['👳', 'Turban'], ['👲', 'Cap'], ['🧑‍🎓', 'Student'], ['🧑‍💻', 'Coder'], ['🧑‍🎨', 'Artist'], ['🧑‍🍳', 'Cook'], ['🧑‍🎤', 'Singer'], ['🧑‍🔬', 'Scientist'],
      ['🧑‍⚕️', 'Health worker'], ['🧑‍🏫', 'Teacher'], ['🧑‍💼', 'Office worker'], ['🧑‍🔧', 'Mechanic'], ['🧑‍🌾', 'Farmer'], ['🧑‍🚀', 'Astronaut'], ['🦸', 'Superhero'], ['🧙', 'Wizard'],
    ],
  },
  {
    key: 'faces', label: 'Faces', items: [
      ['😊', 'Smiling'], ['😎', 'Cool'], ['🤓', 'Nerdy'], ['🥳', 'Party'], ['😇', 'Angel'], ['🤠', 'Cowboy'], ['🤩', 'Star-struck'], ['🤗', 'Hugging'],
      ['😴', 'Sleepy'], ['🤪', 'Zany'], ['🙃', 'Upside down'], ['😺', 'Cat face'], ['👻', 'Ghost'], ['🤖', 'Robot'], ['👽', 'Alien'], ['🎃', 'Pumpkin'],
    ],
  },
  {
    key: 'animals', label: 'Animals', items: [
      ['🐶', 'Dog'], ['🐱', 'Cat'], ['🦊', 'Fox'], ['🐻', 'Bear'], ['🐼', 'Panda'], ['🐨', 'Koala'], ['🐯', 'Tiger'], ['🦁', 'Lion'],
      ['🐸', 'Frog'], ['🐵', 'Monkey'], ['🐰', 'Rabbit'], ['🐹', 'Hamster'], ['🐧', 'Penguin'], ['🦉', 'Owl'], ['🐢', 'Turtle'], ['🐙', 'Octopus'],
      ['🦄', 'Unicorn'], ['🐝', 'Bee'], ['🦋', 'Butterfly'], ['🐬', 'Dolphin'], ['🦖', 'Dinosaur'], ['🐺', 'Wolf'], ['🦦', 'Otter'], ['🐳', 'Whale'],
    ],
  },
  {
    key: 'things', label: 'Things', items: [
      ['⭐', 'Star'], ['🌙', 'Moon'], ['☀️', 'Sun'], ['🌈', 'Rainbow'], ['🔥', 'Fire'], ['🌸', 'Blossom'], ['🌻', 'Sunflower'], ['🍀', 'Clover'],
      ['⚽', 'Football'], ['🏀', 'Basketball'], ['🎮', 'Games'], ['🎸', 'Guitar'], ['🎨', 'Art'], ['📚', 'Books'], ['☕', 'Coffee'], ['🍕', 'Pizza'],
      ['🎧', 'Music'], ['✈️', 'Travel'], ['💎', 'Gem'], ['❤️', 'Heart'], ['🏄', 'Surfing'], ['🧗', 'Climbing'], ['🚴', 'Cycling'], ['🎭', 'Theatre'],
    ],
  },
].map(g => ({ ...g, items: g.items.map(([emoji, name]) => ({ emoji, name, tone: !!g.tone, words: `${name} ${g.label}`.toLowerCase() })) }));

// The avatars whose name (or group) has every word typed: "red hair", "dog".
export function findAvatars(query) {
  const words = query.toLowerCase().split(/[\s,]+/).filter(Boolean);
  if (!words.length) return [];
  return AVATAR_GROUPS.flatMap(g => g.items).filter(it => words.every(w => it.words.includes(w)));
}

// Initials on a colour: the other kind of avatar (person.avatar =
// { style: 'initials', color }). 'layer' uses their layer's colours, so it
// changes as they move; the others are fixed, with white letters.
export const INITIAL_COLORS = [
  { key: 'layer', name: 'Their layer' },
  { key: 'sky', name: 'Sky', bg: '#4F82AE' },
  { key: 'teal', name: 'Teal', bg: '#2F8A7E' },
  { key: 'sage', name: 'Sage', bg: '#6A8F4E' },
  { key: 'amber', name: 'Amber', bg: '#C07A32' },
  { key: 'coral', name: 'Coral', bg: '#C55A50' },
  { key: 'rose', name: 'Rose', bg: '#AE5A86' },
  { key: 'violet', name: 'Violet', bg: '#7660B8' },
  { key: 'slate', name: 'Slate', bg: '#56627A' },
];
// The picker's Initials group: one choice per colour.
export const INITIALS_GROUP = {
  key: 'initials', label: 'Initials', cols: 5,
  items: INITIAL_COLORS.map(c => ({ color: c.key, name: c.name, words: `${c.name} initials letters`.toLowerCase() })),
};
export function isInitials(avatar) {
  return !!avatar && typeof avatar === 'object' && avatar.style === 'initials' && INITIAL_COLORS.some(c => c.key === avatar.color);
}
// A photo: a picture you chose, cropped to the circle and shrunk to
// PHOTO_SIZE px (lib/photo.js), kept in the person as a data URL
// (person.avatar = { style: 'photo', src }). Only small JPEG, PNG or WebP
// images are kept.
export const PHOTO_SIZE = 160;
export const PHOTO_GROUP = { key: 'photo', label: 'Photo', photo: true, items: [] };
const PHOTO_SRC = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
export function isPhoto(avatar) {
  return !!avatar && typeof avatar === 'object' && avatar.style === 'photo' && typeof avatar.src === 'string' && avatar.src.length < 300000 && PHOTO_SRC.test(avatar.src);
}
// A valid avatar style (initials or a photo), or null for the emoji.
export function cleanAvatar(avatar) {
  if (isInitials(avatar)) return { style: 'initials', color: avatar.color };
  if (isPhoto(avatar)) return { style: 'photo', src: avatar.src };
  return null;
}

// Where a w × h picture sits in a square of \`size\` px: it covers the square
// at zoom 1, and x and y move it (in parts of the square), never so far that
// the square shows past its edge. Returns the crop as clamped, and the box.
export function photoBox(w, h, { zoom = 1, x = 0, y = 0 } = {}, size = PHOTO_SIZE) {
  const z = Math.max(1, Math.min(4, zoom));
  const scale = (size / Math.min(w, h)) * z;
  const width = w * scale;
  const height = h * scale;
  const maxX = (width - size) / 2 / size;
  const maxY = (height - size) / 2 / size;
  const cx = Math.max(-maxX, Math.min(maxX, x));
  const cy = Math.max(-maxY, Math.min(maxY, y));
  return { crop: { zoom: z, x: cx, y: cy }, left: (size - width) / 2 + cx * size, top: (size - height) / 2 + cy * size, width, height };
}

// The crop that puts the point fx, fy (parts of the picture's width and
// height) in the middle of the circle, at `zoom`, kept covering the circle.
export function cropAround(w, h, fx, fy, zoom = 1) {
  const z = Math.max(1, Math.min(4, zoom));
  const k = z / Math.min(w, h);
  return photoBox(w, h, { zoom: z, x: w * k * (0.5 - fx), y: h * k * (0.5 - fy) }).crop;
}

// Where a picture starts in the circle before it's moved: the upper middle
// of a portrait, where a face usually is; the middle of anything wider.
export function startCrop(w, h) {
  return cropAround(w, h, 0.5, h > w * 1.1 ? 0.35 : 0.45, 1);
}

// The crop that starts on the biggest face found in a w × h picture
// (lib/photo.js, findFaces): its middle in the middle of the circle, zoomed
// so the face fills about half of it. null when there's no face, or the
// sizes don't match the picture as shown (a phone photo turned by its
// camera's rotation, say), since the face would then be in the wrong place.
export function faceCrop(found, w, h) {
  if (!found || !Array.isArray(found.faces) || !found.faces.length || found.width !== w || found.height !== h) return null;
  const face = found.faces.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
  const zoom = Math.max(1, Math.min(4, (0.5 * Math.min(w, h)) / Math.max(face.w, face.h)));
  return cropAround(w, h, (face.x + face.w / 2) / w, (face.y + face.h / 2) / h, zoom);
}

// A file that's a picture Layers can read (by type, or by name when the type
// is missing).
export function isPictureFile(file) {
  return /^image\/(jpeg|png|webp|gif|bmp)$/.test(file.type || '') || /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name || '');
}

// The person a picture is named after ("Kai.jpg", "kai smith 2.png"): their
// whole name, or a first name only one person has. Otherwise null.
export function personForFile(fileName, people) {
  const words = String(fileName || '').replace(/\.[^.]+$/, '').toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  if (!words.length) return null;
  const whole = people.filter(p => p.name.toLowerCase().split(/\s+/).every((w, i) => words[i] === w));
  if (whole.length === 1) return whole[0].id;
  const first = people.filter(p => p.name.toLowerCase().split(/\s+/)[0] === words[0]);
  return first.length === 1 ? first[0].id : null;
}

// "Ethan M" -> "EM"; one name -> its first two letters ("Isla" -> "Is").
export function initialsOf(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const first = [...words[0]];
  if (words.length === 1) return first[0].toUpperCase() + (first[1] || '').toLowerCase();
  return (first[0] + [...words[words.length - 1]][0]).toUpperCase();
}

// The skin tones, as Fitzpatrick modifiers ('' is the default yellow), with
// a swatch colour for the picker.
export const SKIN_TONES = [
  { mod: '', name: 'Default', swatch: '#FFC83D' },
  { mod: '\u{1F3FB}', name: 'Light', swatch: '#F7DECE' },
  { mod: '\u{1F3FC}', name: 'Medium-light', swatch: '#F3D2A2' },
  { mod: '\u{1F3FD}', name: 'Medium', swatch: '#D5AB88' },
  { mod: '\u{1F3FE}', name: 'Medium-dark', swatch: '#AF7E57' },
  { mod: '\u{1F3FF}', name: 'Dark', swatch: '#7C533E' },
];
const TONE_RE = /[\u{1F3FB}-\u{1F3FF}]/u;

// An emoji with a skin tone: the modifier goes straight after the first
// character ("👩‍🦰" -> "👩🏽‍🦰"), replacing a variation selector there.
export function withTone(emoji, mod) {
  if (!mod) return emoji;
  const chars = [...emoji];
  const rest = chars.slice(1);
  if (rest[0] === '️') rest.shift();
  return [chars[0], mod, ...rest].join('');
}

// Variation selectors don't change which emoji it is ("👱‍♀" is "👱‍♀️").
const plain = (s) => s.replace(/️/g, '');
const ALL = AVATAR_GROUPS.flatMap(g => g.items);

// { base, mod }: an avatar without its tone (as the picker spells it), and
// the tone ('' for none).
export function splitTone(emoji) {
  const s = String(emoji || '');
  const m = s.match(TONE_RE);
  const bare = m ? s.replace(TONE_RE, '') : s;
  const item = ALL.find(it => plain(it.emoji) === plain(bare));
  return { base: item ? item.emoji : bare, mod: m ? m[0] : '' };
}

// Which group an avatar is in (0, People, if it's none of them).
export function groupOf(emoji) {
  const { base } = splitTone(emoji);
  const i = AVATAR_GROUPS.findIndex(g => g.items.some(it => it.emoji === base));
  return i < 0 ? 0 : i;
}

// The name of an avatar, for screen readers.
export function avatarName(emoji) {
  const { base, mod } = splitTone(emoji);
  const item = ALL.find(it => it.emoji === base);
  const tone = SKIN_TONES.find(t => t.mod === mod);
  return item ? `${item.name}${mod && tone ? `, ${tone.name.toLowerCase()} skin` : ''}` : 'Avatar';
}
