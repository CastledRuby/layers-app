const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const windowStateKeeper = require('electron-window-state');

// Windows groups taskbar entries, toast notifications, and jump lists by
// this identity string. It must be set before the app is ready, and it
// should match the appId electron-builder uses to build the installer so
// the packaged app and the installed shortcut are recognised as the same
// application. Without this, Windows can treat separate launches (or the
// dev run vs. the installed run) as unrelated apps.
app.setAppUserModelId('com.layers.app');

let mainWindow = null;
let tray = null;
let isQuitting = false;

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
  // is a graceful async request), so we're certain nothing below this
  // block — window creation, tray creation, whenReady — ever runs.
  app.exit(0);
} else {
  app.on('second-instance', (_event, argv) => {
    if (argv.includes('--quit')) {
      isQuitting = true;
      app.quit();
      return;
    }
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  });
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
// Uses electron-updater against a GitHub Releases feed. Until package.json's
// "build.publish" points at a real repo with a published release, this
// will simply report "not-configured" rather than erroring loudly.
function setupAutoUpdate() {
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (e) {
    return;
  }

  autoUpdater.autoDownload = false;

  autoUpdater.on('checking-for-update', () => sendStatus({ state: 'checking' }));
  autoUpdater.on('update-available', (info) => {
    sendStatus({ state: 'available', version: info.version });
    autoUpdater.downloadUpdate();
  });
  autoUpdater.on('update-not-available', () => sendStatus({ state: 'up-to-date' }));
  autoUpdater.on('download-progress', (p) => sendStatus({ state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (info) => sendStatus({ state: 'ready', version: info.version }));
  autoUpdater.on('error', (err) => sendStatus(classifyUpdateError(err)));

  ipcMain.handle('check-for-updates', async () => {
    try {
      await autoUpdater.checkForUpdates();
      return { ok: true };
    } catch (e) {
      const status = classifyUpdateError(e);
      sendStatus(status);
      return { ok: false, ...status };
    }
  });

  ipcMain.on('quit-and-install', () => {
    isQuitting = true;
    autoUpdater.quitAndInstall();
  });

  // One quiet check shortly after launch, in addition to whatever the
  // person triggers manually from the Me tab.
  setTimeout(() => { autoUpdater.checkForUpdates().catch(() => {}); }, 8000);
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
    backgroundColor: '#F5F6F1',
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
}

function createTray() {
  const trayIconPath = path.join(__dirname, 'tray-icon.png');
  const icon = nativeImage.createFromPath(trayIconPath);
  tray = new Tray(icon.isEmpty() ? icon : icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Layers');
  const menu = Menu.buildFromTemplate([
    { label: 'Open Layers', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => { if (mainWindow) { mainWindow.isVisible() ? mainWindow.focus() : mainWindow.show(); } });
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
function setupAutoLaunch() {
  ipcMain.handle('get-auto-launch', () => {
    return app.getLoginItemSettings().openAtLogin;
  });
  ipcMain.handle('set-auto-launch', (_event, enabled) => {
    app.setLoginItemSettings({ openAtLogin: !!enabled, openAsHidden: true });
    return app.getLoginItemSettings().openAtLogin;
  });
}

// --- Global shortcut: Ctrl+Shift+L brings Layers to the foreground ---
function registerGlobalShortcut() {
  globalShortcut.register('CommandOrControl+Shift+L', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  setupAutoUpdate();
  setupAutoLaunch();
  setupVersionInfo();
  registerGlobalShortcut();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow.show();
  });
});

app.on('will-quit', () => { globalShortcut.unregisterAll(); });

app.on('before-quit', () => { isQuitting = true; });

app.on('window-all-closed', () => {
  if (isQuitting) app.quit();
});
