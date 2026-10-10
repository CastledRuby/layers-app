# Electron shell

Two files make up the desktop layer: [`electron/main.cjs`](../electron/main.cjs) (main process) and
[`electron/preload.cjs`](../electron/preload.cjs) (bridge). Exact line numbers for every IPC
channel are in [generated/code-map.md](generated/code-map.md#electron-ipc).

## Main process responsibilities

| Feature | Function / block | Notes |
|---|---|---|
| App identity | `app.setAppUserModelId('com.layers.app')` | Must match `build.appId` so Windows groups taskbar entries, toasts and shortcuts with the installed app. |
| Single instance | `app.requestSingleInstanceLock()` | A second launch calls `app.exit(0)` immediately. `Layers.exe --quit` makes the running instance quit cleanly (used by `npm run release` before installing), and exits straight away if none is running. Otherwise the first instance receives `second-instance` and calls `showWindow()`, unless the second launch had `--hidden` (a login launch while Layers is already running). |
| Window | `createWindow()` | **Always maximised**: it opens maximised, `showWindow()` maximises it when it's brought back (from the tray, a second launch, Ctrl+Alt+L or a notification), and `unmaximize` (the title bar's restore button, a double-click, dragging it off the top, Win+↓) maximises it straight back. Minimising still works. Min 360×600. It's created hidden and then maximised and shown, because `maximize()` also shows a window: so a launch with `--hidden` stays in the tray until it's shown. `backgroundColor` is the saved theme's paper colour (`savedTheme()` reads `theme.json` in userData), so dark mode doesn't flash white. `electron-window-state` (`window-state.json` in userData) keeps the un-maximised size, with its own maximising turned off (`maximize: false`), since that would show a window launched hidden. `contextIsolation: true`, `nodeIntegration: false`. Loads `electron/app/index.html` with `loadFile`. |
| Close → tray | `mainWindow.on('close')` | Closing hides the window unless `isQuitting` is set. Quit through the tray menu, the updater or `before-quit`. `query-session-end` and `session-end` also set `isQuitting`, so hiding to the tray doesn't hold up a Windows shutdown, restart or sign-out. The page keeps running while hidden, so its [notifications](#notifications) still fire. |
| Crash recovery | `webContents.on('render-process-gone')` | If the page's process dies (any reason except `clean-exit`), the window reloads instead of staying blank. Everything is saved as it changes, so nothing is lost. A page that keeps crashing is left alone after 3 reloads in a minute. |
| Tray | `createTray()`, `trayImage()`, `taskbarIsDark()` | Menu has **Open Layers** and **Quit**. A click calls `showWindow()`. The icon follows the taskbar, which Windows themes separately from apps: `tray-icon-light.png` on a dark taskbar, `tray-icon-dark.png` on a light one. `taskbarIsDark()` reads `SystemUsesLightTheme` under `HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize` with `reg query`, and assumes dark (the Windows default) if it's missing. Other platforms use `nativeTheme.shouldUseDarkColors`. The icon is picked again on `nativeTheme`'s `updated` event and every 15 minutes, because a change to only the taskbar's mode doesn't always notify apps. Destroyed on `will-quit`. |
| Global shortcuts | `registerGlobalShortcut()` | **Ctrl+Shift+L** shows or hides the quick-add box (`toggleQuickAdd`), and **Ctrl+Alt+L** calls `toggleWindow()`: `showWindow()`, or, when Layers is already in front and focused, `minimize()` (so the app you were in comes back). `app.layersToggleWindow` lets the end-to-end tests press it. `register()` returns false when another app already owns a combination; both results are kept and reported through `get-shortcut-status`, so the Me tab can say so. Unregistered on `will-quit`. |
| Quick add | `setupQuickAdd()`, `showQuickAdd()` | A second, small window (560 px wide, frameless, always on top, kept off the taskbar) loading the same page as `#quick` (`src/QuickAdd.jsx`). It's made the first time it's wanted and placed at the top of the screen the mouse is on, then hidden rather than closed: on Esc, when it loses focus, or after saving. It sends `quick-add` messages (only it may): `submit`, `open`, `undo` and `redo` go on to the main window (queued until its page is ready), `open` also shows Layers, and `resize` makes the window as tall as the box. It never writes data itself. `app.layersShowQuickAdd` lets the end-to-end tests open it, since the real shortcut belongs to the Layers already running. |
| Auto-update | `setupAutoUpdate()` | See [Auto-update](#auto-update) below. |
| Launch at login | `setupAutoLaunch()`, `loginItem()` | Registers `{ path, args: ['--hidden'] }`, so a login launch starts in the tray. (`openAsHidden` only works on macOS.) `path` is the portable `.exe` (`PORTABLE_EXECUTABLE_FILE`) when running portable, because `process.execPath` is a temporary folder that's deleted on exit; otherwise `process.execPath`. `get-auto-launch` upgrades an entry from before 1.0.27 (same path, no `--hidden`) in place, and turning it off removes both kinds. |
| Daily backups | `setupBackups()`, [`backups.cjs`](../electron/backups.cjs) | The page sends one backup a day (`save-daily-backup`); it's saved as `layers-backup-YYYY-MM-DD.json` in **Documents\Layers backups** (`Backups` in the data folder when `LAYERS_USER_DATA_DIR` is set). A day's file is never overwritten, so it holds the data as it was when Layers first ran that day, and only the newest 14 are kept. Files with other names are left alone. `backups-info` and `open-backups-folder` serve Me's **Automatic backups** row. |
| Faces in pictures | `setupFaces()`, [`faces.cjs`](../electron/faces.cjs) | `find-faces` takes picture paths (the preload turns the page's `File`s into paths with `webUtils.getPathForFile`) and asks **Windows' own face detector** (`Windows.Media.FaceAnalysis`, as the Photos app uses) where the faces are: one PowerShell run (`-EncodedCommand`, the paths on standard input) for a whole folder, about 1.5 s for nine pictures. Only absolute paths to picture files that exist are asked about; it gives up after 30 s, and answers nothing off Windows. Nothing is bundled and nothing leaves the computer. Photos from a folder and the avatar picker's Photo start their circle on the biggest face (`faceCrop`). |
| Sync through OneDrive | `setupSync()`, [`sync.cjs`](../electron/sync.cjs) | Only moves the encrypted sync file and keeps the passphrase; the page encrypts, decrypts and merges ([state-and-data.md](renderer/state-and-data.md#syncing-through-onedrive)). The file is `Documents\Layers sync\layers-sync.json` (Documents is in OneDrive on this laptop), or `Sync` in the data folder for tests, or `LAYERS_SYNC_DIR`. It's written to a temporary file and renamed over, so nothing ever sees half of it. Every `layers-sync*.json` is read (OneDrive names a clashing copy after the computer), and merged copies are removed. One that can't be read is kept as `layers-sync.unreadable-<time>.bak`. The passphrase is `sync-passphrase.bin` in the data folder, encrypted by Windows for this user (`safeStorage`, DPAPI). |
| Other calendars | `setupFeeds()`, [`feeds.cjs`](../electron/feeds.cjs) | Your Google Calendar, read-only. The secret iCal addresses you add in Me are kept in `calendars.bin` in the data folder, encrypted by Windows (`safeStorage`), never given back to the page (only names and hosts), never synced or backed up. `feeds-add` takes https (or webcal) addresses only, and fetches once to check it's a calendar and read its name; `feeds-fetch` downloads each (20 s limit, 5 MB) and hands the page the files to read ([lib/ics.js](../src/lib/ics.js)). Fetching only downloads. |
| Chat analysis with Claude | `setupAnalysis()`, [`analysis.cjs`](../electron/analysis.cjs) | Coach's **Analyse your own chat**. Your Anthropic API key is `anthropic-key.bin` in the data folder, encrypted by Windows (`safeStorage`); the page only learns whether there is one. `analysis-key-set` takes keys shaped like `sk-ant-…` and checks one works by listing the models (free) before keeping it. `analysis-run` is the only thing that sends a chat anywhere, and only when you press Analyse: it lets through text and up to six base64 screenshots (no links, no files), asks the model Coach picked, if it's one of `MODELS` (Claude Haiku 4.5, the cheapest and the default, then Sonnet 5.5, Opus 5.5 and Fable 5.1; anything else gets Haiku), through the official `@anthropic-ai/sdk`, waiting up to 5 minutes since the bigger models think first, with structured outputs keeping the answer to the page's JSON schema, and gives back `{ result, usage }` or `{ error }` in words (with `usage` and `model` too when Claude answered but it couldn't be used, since that's charged) (a key that doesn't work, no credit left, offline, a refusal, too long; a request Claude turns down says why in Anthropic's own words, and mentions screenshots only when there were some). The page builds the request and hides names ([lib/analysis.js](../src/lib/analysis.js)). |
| Chat exports | `setupChats()`, [`chatfiles.cjs`](../electron/chatfiles.cjs) | The **Layers chats** folder for Coach's "From your chats": `Documents\Layers chats` (Documents is in OneDrive here, so a WhatsApp export saved to it on the phone comes down by itself), or `Chats` in the data folder for tests, or `LAYERS_CHATS_DIR`. It's made at startup so it shows in OneDrive. `chats-list` lists the chat exports in it, newest first: a WhatsApp export (its zip, or the .txt; named from the file, "WhatsApp Chat - Amelie.zip"), an Instagram "Download your information" zip (its `messages/inbox/*/message_*.json`), the same download unzipped (a folder with `messages/inbox` up to five folders down, since Windows' Extract All adds a folder of the same name and newer downloads put it under `your_instagram_activity`; as new as its newest messages file), or either downloaded as HTML (so the page can say to choose JSON). Listing reads only a zip's central directory. `chats-read` reads one by name (nothing outside the folder): the WhatsApp chat's text, or every Instagram messages file, unzipped with Node's own `zlib` (nothing bundled; up to 300 MB a file, 60 MB unpacked per entry, 200 MB in all; no ZIP64) or read from the folder (named as in the zip, `messages/inbox/<thread>/message_1.json`, so the page reads both the same). The page parses them ([lib/chatImport.js](../src/lib/chatImport.js)). `fs.watch` on the folder and the folders in it sends `chats-changed` 1.5 s after files stop changing. Only reads: files are never changed or removed. |
| A summary as a PDF | `setupSummary()` | `export-summary` takes the page `src/lib/summary.js` makes, draws it in a hidden window with scripts off, `printToPDF` (A4 from the page's own `@page`), and saves it where you pick (Documents by default), then opens it. In the end-to-end tests `LAYERS_SUMMARY_DIR` saves it there without asking or opening it. |
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
| `LAYERS_CHATS_DIR` | Use this folder as the Layers chats folder (otherwise `Chats` in `LAYERS_USER_DATA_DIR`, or `Documents\Layers chats`). |
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
| `getSyncInfo()` | `invoke('sync-info')` | `{ dir, hasFile }`: the sync folder, and whether another device made the file already |
| `readSyncFiles()` / `writeSyncFile(text)` | `invoke('sync-read')` / `invoke('sync-write')` | Every sync file as `{ name, text }`, the main one first / the main file, written whole |
| `removeSyncCopies(names)` / `setAsideSyncFile()` | `invoke('sync-remove-copies')` / `invoke('sync-set-aside')` | Removes merged copies (never the main file or other files) / keeps an unreadable main file under another name |
| `getSyncPassphrase()` / `setSyncPassphrase(p)` / `clearSyncPassphrase()` | `invoke('sync-passphrase-*')` | The remembered passphrase, kept encrypted by Windows |
| `openSyncFolder()` | `invoke('sync-open-folder')` | Opens the sync folder in Explorer |
| `listFeeds()` / `addFeed(address)` / `removeFeed(id)` | `invoke('feeds-*')` | Your other calendars: `[{ id, name, host }]` (never the addresses) / add one (`{ ok, feed }` or `{ error }`) / remove one |
| `fetchFeeds()` | `invoke('feeds-fetch')` | Each calendar's file: `[{ id, name, text }]`, or `{ id, name, error }` for one that couldn't be fetched |
| `getAnalysisKeyStatus()` / `setAnalysisKey(key)` / `clearAnalysisKey()` | `invoke('analysis-key-*')` | Chat analysis: `{ hasKey }` (never the key) / keep a key once it's checked (`{ ok }` or `{ error }`) / forget it |
| `getChatsInfo()` / `listChatExports()` / `readChatExport(name)` / `openChatsFolder()` | `invoke('chats-*')` | The Layers chats folder: `{ dir }` / its exports `[{ name, kind, title, size, modified }]` / one's text `{ kind, title, files: [{ path, text }] }` or `{ error }` / opening it in Explorer |
| `onChatExportsChanged(cb)` | `on('chats-changed')` | Calls `cb()` when files come or go in the folder; returns an unsubscribe function |
| `runAnalysis(request)` | `invoke('analysis-run')` | Sends one chat (`{ system, content, schema }` from `lib/analysis.js`) to Claude: `{ result, usage: { input, output }, model }` or `{ error }` |
| `exportSummary(html, fileName)` | `invoke('export-summary')` | Saves a one-page summary as a PDF where you pick: `{ saved }`, `{ canceled }` or `{ error }` |
| `findFaces(files)` | `invoke('find-faces')` | Where the faces are in chosen pictures (`faces.cjs`): one `{ width, height, faces: [{ x, y, w, h }] }` or `null` per file |
| `openBackupsFolder()` | `invoke('open-backups-folder')` | Opens the backups folder in Explorer, creating it if needed |
| `onQuickAdd(cb)` | `on('quick-add')` | Calls `cb({ type, sentence })` for what the quick-add box sends: `submit` (save it, as Ctrl+K would, with Undo), `open` (open it in its full sheet), `undo` or `redo`. Returns an unsubscribe function. |

### `window.layersQuick`

For the quick-add box's page (`src/QuickAdd.jsx`); the main window doesn't use it.

| Method | IPC | Main side |
|---|---|---|
| `submit(sentence)`, `open(sentence)`, `undo()`, `redo()` | `send('quick-add')` | Passed on to the main window's `onQuickAdd`; `open` also shows Layers |
| `hide()` | `send('quick-add')` | Hides the box |
| `resize(height)` | `send('quick-add')` | Sets the box's height (110 to 420 px) |
| `onShow(cb)` | `on('quick-add-show')` | Calls `cb()` each time the box is shown, so it starts clean with the people Layers last saved |

Up to 1.0.23 Ctrl+Shift+L also sent `trigger-log-interaction` to open the log sheet.
That channel and its `onTriggerLog` bridge were removed in 1.0.24; from 1.0.31 the
shortcut opens the quick-add box instead, and Ctrl+Alt+L brings Layers forward (or
sends it back when it's already in front).

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
