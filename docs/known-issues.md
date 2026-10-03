# Known issues & evaluation notes

These findings come from an evaluation of the source on 2026-10-03, ordered by impact.
When you fix an item, delete it here, or move it to *Resolved* with the version.

## Correctness

### 1. Journal dates never age, which breaks check-ins and weekly stats

Journal entries store a relative label (`date: 'Today'`) and a `isThisWeek` flag, both
computed once when the entry is logged and never recomputed. As a result:

- the Journal keeps showing **"Today"** for an entry logged weeks ago;
- Home's weekly counts (`journal.forEach(j => { if (j.isThisWeek) … })` in `HomeView`)
  only ever grow;
- `getCheckInSuggestions()` parses the stored label with `parseDaysAgo`, so a person last
  logged as "Today" is *always* 0 days ago. The **"Haven't caught up in a while"** list
  and the daily desktop notification never fire for anyone you've actually logged.

Seed entries mix in absolute labels like `'Aug 31'`. `parseDaysAgo` can't read those, so
it returns 999 and treats the entry as "long ago", which makes the sample data look like
it works. **Suggested fix:** store an ISO `at` date on
each journal entry (as chart history already does). Derive the label and "this week"
when rendering. Backfill old entries from their label once, on load.

### 2. Dead IPC channel: `trigger-log-interaction`

`preload.cjs` exposes `layersSystem.onTriggerLog`, and `LayersApp` subscribes to it to
open the log sheet. `main.cjs` stopped sending that channel when Ctrl+Shift+L was
changed to only focus the window. Either delete the bridge and the subscription, or
restore the send if "Ctrl+Shift+L → start a log" is still wanted. `npm run docs:map`
flags this under *Channel mismatches*.

## Build & release

### 3. The desktop app can silently run old code *(mitigated in 1.0.24)*

Electron loads only the committed build artifact `electron/app/index.html`. If you
change `src/` and package without `npm run build:electron`, or install a build without
bumping `version`, the app runs stale code that looks current. That happened with the
"Edit goal" bug: the installed 1.0.23 (Sep 19) predated the source's 1.0.23 (Sep 25).
Follow the checklist in [build-and-release.md](build-and-release.md). Consider a
`prepackage` guard that fails when `electron/app/index.html` is older than `src/App.jsx`.

### 4. Renderer libraries are shipped twice in the installer

`react`, `react-dom`, `lucide-react` and `recharts` are in `dependencies`, so
electron-builder copies them into `app.asar`. The current asar holds about 4,200
`lucide-react` files and all of `recharts`/d3, roughly 55 MB, even though the single-file
build has already inlined everything the app uses. Move them to `devDependencies`. Only
`electron-updater` and `electron-window-state` are needed at runtime.

### 5. Stale duplicate project committed under `Layers/`

`Layers/layers-source-project (2)/` is a full copy of the project from 2026-09-11 (its
`App.jsx` is about 178 KB versus about 262 KB now), and it's tracked in git. Vitest picks
up its `logic.test.js`, so `npm test` reports two test files. Searches return
duplicate hits too. It should probably be deleted. Check that nothing in it is needed first.

### 6. Build output folders aren't ignored

`dist-local/` and `release/` are untracked but not in `.gitignore`. `release/` currently
holds 46 installers, about 5.5 GB, so an accidental `git add .` would be painful. Add
both to `.gitignore`.

## Maintainability

### 7. `src/App.jsx` is a ~4,000-line monolith

Every component, constant and handler is in one file. Fast Refresh can't hot-swap it,
because it also exports non-components (the `only-export-components` lint warnings),
so every edit reloads the page. A low-risk split is to follow the existing section banners:

```text
src/theme.js          THEME_*, COLORS, CSS
src/data/*.js         PRESETS, NOTE_TEMPLATES, SCENARIOS, seed data
src/lib/dates.js      date helpers + history helpers
src/lib/progress.js   computeOverall, advanceLayer, layerForOverall, log/adjust maths
src/components/*.jsx  atoms, Sheet/SheetPortal, GoalRow, InfoItemRow, pickers
src/views/*.jsx       one file per screen
src/modals/*.jsx      one file per modal
src/App.jsx           LayersApp only
```

The pure maths in `handleLogSubmit` / `handleLogFromAnalysis` / `handleAdjust` is
currently untestable because it's inlined in the handlers. Extracting it into
`src/lib/progress.js` would allow unit tests.

### 8. Smaller items

- **Unchecked imports.** A backup's `version` field isn't checked, and individual
  entities aren't validated, so a malformed file can crash a view.
- **Startup flash in dark mode.** `BrowserWindow` uses a hard-coded light
  `backgroundColor` (`#F5F6F1`).
- **Fonts fetched from Google.** The fonts come from `fonts.googleapis.com` on every
  launch. That's a network call from a "private, on-device" app, and offline launches
  fall back to system fonts. Consider bundling the two font files.
- **Unused files.** The `electron/*-light.png` / `*-dark.png` icon variants aren't
  referenced anywhere. The `src/assets/*` files are Vite template leftovers.
- **Misleading updater setting.** `autoDownload = false` is set, but the
  `update-available` handler calls `downloadUpdate()` immediately anyway.
- **Lint warnings.** oxlint reports warnings, not errors, in `App.jsx`: unused catch
  params and props, one `exhaustive-deps` in `GoalsView`, one `no-unused-expressions`.

## Resolved

| Version | Issue |
|---|---|
| 1.0.24 | Sheets rendered outside the theme scope. They had transparent panels, black text, didn't line up with the phone frame on tall windows, and used the wrong font. Fixed with `.app-shell`/`.sheet-layer` + `SheetPortal`. See [renderer/ui-system.md](renderer/ui-system.md#history-of-the-edit-goal-bug-fixed-in-1024). |
