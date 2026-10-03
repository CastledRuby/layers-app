# UI system: theme, layout, sheets

## Colours and theming

- `THEME_LIGHT` and `THEME_DARK` ([`src/theme.js`](../../src/theme.js)) are matching palettes:
  `paper`, `paperRaised`, `ink`, `inkSoft`, `line`, `accent`, `accentSoft`, four layer
  colours (each with `Tint`/`Deep`), plus `plum`, `teal`, `good`, `warn`, `alert`.
- `COLORS` **doesn't hold colours.** It maps each key to a CSS variable reference, so
  `COLORS.paperRaised === 'var(--c-paper-raised)'`.
- The `CSS` string defines those variables on `.layers-root` (light) and
  `.layers-root.dark` (dark). `LayersApp` adds the `dark` class from `theme` state.

Theme switching therefore needs no re-render of colour values. It also means that
**anything rendered outside `.layers-root` has no colours at all.** Every `var(--c-…)`
is undefined there, so backgrounds turn transparent, borders disappear and text falls
back to black. That was the root cause of the "Edit goal" bug (below).

To add a colour, add the key to both `THEME_LIGHT` and `THEME_DARK`, then use
`COLORS.yourKey`. `cssVarBlock` emits the variable automatically.

### No flash at startup

Three layers keep a dark-mode launch dark from the first frame. Each one covers the
moment before the next takes over:

1. **The Electron window** opens with `backgroundColor` set to the saved theme's paper
   colour. `main.cjs` stores the theme in `theme.json` in the userData folder.
2. **The page**, before any app code runs: an inline script in `index.html` reads the
   theme from `localStorage` and paints `<html>` with the paper colour.
3. **React**: an effect in `LayersApp` keeps `<html>`'s background in sync and calls
   `layersSystem.setTheme(theme)` whenever the theme changes, so the window colour and
   `theme.json` are right for the next launch.

The two paper colours (`#F5F6F1`, `#1B1E27`) are therefore written in three places:
`THEME_*.paper` in `theme.js`, `BACKGROUNDS` in `main.cjs`, and the `index.html` script.
Change all three together. The first launch after upgrading from 1.0.25 or earlier can
still flash once, because `theme.json` doesn't exist until the app has reported its theme.

## Styling layers

1. **Tailwind utilities** in `className` handle layout and spacing (`flex`,
   `grid grid-cols-2`, `px-5`, `rounded-2xl`, `text-sm`…). The config is stock and
   scans `src/**/*.{js,jsx}`.
2. **Inline `style={{…}}` with `COLORS.*`** handles every colour, so colours follow the theme.
3. **The `CSS` template string** (injected by `<style>{CSS}</style>` inside
   `.layers-root`) holds structural classes Tailwind doesn't express well: `.phone-frame`,
   `.sheet-*`, `.nav-bar`, `.fab-btn`, `.toast*`, keyframe animations and
   reduced-motion overrides. It starts with the `@font-face` rules from
   [`src/fonts.js`](../../src/fonts.js).

### Fonts

Fraunces (display, `.font-display`) and Manrope (body) are **bundled**, so the app works
offline and makes no network request on launch. `src/fonts.js` imports the woff2 files from
`@fontsource-variable/fraunces` and `@fontsource-variable/manrope` (SIL OFL). It uses
Fraunces with its weight and optical-size axes and Manrope with its weight axis, Latin and
Latin Extended subsets only (~160 KB). Vite inlines them into the Electron build as data
URIs. The families keep their plain names, so `font-family: 'Fraunces'` / `'Manrope'`
work as before. To add a weight or subset, add a `face(...)` line there. Don't
reintroduce a Google Fonts `@import`.

## Layout skeleton

```text
.layers-root            theme variables; full-viewport flex, centres the phone
└── .app-shell          position: relative; width 100%, max 428px; 20px vertical margin on ≥480px
    ├── .phone-frame    the visible phone: 100vh on mobile, 860px (max 92vh) + 40px radius on ≥480px
    │   ├── .scroll-area      current screen (overflow-y: auto)
    │   ├── .fab-btn          (+) log button        z-index 20
    │   ├── .nav-bar          BottomNav             z-index 10
    │   └── .toast-stack      toasts                z-index 70 (above sheets)
    └── .sheet-layer    position: absolute; inset: 0 → exactly covers .phone-frame
                        z-index 50, overflow: hidden, same border radius, pointer-events: none
        └── .sheet …    every open Sheet / ConfirmDialog (portaled here)
```

## Sheets and dialogs

The `Sheet` component is a bottom sheet with overlay, title bar, close button, scrollable
body and an optional sticky `footer`. The optional `tall` prop gives it a fixed 80% height.

```jsx
<Sheet title="Edit goal" onClose={onClose} footer={<button>Save changes</button>}>
  …form…
</Sheet>
```

### How it renders

`Sheet` and `ConfirmDialog` wrap their markup in `SheetPortal`, which calls
`createPortal(children, layer)`. `layer` comes from `SheetLayerContext`, which
`LayersApp` sets with a ref callback on `.sheet-layer`
(`<div className="sheet-layer" ref={setSheetLayer} />`).

