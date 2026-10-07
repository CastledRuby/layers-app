// Renders the chosen brand, direction A "Rings" (branding/README.md), into the
// files the app and its installer use. Run it after changing a drawing:
//
//   npm run brand:render        (electron scripts/render-brand.cjs)
//
// It runs inside Electron so Chromium draws the SVGs, and writes:
//   electron/icon.png              256 px app icon (window on Linux, AppImage)
//   electron/icon.ico              16-256 px for the exe, installer and taskbar;
//                                  16, 24 and 32 px use the simplified drawing
//   electron/tray-icon-light.png   white tray glyph for a dark taskbar, 16 px,
//   electron/tray-icon-light@2x.png  and 32 px for 200% scaling
//   electron/tray-icon-dark.png    ink glyph for a light taskbar, likewise
//   electron/tray-icon-dark@2x.png
//   electron/installer-sidebar.bmp 164 x 314, the installer's side panel
//   public/icon.svg                the web favicon (a copy of the icon drawing)
//   ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
//                                  the iPhone app's icon: 1024 px, square
//                                  (iOS rounds the corners itself)
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const brand = (name) => fs.readFileSync(path.join(root, 'branding', 'drafts', `rings-${name}.svg`), 'utf8');
const out = (rel) => path.join(root, rel);

// An .ico holding PNG images (Windows Vista and later read these at any size).
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt8(0, e + 2);
    header.writeUInt8(0, e + 3);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(png.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map(i => i.png)]);
}

// A 24-bit BMP (what NSIS wants for the sidebar) from RGBA pixels.
function bmp(width, height, rgba) {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const data = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const row = (height - 1 - y) * rowSize; // bottom-up
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4;
      data[row + x * 3] = rgba[s + 2];
      data[row + x * 3 + 1] = rgba[s + 1];
      data[row + x * 3 + 2] = rgba[s];
    }
  }
  const head = Buffer.alloc(54);
  head.write('BM', 0);
  head.writeUInt32LE(54 + data.length, 2);
  head.writeUInt32LE(54, 10);
  head.writeUInt32LE(40, 14);
  head.writeInt32LE(width, 18);
  head.writeInt32LE(height, 22);
  head.writeUInt16LE(1, 26);
  head.writeUInt16LE(24, 28);
  head.writeUInt32LE(data.length, 34);
  head.writeInt32LE(2835, 38);
  head.writeInt32LE(2835, 42);
  return Buffer.concat([head, data]);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await win.loadURL('data:text/html,<!doctype html><html><body></body></html>');
  const js = (code) => win.webContents.executeJavaScript(code);
  const svgUrl = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

  // Draws an SVG onto a size x size canvas and returns the PNG bytes.
  async function png(svg, size) {
    const dataUrl = await js(`new Promise((ok, no) => {
      const img = new Image();
      img.onload = () => { const c = document.createElement('canvas'); c.width = ${size}; c.height = ${size}; c.getContext('2d').drawImage(img, 0, 0, ${size}, ${size}); ok(c.toDataURL('image/png')); };
      img.onerror = () => no(new Error('could not draw the SVG'));
      img.src = ${JSON.stringify(svgUrl(svg))};
    })`);
    return Buffer.from(dataUrl.split(',')[1], 'base64');
  }

  const icon = brand('icon');
  const small = brand('icon-small');
  fs.writeFileSync(out('electron/icon.png'), await png(icon, 256));
  const iosIcon = out('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
  if (fs.existsSync(path.dirname(iosIcon))) fs.writeFileSync(iosIcon, await png(icon.replace('rx="56"', 'rx="0"'), 1024));
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const images = [];
  for (const size of sizes) images.push({ size, png: await png(size <= 32 ? small : icon, size) });
  fs.writeFileSync(out('electron/icon.ico'), ico(images));

  for (const [file, tone] of [['tray-icon-light', 'white'], ['tray-icon-dark', 'ink']]) {
    fs.writeFileSync(out(`electron/${file}.png`), await png(brand(`tray16-${tone}`), 16));
    fs.writeFileSync(out(`electron/${file}@2x.png`), await png(brand(`tray32-${tone}`), 32));
  }

  // The installer sidebar: the rings art with the wordmark in Fraunces, the
  // app's display font (loaded from the bundled file).
  const sidebar = fs.readFileSync(path.join(root, 'branding', 'drafts', 'installer-sidebar.svg'), 'utf8');
  const fraunces = fs.readFileSync(require.resolve('@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2')).toString('base64');
  const rgba = await js(`(async () => {
    const bytes = Uint8Array.from(atob(${JSON.stringify(fraunces)}), ch => ch.charCodeAt(0));
    const face = new FontFace('Fraunces', bytes.buffer, { weight: '100 900' });
    await face.load(); document.fonts.add(face);
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = () => no(new Error('could not draw the sidebar')); img.src = ${JSON.stringify(svgUrl(sidebar))}; });
    const c = document.createElement('canvas'); c.width = 164; c.height = 314;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, 164, 314);
    ctx.fillStyle = '#EDEDE6';
    ctx.font = '600 34px Fraunces';
    ctx.fillText('Layers', 18, 54);
    const px = ctx.getImageData(0, 0, 164, 314).data;
    let bin = '';
    for (let i = 0; i < px.length; i += 8192) bin += String.fromCharCode(...px.subarray(i, i + 8192));
    return btoa(bin);
  })()`);
  fs.writeFileSync(out('electron/installer-sidebar.bmp'), bmp(164, 314, Buffer.from(rgba, 'base64')));

  fs.copyFileSync(path.join(root, 'branding', 'drafts', 'rings-icon.svg'), out('public/icon.svg'));
  console.log('[brand] Rendered the icon, .ico, tray icons, installer sidebar and favicon.');
  app.quit();
}).catch((err) => { console.error('[brand] ✗', err && err.stack ? err.stack : err); app.exit(1); });
