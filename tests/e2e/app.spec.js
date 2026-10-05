// End-to-end checks of the packaged desktop app: the behaviour the vision
// (docs/vision.md) says must be verified on the real .exe, not just in a
// browser. Run with `npm run test:e2e`.
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { EXE, launch, mainWindowState, onboard, quit, runExe, tempDataDir } from './helpers.js';

test('a fresh install onboards once, and everything survives a restart', async () => {
  const dataDir = tempDataDir();
  let { app, page } = await launch(dataDir);
  await expect(page.getByText('Welcome to Layers')).toBeVisible();
  await onboard(page, 'Sam');
  await page.locator('.nav-bar').getByRole('button', { name: 'Journal', exact: true }).click();
  await expect(page.getByText('Every interaction, in one place.')).toBeVisible();
  await quit(app);

  ({ app, page } = await launch(dataDir));
  await expect(page.getByText(/Good (morning|afternoon|evening), Sam/)).toBeVisible();
  await expect(page.getByText('Welcome to Layers')).toHaveCount(0);
  await page.locator('.nav-bar').getByRole('button', { name: 'People', exact: true }).click();
  await expect(page.getByText('Alex').first()).toBeVisible();
  await quit(app);
});

test('works with nobody in the circle', async () => {
  const dataDir = tempDataDir();
  const { app, page } = await launch(dataDir);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.getByLabel('Your name').fill('Sam');
  await page.getByRole('button', { name: 'Start fresh with my own people' }).click();
  await page.getByRole('button', { name: "Skip, I'll add people later" }).click();
  await page.getByRole('button', { name: 'Go to Today' }).click();
  for (const tab of ['People', 'Coach', 'Journal', 'Me', 'Today']) {
    await page.locator('.nav-bar').getByRole('button', { name: tab, exact: true }).click();
  }
  await page.keyboard.press('n');
  await expect(page.getByRole('dialog', { name: 'What are you logging?' })).toBeVisible();
  expect(errors).toEqual([]);
  await quit(app);
});

test('dark mode is saved for the next launch, so the window opens dark', async () => {
  const dataDir = tempDataDir();
  let { app, page } = await launch(dataDir);
  await onboard(page);
  await page.locator('.nav-bar').getByRole('button', { name: 'Me', exact: true }).click();
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect.poll(() => fs.existsSync(path.join(dataDir, 'theme.json')) && JSON.parse(fs.readFileSync(path.join(dataDir, 'theme.json'), 'utf8')).theme).toBe('dark');
  await quit(app);

  ({ app, page } = await launch(dataDir));
  expect((await mainWindowState(app)).background.toUpperCase()).toBe('#1B1E27');
  await quit(app);
});

test('closing the window hides it to the tray, and a second launch brings it back', async () => {
  const dataDir = tempDataDir();
  const { app, page } = await launch(dataDir);
  await onboard(page);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await expect.poll(async () => (await mainWindowState(app)).visible).toBe(false);
  expect((await mainWindowState(app)).destroyed).toBe(false);

  // A second launch exits at once and shows the existing window instead.
  expect(await runExe(dataDir)).toBe(0);
  await expect.poll(async () => (await mainWindowState(app)).visible).toBe(true);
  expect((await mainWindowState(app)).count).toBe(1);
  await quit(app);
});

test('Layers.exe --quit closes a running Layers cleanly', async () => {
  const dataDir = tempDataDir();
  const { app, page } = await launch(dataDir);
  await onboard(page);
  const exited = new Promise((resolve) => app.process().on('exit', resolve));
  expect(await runExe(dataDir, ['--quit'])).toBe(0);
  await exited;
  // What was saved before quitting is still there.
  const relaunched = await launch(dataDir);
  await expect(relaunched.page.getByText(/Good (morning|afternoon|evening), Sam/)).toBeVisible();
  await quit(relaunched.app);
});

test('a login launch (--hidden) starts in the tray', async () => {
  const dataDir = tempDataDir();
  const { app } = await launch(dataDir, ['--hidden']);
  expect((await mainWindowState(app)).visible).toBe(false);
  await quit(app);
});

test('the page reloads by itself if its process crashes', async () => {
  const dataDir = tempDataDir();
  const { app, page } = await launch(dataDir);
  await onboard(page);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.forcefullyCrashRenderer());
  // Playwright drops a crashed page, so ask the main process what the window
  // shows. Asking a page that's mid-crash never answers, hence the time limit.
  const shown = () => Promise.race([
    app.evaluate(async ({ BrowserWindow }) => {
      const wc = BrowserWindow.getAllWindows()[0].webContents;
      if (wc.isCrashed()) return 'crashed';
      try { return await wc.executeJavaScript('document.body.innerText'); } catch { return 'loading'; }
    }),
    new Promise(r => setTimeout(() => r('no answer yet'), 2000)),
  ]);
  await expect.poll(shown, { timeout: 20000 }).toMatch(/Good (morning|afternoon|evening), Sam/);
  await quit(app);
});

