// End-to-end checks of the packaged desktop app: the behaviour the vision
// (docs/vision.md) says must be verified on the real .exe, not just in a
// browser. Run with `npm run test:e2e`.
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { EXE, launch, mainWindowState, onboard, quit, runExe, tempDataDir } from './helpers.js';
import { writeBackup } from '../fakeIPhoneBackup.cjs';

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

test('a login launch (--hidden) starts in the tray, and opens maximised when shown', async () => {
  const dataDir = tempDataDir();
  const { app } = await launch(dataDir, ['--hidden']);
  expect((await mainWindowState(app)).visible).toBe(false);
  await new Promise((resolve) => { setTimeout(resolve, 1000); });
  expect((await mainWindowState(app)).visible).toBe(false); // nothing maximised it into view
  expect(await runExe(dataDir)).toBe(0); // a second launch shows it
  await expect.poll(async () => { const s = await mainWindowState(app); return s.visible && s.maximized; }, { timeout: 5000 }).toBe(true);
  await quit(app);
});

test('Layers always fills the screen: it opens maximised, and restoring it down puts it straight back', async () => {
  const { app, page } = await launch(tempDataDir());
  expect((await mainWindowState(app)).maximized).toBe(true);
  await onboard(page);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].unmaximize()); // the title bar's restore button
  await expect.poll(async () => (await mainWindowState(app)).maximized, { timeout: 5000 }).toBe(true);
  // Closed to the tray and opened again: still maximised.
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await expect.poll(async () => (await mainWindowState(app)).visible).toBe(false);
  await app.evaluate(({ app: electronApp }) => electronApp.layersToggleWindow());
  await expect.poll(async () => { const s = await mainWindowState(app); return s.visible && s.maximized; }, { timeout: 5000 }).toBe(true);
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
  await new Promise((resolve) => { setTimeout(resolve, 500); });
  expect((await main()).minimized).toBe(true); // minimising stays minimised
  await toggle();
  await expect.poll(async () => { const s = await main(); return s.visible && !s.minimized; }, { timeout: 5000 }).toBe(true);
  expect((await mainWindowState(app)).maximized).toBe(true);
  await quit(app);
});

