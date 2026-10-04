// Launching the packaged app for end-to-end tests. Every launch gets its own
// temporary data folder (LAYERS_USER_DATA_DIR), so the tests never read or
// change your real Layers data, and don't collide with a Layers that's
// already running (the single-instance lock lives in the data folder).
// LAYERS_NO_UPDATES keeps them from checking GitHub for updates, and
// LAYERS_NO_SCHEDULE from scheduling real Windows notifications.
import { _electron as electron } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const EXE = process.env.LAYERS_EXE || path.resolve('dist-e2e/win-unpacked/Layers.exe');

export function tempDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'layers-e2e-'));
}

export function appEnv(dataDir, extra = {}) {
  return { ...process.env, LAYERS_USER_DATA_DIR: dataDir, LAYERS_NO_UPDATES: '1', LAYERS_NO_SCHEDULE: '1', ...extra };
}

// `extra` adds or overrides environment variables, e.g. LAYERS_SCHEDULE_DUMP.
export async function launch(dataDir, args = [], extra = {}) {
  const app = await electron.launch({ executablePath: EXE, args, env: appEnv(dataDir, extra) });
  const page = await app.firstWindow();
  await page.waitForSelector('.layers-root');
  return { app, page };
}

// Quit the way the tray's Quit does, and wait for the process to end.
export async function quit(app) {
  await app.close();
}

// Run Layers.exe directly (a second launch, or --quit) and wait for it to exit.
export function runExe(dataDir, args = [], timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const child = spawn(EXE, args, { env: appEnv(dataDir), stdio: 'ignore' });
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Layers.exe ${args.join(' ')} didn't exit within ${timeoutMs} ms`)); }, timeoutMs);
    child.on('exit', (code) => { clearTimeout(timer); resolve(code); });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

export function mainWindowState(app) {
  return app.evaluate(({ BrowserWindow }) => {
    const wins = BrowserWindow.getAllWindows();
    const w = wins[0];
    return { count: wins.length, visible: w ? w.isVisible() : false, destroyed: w ? w.isDestroyed() : true, background: w ? w.getBackgroundColor() : null };
  });
}

export async function onboard(page, name = 'Sam') {
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: 'Explore with example people first' }).click();
  await page.getByText(new RegExp(`Good (morning|afternoon|evening), ${name}`)).waitFor();
}
