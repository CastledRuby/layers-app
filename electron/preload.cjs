const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('layersUpdater', {
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  quitAndInstall: () => ipcRenderer.send('quit-and-install'),
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
  setTheme: (theme) => ipcRenderer.send('set-theme', theme),
});
