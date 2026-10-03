# Known issues & evaluation notes

These findings come from an evaluation of the source on 2026-10-03, ordered by impact.
When you fix an item, delete it here, or move it to *Resolved* with the version.

## Correctness

No open correctness issues are known. Item and timeline dates were the last stored
labels; see *Resolved*.

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

- **Unchecked imports.** A backup's `version` field isn't checked, and individual
  entities aren't validated, so a malformed file can crash a view.
- **The "daily" check-in notification only runs once per launch.** Its effect in
  `LayersApp` depends only on `[onboarded]`, and closing the window hides it to the tray,
  so the page is never reloaded. If the app stays running for days, the check doesn't run
  again. For the same reason, a label like "Today" doesn't change at midnight. It updates
  the next time that view re-renders.
- **Startup flash in dark mode.** `BrowserWindow` uses a hard-coded light
  `backgroundColor` (`#F5F6F1`).
- **Unused files.** The `electron/*-light.png` / `*-dark.png` icon variants aren't
  referenced anywhere. The `src/assets/*` files are Vite template leftovers.
- **Misleading updater setting.** `autoDownload = false` is set, but the
  `update-available` handler calls `downloadUpdate()` immediately anyway.
- **Lint warnings.** oxlint reports warnings, not errors, in `src/`: unused catch
  params and props, one `exhaustive-deps` in `GoalsView`, one `no-unused-expressions`.

## Resolved

| Version | Issue |
|---|---|
| 1.0.26 | Fonts were fetched from `fonts.googleapis.com` on every launch, so offline launches fell back to system fonts and the "private" app made a network call. Fraunces and Manrope are now bundled ([renderer/ui-system.md](renderer/ui-system.md#fonts)). |
| 1.0.26 | `src/App.jsx` was a ~4,000-line monolith. It's now split by role into `data/`, `lib/`, `components/`, `modals/` and `views/` ([renderer/app-structure.md](renderer/app-structure.md)), and Fast Refresh works again. |
| 1.0.25 | Info-item ("Last mentioned") and timeline dates never aged, so profile suggestions ("Ideas for next time") never appeared for notes you saved. They now store an ISO `at` like journal entries, and `backfillPeopleDates` dates existing data on load. See [renderer/state-and-data.md](renderer/state-and-data.md#dates-store-the-day-derive-the-label). |
| 1.0.24 | Sheets rendered outside the theme scope. They had transparent panels, black text, didn't line up with the phone frame on tall windows, and used the wrong font. Fixed with `.app-shell`/`.sheet-layer` + `SheetPortal`. See [renderer/ui-system.md](renderer/ui-system.md#history-of-the-edit-goal-bug-fixed-in-1024). |
| 1.0.24 | Journal dates never aged. Entries read "Today" forever, weekly counts only grew, and check-in reminders never fired. Entries now store an ISO `at` date, labels and "this week" are derived when rendered, and older entries are backfilled by `backfillJournalDates`. See [renderer/state-and-data.md](renderer/state-and-data.md#dates-store-the-day-derive-the-label). |
| 1.0.24 | Dead IPC channel `trigger-log-interaction`. Removed `layersSystem.onTriggerLog` from `preload.cjs` and its subscription in `LayersApp`. Ctrl+Shift+L only brings the window to the front. |
| 1.0.24 | Renderer libraries shipped twice. `react`, `react-dom`, `lucide-react` and `recharts` moved to `devDependencies`. `app.asar` went from 55 MB (9,675 entries, 4,197 of them `lucide-react`) to 3 MB (337 entries). See [build-and-release.md](build-and-release.md#dependencies-vs-devdependencies). |
| 1.0.24 | Stale duplicate project under `Layers/` deleted. Every file in it matched the first commit. `npm test` runs one test file again; `vite.config.js` also keeps Vitest out of `.claude/` worktrees. |
| 1.0.24 | `dist-local/` and `release/` added to `.gitignore`. |