test('a chosen photo becomes the avatar, kept small, and survives a restart', async () => {
  const dataDir = tempDataDir();
  let { app, page } = await launch(dataDir);
  await onboard(page, 'Sam');
  await page.keyboard.press('Control+Shift+A');
  await page.getByLabel('Their name').fill('Pip');
  await page.keyboard.press('Tab');
  await page.keyboard.press('g'); // Initials -> Photo
  // A picture from the PC (the file box the U key opens).
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAGUlEQVR4nGNgYGD4z8DAwMDAxMDAwMAAAAwKAAG2t3sRAAAAAElFTkSuQmCC', 'base64');
  await page.getByLabel('Choose a picture').setInputFiles({ name: 'pip.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('.photo-crop img')).toBeVisible();
  await page.keyboard.press('l'); // skip the questions
  await page.keyboard.press('Enter');
  const avatar = () => page.evaluate(() => JSON.parse(localStorage.getItem('layers-app-state-v1')).people.find(p => p.name === 'Pip').avatar);
  await expect.poll(async () => (await avatar() || {}).style, { timeout: 10000 }).toBe('photo');
  const saved = await avatar();
  expect(saved.src.startsWith('data:image/jpeg;base64,')).toBe(true);
  expect(saved.src.length).toBeLessThan(60000);
  await quit(app);

  ({ app, page } = await launch(dataDir));
  await page.locator('.nav-bar').getByRole('button', { name: 'People', exact: true }).click();
  await page.getByRole('button', { name: 'List view' }).click();
  await expect(page.locator('img[src^="data:image/jpeg"]').first()).toBeVisible();
  await quit(app);
});

test('photos from a folder: Windows is asked where the faces are, and the photos are kept small', async () => {
  const dataDir = tempDataDir();
  const picDir = fs.mkdtempSync(path.join(dataDir, 'pictures-'));
  const { app, page } = await launch(dataDir);
  await onboard(page, 'Sam'); // with the example people: Alex, Jamie, Priya, Noah and Sam
  // Two made-up portraits (no real faces), one named after Priya.
  const pics = await page.evaluate(() => ['#7aa6c2', '#c99a6b'].map((bg) => {
    const c = document.createElement('canvas'); c.width = 300; c.height = 450;
    const x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, 300, 450);
    x.fillStyle = '#f1d3b5'; x.beginPath(); x.arc(150, 150, 60, 0, Math.PI * 2); x.fill();
    return c.toDataURL('image/png').split(',')[1];
  }));
  fs.writeFileSync(path.join(picDir, 'Priya.png'), Buffer.from(pics[0], 'base64'));
  fs.writeFileSync(path.join(picDir, 'IMG_1.png'), Buffer.from(pics[1], 'base64'));
  await page.locator('.nav-bar').getByRole('button', { name: 'People', exact: true }).click();
  await page.getByRole('button', { name: 'Add photos from a folder' }).click();
  await page.getByLabel('Choose a folder of pictures').setInputFiles(picDir);
  await expect(page.getByLabel('Which picture')).toContainText('Picture 1 of 2');
  // The real Windows face detector, as the packaged app asks it (faces.cjs).
  const answer = await app.evaluate((_electron, file) => process.mainModule.require('./faces.cjs').findFaces([file]), path.join(picDir, 'Priya.png'));
  expect(answer[0]).toMatchObject({ width: 300, height: 450, faces: expect.any(Array) });
  // Windows answers (no faces in these), and the circle stays where it started.
  await expect(page.getByText('Finding faces…')).toBeHidden({ timeout: 30000 });
  await expect(page.getByRole('button', { name: /Skip this one/ })).toBeVisible();
  await page.keyboard.press('Enter'); // skip IMG_1.png
  await expect(page.getByRole('button', { name: /Use for Priya/ })).toBeVisible(); // Priya.png starts on Priya
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter'); // add the one photo
  const avatar = () => page.evaluate(() => JSON.parse(localStorage.getItem('layers-app-state-v1')).people.find(p => p.name === 'Priya').avatar);
  await expect.poll(async () => (await avatar() || {}).style, { timeout: 10000 }).toBe('photo');
  expect((await avatar()).src.length).toBeLessThan(60000);
  await quit(app);
});

test('sync: two copies of Layers sharing a folder end up the same, with the passphrase kept by Windows', async () => {
  const PASS = 'correct horse battery';
  const shared = tempDataDir(); // stands in for OneDrive's Documents\Layers sync
  const first = tempDataDir();
  const second = tempDataDir();
  const me = (page) => page.locator('.nav-bar').getByRole('button', { name: 'Me', exact: true }).click();
  const people = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('layers-app-state-v1')).people.map(p => p.name).sort());

  // The first copy: the example people, sync turned on.
  let { app, page } = await launch(first, [], { LAYERS_SYNC_DIR: shared });
  await onboard(page, 'Sam');
  await me(page);
  await page.getByRole('button', { name: 'Turn on sync' }).click();
  await expect(page.getByLabel('Passphrase', { exact: true })).toBeFocused(); // the sheet opens once it knows the folder
  await page.keyboard.type(PASS);
  await page.keyboard.press('Enter');
  await page.keyboard.type(PASS);
  await page.keyboard.press('Enter');
  await expect(page.getByText('Sync is on')).toBeVisible({ timeout: 20000 });
  const file = fs.readFileSync(path.join(shared, 'layers-sync.json'), 'utf8');
  expect(file).not.toContain('Priya'); // encrypted
  const kept = fs.readFileSync(path.join(first, 'sync-passphrase.bin'));
  expect(kept.toString('latin1')).not.toContain(PASS); // Windows keeps it encrypted
  const examples = await people(page);
  await quit(app);

  // The second copy starts with nobody, and gets them all with the same passphrase.
  ({ app, page } = await launch(second, [], { LAYERS_SYNC_DIR: shared }));
  await page.getByLabel('Your name').fill('Sam');
  await page.getByRole('button', { name: 'Start fresh with my own people' }).click();
  await page.keyboard.press('Enter'); // nobody yet: on
  await page.getByRole('button', { name: 'Go to Today' }).click();
  await me(page);
  await page.getByRole('button', { name: 'Turn on sync' }).click();
  await expect(page.getByLabel('Passphrase', { exact: true })).toBeFocused();
  await page.keyboard.type(PASS);
  await page.keyboard.press('Enter');
  await expect(page.getByText('Synced: changes from your other device')).toBeVisible({ timeout: 20000 });
  await expect.poll(() => people(page), { timeout: 10000 }).toEqual(examples);
  await quit(app);

  // Started again, it syncs by itself with the remembered passphrase.
  ({ app, page } = await launch(second, [], { LAYERS_SYNC_DIR: shared }));
  await me(page);
  await expect(page.getByLabel('Sync').getByRole('status')).toContainText('Last synced just now', { timeout: 20000 });
  await quit(app);
});

