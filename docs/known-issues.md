# Known issues & evaluation notes

These findings come from an evaluation of the source on 2026-10-03, ordered by impact.
When you fix an item, delete it here, or move it to *Resolved* with the version.

## Correctness

The 2026-10-03 audit against [vision.md](vision.md) found a set of bugs, including a Coach
crash, the exe's "Electron" identity and icon, and Adjust moving people to another layer.
They're listed, with how each was confirmed, in [roadmap.md](roadmap.md#batch-1-fixes).
Move each one to *Resolved* when it ships.

## Build & release

### 1. The desktop app can silently run old code *(mitigated in 1.0.24)*

Electron loads only the committed build artifact `electron/app/index.html`. If you
change `src/` and package without `npm run build:electron`, or install a build without
bumping `version`, the app runs stale code that looks current. That happened with the
"Edit goal" bug: the installed 1.0.23 (Sep 19) predated the source's 1.0.23 (Sep 25).
Follow the checklist in [build-and-release.md](build-and-release.md). Consider a
`prepackage` guard that fails when `electron/app/index.html` is older than the files in `src/`.

## Maintainability

### 2. Smaller items

- **Unused files.** The `electron/*-light.png` / `*-dark.png` icon variants aren't
  referenced anywhere. The `src/assets/*` files are Vite template leftovers.
- **Misleading updater setting.** `autoDownload = false` is set, but the
  `update-available` handler calls `downloadUpdate()` immediately anyway.
- **Lint warnings.** oxlint reports warnings, not errors, in `src/`: unused catch
  params and props, one `exhaustive-deps` in `GoalsView`, one `no-unused-expressions`.

## Resolved

| Version | Issue |
|---|---|
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
