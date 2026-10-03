const { app, BrowserWindow, Tray, Menu, nativeImage, nativeTheme, ipcMain, globalShortcut, shell } = require('electron');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const windowStateKeeper = require('electron-window-state');

// Windows groups taskbar entries, toast notifications, and jump lists by
// this identity string. It must be set before the app is ready, and it
// should match the appId electron-builder uses to build the installer so
// the packaged app and the installed shortcut are recognised as the same
// application. Without this, Windows can treat separate launches (or the
// dev run vs. the installed run) as unrelated apps.
app.setAppUserModelId('com.layers.app');

// LAYERS_USER_DATA_DIR runs Layers against a separate data folder. The
// end-to-end tests (tests/e2e) use a temporary one, so they never touch real
// data and their single-instance lock (kept in the data folder) doesn't
// collide with a Layers that's already running. Must be set before the lock.
if (process.env.LAYERS_USER_DATA_DIR) app.setPath('userData', process.env.LAYERS_USER_DATA_DIR);

// electron-builder's portable .exe unpacks the app to a temporary folder and
// runs it from there, setting PORTABLE_EXECUTABLE_FILE to the .exe itself.
const PORTABLE_EXE = process.env.PORTABLE_EXECUTABLE_FILE || null;
// "Launch at login" starts Layers with --hidden, straight into the tray.
const START_HIDDEN = process.argv.includes('--hidden');
const RELEASES_URL = 'https://github.com/CastledRuby/layers-app/releases/latest';

let mainWindow = null;
let tray = null;
let isQuitting = false;
let shortcutRegistered = null;

// --- Single instance lock -------------------------------------------------
// Without this, every double-click on the exe (or every login-item launch)
// spins up an entirely separate Electron process, each with its own
// taskbar entry and its own tray icon. requestSingleInstanceLock() makes
// the *first* launch the sole owner of the app; any later launch attempt
// immediately quits itself and instead fires 'second-instance' on the
// original process, which is where we bring the existing window forward.
//
// `Layers.exe --quit` asks a running Layers to quit cleanly. The release
// script (scripts/release.mjs) runs it before installing an update, so the
// app shuts down normally and flushes localStorage, instead of the installer
// force-killing it. With no instance running there's nothing to quit, so
// that launch just exits.
const quitRequested = process.argv.includes('--quit');
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock || quitRequested) {
  // Another instance already owns the lock — this process has no reason
  // to exist. app.exit() terminates immediately (unlike app.quit(), which
  // is a graceful async request). Everything else is set up in the else
  // branch, so nothing below runs in this process either way.
  app.exit(0);
} else {
  app.on('second-instance', (_event, argv) => {
    if (argv.includes('--quit')) {
      isQuitting = true;
      app.quit();
      return;
    }
    if (argv.includes('--hidden')) return; // a login launch while already running
    showWindow();
  });

  app.whenReady().then(() => {
    setupThemeSync();
    createWindow();
    createTray();
    setupAutoUpdate();
    setupAutoLaunch();
    setupVersionInfo();
    registerGlobalShortcut();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else showWindow();
    });
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    if (tray) { tray.destroy(); tray = null; }
  });

  app.on('before-quit', () => { isQuitting = true; });

  app.on('window-all-closed', () => {
    if (isQuitting) app.quit();
  });
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

function sendStatus(status) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', status);
  }
}

function classifyUpdateError(err) {
  const msg = String((err && err.message) || err || '');
  if (/no published versions|cannot find latest|app-update\.yml|publish/i.test(msg)) {
    return { state: 'not-configured' };
  }
  return { state: 'error', message: msg };
}

// --- Auto-update -------------------------------------------------------
// electron-updater reads the GitHub Releases feed configured in
// package.json's build.publish (CastledRuby/layers-app, latest.yml).
// - Installed copies download an update as soon as one is found, and install
//   it when Layers next quits (autoInstallOnAppQuit), or straight away from
//   Me > "Restart & install".
// - The portable .exe can't update itself (the feed only has the installer),
//   so it reports the new version and offers the download page instead of
//   downloading an installer it would then run on quit.
// - It checks shortly after launch and every few hours, since Layers usually
//   stays running in the tray for days.
const UPDATE_CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

