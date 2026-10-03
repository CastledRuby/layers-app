# Build & release

## Everyday commands

| Goal | Command | Output |
|---|---|---|
| Develop in a browser with hot reload | `npm run dev` | http://localhost:5173 (no Electron bridges, so updater/auto-launch UI is hidden) |
| Unit tests | `npm test` | Vitest over `src/logic.test.js`. `vite.config.js` excludes `.claude/**`, so Claude Code worktrees aren't tested twice. |
| Lint | `npm run lint` | oxlint (`.oxlintrc.json`: react + oxc plugins) |
| Refresh the code map | `npm run docs:map` | `docs/generated/code-map.md` |
| Rebuild what Electron loads | `npm run build:electron` | `dist-local/index.html` → copied to `electron/app/index.html` |
| Run the desktop app from source | `npm run build:electron` then `npx electron .` | Uses `electron/main.cjs` (package.json `"main"`). It shares the installed app's name (`layers-web`), so it uses the same data in `%APPDATA%\layers-web`, and it exits silently while the installed Layers is running (single-instance lock). Quit Layers from the tray first, or add `--user-data-dir=<temp folder>` for a separate profile. |
| Windows installer + portable exe | `npm run electron:build:win` | `release/Layers Setup x.y.z.exe`, `release/Layers x.y.z.exe`, `release/win-unpacked/` |
| **Release a new version** | `npm run release` | Bumps the version, tests, builds, pushes to `main`, publishes the GitHub release, then installs it on this computer. See [Releasing](#releasing). |
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
3. **Test and build:** `npm test`, `build:electron`, `docs:map`, then
   `electron-builder --win --x64 --publish never`. Each version builds into its own folder,
   `release/x.y.z/`, because a previous build's `win-unpacked` can stay locked (antivirus,
   or an app holding its `app.asar` open), and electron-builder fails if it can't replace it.
4. **Commit** `Release vX.Y.Z` and push it to `main`.
5. **Publish** a non-draft GitHub release `vX.Y.Z` at that commit, using the GitHub CLI.
   Assets are uploaded under the hyphenated names that `latest.yml` points at
   (`Layers-Setup-X.Y.Z.exe`, its `.blockmap`, the portable `Layers-X.Y.Z.exe`,
   `latest.yml`). Release notes default to the commit subjects since the previous tag;
   pass `--notes file.md` to write your own. Afterwards the script checks that the public
   update feed (`releases/latest/download/latest.yml`) offers the new version.
6. **Install here.** It runs `Layers.exe --quit` so the running app shuts down cleanly and
   saves its data (builds before 1.0.25 ignore this, and the installer closes them
   instead). Then it runs the installer silently (`/S --force-run`), reads the installed
   `app.asar` to confirm the version, and waits for Layers to relaunch. Your data in
   `%APPDATA%` is untouched. Pass `--no-install` to skip this step.

**Recovering from a failed step:**

- If a test or build fails, nothing has been committed or pushed yet. Fix the problem,
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

## "Is my installed app actually running the new code?"

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
| `release/` | `npm run release` output, one folder per version (`release/x.y.z/`: installer, portable exe, `latest.yml`, `win-unpacked/`, ~220 MB each). `npm run electron:build:win` writes straight into `release/`. | Yes. Keep the newest version's folder if you want `--install-only` to work. |
