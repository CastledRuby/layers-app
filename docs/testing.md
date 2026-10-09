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
  draw on (Claude's tip from the last analysed chat too), their order, the six-hook limit,
  and experiences only from Layer 3 on.
- `src/reminders.test.js` covers `lib/reminders.js`: the next occurrence, marking
  done, passed one-offs, the 15-minute notification window and follow-up reminders (the
  day after a detail's day, or three days later).

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
  details, journal editing and filters (and the goals a log moved), sample people, reminders and their
  notifications, profile editing, achievements, skill goals and "Try this next".
- `calendar.test.jsx` covers the calendar as the main screen:
  - Today first and in the centre tab, the month on M, Ctrl+2 for the map
  - planning by keys and from a profile, daily plans and edits, Save + another,
    Several days, Every weekday, one day of a repeating plan (changed or deleted on its
    own), editing one of several copies (a copy isn't an overlap,
    and making it repeat replaces the copies it covers, with Undo), and Plan it again
    (only offered before a plan starts, without Log it)
  - picking people by number or name
  - "How did it go?" (Log it, Just tick it, and Didn't happen: nothing logged, Undo, X,
    a repeating plan for one day only, done after all), ideas and birthdays
  - what's handed to Windows (a fake `layersSystem`), and notification buttons pressed
    with Layers closed or open
- `setup.test.jsx` covers knowing which page you're on (the tab marked, pages sliding
  in from their side), starting over (all of it, with a backup and a held press; or just
  some things), setting up (people tapped or typed with how close they are, a birthday
  typed with D, notification switches, Plan something first, Restore from a backup), and planning's Plan again and
  overlap warning.
- `quickadd.test.jsx` covers the quick-add box (its preview, what it sends, what a log
  still needs, Ctrl+Z and Ctrl+Y, Ctrl+Z after opening it again, Ctrl+Enter and Esc, with a fake `window.layersQuick`) and the main
  window saving what it sends (and undoing and redoing it). The end-to-end tests open the
  real box in the packaged app and check the plan reaches the main window's saved data,
  and that Ctrl+Alt+L sends a focused Layers back (minimised) and brings it forward again.
- `wide.test.jsx` covers a wide window: the month beside the day, and the people list
  beside a profile. `tests/setup.js`'s `matchMedia` says the window is narrow unless a
  test sets `window.__layersWide`.
- `jump.test.jsx` covers Ctrl+K: finding a person and their actions, "plan sam", going
  somewhere from over a sheet, Dark mode, and saving, opening or logging a typed sentence.
  The matching itself is unit-tested in `src/jump.test.js`, and the sentence reader in
  `src/sentence.test.js`.
- `feedback.test.jsx` covers the owner's live-test feedback: picking from more than nine
  people, a plan's title after Plan again, leaving the title box, a new goal while
  planning or logging, and the day popup with Coach tips.
- `prerelease.test.jsx` covers what went in before 1.0.31: arrow keys and Enter on the
  People list (and beside an open profile, and from the search box), logging with someone
  starting at "What did you do?", "Where are we now?" (moving someone, with Undo, and W in
  Ctrl+K), and Today's getting-started list (ticking off, Hide, and not for a circle with
  a few logs).
- `avatar.test.jsx` covers the avatar picker: arrows, skin tones and groups when adding
  someone, initials (the default for new people, picking a colour, showing them, and going
  back to an emoji), a photo (U opens the file box, and a saved photo shows), finding one
  by name (/), keeping a tone when editing them, and A while
  setting up. `src/avatars.test.js`
  checks that tones go in and come out of an emoji cleanly, that every older avatar is
  still offered, how initials are worked out, where a picture sits in the circle, and that
  saved data keeps only initials or a small photo held in the data. The end-to-end tests
  choose a real picture in the packaged app and check it's saved small and still there
  after a restart. `photos.test.jsx` covers photos from a folder (pictures only, a picture
  named after someone starting on them, finding someone by name, Backspace, skipping, and
  one Undo for the lot), with `lib/photo.js` stood in for, since jsdom can't decode
  pictures, and Windows' face detector stood in for (a face found in one picture starts
  its circle there); `src/avatars.test.js` checks `personForFile`, `isPictureFile` and
  where a picture starts in the circle; `src/faces.test.js` checks `electron/faces.cjs`
  (which paths are asked about, reading Windows' answers, one PowerShell run, nothing off
  Windows, the time limit) and `faceCrop`. The end-to-end tests run photos from a
  folder in the packaged app, with the real face detector asked about a picture.
- `closeness.test.jsx` covers adding someone through "How close are you two?" from the
  keyboard: the questions in order, stopping early, Backspace, picking a layer by hand,
  asking again (Q) and the avatar arrows; `setup.test.jsx` covers the quiz while setting
  up. `src/closeness.test.js` checks which questions are asked and where the answers
  place someone.
