# Vision and goals

What Layers is for, what "done" means for each part of it, and the working principles
behind every change. This was compiled from the project briefs and the development
history for v1.0.0–v1.0.24. For where each goal stands today, and what's next, see
[roadmap.md](roadmap.md).

## What Layers is

Layers is a private, psychology-informed relationship-coaching desktop app for Windows,
built around Social Penetration Theory (SPT). It helps you build stronger relationships
on purpose while improving your own social and conversational skills.

**Design intent.** It should feel like a polished, real product, not a demo or a
prototype:

- modern and clean
- calm rather than corporate
- visually consistent and easy to navigate
- laid out mobile-first, even on a Windows laptop

The desktop window shows it as a centred "phone frame" card. *(Since 1.0.36 the window
always opens maximised, and from 900 px wide Layers fills it; the phone frame only shows
in a narrow window.)*

**Privacy is core.** Layers is local-first: everything is stored on the device. *(The
optional OneDrive sync file is encrypted, and a chat goes to Claude only when you press
Analyse.)* Its
relationship scores are a reflection tool, not a measurement instrument. They make no
claim to objectively measure another person's feelings.

## Core architecture goals

- **Windows desktop app.**
  - Packaged as both a portable `.exe` and an NSIS installer `.exe`.
  - Launches as a real desktop app, not a browser tab.
  - Has a proper Layers icon (the dark icon is preferred over the light one). *(Since
    1.0.29 the icon is the Rings brand; see [branding](../branding/README.md).)*
  - Has the correct Windows taskbar identity.
- **Single instance.** Launching Layers again while it's running must not start a second
  process, window or tray icon. It should bring the existing window to the front and
  restore it if it's minimized. This must work in the packaged `.exe`, not just in dev mode.
- **One tray icon, always.** It's created once, reused across show, hide and minimize, and
  removed cleanly on quit.
- **Consistent app identity.** These must all agree, so the pinned taskbar icon groups
  with the running app instead of creating a second, unrelated taskbar entry:
  - the Electron `AppUserModelID`
  - the executable's metadata
  - the Windows shortcut
  - the taskbar entry
  - the tray icon
- **Full local persistence.** All of this must survive closing the app, reopening it and
  restarting Windows:
  - people, Layer assignments, dimensions and history
  - goals and goal progress
  - journal entries
  - social-skill progress and achievements
  - onboarding/setup state, your name and settings

  No new feature should keep data only in memory, unless it's intentionally UI-only
  (for example, whether a panel is open).
- **First-launch onboarding.** A short setup that doesn't feel like a questionnaire. It
  asks for:
  - your name
  - your main reason for using Layers (new friendships / deepening existing
    relationships / improving social skills / a bit of everything)
  - whether to start fresh or explore with sample data

  It's saved, so onboarding never appears again.
- **Sample data, cleanly separable.** Sample people, goals, journal entries and history
  must never be hardcoded dependencies elsewhere. No feature should assume "Alex" or
  "Jamie" exists. Me/Settings offers both "Delete sample data / start over" and "Restore
  sample data" (today "Remove sample people" and "Add sample people"), and the app works
  correctly with zero people.
- **Data-model stability.** Saved data stays compatible across changes. If the data model
  changes, migrate it rather than silently dropping user data.

## Core features

- **People and relationship Layers.**
  - Add people and assign each to one of 4 relationship Layers, visually distinct
    throughout the app.
  - See relationships as a map and as a list.
  - Open a person's profile, adjust the 6 relationship dimensions, track progress and
    view their history/timeline.
  - Each Layer has its own 0–100% progress meter (not cumulative) and levels up at 100%.
  - The manual "Adjust" uses an absolute band mapping rather than deltas.
- **Goals.**
  - Preset and custom goals, milestones, progress tracking and suggested next steps.
  - Due dates with proximity indicators (overdue / amber / green).
  - Goals connect to people and to social-skill progress where relevant.
  - Each preset has 6 variants, reached through a chevron badge on the goal card.
- **Conversation Coach, Prepare.**
  - Tools for identifying conversational hooks.
  - A Listen → Follow-up → Share model, conversation hand-offs and encouragers.
  - It surfaces hooks from the person's saved interests, recent log entries and past
    conversation topics, not only generic advice.
