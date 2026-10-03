# Electron shell

Two files make up the desktop layer: [`electron/main.cjs`](../electron/main.cjs) (main process) and
[`electron/preload.cjs`](../electron/preload.cjs) (bridge). Exact line numbers for every IPC
channel are in [generated/code-map.md](generated/code-map.md#electron-ipc).

## Main process responsibilities

| Feature | Function / block | Notes |
|---|---|---|
| App identity | `app.setAppUserModelId('com.layers.app')` | Must match `build.appId` so Windows groups taskbar entries, toasts and shortcuts with the installed app. |
| Single instance | `app.requestSingleInstanceLock()` | A second launch calls `app.exit(0)` immediately. `Layers.exe --quit` makes the running instance quit cleanly (used by `npm run release` before installing), and exits straight away if none is running. Otherwise the first instance receives `second-instance` and calls `showWindow()`, unless the second launch had `--hidden` (a login launch while Layers is already running). |
| Window | `createWindow()` | 420×860 default, min 360×600. Starts hidden when launched with `--hidden`. `backgroundColor` is the saved theme's paper colour (`savedTheme()` reads `theme.json` in userData), so dark mode doesn't flash white. Size and position persist via `electron-window-state` (`window-state.json` in userData). `contextIsolation: true`, `nodeIntegration: false`. Loads `electron/app/index.html` with `loadFile`. |
| Close → tray | `mainWindow.on('close')` | Closing hides the window unless `isQuitting` is set. Quit through the tray menu, the updater or `before-quit`. `query-session-end` and `session-end` also set `isQuitting`, so hiding to the tray doesn't hold up a Windows shutdown, restart or sign-out. The page keeps running while hidden, so its [notifications](#notifications) still fire. |
| Crash recovery | `webContents.on('render-process-gone')` | If the page's process dies (any reason except `clean-exit`), the window reloads instead of staying blank. Everything is saved as it changes, so nothing is lost. A page that keeps crashing is left alone after 3 reloads in a minute. |
| Tray | `createTray()`, `trayImage()`, `taskbarIsDark()` | Menu has **Open Layers** and **Quit**. A click calls `showWindow()`. The icon follows the taskbar, which Windows themes separately from apps: `tray-icon-light.png` on a dark taskbar, `tray-icon-dark.png` on a light one. `taskbarIsDark()` reads `SystemUsesLightTheme` under `HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize` with `reg query`, and assumes dark (the Windows default) if it's missing. Other platforms use `nativeTheme.shouldUseDarkColors`. The icon is picked again on `nativeTheme`'s `updated` event and every 15 minutes, because a change to only the taskbar's mode doesn't always notify apps. Destroyed on `will-quit`. |
| Global shortcut | `registerGlobalShortcut()` | **Ctrl+Shift+L** calls `showWindow()`. `register()` returns false when another app already owns the combination; the result is kept and reported through `get-shortcut-status`, so the Me tab can say so. Unregistered on `will-quit`. |
| Auto-update | `setupAutoUpdate()` | See [Auto-update](#auto-update) below. |
| Launch at login | `setupAutoLaunch()`, `loginItem()` | Registers `{ path, args: ['--hidden'] }`, so a login launch starts in the tray. (`openAsHidden` only works on macOS.) `path` is the portable `.exe` (`PORTABLE_EXECUTABLE_FILE`) when running portable, because `process.execPath` is a temporary folder that's deleted on exit; otherwise `process.execPath`. `get-auto-launch` upgrades an entry from before 1.0.27 (same path, no `--hidden`) in place, and turning it off removes both kinds. |
| Version | `setupVersionInfo()` | Returns `app.getVersion()`, the version baked in at package time. The Me tab shows it. |
| Show from a notification | `ipcMain.on('show-window', showWindow)` | Registered in `setupVersionInfo()`. The renderer sends it when you click one of its notifications. |

### Startup

All the setup above, `app.whenReady()` and the `will-quit`, `before-quit` and
`window-all-closed` handlers are registered inside the `else` branch of the
single-instance check. A launch that doesn't get the lock, or a `--quit` launch, calls
`app.exit(0)` and sets nothing up. `showWindow()` is the one place that restores, shows
and focuses the window; the tray, the shortcut, `second-instance`, `activate` and the
renderer's `show-window` message all use it.

### Notifications

Layers' desktop notifications come from the page, not the main process. `src/lib/hooks.js`
sends reminder notifications and the daily check-in nudge with the web `Notification` API
([state-and-data.md](renderer/state-and-data.md#desktop-notifications)), and Electron
shows them as Windows notifications under the app's identity (`setAppUserModelId`).
They need the page to be running. It is while the window is hidden in the tray, because
closing only hides it, but a Layers that has quit sends none. Chromium may slow a hidden
page's timers, but the 30-second check and the 15-minute window leave plenty of room.
Clicking a notification calls `layersSystem.showWindow()`, which brings the window
forward from the tray.

### Command-line flags and environment variables

| Name | Effect |
|---|---|
| `--hidden` | Start in the tray without showing the window. The login item passes it. |
| `--quit` | Ask a running Layers to quit cleanly, then exit. |
| `PORTABLE_EXECUTABLE_FILE` | Set by electron-builder's portable launcher to the `.exe` itself. Layers uses it for the login item and to tell the portable build from the installed one. |
| `LAYERS_USER_DATA_DIR` | Use this folder for userData (`localStorage`, `theme.json`, `window-state.json` and the single-instance lock). It's applied before the lock, so a test copy can run beside your own Layers. The end-to-end tests give every launch a new temporary folder ([testing.md](testing.md#3-end-to-end-tests-testse2especjs)). |
| `LAYERS_NO_UPDATES` | Don't load `electron-updater`. `check-for-updates` answers `not-configured`. The end-to-end tests set it so they never contact GitHub. |

### Icons

`electron/` holds three icons, listed one by one in the packaging config:

- `icon.png`: the window icon, and the exe and installer icon (`build.win.icon`)
- `tray-icon-light.png`: the tray icon on a dark taskbar
- `tray-icon-dark.png`: the tray icon on a light taskbar

### Auto-update

`electron-updater` reads the GitHub Releases feed in `build.publish`
(`CastledRuby/layers-app`, `latest.yml`).

- **Checks:** one quiet check 8 s after launch, then every 6 hours
  (`UPDATE_CHECK_EVERY_MS`), because Layers usually sits in the tray for days. Me →
  "Check for updates" runs one on demand.
- **Installed copies** download a new version as soon as it's found. `autoDownload` is
  `false` and `update-available` calls `downloadUpdate()` itself, so a failed download is
  caught and reported as an error. A version that's already downloading isn't started
  again, and one that's already downloaded is reported as `ready` again. It installs when
  Layers next quits (`autoInstallOnAppQuit`), or straight away from Me → "Restart & install".
- **The portable `.exe`** can't update itself, because the feed only has the installer.
  It reports `available-portable` instead, and Me offers "Open download page"
  (`open-download-page`, which opens the latest release on GitHub).
- **Errors** that mean "no feed yet" are reported as `{ state: 'not-configured' }`.

## Renderer bridge (preload)

`contextBridge.exposeInMainWorld` exposes two objects. The renderer checks for them
before use (`hasUpdater`, `hasSystemBridge` in `LayersApp`), so the same bundle runs in a
plain browser.

### `window.layersUpdater`

| Method | IPC | Main side |
|---|---|---|
| `checkForUpdates()` | `invoke('check-for-updates')` | `autoUpdater.checkForUpdates()`; returns `{ ok }` or `{ ok: false, state, message }` |
| `quitAndInstall()` | `send('quit-and-install')` | Sets `isQuitting`, then calls `autoUpdater.quitAndInstall()` |
| `openDownloadPage()` | `invoke('open-download-page')` | `shell.openExternal` on the latest GitHub release (for the portable build) |
| `onStatus(cb)` → `unsubscribe` | `on('update-status')` | Main pushes `{ state: 'checking' \| 'available' \| 'available-portable' \| 'up-to-date' \| 'downloading' \| 'ready' \| 'not-configured' \| 'error', version?, percent?, message? }` |

The renderer turns these statuses into toasts and the Me-tab update row
(`updateStatusText()` in `src/lib/text.js`, which is unit-tested). Main re-checks every
6 hours, so `LayersApp` toasts each version's `available`, `ready` or
`available-portable` only once (the `announcedUpdate` ref).

### `window.layersSystem`

| Method | IPC | Main side |
|---|---|---|
| `getAutoLaunch()` | `invoke('get-auto-launch')` | Whether the login item (`loginItem()`) is set, upgrading a pre-1.0.27 entry |
| `setAutoLaunch(enabled)` | `invoke('set-auto-launch')` | Sets the login item and returns the new value |
| `getVersion()` | `invoke('get-app-version')` | `app.getVersion()` |
| `getShortcutStatus()` | `invoke('get-shortcut-status')` | `{ accelerator: 'Ctrl+Shift+L', registered }`. Me shows a warning when `registered` is false. |
| `showWindow()` | `send('show-window')` | `showWindow()`: restores, shows and focuses the window. Clicking a desktop notification calls it ([below](#notifications)). |
| `setTheme(theme)` | `send('set-theme')` | Sets the window's background colour and saves `{ theme }` to `theme.json` for the next launch (see [ui-system.md](renderer/ui-system.md#no-flash-at-startup)) |

Ctrl+Shift+L doesn't message the renderer. Up to 1.0.23 it also sent
`trigger-log-interaction` to open the log sheet. That channel and its
`onTriggerLog` bridge were removed in 1.0.24.

## Adding a new IPC capability

1. Register the handler in `main.cjs`. Use `ipcMain.handle` for request/response or
   `ipcMain.on` for fire-and-forget. Use `webContents.send` to push to the page, guarded
   by `mainWindow && !mainWindow.isDestroyed()` the way `sendStatus()` is.
2. Expose a narrow function in `preload.cjs` under the existing `layersSystem` or
   `layersUpdater` object. Never expose `ipcRenderer` itself. For listeners, return an
   unsubscribe function, following `onStatus`.
3. In `LayersApp` (`src/App.jsx`), feature-detect (`window.layersSystem && window.layersSystem.newThing`)
   so the web build keeps working. Subscribe inside a `useEffect` that returns the
   unsubscribe.
4. Run `npm run docs:map`. The *Channel mismatches* list in the code map should stay empty.

## Packaging config

The electron-builder config is the `"build"` key in [`package.json`](../package.json). It
packages `electron/main.cjs`, `electron/preload.cjs`, the three icons and
`electron/app/**` into an asar (`compression: "store"`). electron-builder also bundles
every package listed under `dependencies`, with its own dependencies. So `dependencies`
holds only what `main.cjs` `require`s: `electron-updater` and `electron-window-state`.
Renderer libraries (`react`, `react-dom`, `recharts`, `lucide-react`) are
`devDependencies`, because the single-file build already inlines them into `index.html`.
See [build-and-release.md](build-and-release.md#dependencies-vs-devdependencies).
Targets: Windows NSIS installer + portable exe (x64), Linux AppImage.

Code signing is off (`signtoolOptions.sign: null`), but electron-builder still edits the
exe's resources. So `Layers.exe` carries the Layers name (`productName`), icon
(`win.icon`), version and company (`author`, `CastledRuby`), and that's what the
Start menu, taskbar, notifications and Task Manager show. Up to 1.0.26,
`signAndEditExecutable: false` skipped the editing too, and Windows showed "Electron" by
GitHub, Inc. with the Electron icon. An end-to-end test checks the exe's identity.
