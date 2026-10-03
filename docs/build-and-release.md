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
| Publish a release to GitHub | `npm run electron:publish:win` | Same, plus upload to `CastledRuby/layers-app` Releases (needs `GH_TOKEN`) |
| Linux AppImage | `npm run build:electron && npm run electron:build:linux` | `electron:build:linux` does **not** rebuild the renderer on its own |

## Why there are two Vite configs

- `vite.config.js` is the normal multi-file build into `dist/`, for hosting as a website or PWA.
- `vite.config.local.js` uses `vite-plugin-singlefile` to inline all JS, CSS and assets
  into one `dist-local/index.html`. Electron loads that file with `loadFile`, so it needs
  no server and no relative asset paths. Run it from disk and it still works.

`scripts/sync-app.mjs` copies that file to `electron/app/index.html`, the only renderer
file electron-builder packages. **`electron/app/index.html` is a committed build
artifact.** If it's older than `src/App.jsx`, the desktop app is running old code.

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

## Release checklist

1. `npm test` and `npm run lint` are clean (warnings are acceptable).
2. **Bump `version` in `package.json`.** electron-updater compares versions, so it only
   offers an update when the new version is strictly higher than the installed one.
   Rebuilding with an unchanged number produces an installer the updater ignores, and
   the Me tab shows the same version for two different builds.
3. `npm run build:electron`. Check that `electron/app/index.html` has a fresh timestamp.
4. `npm run docs:map` so the generated map shows the new version.
5. `npm run electron:build:win` (local) or `npm run electron:publish:win` (GitHub release).
6. Install `release/Layers Setup x.y.z.exe`, or let the installed app auto-update, and
   check the version in the Me tab.
7. Commit `package.json`, `electron/app/index.html`, `docs/generated/code-map.md` and the source together.

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
| `release/` | Every installer ever built (~117 MB each), `win-unpacked/`, `latest.yml` | Yes. Keep the newest if you need to reinstall. |