test('your Google Calendar: the packaged app refuses an address that is not a calendar, keeping nothing', async () => {
  const dataDir = tempDataDir();
  const { app, page } = await launch(dataDir);
  await onboard(page, 'Sam');
  await page.locator('.nav-bar').getByRole('button', { name: 'Me', exact: true }).click();
  const card = page.getByLabel('Other calendars');
  await card.getByLabel('Secret address in iCal format').fill('http://example.com/not-secure.ics');
  await card.getByRole('button', { name: 'Add' }).click();
  await expect(card.getByRole('alert')).toContainText("isn't a calendar address");
  expect(fs.existsSync(path.join(dataDir, 'calendars.bin'))).toBe(false);
  await quit(app);
});

// A one-file zip, deflated, as WhatsApp's "Export chat" makes.
function chatZip(name, text) {
  const raw = Buffer.from(text, 'utf8');
  const data = zlib.deflateRawSync(raw);
  const file = Buffer.from(name, 'utf8');
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(file.length, 26);
  const head = Buffer.alloc(46);
  head.writeUInt32LE(0x02014b50, 0); head.writeUInt16LE(8, 10); head.writeUInt32LE(data.length, 20); head.writeUInt32LE(raw.length, 24); head.writeUInt16LE(file.length, 28);
  const cd = Buffer.concat([head, file]);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(30 + file.length + data.length, 16);
  return Buffer.concat([local, file, data, cd, end]);
}
const waStamp = (d) => `[${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}, ${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}:00 ${d.getHours() < 12 ? 'am' : 'pm'}]`;

test('chats from your exports: a WhatsApp export in the folder is opened by the packaged app, and a new one is noticed', async () => {
  const dataDir = tempDataDir();
  const chats = path.join(dataDir, 'Chats');
  fs.mkdirSync(chats, { recursive: true });
  const t = new Date(Date.now() - 3600 * 1000);
  fs.writeFileSync(path.join(chats, 'WhatsApp Chat - Priya.zip'), chatZip('_chat.txt', `${waStamp(t)} Priya: I got the job!!\n${waStamp(new Date(t.getTime() + 60000))} Sam: No way, congrats!`));
  const { app, page } = await launch(dataDir);
  await onboard(page, 'Sam'); // the example people, Priya among them
  // A stand-in key, kept as the main process keeps one (nothing is sent: Analyse isn't pressed).
  await app.evaluate(({ app: a, safeStorage }) => {
    process.getBuiltinModule('fs').writeFileSync(process.getBuiltinModule('path').join(a.getPath('userData'), 'anthropic-key.bin'), safeStorage.encryptString('sk-ant-api03-standinstandinstandinstandin'));
  });
  await page.reload();
  await page.locator('.nav-bar').getByRole('button', { name: 'Coach', exact: true }).click();
  await page.getByRole('button', { name: 'Analyse a chat' }).click();
  const card = page.getByLabel('From your chats');
  await card.getByRole('button', { name: /Priya.*WhatsApp.*1 new/ }).click();
  await card.getByRole('button', { name: /2 messages/ }).click();
  await expect(page.getByLabel('The chat')).toHaveValue(/\] Priya: I got the job!!\n\[.*\] Sam: No way, congrats!$/);
  await expect(page.getByRole('group', { name: "Who it's with" })).toContainText('Priya');
  // OneDrive brings down another export: it shows without reopening.
  fs.writeFileSync(path.join(chats, 'WhatsApp Chat - Noah.zip'), chatZip('_chat.txt', `${waStamp(new Date())} Noah: game tonight?`));
  await expect(card.getByRole('button', { name: /Noah.*WhatsApp/ })).toBeVisible({ timeout: 15000 });
  await quit(app);
});