function setupAutoUpdate() {
  ipcMain.handle('open-download-page', () => shell.openExternal(RELEASES_URL));

  let autoUpdater = null;
  if (!process.env.LAYERS_NO_UPDATES) {
    try {
      ({ autoUpdater } = require('electron-updater'));
    } catch {
      autoUpdater = null;
    }
  }
  if (!autoUpdater) {
    // Tests (LAYERS_NO_UPDATES) and builds without the updater still answer.
    ipcMain.handle('check-for-updates', () => { sendStatus({ state: 'not-configured' }); return { ok: false, state: 'not-configured' }; });
    ipcMain.on('quit-and-install', () => {});
    return;
  }

  // Downloads are started explicitly below, so their errors are reported.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  let downloading = null;
  let readyVersion = null;

  autoUpdater.on('checking-for-update', () => sendStatus({ state: 'checking' }));
  autoUpdater.on('update-available', (info) => {
    if (PORTABLE_EXE) { sendStatus({ state: 'available-portable', version: info.version }); return; }
    if (readyVersion === info.version) { sendStatus({ state: 'ready', version: info.version }); return; }
    if (downloading === info.version) return; // a later check while it's still downloading
    downloading = info.version;
    sendStatus({ state: 'available', version: info.version });
    autoUpdater.downloadUpdate().catch((err) => { downloading = null; sendStatus(classifyUpdateError(err)); });
  });
  autoUpdater.on('update-not-available', () => sendStatus({ state: 'up-to-date' }));
  autoUpdater.on('download-progress', (p) => sendStatus({ state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (info) => { downloading = null; readyVersion = info.version; sendStatus({ state: 'ready', version: info.version }); });
  autoUpdater.on('error', (err) => sendStatus(classifyUpdateError(err)));

  ipcMain.handle('check-for-updates', async () => {
    try {
      await autoUpdater.checkForUpdates();
      return { ok: true };
    } catch {
      const status = classifyUpdateError(e);
      sendStatus(status);
      return { ok: false, ...status };
    }
  });

  ipcMain.on('quit-and-install', () => {
    isQuitting = true;
    autoUpdater.quitAndInstall();
  });

  const quietCheck = () => { autoUpdater.checkForUpdates().catch(() => {}); };
  setTimeout(quietCheck, 8000);
  setInterval(quietCheck, UPDATE_CHECK_EVERY_MS);
}

// --- Theme-aware window background ---------------------------------------
// The window paints backgroundColor before the page loads. It used to be the
// light paper colour, so dark mode flashed white on every launch. The
// renderer reports its theme (layersSystem.setTheme) whenever it changes,
// and it's saved here so the next launch opens in the right colour.
// Keep these in sync with THEME_LIGHT.paper / THEME_DARK.paper (src/theme.js)
// and the early script in index.html.
const BACKGROUNDS = { light: '#F5F6F1', dark: '#1B1E27' };
const themeFile = () => path.join(app.getPath('userData'), 'theme.json');

function savedTheme() {
  try {
    return JSON.parse(fs.readFileSync(themeFile(), 'utf8')).theme === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function setupThemeSync() {
  ipcMain.on('set-theme', (_event, theme) => {
    const next = theme === 'dark' ? 'dark' : 'light';
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setBackgroundColor(BACKGROUNDS[next]);
    if (next === savedTheme()) return;
    try {
      fs.writeFileSync(themeFile(), JSON.stringify({ theme: next }));
    } catch {
      // Not fatal: the next launch just opens with the light background.
    }
  });
}

function createWindow() {
  const windowState = windowStateKeeper({
    defaultWidth: 420,
    defaultHeight: 860,
    file: 'window-state.json',
  });

  mainWindow = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    minWidth: 360,
    minHeight: 600,
    show: !START_HIDDEN,
    backgroundColor: BACKGROUNDS[savedTheme()],
    title: 'Layers',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  windowState.manage(mainWindow);

  mainWindow.loadFile(path.join(__dirname, 'app', 'index.html'));

  // Closing the window hides it to the tray instead of quitting, so
  // reminder checks and the app itself stay available in the background.
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  // ...except when Windows is shutting down, restarting or signing out:
  // hiding then would hold the shutdown up ("Layers is preventing restart").
  mainWindow.on('query-session-end', () => { isQuitting = true; });
  mainWindow.on('session-end', () => { isQuitting = true; });
  mainWindow.on('closed', () => { mainWindow = null; });

  // If the page's process dies, reload it instead of leaving a blank window
  // in the tray. Everything is saved as it changes, so nothing is lost. A
  // page that keeps crashing is left alone after three tries in a minute.
  let crashes = [];
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    if (details.reason === 'clean-exit' || !mainWindow || mainWindow.isDestroyed()) return;
    const now = Date.now();
    crashes = crashes.filter(t => now - t < 60 * 1000);
    crashes.push(now);
    if (crashes.length <= 3) mainWindow.reload();
  });
}

// --- Tray ------------------------------------------------------------------
// Windows draws the taskbar in its own light or dark mode, set separately
// from the apps' mode (Settings > Personalization > Colors). The tray icon
// matches it: the light icon on a dark taskbar and the dark icon on a light
// one. (It always used the dark icon, which nearly vanished on the default
// dark taskbar.)
function taskbarIsDark() {
  if (process.platform !== 'win32') return nativeTheme.shouldUseDarkColors;
  try {
    const out = execFileSync('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', '/v', 'SystemUsesLightTheme'], { encoding: 'utf8', windowsHide: true, timeout: 3000 });
    const m = out.match(/SystemUsesLightTheme\s+REG_DWORD\s+0x([0-9a-f]+)/i);
    return m ? parseInt(m[1], 16) === 0 : true;
  } catch {
    return true; // no setting saved: Windows 10 and 11 default to a dark taskbar
  }
}

function trayImage() {
  const icon = nativeImage.createFromPath(path.join(__dirname, taskbarIsDark() ? 'tray-icon-light.png' : 'tray-icon-dark.png'));
  return icon.isEmpty() ? icon : icon.resize({ width: 16, height: 16 });
}

function createTray() {
  tray = new Tray(trayImage());
  tray.setToolTip('Layers');
  const menu = Menu.buildFromTemplate([
    { label: 'Open Layers', click: showWindow },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', showWindow);
  // Pick the icon again when Windows' colours change, and now and then in
  // case only the taskbar's mode changed (that doesn't always notify apps).
  const refresh = () => { if (tray) tray.setImage(trayImage()); };
  nativeTheme.on('updated', refresh);
  setInterval(refresh, 15 * 60 * 1000);
}

// --- App version -----------------------------------------------------
// app.getVersion() reads the version electron-builder baked into this
// specific packaged build (from package.json at build time) — showing this
// in the UI lets you confirm exactly which build you're actually running,
// separate from whether a newer one has been published yet.
function setupVersionInfo() {
  ipcMain.handle('get-app-version', () => app.getVersion());
}

// --- Launch at login -----------------------------------------------------
// Registered with --hidden so Layers starts in the tray rather than popping
// up at every login (openAsHidden only works on macOS). The portable build
// registers its .exe, not the temporary folder it runs from, which is
// deleted when it exits.
function loginItem() {
  return { path: PORTABLE_EXE || process.execPath, args: ['--hidden'] };
}

function setupAutoLaunch() {
  ipcMain.handle('get-auto-launch', () => {
    const item = loginItem();
    if (app.getLoginItemSettings(item).openAtLogin) return true;
    // Before 1.0.27 the entry had no --hidden: upgrade it in place.
    if (app.getLoginItemSettings({ path: item.path }).openAtLogin) {
      app.setLoginItemSettings({ openAtLogin: true, ...item });
      return true;
    }
    return false;
  });
  ipcMain.handle('set-auto-launch', (_event, enabled) => {
    const item = loginItem();
    app.setLoginItemSettings({ openAtLogin: !!enabled, ...item });
    if (!enabled) app.setLoginItemSettings({ openAtLogin: false, path: item.path }); // and any pre-1.0.27 entry
    return app.getLoginItemSettings(item).openAtLogin;
  });
}

// --- Global shortcut: Ctrl+Shift+L brings Layers to the foreground ---
// register() returns false when another app already owns the combination;
// the Me tab asks (get-shortcut-status) and says so instead of it silently
// doing nothing.
function registerGlobalShortcut() {
  shortcutRegistered = globalShortcut.register('CommandOrControl+Shift+L', showWindow);
  ipcMain.handle('get-shortcut-status', () => ({ accelerator: 'Ctrl+Shift+L', registered: shortcutRegistered }));
}
