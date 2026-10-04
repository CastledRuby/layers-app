# Branding drafts

Four logo directions for Layers. Each one has a logo mark, app icon and tray icon, all
drawn as SVG by [`draw-drafts.cjs`](draw-drafts.cjs) into [`drafts/`](drafts/). None of
them is in the app yet: the owner picks one first
([roadmap.md](../docs/roadmap.md#branding-pick-a-direction)). You can see them all on the
design canvas "Layers branding drafts" (claude.ai/artifact/QMY1ApR3RVaqsqsZp2DUtH), at
real sizes and in the app.

| | Direction | The idea |
|---|---|---|
| A | Rings | The four layers around a centre: the onion model seen from above, the same rings as the People view. Today's icon, redrawn so it reads at small sizes. |
| B | Arches | Nested arches, a doorway into closer layers; the filled one is Layer 4. |
| C | Onion | An onion (or a bud) cut through: layers around a core. |
| D | Overlap | Two people overlapping; the shared part is filled. |

Each direction uses the app's own colours: navy `#23283A`, paper `#F5F6F1`, and the
four layer hues, Layer 1 to 4 from the outside in. There's a deeper set for light grounds
and a brighter set for dark ones.

## Files

For each direction (`rings`, `arches`, `onion`, `overlap`):

| File | What it's for |
|---|---|
| `<d>-mark.svg`, `<d>-mark-dark.svg` | The logo mark on light and dark grounds, for the wordmark lockup ("Layers" in Fraunces 600) and the startup screen |
| `<d>-icon.svg` | The app icon on a navy tile, used at 48 px and up (exe, installer, Alt+Tab, Start) |
| `<d>-icon-paper.svg` | The same on a paper tile, as an alternative |
| `<d>-icon-small.svg` | A simplified icon for 32 px and below (taskbar, title bar), where the full one turns muddy |
| `<d>-tray16-{white,ink}.svg`, `<d>-tray32-{white,ink}.svg` | Single-colour tray icons: white for a dark taskbar, ink for a light one. They're drawn separately at 16 and 32 px, for 100% and 200% display scaling, so each stays crisp. |

There are also illustrations for direction A:
- `empty-people.svg`: the People view's empty state
- `onboarding-hero.svg`: the welcome screen
- `installer-sidebar.svg`: the installer's 164 × 314 side panel

## When a direction is chosen

1. Render the icon to `electron/icon.png` (256 px). electron-builder makes the `.ico`
   from it, for the exe and installer.
2. Render the tray icons to `electron/tray-icon-light.png` and `tray-icon-dark.png` at
   32 px. `main.cjs` resizes them to 16, so use the 16 px drawing for a 16 px file if
   it's sharper.
3. Replace `public/icon.svg`, the web favicon.
4. Optionally add the illustrations to the empty People view, onboarding and the
   installer (`nsis.installerSidebar`, a 164 × 314 BMP).
