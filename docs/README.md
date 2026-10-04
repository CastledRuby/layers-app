# Layers — project docs

Layers is a private relationship-development and social-skills coaching app. It is a
React single-page app packaged as a Windows/Linux desktop app with Electron, and it keeps
all data in `localStorage` on the device.

These docs map the project so you can find your way around a codebase whose renderer
is split across `src/` by role (data, logic, components, modals, views).

## Start here

| If you want to… | Read |
|---|---|
| Know what Layers is for, what "done" means, and the rules for changing it | [vision.md](vision.md) |
| See where each goal stands and what's next (fixes, then proposals) | [roadmap.md](roadmap.md) |
| Get the big picture: processes, folders, how a build becomes an `.exe` | [architecture.md](architecture.md) |
| See the brand (Rings): logo, app and tray icons, how they are drawn, and the drafts | [../branding/README.md](../branding/README.md) |
| Run, build, version and ship a release, and how every commit gets installed on this computer | [build-and-release.md](build-and-release.md) |
| Run the tests, or add one: unit, app and end-to-end tests, and the pre-commit hook | [testing.md](testing.md) |
| Change the desktop shell: window, tray, shortcuts, auto-update, IPC | [electron.md](electron.md) |
| Find which file a screen, sheet or helper lives in, or see how screens connect | [renderer/app-structure.md](renderer/app-structure.md) |
| Understand the data model, persistence and the layer/progress maths | [renderer/state-and-data.md](renderer/state-and-data.md) |
| Change colours, themes, layout, sheets/modals, toasts or shortcuts | [renderer/ui-system.md](renderer/ui-system.md) |
| See what's broken, risky or worth cleaning up | [known-issues.md](known-issues.md) |
| Jump to an exact line: every component, function, constant, IPC channel | [generated/code-map.md](generated/code-map.md) *(auto-generated)* |

## How these docs stay accurate

The docs come in two kinds:

- **Hand-written docs** (everything except `generated/`) explain *what* things are and
  *why*. They name files and functions, not line numbers, so they survive edits.
- **The generated code map** (`generated/code-map.md`) records *where* things are, with
  line links. `scripts/gen-code-map.mjs` rebuilds it from the source:

```bash
npm run docs:map
```

```bash
npm run docs:map -- --check
```

The second command makes no changes and exits non-zero if the map is out of date. It
also lists IPC channels that are wired on only one side of the Electron bridge. The
pre-commit hook regenerates the map on every commit, and `npm run verify` runs the check
(see [testing.md](testing.md#the-pre-commit-hook)).

When you change behaviour, update the matching hand-written page in the same commit.
The table above tells you which page owns which topic. [`CLAUDE.md`](../CLAUDE.md) at the
repo root gives Claude Code sessions the same rules in short: read the vision first, run
`npm run verify` after every change, and keep the owning doc up to date.

## Conventions used in these docs

- File links are relative, so they work on GitHub and in VS Code's Markdown preview.
- Mermaid diagrams (` ```mermaid `) render on GitHub and in VS Code with a Mermaid extension.
