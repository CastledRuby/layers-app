# Layers: notes for Claude

Layers is a private relationship-coaching desktop app: React 19 + Vite renderer,
Electron shell, Windows installer. Start with [docs/README.md](docs/README.md).

## Before changing anything

- Read [docs/vision.md](docs/vision.md#working-principles), the owner's principles:
  - Make targeted changes, never rewrites.
  - Propose medium or large UX changes before building them; quick, contained fixes
    can just be done.
  - Never silently redesign a working feature.
- Check [docs/roadmap.md](docs/roadmap.md) for what's planned and what's been decided.
- Inspect the current code rather than trusting an earlier plan or doc.

## After every change

```bash
npm run verify
```

This runs lint, the code-map check, the unit and app tests, and the build. The
pre-commit hook runs it too. Add or update a test in `tests/app/` for any behaviour
you change; see [docs/testing.md](docs/testing.md). For changes to `electron/` or
packaging, also run `npm run test:e2e`. It tests the packaged app with a temporary
data folder, never the real one.

Don't call something done because it builds. Check the behaviour itself (the app
tests, the browser preview, or the packaged app), and say what was actually checked.

## Releasing

`npm run release` bumps the version, verifies, builds and runs the end-to-end tests
on that build. Then it pushes to `main`, publishes the GitHub release
(CastledRuby/layers-app) and installs it silently on this computer. The owner wants
every release installed on their laptop. See
[docs/build-and-release.md](docs/build-and-release.md).

## Conventions

- Dates are stored as ISO days (`at: 'YYYY-MM-DD'`) and turned into labels when
  shown. The timeline always shows calendar dates.
- Sheets portal into `.sheet-layer` (never `document.body`) and register
  themselves for Esc (`useOpenSheet` in `components/sheetLayer.js`).
- Saved data is checked at startup like a backup import (`lib/storage.js`).
  Migrate old data rather than dropping it.
- Update the hand-written doc that owns a topic in the same commit. The table in
  `docs/README.md` says which page owns what.
