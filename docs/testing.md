# Testing

Layers has three layers of tests. Each one catches problems the one before it
can't. Two commands cover them:

| Command | What it runs | When | Time |
|---|---|---|---|
| `npm run verify` | lint, code-map check, unit tests, app tests, renderer build | after every change; the pre-commit hook runs it automatically | about 30 s |
| `npm run test:e2e` | builds the packaged app, then drives the real `Layers.exe` | before a release; `npm run release` runs it on the exact build it publishes | about 2 min |

`npm test` runs just the Vitest tests (unit tests plus app tests). `npm run test:watch`
reruns them as you edit.

## 1. Unit tests: `src/*.test.js`

These are pure logic with no DOM:

- dates
- progress
- backups
- check-in reminders
- reminders and their notifications
- Prepare's hooks
- text

They run in Node and take milliseconds. Add one whenever you change a function in
`src/lib/`.

- `src/logic.test.js` covers dates, text, progress basics and reminders.
- `src/backup.test.js` covers the backup validator, including recorded achievements.
- `src/progress.test.js` covers layer placement, `movePerson`, skills, and date
  sorting and backfill. It also checks that the sample people sit exactly where
  Adjust would place them.
- `src/prepare.test.js` covers Prepare's hooks (`buildPotentialHooks`): what they
  draw on, their order, the six-hook limit, and experiences only from Layer 3 on.
- `src/reminders.test.js` covers `lib/reminders.js`: the next occurrence, marking
  done, passed one-offs, the 15-minute notification window and follow-up reminders.

## 2. App tests: `tests/app/*.test.jsx`

These render the whole app, exactly what `main.jsx` mounts, in jsdom. They drive it
the way a person would, with Testing Library's `user-event`: clicking buttons, typing,
pressing keys. Then they check what's on screen and what was saved to
`localStorage`. They catch bugs that only show up when screens, sheets and state
interact.

- `smoke.test.jsx`
  - onboarding, both "start fresh" and "explore with samples"
  - every tab, with zero people and with the sample people
  - a relaunch from saved data
  - the saved theme
