# Layers

A private relationship-development and social-skills coaching app. It tracks the
people in your circle across four "layers" of closeness, logs interactions, sets goals,
and coaches you on conversations. Your data is kept on the device in `localStorage`, with
a daily backup in Documents. Turning on sync adds one encrypted file in OneDrive. Claude
is used only with your own API key: for what you ask (Analyse, What to say, Practise), and
once a day for an opener to the person to message, within your monthly limit.

It's a React 19 + Vite single-page app, packaged for Windows and Linux with Electron. An
iPhone app (Capacitor) is built for the simulator on GitHub so far.

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

To ship a new version, run this. It bumps the version, tests, builds, publishes the GitHub
release and installs it on this computer (see
[Releasing](docs/build-and-release.md#releasing)):

```bash
npm run release
```

## Documentation

The project is mapped in **[`docs/`](docs/README.md)**:

- [Vision](docs/vision.md): what Layers is for, and the rules for changing it
- [Roadmap](docs/roadmap.md): where each goal stands, decisions and what's next
- [Architecture](docs/architecture.md): processes, folder layout, build pipeline
- [Build & release](docs/build-and-release.md): commands, release checklist, the iPhone build, checking which build is installed
- [Testing](docs/testing.md): unit, app and end-to-end tests, and the pre-commit hook
- [Electron shell](docs/electron.md): window, tray, shortcuts, auto-update, backups, sync file, IPC bridge
- [Renderer structure](docs/renderer/app-structure.md): which file holds what in `src/`, screens, navigation, modals
- [State & data](docs/renderer/state-and-data.md): data model, persistence, progression maths, syncing, backup format
- [UI system](docs/renderer/ui-system.md): theme tokens, layout, the sheet/portal system
- [Known issues](docs/known-issues.md): evaluation findings and tech debt
- [Branding](branding/README.md): the Rings logo, app and tray icons, and how they reach the app
- [Code map](docs/generated/code-map.md): auto-generated, line-linked index (`npm run docs:map`)
