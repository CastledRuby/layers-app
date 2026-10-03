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

## Styling layers

1. **Tailwind utilities** in `className` handle layout and spacing (`flex`,
   `grid grid-cols-2`, `px-5`, `rounded-2xl`, `text-sm`…). The config is stock and
   scans `src/**/*.{js,jsx}`.
2. **Inline `style={{…}}` with `COLORS.*`** handles every colour, so colours follow the theme.
3. **The `CSS` template string** (injected by `<style>{CSS}</style>` inside
   `.layers-root`) holds structural classes Tailwind doesn't express well: `.phone-frame`,
   `.sheet-*`, `.nav-bar`, `.fab-btn`, `.toast*`, keyframe animations and
   reduced-motion overrides. It also loads the Fraunces (display) and Manrope (body)
   Google fonts.

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

### Rules for new overlays

- Use `Sheet` (or wrap custom markup in `SheetPortal`) for anything that overlays the app.
  Don't use `position: fixed` and don't `createPortal(…, document.body)`.
- Don't look up DOM nodes during render (`document.getElementById`) to find a portal
  target. Use the context.
- Pass `onClose`. If the sheet is owned by `LayersApp`, also add it to the `Escape`
  priority chain and to `anyModalOpen` in the keyboard effect, so shortcuts don't fire
  underneath it.

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

## Toasts

`pushToast(text)` in `LayersApp` adds `{ id, text }` and removes it after 2.6 s. The
stack lives inside `.phone-frame` above the nav bar.

## Motion

`sheetUp`, `fadeIn`, `toastIn`, and the level-up pulse/glow/banner keyframes are all in
`CSS`. A `prefers-reduced-motion: reduce` block shortens every animation and transition
to ~0.
