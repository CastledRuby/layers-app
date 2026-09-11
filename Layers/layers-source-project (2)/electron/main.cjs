const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const windowStateKeeper = require('electron-window-state');

let mainWindow = null;
let tray = null;
let isQuitting = false;

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

// --- Global shortcut: Ctrl+Shift+L opens Layers and starts a log entry ---
function registerGlobalShortcut() {
  globalShortcut.register('CommandOrControl+Shift+L', () => {
    if (!mainWindow) return;
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('trigger-log-interaction');
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  setupAutoUpdate();
  setupAutoLaunch();
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
