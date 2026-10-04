const { contextBridge, ipcRenderer } = require('electron');

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
  onCalendarAction: (callback) => {
    const listener = (_event, link) => callback(link);
    ipcRenderer.on('calendar-action', listener);
    return () => ipcRenderer.removeListener('calendar-action', listener);
  },
});
