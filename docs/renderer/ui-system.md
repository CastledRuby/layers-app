# UI system: theme, layout, sheets

## Colours and theming

- `THEME_LIGHT` and `THEME_DARK` ([`src/theme.js`](../../src/theme.js)) are matching palettes:
  `paper`, `paperRaised`, `ink`, `inkSoft`, `line`, `accent`, `accentSoft`, four layer
  colours (each with `Tint`/`Deep`), plus `plum`, `teal`, `good`, `warn`, `alert`.
- Three more serve the controls:
  - `onAccent` is for text and icons on an accent background. It's white in light mode
    and a dark navy in dark mode, where white on the light-blue accent was only about
    2.5:1. Use it rather than `'#fff'` whenever the background is `COLORS.accent`. A
    test checks that it's at least 4.5:1 in both themes.
  - `tile` is the surface of big choice buttons and chips, a step off the sheet.
  - `overlay` is the backdrop behind an open sheet, darker in dark mode so the sheet's
    edge shows.
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
   colour. `main.cjs` stores the theme and mode in `theme.json` in the userData folder;
   with Match Windows it asks Windows instead.
2. **The page**, before any app code runs: an inline script in `index.html` reads the
   theme mode from `localStorage` (asking `prefers-color-scheme` for Match Windows) and
   paints `<html>` with the paper colour.
