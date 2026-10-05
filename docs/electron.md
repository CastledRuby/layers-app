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
| Global shortcuts | `registerGlobalShortcut()` | **Ctrl+Shift+L** shows or hides the quick-add box (`toggleQuickAdd`), and **Ctrl+Alt+L** calls `showWindow()`. `register()` returns false when another app already owns a combination; both results are kept and reported through `get-shortcut-status`, so the Me tab can say so. Unregistered on `will-quit`. |
| Quick add | `setupQuickAdd()`, `showQuickAdd()` | A second, small window (560 px wide, frameless, always on top, kept off the taskbar) loading the same page as `#quick` (`src/QuickAdd.jsx`). It's made the first time it's wanted and placed at the top of the screen the mouse is on, then hidden rather than closed: on Esc, when it loses focus, or after saving. It sends `quick-add` messages (only it may): `submit`, `open` and `undo` go on to the main window (queued until its page is ready), `open` also shows Layers, and `resize` makes the window as tall as the box. It never writes data itself. `app.layersShowQuickAdd` lets the end-to-end tests open it, since the real shortcut belongs to the Layers already running. |
| Auto-update | `setupAutoUpdate()` | See [Auto-update](#auto-update) below. |
| Launch at login | `setupAutoLaunch()`, `loginItem()` | Registers `{ path, args: ['--hidden'] }`, so a login launch starts in the tray. (`openAsHidden` only works on macOS.) `path` is the portable `.exe` (`PORTABLE_EXECUTABLE_FILE`) when running portable, because `process.execPath` is a temporary folder that's deleted on exit; otherwise `process.execPath`. `get-auto-launch` upgrades an entry from before 1.0.27 (same path, no `--hidden`) in place, and turning it off removes both kinds. |
| Daily backups | `setupBackups()`, [`backups.cjs`](../electron/backups.cjs) | The page sends one backup a day (`save-daily-backup`); it's saved as `layers-backup-YYYY-MM-DD.json` in **Documents\Layers backups** (`Backups` in the data folder when `LAYERS_USER_DATA_DIR` is set). A day's file is never overwritten, so it holds the data as it was when Layers first ran that day, and only the newest 14 are kept. Files with other names are left alone. `backups-info` and `open-backups-folder` serve Me's **Automatic backups** row. |
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

The calendar's notifications are **scheduled with Windows**, so they arrive on time even
when Layers is closed:

1. The renderer works out the next 14 days of them (`plannedNotifications`,
   [state-and-data.md](renderer/state-and-data.md#notifications)). It sends them with
   `layersSystem.scheduleNotifications` whenever they change, and every hour.
2. [`electron/toasts.cjs`](../electron/toasts.cjs) turns each into toast XML
   (`toastXml`).
   - Reminders (before a plan, or as it starts) use the `reminder` scenario, so they
     stay on screen, with **10 min**, **1 hour** and **Tomorrow**. They have no Log it
     or Done: the plan hasn't happened yet.
   - "How did it go?" (when a plan with people ends) is rated right there: **Casual**,
     **Good**, **Personal** or **Deep** (`layers://rate?…&r=2` to `5`), a quick log made
     without opening Layers that ticks the plan off; or **Log it…** for the full log.
   - Someone close gone quiet has **Plan something**; the weekly catch-up list has **Plan
     with** each of up to three people; the Sunday review has **Review my week**. Clicking
     the catch-up list or the review opens the week review (`layers://review`).
   - A birthday or key date coming up has **Plan something** (`layers://plan?p=<person>&d=<day>`), which opens planning with that person on that day.
   - Every button and the toast body are `layers://` links.
3. It replaces Layers' scheduled toasts (group `layers`) through Windows PowerShell and
   the WinRT `ToastNotificationManager`, so no native module is needed. One run happens
   at a time; a newer list waiting replaces an older one.

**A button press**:
1. Windows starts `Layers.exe` with the `layers://` link. The installer registers the
   protocol (`build.protocols`), and `setupCalendar()` re-registers it if the app moved.
   It never does this for test runs or the portable build.
2. If Layers is already running, the link reaches it through `second-instance`.
   Otherwise it starts with the link, in the tray for Just tick it, Snooze and a rating
   (`quietLink`), or with its window for everything else.
3. Links wait in `pendingActions` until the page asks for them (`calendar-ready`), then
   go out as `calendar-action`.

The page also shows the daily check-in nudge itself, with the web `Notification` API,
while Layers runs. Clicking it calls `layersSystem.showWindow()`.

### Command-line flags and environment variables

| Name | Effect |
|---|---|
| `--hidden` | Start in the tray without showing the window. The login item passes it. |
| `--quit` | Ask a running Layers to quit cleanly, then exit. |
| `PORTABLE_EXECUTABLE_FILE` | Set by electron-builder's portable launcher to the `.exe` itself. Layers uses it for the login item and to tell the portable build from the installed one. |
| `LAYERS_USER_DATA_DIR` | Use this folder for userData (`localStorage`, `theme.json`, `window-state.json` and the single-instance lock), and its `Backups` folder for daily backups. It's applied before the lock, so a test copy can run beside your own Layers. The end-to-end tests give every launch a new temporary folder ([testing.md](testing.md#3-end-to-end-tests-testse2especjs)). |
| `LAYERS_NO_UPDATES` | Don't load `electron-updater`. `check-for-updates` answers `not-configured`. The end-to-end tests set it so they never contact GitHub. |
| `LAYERS_NO_SCHEDULE` | Don't schedule Windows notifications. The end-to-end tests set it, so they never put toasts on your computer. |
| `LAYERS_SCHEDULE_DUMP` | Write the toasts that would be scheduled (tag, time, XML) to this file instead. One end-to-end test uses it. |
| `layers://…` | A notification button's link ([Notifications](#notifications)). |

### Icons

The brand is direction A, Rings ([branding/README.md](../branding/README.md)).
`npm run brand:render` ([`scripts/render-brand.cjs`](../scripts/render-brand.cjs)) draws
these files from its SVGs. Run it inside Electron, so Chromium does the drawing:

- `icon.ico`: the exe and installer icon (`build.win.icon`) and, on Windows, the window
  icon. It holds 16–256 px images; 16, 24 and 32 px use the simplified drawing, which stays
  clear in the taskbar and title bar.
- `icon.png`: 256 px, the window icon elsewhere and the Linux icon
- `tray-icon-light.png` and `tray-icon-light@2x.png`: the tray icon on a dark taskbar, at
  16 and 32 px. `trayImage()` loads the 16 px file and Electron picks the `@2x` one on
  high-DPI displays.
- `tray-icon-dark.png` and `@2x`: the same on a light taskbar
- `installer-sidebar.bmp`: the installer's 164 × 314 side panel (`nsis.installerSidebar`)

All but the sidebar are listed one by one in `build.files`.

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
| `getShortcutStatus()` | `invoke('get-shortcut-status')` | `{ accelerator: 'Ctrl+Shift+L', registered, open: { accelerator: 'Ctrl+Alt+L', registered } }`. Me shows a warning for each one another app owns. |
| `showWindow()` | `send('show-window')` | `showWindow()`: restores, shows and focuses the window. Clicking a desktop notification calls it ([below](#notifications)). |
| `scheduleNotifications(list)` | `invoke('schedule-notifications')` | Replaces Layers' scheduled Windows toasts with `list` (`toasts.cjs`); resolves `{ scheduled }` or `{ error }` |
| `calendarReady()` | `invoke('calendar-ready')` | Marks the page ready and returns the `layers://` links that arrived before it was |
| `onCalendarAction(cb)` | `on('calendar-action')` | Calls `cb(link)` for each later button press; returns an unsubscribe function |
| `setTheme(theme, mode)` | `send('set-theme')` | Sets the window's background colour and saves `{ theme, mode }` to `theme.json` for the next launch. With `mode: 'system'` (Match Windows) the next launch asks Windows (`nativeTheme.shouldUseDarkColors`). See [ui-system.md](renderer/ui-system.md#no-flash-at-startup). |
| `saveDailyBackup(day, json)` | `invoke('save-daily-backup')` | Saves the day's backup unless it has one, keeps the newest 14; resolves `{ saved, dir, count, latest }` or `{ error }` |
| `getBackupsInfo()` | `invoke('backups-info')` | `{ dir, count, latest }` for Me |
| `openBackupsFolder()` | `invoke('open-backups-folder')` | Opens the backups folder in Explorer, creating it if needed |
| `onQuickAdd(cb)` | `on('quick-add')` | Calls `cb({ type, sentence })` for what the quick-add box sends: `submit` (save it, as Ctrl+K would, with Undo), `open` (open it in its full sheet) or `undo`. Returns an unsubscribe function. |

### `window.layersQuick`

For the quick-add box's page (`src/QuickAdd.jsx`); the main window doesn't use it.

| Method | IPC | Main side |
|---|---|---|
| `submit(sentence)`, `open(sentence)`, `undo()` | `send('quick-add')` | Passed on to the main window's `onQuickAdd`; `open` also shows Layers |
| `hide()` | `send('quick-add')` | Hides the box |
| `resize(height)` | `send('quick-add')` | Sets the box's height (110 to 420 px) |
| `onShow(cb)` | `on('quick-add-show')` | Calls `cb()` each time the box is shown, so it starts clean with the people Layers last saved |

Up to 1.0.23 Ctrl+Shift+L also sent `trigger-log-interaction` to open the log sheet.
That channel and its `onTriggerLog` bridge were removed in 1.0.24; from 1.0.31 the
shortcut opens the quick-add box instead, and Ctrl+Alt+L brings Layers forward.

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
