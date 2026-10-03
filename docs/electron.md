# Electron shell

Two files make up the desktop layer: [`electron/main.cjs`](../electron/main.cjs) (main process) and
[`electron/preload.cjs`](../electron/preload.cjs) (bridge). Exact line numbers for every IPC
channel are in [generated/code-map.md](generated/code-map.md#electron-ipc).

## Main process responsibilities

| Feature | Function / block | Notes |
|---|---|---|
| App identity | `app.setAppUserModelId('com.layers.app')` | Must match `build.appId` so Windows groups taskbar entries, toasts and shortcuts with the installed app. |
| Single instance | `app.requestSingleInstanceLock()` | A second launch calls `app.exit(0)` immediately. The first instance receives `second-instance` and restores, shows and focuses its window. |
| Window | `createWindow()` | 420×860 default, min 360×600. Size and position persist via `electron-window-state` (`window-state.json` in userData). `contextIsolation: true`, `nodeIntegration: false`. Loads `electron/app/index.html` with `loadFile`. |
| Close → tray | `mainWindow.on('close')` | Closing hides the window unless `isQuitting` is set. Quit through the tray menu, the updater or `before-quit`. |
| Tray | `createTray()` | Menu has **Open Layers** and **Quit**. A click shows or focuses the window. |
| Global shortcut | `registerGlobalShortcut()` | **Ctrl+Shift+L** restores, shows and focuses the window. Unregistered on `will-quit`. |
| Auto-update | `setupAutoUpdate()` | `electron-updater` against GitHub Releases (`build.publish`). `autoDownload = false`, but `update-available` starts the download straight away. Runs one quiet check 8 s after launch. Errors that mean "no feed yet" are reported as `{ state: 'not-configured' }`. |
| Launch at login | `setupAutoLaunch()` | `app.setLoginItemSettings({ openAtLogin, openAsHidden: true })`. |
| Version | `setupVersionInfo()` | Returns `app.getVersion()`, the version baked in at package time. The Me tab shows it. |

## Renderer bridge (preload)

`contextBridge.exposeInMainWorld` exposes two objects. The renderer checks for them
before use (`hasUpdater`, `hasSystemBridge` in `LayersApp`), so the same bundle runs in a
plain browser.

### `window.layersUpdater`

| Method | IPC | Main side |
|---|---|---|
| `checkForUpdates()` | `invoke('check-for-updates')` | `autoUpdater.checkForUpdates()`; returns `{ ok }` or `{ ok: false, state, message }` |
| `quitAndInstall()` | `send('quit-and-install')` | Sets `isQuitting`, then calls `autoUpdater.quitAndInstall()` |
| `onStatus(cb)` → `unsubscribe` | `on('update-status')` | Main pushes `{ state: 'checking' \| 'available' \| 'up-to-date' \| 'downloading' \| 'ready' \| 'not-configured' \| 'error', version?, percent?, message? }` |

The renderer turns these statuses into toasts and the Me-tab update row
(`updateStatusText()` in App.jsx, which is unit-tested).

### `window.layersSystem`

| Method | IPC | Main side |
|---|---|---|
| `getAutoLaunch()` | `invoke('get-auto-launch')` | `app.getLoginItemSettings().openAtLogin` |
| `setAutoLaunch(enabled)` | `invoke('set-auto-launch')` | Sets the login item and returns the new value |
| `getVersion()` | `invoke('get-app-version')` | `app.getVersion()` |
| `onTriggerLog(cb)` → `unsubscribe` | `on('trigger-log-interaction')` | ⚠️ **Nothing sends this any more.** Ctrl+Shift+L used to open the log sheet and now only focuses the window. See [known-issues.md](known-issues.md). |

## Adding a new IPC capability

1. Register the handler in `main.cjs`. Use `ipcMain.handle` for request/response or
   `ipcMain.on` for fire-and-forget. Use `webContents.send` to push to the page, guarded
   by `mainWindow && !mainWindow.isDestroyed()` the way `sendStatus()` is.
2. Expose a narrow function in `preload.cjs` under the existing `layersSystem` or
   `layersUpdater` object. Never expose `ipcRenderer` itself. For listeners, return an
   unsubscribe function, following `onStatus`.
3. In `App.jsx`, feature-detect (`window.layersSystem && window.layersSystem.newThing`)
   so the web build keeps working. Subscribe inside a `useEffect` that returns the
   unsubscribe.
4. Run `npm run docs:map`. The *Channel mismatches* list in the code map should stay empty.

## Packaging config

The electron-builder config is the `"build"` key in [`package.json`](../package.json). It
packages `electron/main.cjs`, `electron/preload.cjs`, `electron/*.png` and
`electron/app/**` into an asar (`compression: "store"`). electron-builder also bundles
every package listed under `dependencies`. That covers `react`, `react-dom`, `recharts`
and `lucide-react`, even though they're already inlined into `index.html` and never
`require`d at runtime (see [known-issues.md](known-issues.md)). Targets: Windows NSIS
installer + portable exe (x64), Linux AppImage. Code signing is disabled
(`signAndEditExecutable: false`).
