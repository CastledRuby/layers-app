const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('layersUpdater', {
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  quitAndInstall: () => ipcRenderer.send('quit-and-install'),
  openDownloadPage: () => ipcRenderer.invoke('open-download-page'),
  onStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('update-status', listener);
    return () => ipcRenderer.removeListener('update-status', listener);
  },
});

contextBridge.exposeInMainWorld('layersSystem', {
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('set-auto-launch', enabled),
  getVersion: () => ipcRenderer.invoke('get-app-version'),
  getShortcutStatus: () => ipcRenderer.invoke('get-shortcut-status'),
  showWindow: () => ipcRenderer.send('show-window'),
  setTheme: (theme, mode) => ipcRenderer.send('set-theme', theme, mode),
  // Calendar (main.cjs): hand Windows the notifications to schedule, and
  // receive notification button presses as layers:// links.
  scheduleNotifications: (list) => ipcRenderer.invoke('schedule-notifications', list),
  calendarReady: () => ipcRenderer.invoke('calendar-ready'),
  // Daily backups (backups.cjs): save today's, and show or open the folder.
  saveDailyBackup: (day, json) => ipcRenderer.invoke('save-daily-backup', day, json),
  getBackupsInfo: () => ipcRenderer.invoke('backups-info'),
  openBackupsFolder: () => ipcRenderer.invoke('open-backups-folder'),
  // Sync through OneDrive (sync.cjs): the folder and whether a sync file is
  // there, reading and writing it, and the passphrase Windows keeps.
  getSyncInfo: () => ipcRenderer.invoke('sync-info'),
  readSyncFiles: () => ipcRenderer.invoke('sync-read'),
  writeSyncFile: (text) => ipcRenderer.invoke('sync-write', text),
  removeSyncCopies: (names) => ipcRenderer.invoke('sync-remove-copies', names),
  setAsideSyncFile: () => ipcRenderer.invoke('sync-set-aside'),
  getSyncPassphrase: () => ipcRenderer.invoke('sync-passphrase-get'),
  setSyncPassphrase: (passphrase) => ipcRenderer.invoke('sync-passphrase-set', passphrase),
  clearSyncPassphrase: () => ipcRenderer.invoke('sync-passphrase-clear'),
  openSyncFolder: () => ipcRenderer.invoke('sync-open-folder'),
  // Other calendars, read-only (feeds.cjs): names only come back, never the
  // secret addresses; fetchFeeds gives each calendar's file to read.
  listFeeds: () => ipcRenderer.invoke('feeds-list'),
  addFeed: (address) => ipcRenderer.invoke('feeds-add', address),
  removeFeed: (id) => ipcRenderer.invoke('feeds-remove', id),
  fetchFeeds: () => ipcRenderer.invoke('feeds-fetch'),
  // Where the faces are in chosen pictures (File objects), from Windows' own
  // face detector (faces.cjs): one { width, height, faces } or null each.
  findFaces: (files) => ipcRenderer.invoke('find-faces', [...files].map(file => { try { return webUtils.getPathForFile(file) || null; } catch { return null; } })),
  onCalendarAction: (callback) => {
    const listener = (_event, link) => callback(link);
    ipcRenderer.on('calendar-action', listener);
    return () => ipcRenderer.removeListener('calendar-action', listener);
  },
  // What the quick-add box sends to be saved, opened, undone or redone (main.cjs).
  onQuickAdd: (callback) => {
    const listener = (_event, msg) => callback(msg);
    ipcRenderer.on('quick-add', listener);
    return () => ipcRenderer.removeListener('quick-add', listener);
  },
});

// The quick-add box (src/QuickAdd.jsx, in its own small window): hand what
// was typed to the main window, and hear when the box is shown again.
contextBridge.exposeInMainWorld('layersQuick', {
  submit: (sentence) => ipcRenderer.send('quick-add', { type: 'submit', sentence }),
  open: (sentence) => ipcRenderer.send('quick-add', { type: 'open', sentence }),
  undo: () => ipcRenderer.send('quick-add', { type: 'undo' }),
  redo: () => ipcRenderer.send('quick-add', { type: 'redo' }),
  hide: () => ipcRenderer.send('quick-add', { type: 'hide' }),
  resize: (height) => ipcRenderer.send('quick-add', { type: 'resize', height }),
  onShow: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('quick-add-show', listener);
    return () => ipcRenderer.removeListener('quick-add-show', listener);
  },
});
