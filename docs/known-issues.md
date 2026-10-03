# Known issues & evaluation notes

These findings come from an evaluation of the source on 2026-10-03, ordered by impact.
When you fix an item, delete it here, or move it to *Resolved* with the version.

## Correctness

The 2026-10-03 audit against [vision.md](vision.md) found 22 bugs, listed with how each
was confirmed in [roadmap.md](roadmap.md#batch-1-fixes). All of Batch 1 is fixed in
1.0.27 (see *Resolved* below). `tests/app/fixes.test.jsx` reproduces each one through the
UI, so none can come back unnoticed. 1.0.28 then built most of the proposals; what still
needs a decision is in [roadmap.md](roadmap.md#needs-your-decision).

The last inconsistency, logging and Adjust disagreeing about a person's layer, is
resolved by P3 option C (after 1.0.28, not released yet): the dimensions stay inside
the layer's band. See
[renderer/state-and-data.md](renderer/state-and-data.md#dimensions-stay-inside-the-layer).

## Build & release

### 1. The desktop app can silently run old code *(mitigated in 1.0.24 and 1.0.27)*

Electron loads only the committed build artifact `electron/app/index.html`. If you
change `src/` and package without `npm run build:electron`, or install a build without
bumping `version`, the app runs stale code that looks current. That happened with the
"Edit goal" bug: the installed 1.0.23 (Sep 19) predated the source's 1.0.23 (Sep 25).
Follow the checklist in [build-and-release.md](build-and-release.md). `npm run release`
rebuilds the renderer itself, and since 1.0.27 it also runs the end-to-end tests on the
packaged build it's about to publish ([testing.md](testing.md#in-the-release)). Packaging
by hand (`electron-builder` on its own) still skips both, so consider a `prepackage` guard
that fails when `electron/app/index.html` is older than the files in `src/`.

## Resolved

| Version | Issue |
|---|---|
| 1.0.27 | Coach crashed to a blank window when it was opened for someone who had since been removed. Coach now falls back to the first person in Prepare and asks who the conversation was with in Analyse. Every screen is wrapped in an `ErrorBoundary` with "Go to Home" and "Reload Layers" ([renderer/ui-system.md](renderer/ui-system.md#when-a-screen-crashes)), and `main.cjs` reloads the page if its process dies ([electron.md](electron.md)). |
| 1.0.27 | Saved data that couldn't be read was silently replaced by the sample people, and the next save overwrote it for good. Failed saves were silent too. `loadSavedState` now checks saved data with `validateBackup` at startup. Unreadable data is copied aside and explained, damaged records are repaired with a notice, and a failed save shows one toast ([renderer/state-and-data.md](renderer/state-and-data.md#loading-saved-data)). Removing a person or restoring samples also unlinks them from reminders. |
| 1.0.27 | Adjust → Save with nothing changed could move someone to another layer. Saving unchanged sliders now does nothing, Adjust shows where saving would put them, and new and sample people start exactly where Adjust would place them ([renderer/state-and-data.md](renderer/state-and-data.md#progression-model)). |
| 1.0.27 | `Layers.exe` called itself "Electron" by GitHub, Inc. and showed the Electron icon in the Start menu, on the desktop, the taskbar, notifications and Task Manager, because `signAndEditExecutable` was `false`. The exe now carries the Layers name, icon and version, and `author` in `package.json` supplies the company. An end-to-end test checks it. |
| 1.0.27 | Desktop shell ([electron.md](electron.md)): the tray icon was dark on the default dark taskbar and now follows the taskbar's mode. "Launch at login" opened the window (`openAsHidden` is macOS-only) and now starts in the tray with `--hidden`; the portable build registered a temporary folder and now registers its own `.exe`. Close-to-tray no longer holds up a Windows shutdown or restart. Updates are re-checked every 6 hours. The download is started explicitly, so `autoDownload = false` is no longer misleading and a failed download is reported. The portable build offers the download page instead of downloading the installer. Me warns when another app owns Ctrl+Shift+L. |
| 1.0.27 | Keyboard: `/` did nothing on Home, Coach or Me; Ctrl or Alt + N or D opened sheets; Esc didn't close "Prepare to talk" or Home's detail picker, and in a picker opened from another sheet it closed both. `/` now works from any tab, single-key shortcuts ignore Ctrl/Alt/Win, and Esc closes only the top sheet ([renderer/ui-system.md](renderer/ui-system.md#esc-and-the-open-sheet-stack)). |
| 1.0.27 | What you see: topics picked while logging with one person now reach their profile. The skills chart records points. The timeline gets a dated step for every layer change. The change card counts a gain across a level-up instead of "+0%". Recent activity is ordered by date. A group log announces every level-up, not only the first. Coach applies the goal gain it shows and can't log the same analysis twice. A goal's description follows the chosen person. Due labels refresh at midnight. Reminders can be made with nobody in your circle, and deleting one asks first. Outdated wording on Home, Me and Journal is fixed. |
| 1.0.27 | Housekeeping: the unused icon variants (`electron/icon-light.png`, `icon-dark.png`, `tray-icon.png`) and the Vite template leftovers in `src/assets/` are gone, and every oxlint warning is cleared. |
| 1.0.26 | The "daily" check-in reminder only ran once per launch, using the data from launch time, so an app left in the tray never reminded you again. It also took "today" from the UTC date, which is still yesterday in New Zealand until around midday. `useDailyCheckIn` now re-checks whenever the local day changes (`useToday`), and Home and profile labels refresh at midnight. |
| 1.0.26 | Imports weren't checked: a wrong or damaged file could replace your data or crash a screen (a person without a `goals` list crashed Home). `validateBackup` now refuses bad files, repairs or skips damaged records, and the confirm dialog says what will be imported ([renderer/state-and-data.md](renderer/state-and-data.md#backup-format)). |
| 1.0.26 | Dark mode flashed white at startup (the window's background was hard-coded light). The window, the page and React now all paint the saved theme ([renderer/ui-system.md](renderer/ui-system.md#no-flash-at-startup)). |
| 1.0.26 | A running `npm run dev` made release builds fail with `EPERM` (Vite watched `release/`, so electron-builder couldn't rename `win-unpacked.tmp`). `vite.config.js` now skips the build output folders and `.claude/` with a path-prefix check. Globs don't work here: the folder name's parentheses break them, and `**/.claude/**` matched the whole project inside a worktree. |
| 1.0.26 | Fonts were fetched from `fonts.googleapis.com` on every launch, so offline launches fell back to system fonts and the "private" app made a network call. Fraunces and Manrope are now bundled ([renderer/ui-system.md](renderer/ui-system.md#fonts)). |
| 1.0.26 | `src/App.jsx` was a ~4,000-line monolith. It's now split by role into `data/`, `lib/`, `components/`, `modals/` and `views/` ([renderer/app-structure.md](renderer/app-structure.md)), and Fast Refresh works again. |
| 1.0.25 | Info-item ("Last mentioned") and timeline dates never aged, so profile suggestions ("Ideas for next time") never appeared for notes you saved. They now store an ISO `at` like journal entries, and `backfillPeopleDates` dates existing data on load. See [renderer/state-and-data.md](renderer/state-and-data.md#dates-store-the-day-derive-the-label). |
| 1.0.24 | Sheets rendered outside the theme scope. They had transparent panels, black text, didn't line up with the phone frame on tall windows, and used the wrong font. Fixed with `.app-shell`/`.sheet-layer` + `SheetPortal`. See [renderer/ui-system.md](renderer/ui-system.md#history-of-the-edit-goal-bug-fixed-in-1024). |
| 1.0.24 | Journal dates never aged. Entries read "Today" forever, weekly counts only grew, and check-in reminders never fired. Entries now store an ISO `at` date, labels and "this week" are derived when rendered, and older entries are backfilled by `backfillJournalDates`. See [renderer/state-and-data.md](renderer/state-and-data.md#dates-store-the-day-derive-the-label). |
| 1.0.24 | Dead IPC channel `trigger-log-interaction`. Removed `layersSystem.onTriggerLog` from `preload.cjs` and its subscription in `LayersApp`. Ctrl+Shift+L only brings the window to the front. |
| 1.0.24 | Renderer libraries shipped twice. `react`, `react-dom`, `lucide-react` and `recharts` moved to `devDependencies`. `app.asar` went from 55 MB (9,675 entries, 4,197 of them `lucide-react`) to 3 MB (337 entries). See [build-and-release.md](build-and-release.md#dependencies-vs-devdependencies). |
| 1.0.24 | Stale duplicate project under `Layers/` deleted. Every file in it matched the first commit. `npm test` runs one test file again; `vite.config.js` also keeps Vitest out of `.claude/` worktrees. |
| 1.0.24 | `dist-local/` and `release/` added to `.gitignore`. |