- **Conversation Coach, Analyse.** It works with mock data for now, but it must work for
  any person you've added, not hardcoded demo IDs. *(Since 1.0.36 it is a real analysis
  by Claude, run only when you press Analyse.)* It offers:
  - conversation reconstruction
  - a conversation-state assessment
  - grading across several dimensions
  - extracted info with Save/Edit/Ignore
  - suggested next messages in several tones
- **Social skills.** The 6 skills, each with its current level, history and progress
  chart. Achievements unlock based on usage.
- **Journal.** Reflections and relationship experiences, sorted by the date they're tagged
  to rather than the order they were logged. The filters should be genuinely useful
  rather than filters for their own sake. The candidates considered were person, date,
  interaction type, goal, Layer and search text.
- **Logging flow.** Logging updates the person, goals, journal and social-skill data
  involved. It has two steps:
  - a fast quick log: person → interaction type → short note → save
  - an optional, progressive "Add details" step, instead of one long mandatory form,
    covering new info, interests, relationship dimensions, conversation quality, goal
    progress and reflection
- **Events and recurring reminders.** One-off and recurring reminders, person-linked
  reminders, follow-ups, and goal-linked reminders where useful. They stay a lightweight,
  contextual nudge system, not a full calendar app.
- **Me / Settings.**
  - social-skill tracking
  - a keyboard-shortcut reference
  - backup (export/import)
  - a privacy section explaining local-first storage, with a full reset
  - sample-data controls
- **Keyboard shortcuts** for fast navigation on Windows:

  | Keys | Action |
  |---|---|
  | Ctrl+1–5 | Switch tab |
  | N | Quick log |
  | D | Add detail |
  | Ctrl+Shift+A | Add person |
  | / | Search |
  | Backspace | Back |
  | Esc | Close dialog |
  | ? | Shortcuts list |
  | Ctrl+Shift+L | Bring Layers to the front, from anywhere. It must not also trigger quick log. |

  *(Changed in 1.0.31: Ctrl+Shift+L now opens the quick-add box, and Ctrl+Alt+L brings
  Layers to the front. The full, current list is `SHORTCUTS` in `src/data/constants.js`,
  shown in Me.)*

## Working principles

These apply to every change:

- **Work on the existing project.** No rewrites from scratch; make targeted changes only.
- **Propose before implementing** anything that could meaningfully change the UX (medium
  or large changes). Quick, contained bug fixes can just be done.
- **Don't silently redesign** features that work.
- **Preserve the existing architecture** (People, Layers, Goals, Coach, Journal, Me,
  persistence, onboarding, sample data, the Windows/Electron plumbing) unless a change is
  actually necessary.
- **Test for real, not just "the build succeeded".** Verify the actual behaviour before
  calling something done: persistence across a restart, single-instance with the packaged
  `.exe`, a fresh install with zero people, and so on.
- **Inspect the current code** and confirm what's actually implemented before assuming an
  earlier plan was applied.

## Deferred ideas

These are wanted eventually, but each needs its own proposal before it's built:

- A short quick survey (about 20 questions) to bulk-input relationship history for
  someone you aren't starting from zero with.
- Per-dimension "meaningfulness" logging (for example trust 8/10 and reciprocity 6/10,
  rather than one overall score), tied into the goal system.
- A calendar or heatmap view of a person's activity over time.
- A human-readable or PDF export of a person's summary.
- Minimal desktop notifications.

## History

Releases v1.0.1–v1.0.24 implemented and iterated on most of the core features, including:

- the person picker, map contrast and quick-add interests
- Prepare hooks and keyboard shortcuts
- the taskbar/AUMID identity, single-instance locking and the tray icon
- journal sorting and filters, and the progressive logging flow
- the "Manage" panel for recurring events
- goal due dates and the expanded preset variants

**The sheet regression is resolved.** Sheet-based popups (Keyboard shortcuts, Edit goal,
Add to Plans, the date pickers) first rendered as full-width unstyled overlays, then as
see-through overlays over the page behind them.

- **Cause:** the portal target landed outside `.layers-root`, the element that defines the
  `--c-*` theme variables.
- **1.0.24:** the fix portals into `.sheet-layer`, which lives inside `.layers-root`, via
  `SheetLayerContext`, so it no longer looks up an element by id.
- **Why it seemed to persist:** the installed build was stale.

See [the bug's history](renderer/ui-system.md#history-of-the-edit-goal-bug-fixed-in-1024).
Releases 1.0.25 and 1.0.26 followed. See [known-issues.md](known-issues.md) for what each
one fixed.