The portal is necessary because a sheet can be declared deep inside a scrolling or
clipped container. Examples are a `DateDropdown` inside `GoalModal`'s scrolling body, or
`PrepareTipsModal` inside the profile. Rendered in place, it would be clipped by
`.phone-frame { overflow: hidden }` or by the parent sheet's `overflow-y: auto`.
`.sheet-layer` is a sibling of `.phone-frame`, so it escapes both. It also has three
other properties:

- it's still **inside `.layers-root`**, so theme variables resolve;
- it's sized by `.app-shell`, so it **always overlays the phone frame exactly**, at any
  window size, on mobile and desktop;
- it has the same border radius and `overflow: hidden`, so the overlay and panels clip
  to the phone's rounded corners.

Sheets stack in the order they open. Nested pickers and a `ConfirmDialog` opened later
always appear on top. Toasts (`z-index: 70`) stay visible above sheets.

`ConfirmDialog` takes `hideCancel` for an OK-only notice, such as the startup notice
about saved data that couldn't be read
([state-and-data.md](state-and-data.md#loading-saved-data)). Esc still dismisses it.

### Esc and the open-sheet stack

Every open `Sheet` and `ConfirmDialog` registers itself in a stack in
[`components/sheetLayer.js`](../../src/components/sheetLayer.js) while it's mounted.
`useOpenSheet(onClose)` calls `registerSheet` on mount and removes the entry on unmount.
It keeps the latest `onClose` in a ref, so Esc always calls the current handler. The
keyboard handler in `LayersApp` uses the stack in two ways:

- **Esc closes only the top sheet.** It first leaves a focused search box; otherwise it
  calls `topSheet().close()`. A picker opened inside a sheet closes by itself, and the
  sheet underneath keeps what you typed.
- **Shortcuts are off while any sheet is open** (`hasOpenSheet()`).

This covers sheets owned by a screen, such as "Prepare to talk" in `PersonProfile`, Home's
detail picker, the date and time pickers and `GoalModal`'s variant picker, as well as the
ones `LayersApp` owns. Up to 1.0.26 `LayersApp` kept its own list of open flags, which
missed screen-owned sheets and closed a whole dialog when Esc was meant for a picker
inside it.

### Rules for new overlays

- Use `Sheet` (or wrap custom markup in `SheetPortal`) for anything that overlays the app.
  Don't use `position: fixed` and don't `createPortal(…, document.body)`.
- Don't look up DOM nodes during render (`document.getElementById`) to find a portal
  target. Use the context.
- Pass `onClose`. `Sheet` registers itself in the open-sheet stack, so Esc and the
  shortcuts work without changes to `LayersApp`. Custom markup in `SheetPortal` must call
  `useOpenSheet(onClose)` itself, as `ConfirmDialog` does.

### History of the "Edit goal" bug (fixed in 1.0.24)

**Symptom:** the Edit/New goal sheet, and every other sheet, rendered with a transparent
panel, black text and no backdrop, drawn over the profile screen. Wide windows made it
worse.

**Cause:** `Sheet` once portaled straight to `document.body`, outside `.layers-root`, so
every `var(--c-*)` was undefined. In some builds `.sheet` was also positioned against
the page rather than the phone. A partial fix portaled into
`document.getElementById('sheet-portal-root')` instead, but it had three problems:

- it fell back to `document.body` whenever that lookup failed;
- `.sheet` was `position: fixed` with hard-coded `top/bottom: 20px`, so sheets didn't
  line up with the phone frame on tall windows. The panel hung off the bottom of the
  frame and past the viewport;
- sheet text lost the Manrope font, because the portal root sat outside `.phone-frame`.

The installed desktop build was also older than the source and still had the original
bug, and both builds were labelled 1.0.23.

**Fix:** `.app-shell` + `.sheet-layer` + `SheetLayerContext`/`SheetPortal` as described
above, with no fallback to `body`. `ConfirmDialog` moved onto the same layer. The version
was bumped so the rebuilt app is distinguishable and the updater offers it.

## When a screen crashes

`ErrorBoundary` ([`components/ErrorBoundary.jsx`](../../src/components/ErrorBoundary.jsx))
wraps the current screen inside `.scroll-area`. If a screen throws while rendering, it
shows "This screen hit a problem" with **Go to Home**, **Reload Layers** and the error
message, instead of React unmounting the whole app and leaving a blank window. Data is
saved as it changes, so nothing is lost. `LayersApp` keys the boundary by onboarding
state, screen, person and tab, so going anywhere else tries again.

Sheets that a screen owns are inside the boundary. The sheets `LayersApp` renders
itself (the log, goal and person sheets, `ConfirmDialog`, …) are outside it, so a crash
in one of those still unmounts the app. If the page's whole process dies, Electron
reloads the window ([electron.md](../electron.md)).

## Toasts

`pushToast(text)` in `LayersApp` adds `{ id, text }` and removes it after 2.6 s. The
stack lives inside `.phone-frame` above the nav bar.

## Motion

`sheetUp`, `fadeIn`, `toastIn`, and the level-up pulse/glow/banner keyframes are all in
`CSS`. A `prefers-reduced-motion: reduce` block shortens every animation and transition
to ~0.