- `fixes.test.jsx` has one test per bug fixed in 1.0.27 (see
  [roadmap.md](roadmap.md#batch-1-fixes)). Each reproduces the bug through the UI,
  so it can't come back unnoticed.
- `proposals.test.jsx` covers the proposals built in 1.0.28 (P1, P2 and P4 to P7; see
  [roadmap.md](roadmap.md#proposals-built-in-1028)) through the UI: the log's More
  details, journal editing and filters, sample people, reminders and their
  notifications, profile editing, achievements, skill goals and "Try this next".

`tests/app/harness.jsx` has the helpers:

| Helper | Does |
|---|---|
| `seedState(partial)` | saves a state as if the app had been used before (onboarded, nobody in the circle, unless you override it) |
| `person(name, overrides)` | a person as Add Person would create them |
| `renderApp()` | mounts the app; returns `{ user, ... }` for `user.click` / `user.keyboard` |
| `relaunch(app)` | unmounts and mounts again from what was saved |
| `savedState()`, `savedPerson(name)` | what's in `localStorage` now |
| `dialog(title)`, `confirmDialog(title)` | a sheet or confirm dialog by its title |
| `nav('Journal')` | a bottom-nav tab |
| `toasts()` | the toast messages on screen |
| `trackErrors()` | collects uncaught errors and React error logs, to assert there were none |

A new feature should get an app test that uses it the way a person would. A bug fix
should get one that fails without the fix.

jsdom has no layout, so these tests can't see sizes, colours or whether something is
actually visible. Those need the browser preview or the end-to-end tests.

## 3. End-to-end tests: `tests/e2e/*.spec.js`

[Playwright](https://playwright.dev/docs/api/class-electron) launches the packaged
`Layers.exe` and checks what only the real desktop app can show:

- a fresh install onboards once, and data survives quitting and relaunching
- the app works with nobody in the circle
- dark mode is saved to `theme.json`, and the next window opens dark (no white flash)
- closing the window hides it to the tray, and a second launch brings it back without
  a second window (single instance)
- `Layers.exe --quit` quits a running Layers cleanly
- a login launch (`--hidden`) starts in the tray
- if the page's process crashes, the window reloads by itself
- the exe identifies itself as Layers (name, description, company), not Electron

`npm run test:e2e` builds the renderer and packages `dist-e2e/win-unpacked/` (git
ignores it), then runs the tests. Options:

- `npm run test:e2e -- --no-build` reuses the last build.
- `node scripts/e2e.mjs --exe path\to\Layers.exe` tests an existing build.

**Your real data is never touched.** Every launch gets a new temporary data folder
through the `LAYERS_USER_DATA_DIR` environment variable, which `electron/main.cjs`
honours before anything else. The single-instance lock lives in that folder, so the
tests also run fine while your own Layers is open. `LAYERS_NO_UPDATES=1` stops the
test app from checking GitHub for updates. The tests never turn on "Launch at login",
because that writes to the real Windows registry.

## The pre-commit hook

`.githooks/pre-commit` runs on every `git commit`:

1. It regenerates `docs/generated/code-map.md` and adds it to the commit.
2. It runs `npm run verify`.

If anything fails, nothing is committed. `npm install` points git at the hook through
the `prepare` script (`scripts/install-hooks.mjs`, which runs
`git config core.hooksPath .githooks`). To skip it once, use `git commit --no-verify`,
but the release script runs the same checks anyway.

## In the release

`npm run release` ([build-and-release.md](build-and-release.md#releasing)) runs:

1. `docs:map`
2. `verify`
3. the build and package
4. **the end-to-end tests against `release/<version>/win-unpacked/Layers.exe`**
5. only then the commit, push, GitHub release and local install

So a build that fails any test never reaches GitHub or your installed app.

## When Windows blocks the build

Windows 11's **Smart App Control** blocks unsigned apps it doesn't already trust, and
every build of Layers is a new, unsigned file to it. A blocked `Layers.exe` can't start
at all. `scripts/e2e.mjs` checks for this before running the tests and stops with
"Windows wouldn't start … Smart App Control is probably blocking this unsigned build"
(exit code 3). Through `npm run release`, that stops the release before anything is
published or installed. If the installer itself is blocked, the release script restarts
the copy that's already installed rather than leaving Layers closed.

To check whether Smart App Control is on: Windows Security > App & browser control >
Smart App Control. In the registry, `VerifiedAndReputablePolicyState` under
`HKLM\SYSTEM\CurrentControlSet\Control\CI\Policy` is 1 when it's enforcing. The
blocks are logged under *Microsoft-Windows-CodeIntegrity/Operational* (events 3077 and
3118).

There are two ways past it:

- **Sign the app** (roadmap P8). Smart App Control allows apps signed with a trusted
  certificate. This is the real fix, because it also covers installing and auto-updating.
- **Turn Smart App Control off** in Windows Security. It's the owner's call, and Windows
  doesn't let you turn it back on without reinstalling.

This first happened on 2026-10-04 at 12:51 AM. Every build after that was blocked, and
the builds before it, including the installed 1.0.27, still run.

## What isn't automated

- **Visual checks:** colours, spacing, dark mode contrast, the phone frame at different
  window sizes. Use the browser preview (`npm run dev`) or look at the installed app.
- **The tray icon and Windows notifications.** These belong to the shell, not the page.
  The tray icon's light/dark choice reads the registry (`taskbarIsDark` in `main.cjs`).
  The app tests replace `Notification` with a stand-in to check that a reminder notifies
  once at its time, but nothing checks that Windows shows it, or that clicking it brings
  the window forward.
- **Auto-update.** It's only exercised for real by installing an older version and
  letting it update.
- **Launch at login.** It would change your real login items.
