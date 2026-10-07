# Build & release

## Everyday commands

| Goal | Command | Output |
|---|---|---|
| Develop in a browser with hot reload | `npm run dev` | http://localhost:5173 (no Electron bridges, so updater/auto-launch UI is hidden) |
| Check a change (run after every change) | `npm run verify` | Lint, code-map check, unit and app tests, renderer build. The pre-commit hook runs it. See [testing.md](testing.md). |
| Unit and app tests only | `npm test` (`npm run test:watch` to rerun on save) | Vitest over `src/*.test.js` and `tests/app/`. `vite.config.js` excludes `.claude/**`, so Claude Code worktrees aren't tested twice, and `tests/e2e/`, which is Playwright's. |
| End-to-end tests | `npm run test:e2e` | Packages `dist-e2e/win-unpacked/` and drives the real `Layers.exe` with a temporary data folder |
| Lint | `npm run lint` | oxlint (`.oxlintrc.json`: react + oxc plugins) |
| Refresh the code map | `npm run docs:map` | `docs/generated/code-map.md` |
| Rebuild what Electron loads | `npm run build:electron` | `dist-local/index.html` → copied to `electron/app/index.html` |
| Run the desktop app from source | `npm run build:electron` then `npx electron .` | Uses `electron/main.cjs` (package.json `"main"`). It shares the installed app's name (`layers-web`), so it uses the same data in `%APPDATA%\layers-web`, and it exits silently while the installed Layers is running (single-instance lock). Quit Layers from the tray first, or set `LAYERS_USER_DATA_DIR` to another folder for a separate profile and lock ([electron.md](electron.md#command-line-flags-and-environment-variables)). |
| Windows installer + portable exe | `npm run electron:build:win` | `release/Layers Setup x.y.z.exe`, `release/Layers x.y.z.exe`, `release/win-unpacked/` |
| **Release a new version** | `npm run release` | Bumps the version, verifies, builds, runs the end-to-end tests on that build, pushes to `main`, publishes the GitHub release, then installs it on this computer. See [Releasing](#releasing). |
| Install the current code on this computer | `npm run install:local` | The post-commit hook runs it after every commit. Builds the installer and runs it silently; nothing is published. See [Every commit is installed on this computer](#every-commit-is-installed-on-this-computer). |
| Redraw the icons after changing the brand | `npm run brand:render` | `electron/icon.ico`, `icon.png`, the tray icons, the installer sidebar and `public/icon.svg`; see [electron.md](electron.md#icons) |
| Reinstall the current version here | `npm run release -- --install-only` | Silently installs `release/x.y.z/Layers Setup x.y.z.exe` and relaunches Layers |
| Linux AppImage | `npm run build:electron && npm run electron:build:linux` | `electron:build:linux` does **not** rebuild the renderer on its own |

## Why there are two Vite configs

- `vite.config.js` is the normal multi-file build into `dist/`, for hosting as a website or PWA.
- `vite.config.local.js` uses `vite-plugin-singlefile` to inline all JS, CSS and assets
  into one `dist-local/index.html`. Electron loads that file with `loadFile`, so it needs
  no server and no relative asset paths. Run it from disk and it still works.

`scripts/sync-app.mjs` copies that file to `electron/app/index.html`, the only renderer
file electron-builder packages. **`electron/app/index.html` is a committed build
artifact.** If it's older than the files in `src/`, the desktop app is running old code.

## Dependencies vs devDependencies

electron-builder copies every package in `dependencies`, plus its dependencies, into
`app.asar`. Only list packages that `electron/main.cjs` `require`s at runtime:
`electron-updater` and `electron-window-state`. Everything the renderer imports (`react`,
`react-dom`, `recharts`, `lucide-react`, …) goes in `devDependencies`, because Vite
inlines it into `electron/app/index.html`.

To check what a build packaged:

```powershell
npx @electron/asar list release/win-unpacked/resources/app.asar
```

From 1.0.24, the asar is about 3 MB with around 340 entries: `electron/…`, `package.json`,
and `node_modules/` for the two runtime packages and their dependencies. The 1.0.23 asar
was 55 MB, because `react`, all of `recharts`/d3 and about 4,200 `lucide-react` files
were in it.

## Releasing

```bash
npm run release
```

[`scripts/release.mjs`](../scripts/release.mjs) does the whole release in this order. Every
local step runs before anything leaves the computer, so a failed test or build leaves
GitHub untouched.

1. **Preflight.** The working tree must be clean, `HEAD` must contain `origin/main` (so
   the push is a fast-forward), and the GitHub CLI must be logged in.
2. **Bump** `package.json` / `package-lock.json`: patch by default, or pass `minor`,
   `major` or an exact version (`npm run release -- 1.1.0`). electron-updater only offers
   versions strictly higher than the installed one, so every release needs a new number.
3. **Verify and build:** `docs:map`, then `verify` (lint, code-map check, unit and app
   tests, renderer build), then `build:electron` and
   `electron-builder --win --x64 --publish never` (whose `beforePack`,
   `scripts/check-fresh-build.cjs`, refuses a page not built from `src/` as it is now:
   `build:electron` writes that fingerprint). Each version builds into its own folder,
   `release/x.y.z/`, because a previous build's `win-unpacked` can stay locked (antivirus,
   or an app holding its `app.asar` open), and electron-builder fails if it can't replace it.
   electron-builder writes the Layers name, icon, version and company (`author` in
   `package.json`) into `Layers.exe`; see [electron.md](electron.md#packaging-config).
4. **End-to-end tests** on the exact build about to be published:
   `scripts/e2e.mjs --exe release/x.y.z/win-unpacked/Layers.exe`. They run the packaged app
   with a temporary data folder, so your own data is never touched. See
   [testing.md](testing.md#in-the-release).
5. **Commit** `Release vX.Y.Z` and push it to `main`.
6. **Publish** a non-draft GitHub release `vX.Y.Z` at that commit, using the GitHub CLI.
   Assets are uploaded under the hyphenated names that `latest.yml` points at
   (`Layers-Setup-X.Y.Z.exe`, its `.blockmap`, the portable `Layers-X.Y.Z.exe`,
   `latest.yml`). Release notes default to the commit subjects since the previous tag;
   pass `--notes file.md` to write your own. Afterwards the script checks that the public
   update feed (`releases/latest/download/latest.yml`) offers the new version.
7. **Install here.** It runs `Layers.exe --quit` so the running app shuts down cleanly and
   saves its data (builds before 1.0.25 ignore this, and the installer closes them
   instead). Then it runs the installer silently (`/S --force-run`), reads the installed
   `app.asar` to confirm the version, and waits for Layers to relaunch. Your data in
   `%APPDATA%` is untouched. Pass `--no-install` to skip this step.

**Recovering from a failed step:**

- If a check, build or end-to-end test fails, nothing has been committed or pushed yet. Fix the problem,
  discard the version bump (`git checkout -- package.json package-lock.json`), and run the
  release again.
- If the upload fails after the push, run `npm run release -- --publish-only`. It
  uploads the files already in `release/x.y.z/` for the current version, then installs.
- If the install fails, run `npm run release -- --install-only`.

**Setup on a new computer:** install the GitHub CLI (`winget install GitHub.cli`) and run
`gh auth login` as an account that can publish to `CastledRuby/layers-app`. No
`GH_TOKEN` is needed. `npm run electron:publish:win` (electron-builder's own publisher)
still works if you set `GH_TOKEN`, but it creates a *draft* release that you then have to
publish by hand.

## Every commit is installed on this computer

The owner wants the Layers on their laptop to run the latest code, not just the latest
release. After every commit, `.githooks/post-commit` runs
[`scripts/install-local.mjs`](../scripts/install-local.mjs), and `.githooks/post-merge`
does too after `git merge` or `git pull`. To run it yourself: `npm run install:local`.

1. **Skip if nothing changed.** With `--if-changed` (the hooks), it compares the app's
   files at `HEAD` with the commit last installed. That commit is recorded in
   `.git/layers-installed.json`, which `npm run release` writes too. Docs, tests,
   scripts, branding drafts and the hooks aren't part of the app, so a commit that only
   changes those finishes in a second.
2. **Build the installer** the way a release does: `build:electron`, then
   `electron-builder --win nsis` into `dist-install/`. It's versioned like
   `1.0.28+local.abc1234`: the last release, then the commit (`.uncommitted` is added
   when uncommitted changes went in). `electron/app/index.html` is put back afterwards,
   because only releases commit it. Nothing is published.
3. **Quit, back up, install.**
   - It runs `Layers.exe --quit` and waits for Layers to close.
   - It copies your data's `Local Storage` folder to
     `%APPDATA%\layers-web\Install backups\<time> before <version>\`. The newest 10 are
     kept.
   - It runs the installer silently (`/S`), then reads the installed version back.
4. **Relaunch.** Layers starts with its window if the window was showing, otherwise in
   the tray, and it must still be running 3 seconds later.

It takes about a minute and a half. One install runs at a time
(`.git/layers-install.lock`). It's skipped:
- while `npm run release` commits, because the release installs its own build
- during a rebase
- when `LAYERS_NO_INSTALL` is set

A failed install never undoes the commit: the hook says what went wrong, and
`npm run install:local` tries again. It needs Windows to let new builds run, so if Smart
App Control is ever turned on again, it fails at the install
([testing.md](testing.md#when-windows-blocks-the-build)).

**Updates still work.** The update check ignores the `+local…` part, so
`1.0.28+local.abc1234` counts as 1.0.28, and the next release installs over it as usual.

**To restore your data from a backup:** quit Layers from the tray icon, replace
`%APPDATA%\layers-web\Local Storage` with the backup's `Local Storage` folder, then
start Layers.

## The iPhone app (built on GitHub, no Apple account yet)

Step 2 of [Layers on your phone](roadmap.md#proposal-layers-on-your-phone-2026-10-06):
the same page, wrapped as an iPhone app with **Capacitor** (8.5, devDependencies, so
nothing changes in the Windows app).

- [`capacitor.config.json`](../capacitor.config.json): the app id
  `com.castledruby.layers`, the name **Layers**, and `webDir: dist-local`, the same
  single-file build Electron uses. `contentInset: never` lets the page reach the screen's
  edges; the CSS keeps clear of the notch and home bar
  ([ui-system.md](renderer/ui-system.md#touch-screens)).
- [`ios/`](../ios/): the Xcode project `npx cap add ios --packagemanager SPM` made (Swift
  Package Manager, so no CocoaPods). Its copy of the page (`ios/App/App/public`) is
  git-ignored; `npx cap sync ios` after `npm run build:local` puts it there. The icon,
  `AppIcon-512@2x.png`, is the rings drawn square at 1024 px by `npm run brand:render`.
- [`.github/workflows/ios.yml`](../.github/workflows/ios.yml): after a push to `main`
  that touches the page or the project, GitHub's Macs build it for the **iPhone
  simulator** (`xcodebuild ... CODE_SIGNING_ALLOWED=NO`) and keep the `.app` as the run's
  artifact. The repository is public, so they're free. Without a Mac, that's how it's
  checked.
- On the phone the page runs without Electron's bridge, as in a browser: saved in the
  app's own storage, no Windows notifications or sync yet. Those come with the next steps.
- **Not yet**: putting it on a real iPhone (TestFlight) needs signing with the Apple
  Developer account (US$99 a year). With it, the workflow gets a signing step and uploads
  to TestFlight.

## "Is my installed app actually running the new code?"

Me shows the installed version. `v1.0.28+local.abc1234` means it was built from commit
`abc1234`, and `.git/layers-installed.json` records the same commit.

The installed app lives in `%LOCALAPPDATA%\Programs\Layers\`. Its renderer is inside
`resources\app.asar`. Because the asar is stored uncompressed, you can grep it:

```powershell
Select-String -Path "$env:LOCALAPPDATA\Programs\Layers\resources\app.asar" -Pattern 'sheet-layer' -SimpleMatch -Quiet
```

Swap `sheet-layer` for any string unique to the change you expect. This is how the
"Edit goal" rendering bug was traced. The installed build dated 2026-09-19 still portaled
sheets to `document.body`, even though the source had already moved on, and both builds
were labelled 1.0.23.

## Output folders (all git-ignored)

| Folder | What | Safe to delete? |
|---|---|---|
| `dist/` | Multi-file web build | Yes |
| `dist-local/` | Single-file build (input to `sync:app`) | Yes |
| `dist-install/` | The installer `npm run install:local` builds and runs | Yes |
| `dist-e2e/` | The unpacked app `npm run test:e2e` builds and tests | Yes. `npm run test:e2e -- --no-build` reuses it. |
| `test-results/` | Playwright's output from the last end-to-end run | Yes |
| `release/` | `npm run release` output, one folder per version (`release/x.y.z/`: installer, portable exe, `latest.yml`, `win-unpacked/`, ~220 MB each). `npm run electron:build:win` writes straight into `release/`. | Yes. Keep the newest version's folder if you want `--install-only` to work. |