test('iMessage: the packaged app reads chats from an iPhone backup on this laptop, and changes nothing in it', async () => {
  const dataDir = tempDataDir();
  const now = Date.now();
  // A made-up backup where tests keep theirs (the data folder's iPhone backups).
  const dir = writeBackup(path.join(dataDir, 'iPhone backups'), {
    contacts: [{ first: 'Priya', last: 'Shah', phones: ['+64 21 555 0101'] }],
    chats: [{ guid: 'iMessage;-;+64215550101', handles: ['+64215550101'], messages: [
      { at: now - 3600 * 1000, from: '+64215550101', text: 'I got the job!!' },
      { at: now - 3600 * 1000 + 60000, from: null, body: 'No way, congrats!' },
    ] }],
  });
  const before = fs.readdirSync(dir, { recursive: true }).sort();
  const { app, page } = await launch(dataDir);
  await onboard(page, 'Sam'); // the example people, Priya among them
  await app.evaluate(({ app: a, safeStorage }) => {
    process.getBuiltinModule('fs').writeFileSync(process.getBuiltinModule('path').join(a.getPath('userData'), 'anthropic-key.bin'), safeStorage.encryptString('sk-ant-api03-standinstandinstandinstandin'));
  });
  await page.reload();
  await page.locator('.nav-bar').getByRole('button', { name: 'Coach', exact: true }).click();
  await page.getByRole('button', { name: 'Analyse a chat' }).click();
  const card = page.getByLabel('From your chats');
  await expect(card).toContainText(/iMessage from Liam's iPhone, backed up Today/);
  await card.getByRole('button', { name: /Priya Shah.*iMessage.*1 new/ }).click();
  await card.getByRole('button', { name: /2 messages/ }).click();
  await expect(page.getByLabel('The chat')).toHaveValue(/\] Priya: I got the job!!\n\[.*\] Sam: No way, congrats!$/);
  await quit(app);
  expect(fs.readdirSync(dir, { recursive: true }).sort()).toEqual(before);
});

test('chat analysis: the packaged app refuses a key that is not an Anthropic key, keeping nothing and asking nobody', async () => {
  const dataDir = tempDataDir();
  const { app, page } = await launch(dataDir);
  await onboard(page, 'Sam');
  await page.locator('.nav-bar').getByRole('button', { name: 'Me', exact: true }).click();
  const card = page.getByLabel('Chat analysis');
  await card.getByLabel('Anthropic API key').fill('sk-proj-not-an-anthropic-key-1234567890');
  await card.getByRole('button', { name: 'Save' }).click();
  await expect(card.getByRole('alert')).toContainText("doesn't look like an Anthropic API key");
  expect(fs.existsSync(path.join(dataDir, 'anthropic-key.bin'))).toBe(false);
  // Coach offers it, pointing to Me for the key.
  await page.locator('.nav-bar').getByRole('button', { name: 'Coach', exact: true }).click();
  await page.getByRole('button', { name: 'Analyse a chat' }).click();
  await page.getByRole('button', { name: /Priya/ }).first().click();
  await expect(page.getByRole('button', { name: 'Add a key in Me' })).toBeVisible();
  await quit(app);
});

test('a one-page summary of someone is saved as a real PDF', async () => {
  const dataDir = tempDataDir();
  const out = tempDataDir();
  const { app, page } = await launch(dataDir, [], { LAYERS_SUMMARY_DIR: out });
  await onboard(page, 'Sam'); // the example people
  await page.locator('.nav-bar').getByRole('button', { name: 'People', exact: true }).click();
  await page.getByRole('button', { name: /Priya/ }).first().click();
  await page.getByRole('button', { name: /Summary/ }).click();
  await expect(page.getByText(/^Summary saved: Priya summary .+\.pdf$/)).toBeVisible({ timeout: 20000 });
  const [file] = fs.readdirSync(out).filter(n => n.endsWith('.pdf'));
  const pdf = fs.readFileSync(path.join(out, file));
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.length).toBeGreaterThan(5000);
  await quit(app);
});