3. **React**: an effect in `LayersApp` keeps `<html>`'s background in sync and calls
   `layersSystem.setTheme(theme, themeMode)` whenever the theme changes (with Match
   Windows, `useSystemDark` follows Windows' mode as it changes), so the window colour and
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
   reduced-motion overrides. It also holds the shared control classes:
   - `.tile`: big choice buttons, which lift on hover and press in on click (`.tile--accent`
     is the highlighted one, `.tile-icon` the icon well)
   - `.chip` and `.chip--on`: small pills
   - `.seg` and `.seg-btn`: the 1–5 scale
   - `.primary-btn`: a sheet's main button
   - `.icon-btn`: round icon buttons such as back and close
   - `.kbd`: a key hint It starts with the `@font-face` rules from
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

### A wide window

From **900 px** wide (`useWide` in [lib/hooks.js](../../src/lib/hooks.js), which adds
`.is-wide` to `.layers-root`), Layers fills the window instead of the phone-shaped card:

- `.app-shell` has no maximum width and `.phone-frame` no radius, so the frame is the
  window.
- **Today** is `.today-wide`: the day on the left and the month grid in a sticky column
  on the right (`.today-wide-side`), with no week strip or Day/Month switch.
- **People** is `.people-split`: until someone is picked, the list on its own in the
  middle (`.people-split--solo`, 760 px); once one is, the list (sticky, scrolling on its
  own) beside their profile. The list slides between the two (`useSlideAcross` in
  `lib/hooks.js`), and keeps the person picked in view. The tabs stay, with People lit.
- **Coach, Journal, Me, Goals** and onboarding sit in `.page-col`, a centred column 760 px
  wide.
- **The tabs** stay at the bottom, the five centred in 660 px; the FAB sits at the window's
  right.
- **Sheets** open as a centred 540 px panel (`.is-wide .sheet-panel`), and the Ctrl+K box
  as a 640 px one near the top.

Narrower than 900 px, nothing changes.

## Sheets and dialogs

The `Sheet` component is a bottom sheet with overlay, a handle, title bar, close button,
scrollable body and an optional sticky `footer`. Its other props:

- `tall` gives it a fixed 80% height, for sheets whose content changes between steps.
- `onBack` shows a back arrow before the title.
- `onKey(e)` receives key presses only while this sheet is the top one and nothing has
  handled the key already. The log uses it for its keys.

Closing by X, the backdrop or Esc first plays a short slide (`.sheet.is-closing`, 170
ms), then calls `onClose`. A parent that unmounts the sheet itself, after saving for
example, closes it at once. With "reduce motion" on, it closes at once too.

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
always appear on top. Each `.sheet` is its own stacking context (`isolation: isolate`),
so nothing inside one sheet can paint over a sheet opened above it. Before this, the
log's date button sat in a `z-index: 20` wrapper and showed through "Add detail". Toasts (`z-index: 70`) stay visible above sheets.

`ConfirmDialog` takes `hideCancel` for an OK-only notice, such as the startup notice
about saved data that couldn't be read
([state-and-data.md](state-and-data.md#loading-saved-data)). Esc still dismisses it.

`Sheet`'s `top` drops the panel down from the top with no title bar (the title still
names it for screen readers): the Ctrl+K box.

### Esc and the open-sheet stack

Every open `Sheet` and `ConfirmDialog` registers itself in a stack in
[`components/sheetLayer.js`](../../src/components/sheetLayer.js) while it's mounted.
`useOpenSheet(onClose)` calls `registerSheet` on mount and removes the entry on unmount.
It keeps the latest `onClose` in a ref, so Esc always calls the current handler. The
keyboard handler in `LayersApp` uses the stack in two ways:

- **Esc closes only the top sheet.** It first leaves a focused search box, or a text box
  in a sheet that has keys (its panel has `data-keys`), so the sheet's keys work again;
  otherwise it calls `topSheet().close()`. Tab in such a text box leaves it too
  (`Sheet`), rather than landing on the next button. A picker opened inside a sheet closes by itself, and the
  sheet underneath keeps what you typed.
- **A text box shows its key** with `KeyedField` (`components/atoms.jsx`): the letter
  the sheet uses to get into it on its right (N for a note), and Esc once you're in.
  It's a plain `<input>` (or `<textarea>` with `multiline`) otherwise; the sheet's own
  `onKey` does the focusing. The quick log's note, editing a journal entry (N and F),
  Something new, How it felt, Add detail's own words, a new goal's own words and a plan's
  title all work this way.
- **Shortcuts are off while any sheet is open** (`hasOpenSheet()`).

This covers sheets owned by a screen, such as "Prepare to talk" in `PersonProfile`, the
date and time pickers and `GoalModal`'s variant picker, as well as the
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
shows "This screen hit a problem" with **Go to Today**, **Reload Layers** and the error
message, instead of React unmounting the whole app and leaving a blank window. Data is
saved as it changes, so nothing is lost. `LayersApp` keys the boundary by onboarding
state, screen, person and tab, so going anywhere else tries again.

Sheets that a screen owns are inside the boundary. The sheets `LayersApp` renders
itself (the log, goal and person sheets, `ConfirmDialog`, …) are outside it, so a crash
in one of those still unmounts the app. If the page's whole process dies, Electron
reloads the window ([electron.md](../electron.md)).

## Toasts

`pushToast(text, { undo })` in `LayersApp` adds `{ id, text, undo }` and removes it after
2.6 s (longer for long messages). The stack lives inside `.phone-frame` above the nav bar.

**Undo.** Deletes (a plan, entry, goal, person, key date, the sample people), ticking a
plan off, a log, a saved or edited plan, and clearing some things when starting over pass
`undo: snapshot()`: the people, journal, plans, goals, skills, achievements and profile as
they were just before. That toast shows an **Undo** button for 7 s, and **Ctrl+Z** undoes
the newest one (not while typing or with a sheet open). Undo puts the snapshot back and
says "Undone", with **Redo** (or **Ctrl+Y**, or Ctrl+Shift+Z) for 7 s: `pushToast(text,
{ redo })`, holding the data from just before the Undo. Redo only works if nothing has
changed since (it compares the data by reference); then it says "Redone", with Undo
again. The key handler reads the data through `liveData`, a ref kept current after
every render, because its own copy is from when it was set up.

## Switches, disclosures and chips

There's no shared component for these. Each is a plain `<button>` styled inline, and its
ARIA attribute carries the state:

- **Switches** (Me → Notifications) use `role="switch"` and `aria-checked`. The track
  and knob are two styled spans, and the knob slides with a short `left` transition.
- **Chips and single choices** (Journal filters, the type and meaningfulness choices in
  Edit entry) use `aria-pressed`.
- **Rating scales** (the log's "How did each part go?") are one `role="radiogroup"` per
  dimension, labelled with its question, with `role="radio"` buttons 1–5. The scale fills
  up to the rating in the dimension's colour. The highlighted row is where typing a
  number lands; the rating sheet's key handler moves it (1–5, Backspace, arrows). A tick
  list, like "Goals this moved" or active listening, uses `role="checkbox"` and
  `aria-checked`.
- **A person's number** on a "who" step is a solid badge (`.pick-key`), readable over any
  avatar ring in either theme; the person the arrow keys are on has `.pick-cursor`.
- **Key hints** (`Kbd`) are `aria-hidden`, so a button's name stays what it does
  ("Save interaction", not "Save interaction ↵").

Older controls don't all have them yet, but new ones should. Screen readers need them,
and the app tests find controls by them (`getByRole('switch', …)`).

## Motion

All the keyframes are in `CSS`, with one easing for most of them (`EASE`: quick to
start, gentle to settle):

- **Sheets** slide up with their backdrop fading in (`sheetUp`, `fadeIn`), and slide
  away when dismissed (`sheetDown`, `fadeOut`).
- **Steps** inside a sheet slide in from the right going forward and from the left going
  back (`step-in`, `step-back`).
- **Picks** pop (`.pop`): the chosen 1–5, a rating, a ticked box, a selected person.
  New chips grow in (`.chip-in`).
- **Buttons** press in slightly on click everywhere; tiles also lift on hover.
- **Toasts** rise in (`toastIn`). In dark mode they're light, so they stand out.
- **The tab bar** shows the page you're on with a pill (`.nav-indicator`): accent-tinted,
  outlined, with a glowing bar on the top edge. Switching tabs slides it across with a
  little overshoot, a ring ripples out (`navRipple`) and the icon hops (`navHop`).
- **Pages** slide in from the side their tab is on, sharpening from a slight blur
  (`page-anim--fwd`, `page-anim--back`; `PageTransition`).
- **Press and hold** (`.hold-btn`): a fill runs across the button while it's held
  (`--hold-ms`), for "Delete for good?" in `StartOverSheet`.
- The level-up pulse, glow and banner.

A `prefers-reduced-motion: reduce` block shortens every animation and transition to ~0.
The app tests run as if it were on (`tests/setup.js`), so sheets close at once there.
One test turns it off to check the closing slide.
