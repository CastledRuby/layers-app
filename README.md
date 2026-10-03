# Layers

A private relationship-development and social-skills coaching app. It tracks the
people in your circle across four "layers" of closeness, logs interactions, sets goals,
and coaches you on conversations. All data stays on the device in `localStorage`.

It's a React 19 + Vite single-page app, packaged for Windows and Linux with Electron.

## Quick start

```bash
npm install
```

```bash
npm run dev
```

The second command starts the dev server at http://localhost:5173. To run the desktop
app from source:

```bash
npm run build:electron
```

```bash
npx electron .
```

Build a Windows installer into `release/` (bump `version` in `package.json` first):

```bash
npm run electron:build:win
```

## Documentation

The project is mapped in **[`docs/`](docs/README.md)**:

- [Architecture](docs/architecture.md): processes, folder layout, build pipeline
- [Build & release](docs/build-and-release.md): commands, release checklist, checking which build is installed
- [Electron shell](docs/electron.md): window, tray, shortcuts, auto-update, IPC bridge
- [Renderer structure](docs/renderer/app-structure.md): screens, navigation, modals inside `src/App.jsx`
- [State & data](docs/renderer/state-and-data.md): data model, persistence, progression maths
- [UI system](docs/renderer/ui-system.md): theme tokens, layout, the sheet/portal system
- [Known issues](docs/known-issues.md): evaluation findings and tech debt
- [Code map](docs/generated/code-map.md): auto-generated, line-linked index (`npm run docs:map`)