test('the exe identifies itself as Layers, not Electron', async () => {
  test.skip(process.platform !== 'win32', 'Windows file metadata');
  const out = execFileSync('powershell', ['-NoProfile', '-Command', `(Get-Item -LiteralPath '${EXE.replace(/'/g, "''")}').VersionInfo | Select-Object ProductName,FileDescription,CompanyName | ConvertTo-Json`], { encoding: 'utf8' });
  const info = JSON.parse(out);
  expect(info.ProductName).toBe('Layers');
  expect(info.FileDescription).toBe('Layers');
  expect(info.CompanyName).not.toMatch(/GitHub/);
});

test('a plan is handed to Windows with buttons, and a pressed button reaches Layers', async () => {
  const dataDir = tempDataDir();
  const dump = path.join(dataDir, 'scheduled.json');
  // Instead of scheduling real toasts, the app writes what it would schedule.
  const { app, page } = await launch(dataDir, [], { LAYERS_SCHEDULE_DUMP: dump, LAYERS_NO_SCHEDULE: '' });
  await onboard(page);
  await page.keyboard.press('p');
  await page.keyboard.press('8'); // Something else
  await page.getByRole('button', { name: /Continue without anyone/ }).click();
  await page.getByRole('button', { name: 'Tomorrow', exact: true }).click();
  await page.getByRole('button', { name: 'Save plan' }).click();
  const ev = await page.evaluate(() => JSON.parse(localStorage.getItem('layers-app-state-v1')).events[0]);
  await expect.poll(() => fs.existsSync(dump) && JSON.parse(fs.readFileSync(dump, 'utf8')).some(n => n.tag === `a:${ev.id}:${ev.date}`)).toBe(true);
  const toast = JSON.parse(fs.readFileSync(dump, 'utf8')).find(n => n.tag === `a:${ev.id}:${ev.date}`);
  // A reminder only snoozes; Log it and ticking off wait for "How did it go?".
  expect(toast.xml).toContain(`arguments="layers://snooze?e=${ev.id}&amp;d=${ev.date}&amp;m=10"`);
  expect(toast.xml).not.toContain('layers://done');

  // Pressing a button (here "Just tick it") launches Layers.exe with the link;
  // the running app takes it.
  expect(await runExe(dataDir, [`layers://done?e=${ev.id}&d=${ev.date}`])).toBe(0);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('layers-app-state-v1')).events[0].doneAt || null)).toBe(ev.date);
  await quit(app);
});

test('a daily backup is saved a few seconds after starting, in the data folder for tests', async () => {
  const dataDir = tempDataDir();
  const { app, page } = await launch(dataDir);
  await onboard(page, 'Sam');
  const dir = path.join(dataDir, 'Backups');
  await expect.poll(() => (fs.existsSync(dir) ? fs.readdirSync(dir) : []).filter(n => /^layers-backup-\d{4}-\d{2}-\d{2}\.json$/.test(n)).length, { timeout: 15000 }).toBe(1);
  const file = fs.readdirSync(dir).find(n => n.startsWith('layers-backup-'));
  const backup = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  expect(backup.people.map(p => p.name)).toContain('Alex');
  await quit(app);
});

test('the quick-add box saves a typed plan through the main window, then hides', async () => {
  const dataDir = tempDataDir();
  const { app, page } = await launch(dataDir);
  await onboard(page, 'Sam');
  // The real Ctrl+Shift+L belongs to the Layers already running on this
  // computer, so the test opens the box the way the shortcut does.
  const opened = app.waitForEvent('window');
  await app.evaluate(({ app: electronApp }) => electronApp.layersShowQuickAdd());
  const box = await opened;
  await box.waitForSelector('.quick-box');
  const input = box.getByLabel('Plan or log');
  await input.fill('coffee with priya tomorrow 10am');
  await expect(box.getByRole('status', { name: 'Preview' })).toContainText('Coffee with Priya');
  await input.press('Enter');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('layers-app-state-v1')).events.map(e => e.title)), { timeout: 10000 }).toContain('Coffee with Priya');
  await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter(w => w.isVisible()).length), { timeout: 10000 }).toBe(1);
  await quit(app);
});

test('Ctrl+Alt+L sends Layers back when it is in front, and brings it forward again', async () => {
  const { app, page } = await launch(tempDataDir());
  await onboard(page, 'Sam');
  // The real shortcut belongs to the Layers already running on this
  // computer, so the test does what it does.
  const main = () => app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    return { minimized: w.isMinimized(), visible: w.isVisible(), focused: w.isFocused() };
  });
  const toggle = () => app.evaluate(({ app: electronApp }) => electronApp.layersToggleWindow());
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].focus());
  await expect.poll(async () => (await main()).focused, { timeout: 5000 }).toBe(true);
  await toggle();
  await expect.poll(async () => (await main()).minimized, { timeout: 5000 }).toBe(true);
  await toggle();
  await expect.poll(async () => { const s = await main(); return s.visible && !s.minimized; }, { timeout: 5000 }).toBe(true);
  await quit(app);
});
