// Copies the single-file Vite build (dist-local/index.html) into
// electron/app/index.html, which is what electron/main.cjs actually loads
// and what electron-builder packages into the .exe. Vite's default "build"
// script only writes dist/ (multi-file), so the renderer must be built with
// the *local* config (build:local) before this runs — see "build:electron"
// in package.json, which chains both steps in the right order.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, 'dist-local', 'index.html');
const destDir = join(root, 'electron', 'app');
const dest = join(destDir, 'index.html');

if (!existsSync(src)) {
  console.error(`[sync-app] Missing ${src}. Run "npm run build:local" first.`);
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`[sync-app] Copied ${src} -> ${dest}`);