- `keys2.test.jsx` covers the second live test's keys: N into a note box and Esc out
  (the quick log, Add detail, editing a journal entry), Redo with Ctrl+Y and
  Ctrl+Shift+Z (and not once something else changed), and Ctrl+K's O, L, P and R.
- `chatTrend.test.jsx` covers skills over time: on a profile with analysed chats (not
  one without) and in Me, the latest scores and how they've moved. `src/chatTrend.test.js`
  covers the points (a day's averaged, a group chat once with everyone) and the change.
- `nicknames.test.jsx` covers Me's title (your name, with your focus under it) and nicknames: added when editing someone, shown on the
  profile, and a chat signed with one going to them with the nickname hidden.
  `src/nicknames.test.js` covers keeping them tidy and finding someone by one in chat
  names, Ctrl+K and typed plans.
- `activity.test.jsx` covers the activity calendars (a profile's days with logs, one
  opening the Journal on that person that day, the Journal's for everyone) and Summary
  handing the page to a stand-in main process; `src/activity.test.js` the grid (26 weeks,
  ending with this week, levels) and the summary page (everything escaped, archived details
  left out, a yearly date without its year, the file name). The end-to-end tests save a
  real PDF of an example person.
- `analysis.test.jsx` covers analysing your own chat (the main process and Claude stood
  in for): who it's with read from the names on the messages (a chat with Amelie goes
  to Amelie though Chloe was picked), a group chat (tagged apart, each detail to its
  person, one log with everyone), the Log it card (Claude's ratings, the chat's date,
  saved as a Messaged log, keeping the review and the chat, read again from the Journal's Review and found by its search), no screenshots on a laptop, the key added in Me (a bad one refused, never saved with your data) and
  removed, the pasted chat sent with names hidden only when Analyse is pressed, the answer
  shown with their name back (info saved, logged once), screenshots (six at most, each
  removable), an error keeping the chat, an answer dropped after moving to someone else,
  what it has cost in Me (each answer once, by model), "What are you logging?" opening Analyse with 3, the model buttons (the cheapest by default and again after a restart, another picked,
  the same chat with another model in a click, shown again without asking twice, logged
  once, an error keeping the first answer), the details (Save all with S, a detail's day shown, saved and on the profile, Save and remind me after
  and Remind me after planning the day after, L logging, Ctrl+Enter analysing), and nothing offered in the browser. `src/analysis.test.js` covers reading who a chat is with,
  hiding and restoring names (groups too), the request, what Claude is told to look for,
  the schema (every object closed, every field required, six either-or fields at most, the reading before the scores)
  and making any answer and its log safe (the chat's day only when it's real and within
  the year, and a detail's day only when it's real and within a year either way); `src/analysisMain.test.js` covers `electron/analysis.cjs` (keys,
  the key kept encrypted, only text and screenshots let through, what's asked of Claude,
  and every failure in words, and only the offered models asked for). No test calls
  Claude. The end-to-end tests check a key
  that isn't Anthropic's is refused by the packaged app's main process. They also check
  the window is always maximised: on opening, after its restore button, back from the
  tray and from a minimise, and that a login launch stays hidden until it's shown.
- `chats.test.jsx` covers chats from your exports (the folder stood in for): a
  WhatsApp chat's new conversation picked and its text written with exact times, the log
  on its day, the chat moving on (and its earlier conversations still there), how to add
  one, the folder opened, a new export noticed, the week review listing a chat to analyse and opening it in Coach, Instagram (you found as the name in
  every chat, chats with people not in Layers tucked away, an HTML download named) and
  "Which of these is you?". `src/chatImport.test.js` covers reading WhatsApp (iOS and
  Android, notices, attachments, several lines, day or month first) and Instagram
  (lettering, likes, photos), merging, who's who, splitting at pauses and the text
  sent; `src/chatFiles.test.js` covers `electron/chatfiles.cjs` (the folder, which files
  are exports, zips packed or stored, errors, nothing outside the folder, noticing a
  new file). The end-to-end tests open a real zip in the packaged app and see a second
  one arrive.
- `chatBatch.test.jsx` covers Analyse all new (the folder, key and Claude stood in for):
  each day with someone sent once with names hidden, a tiny one only marked as seen, the
  chats moving on, the answers reviewed (a detail left out, a reminder, logged on its day
  with its details, Undo bringing it back, the full review, skipped, all the rest logged
  at once), the answers kept after a restart without asking again, stopping at the
  monthly limit (and the limit raised in Me) and when Claude can't be reached, and the
  week review's way in. `src/chatBatch.test.js` covers what's sent (days merged, tiny ones,
  chats left out), the estimate, the queue (kept, cleaned, what's waiting, pruned) and the
  limit.
- `calendars.test.jsx` covers your Google Calendar (the main process stood in for):
  adding it in Me (a bad address refused), its event on Today marked as Google's and
  opened read-only, nothing of it handed to Windows as a reminder, planning's clash
  warning, and no Plan again for it. `src/ics.test.js` covers reading calendar files
  (zones, UTC, all day, weekly days with UNTIL and EXDATE, daily COUNT, every other week,
  a moved or cancelled occurrence, several days), pinned to New Zealand time;
  `src/feeds.test.js` covers `electron/feeds.cjs` (https and webcal only, the addresses
  kept encrypted and never shown to the page, fetching and its errors). The end-to-end
  tests check a bad address is refused by the packaged app's main process.
- `syncing.test.jsx` covers sync through OneDrive in the app (the folder and Windows'
  passphrase keeping stood in for, the encryption real): turning it on with the
  passphrase typed twice, a wrong passphrase refused and the right one bringing another
  device's people in (and sending this one's back), Sync now, and turning it off.
  `src/syncFile.test.js` covers the encrypted file (only the passphrase opens it; a
  changed byte makes it unreadable) and `syncOnce` (the first write, nothing written
  when nothing changed, two devices settling, a wrong passphrase writing nothing, OneDrive's
  copies merged and removed, an unreadable file put aside); `src/syncFolder.test.js`
  covers `electron/sync.cjs` on a temporary folder. The end-to-end tests run two copies of
  Layers sharing one folder, with Windows really keeping the passphrase.
- `sync.test.jsx` covers being ready for syncing: a deleted plan remembered and Undo
  forgetting it (with Redo still working), only changed records getting a new time, and
  a backup carrying them. `src/sync.test.js` covers `createStamper` and `mergeData`
  (the copy changed last, ties, a person's goals merged one by one, deletions before and
  after changes, skills and achievements).
- `keys3.test.jsx` covers the last sheets that needed the mouse: the full goal editor
  (a goal by number, its more specific versions with V, S, C, E, D and ← →), Add info,
  your profile, Coach's Prepare (← →, L, A, 1 and 2), and focus moving into a sheet and
  back, with a deleting dialog starting on Cancel.
- `qol.test.jsx` covers the quality-of-life batches: Undo from a toast and with
  Ctrl+Z, a birthday reminder's Plan something, daily backups (a fake bridge), Match
  Windows, rating a plan from its notification, and the weekly review.
  `src/freshBuild.test.js` checks the stale-build guard (a page built from `src/` as it is
  passes; one built before a change, without a fingerprint, or missing, doesn't; line
  endings don't count), and `src/scenarios.test.js` that every Analyse suggestion has its
  natural, playful and deeper versions. `src/backups.test.js` checks `electron/backups.cjs` on a temporary folder:
  one file a day, never overwritten, the newest 14 kept.
- `polish.test.jsx` covers the quick log redesign:
  - the quick log asks for little
  - each extra detail opens its own sheet
  - the whole log works from the keyboard
  - Enter in a detail sheet never saves the log
  - sheets are separate layers (the date-button overlap) and slide away when dismissed
  - text on the accent colour is readable in both themes

`tests/app/harness.jsx` has the helpers:

| Helper | Does |
|---|---|
| `seedState(partial)` | saves a state as if the app had been used before (onboarded, nobody in the circle, unless you override it) |
| `person(name, overrides)` | a person as Add Person would create them |
| `renderApp()` | mounts the app; returns `{ user, ... }` for `user.click` / `user.keyboard` |
| `relaunch(app)` | unmounts and mounts again from what was saved |
| `savedState()`, `savedPerson(name)` | what's in `localStorage` now |
| `dialog(title)`, `confirmDialog(title)` | a sheet or confirm dialog by its title |
| `logDetails()` | the quick log's sheet, whatever its title ("Talked with Morgan") |
| `openExtra(user, 'Rate each part')`, `done(user, sheetTitle)` | open a More details sheet from its chip, and close a sheet with Done |
| `nav('Journal')` | a bottom-nav tab |
| `toasts()` | the toast messages on screen |
| `trackErrors()` | collects uncaught errors and React error logs, to assert there were none |

A new feature should get an app test that uses it the way a person would. A bug fix
should get one that fails without the fix.

The tests run as if "reduce motion" were on (`tests/setup.js`), so a dismissed sheet
closes at once instead of after its slide.

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

After the commit, `.githooks/post-commit` builds the app and installs it on this
computer
([build-and-release.md](build-and-release.md#every-commit-is-installed-on-this-computer)).
A failed install doesn't undo the commit.

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

On 2026-10-04 the owner turned Smart App Control off, so new builds run here again.
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
