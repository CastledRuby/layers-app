# Roadmap

Where Layers stands against [vision.md](vision.md), and what comes next. This is based on
an audit of 1.0.26 on 2026-10-03, done three ways:

- reading every view, modal, `lib/` module and `electron/main.cjs`
- clicking through a fresh install (zero people, then one person) in the browser
- inspecting the installed app on the owner's laptop

The marks after each item say how it was checked:

- 🔍 seen happening in the browser or on the installed app
- 📖 found by reading the code

Following the [working principles](vision.md#working-principles):

- **Batch 1** holds contained fixes. They restore behaviour the vision already asks for,
  so they can just be done.
- **Proposals** change the UX, so each one waits for a go-ahead.

## Status against the vision

| Area | Status | What's missing or wrong |
|---|---|---|
| Portable + installer `.exe` | ✅ Done | |
| Icon and Windows identity | ❌ Broken | 🔍 `Layers.exe` says it's "Electron" by GitHub, Inc. and shows the Electron atom icon. The Start-menu and desktop shortcuts, the pinned taskbar icon and notifications use it. The tray icon is dark-on-dark on a dark taskbar. The AUMID (`com.layers.app`) does agree everywhere. |
| Single instance, `--quit` | ✅ Done | Tested end-to-end with the packaged app in 1.0.26. |
| One tray icon | ✅ Done | 📖 Nothing handles Windows shutdown, so close-to-tray may hold up a shutdown or restart. |
| Full local persistence | 🟡 Mostly | 📖 Skill history is never recorded. Achievements are recalculated rather than stored, so they can re-lock. A corrupt save is silently replaced with sample data, and failed writes are silent. There's no schema version. |
| Onboarding | ✅ Done | 🔍 Persisted and never reappears. The chosen focus only feeds the Home subtitle. Name and focus can't be changed later. |
| Sample data separable | 🟡 Partial | 📖 No code assumes a sample person. But there's no "remove sample data only": both buttons replace *your* data (with a warning). Restore also leaves events linked to people who no longer exist. |
| Works with zero people | ✅ Mostly | 🔍 Every tab and shortcut works. But you can't create an event with nobody in your circle. |
| Data-model migration | 🟡 Partial | `backfill*` migrates old dates. Saved data has no version number. |
| People & Layers | 🟡 Partial | 📖 Adjust and logging use different maths, so Adjust → Save with *nothing changed* can move someone to another layer. The timeline never gets an entry after "First met". A level-up shows as "+0%" and a dip in the chart. |
| Goals | ✅ Mostly | All 14 presets have 6 variants. Due dates: red when overdue, amber within 3 days, green otherwise. 📖 Gaps: not linked to skill levels; general goals never move; the variant chevron only shows after a preset is picked and can't be reached by keyboard. |
| Coach, Prepare | 🟡 Partial | 📖 Hooks use only the *first* interest, the latest entry, the first plan and the first "important" item. |
| Coach, Analyse | ✅ Works for anyone | 🔍 Tried with a non-sample person, and Save wrote the item to them. 🔍 It crashes after the person it was opened for is deleted. Only one suggestion has multiple tones. |
| Social skills | 🟡 Partial | 📖 The progress chart never gets new points, so a new user's chart stays empty. Self-disclosure can't rise from logging. There's no unlock notice. |
| Journal | 🟡 Partial | Sorted by date. Filters: person, type, search. 📖 Entries can't be edited or deleted. There are no Layer or date filters. |
| Logging flow | 🟡 Partial | The quick path works. 📖 "Add details" is one fixed screen, and detail tags only go into the summary text, never onto the profile. Home's "Recent activity" ignores the logged date. |
| Events / reminders | 🟡 Partial | One-off and weekly reminders, linked to people, with a Manage panel. 📖 No goal links, follow-up type or "done" state, and no desktop notification. Deleting has no confirmation. |
| Me / Settings | ✅ Done | 🔍 It shows "Your biggest strength: Active listening" when every skill is 0%. |
| Keyboard shortcuts | 🟡 Mostly | All 12 work and match the list. 🔍 `/` does nothing on Home, Coach or Me. 📖 Ctrl+N and Ctrl+D also trigger N and D. Esc doesn't close "Prepare to talk". In a picker opened from another sheet, Esc closes both sheets and discards input. |

## Batch 1: fixes

**All 22 shipped in 1.0.27**, each with a regression test in `tests/app/fixes.test.jsx`, and the end-to-end tests in `tests/e2e/` check the packaged app (see [testing.md](testing.md)). The list is kept here as the record of what was wrong.

**Crashes and data safety**

1. 🔍 Coach crashes to a blank window when it was opened for a person who has since been
   deleted. Reset Coach's person whenever that person disappears. Add an error screen
   with "Reload", so any future render crash doesn't leave a blank window, and reload the
   window from Electron if the renderer dies.
2. 📖 If the saved data is unreadable, keep a copy and say so, instead of silently loading
   the sample people over it. Show a toast if saving fails (for example, disk full).
3. 📖 Deleting a person, or restoring samples, leaves events linked to people who no
   longer exist. Remove those links.
4. 📖 Adjust → Save with nothing changed must not move anyone. A new person's starting
   percentage should also match what Adjust would show. The bigger question of one shared
   progress model is proposal P3.

**Windows identity and the tray**

5. 🔍 Make `Layers.exe` carry the Layers name, icon and version. This is the
   `signAndEditExecutable: false` setting in `package.json`. It fixes the Start-menu
   and desktop shortcuts, the pinned taskbar icon, notifications and Task Manager.
6. 📖 Tray icon readable on dark taskbars: follow the Windows theme.
7. 📖 "Open at login" should start Layers hidden in the tray, as the code intends.
   `openAsHidden` only works on macOS. The portable build also registers a temporary
   path that stops existing.
8. 📖 Let Windows shut down and restart without the close-to-tray handler getting in the
   way.
9. 📖 Updates:
   - check again every few hours while Layers sits in the tray
   - catch failed downloads
   - fix the misleading `autoDownload` setting
   - stop the portable build from downloading the installer
   - warn if another app already owns Ctrl+Shift+L

**Behaviour that doesn't match the vision**

10. 🔍 `/` should jump to search from any tab.
11. 📖 Ctrl/Alt + N or D shouldn't trigger quick log or Add detail.
12. 📖 Esc should close "Prepare to talk" and Home's detail picker. In a picker opened from
    another sheet, Esc should close only the picker.
13. 📖 Details picked while logging should reach the person's profile, as the save handler
    already expects. The modal currently always sends an empty list. This also lets
    self-disclosure grow.
14. 📖 The skills chart should record a point (at most one a day) whenever a skill changes.
15. 📖 The timeline should get a dated step whenever someone changes layer.
16. 📖 Home's "Recent activity" should be ordered by the logged date, not by entry order.
17. 📖 Logging several people at once should toast every level-up, not only the first.
18. 📖 Coach Analyse:
    - the goal gain shown should be the gain applied
    - the same analysis shouldn't be saved twice
    - a cleared edit shouldn't be saved as an empty item
19. 📖 A goal's description should follow the chosen person, not the first one picked.
20. 📖 Due-date labels should refresh at midnight, like the rest of Home.
21. Stale wording:
    - 📖 Home says Layers "doesn't send OS notifications yet".
    - 📖 Home says "edit it under People" for events.
    - 🔍 Me shows a strength when every skill is 0%.
    - 🔍 Journal says "No interactions match this filter" when no filter is set.
22. 📖 Deleting an event should ask first, like goals do. You should be able to create an
    event with no people.

## Proposals: need a go-ahead

Ordered by recommended priority. Each is a UX change, so it starts with a short
description and a yes.

- **P1. Progressive "Add details" when logging.** This is the vision's logging flow, and
  it doesn't exist yet. Quick log stays as it is. An optional, expandable "Add details"
  step then covers:
  - new info or interests, saved to the profile
  - dimension nudges
  - which goal moved
  - a reflection
- **P2. Journal editing and filters.** Edit or delete a single entry, with progress
  recalculated. Add Layer and date-range filters. Skip a goal filter until entries record
  goals.
- **P3. One progress model.** Make the dimensions and the per-layer meter agree, so
  logging, Adjust and the charts never contradict each other. This changes how numbers
  move, so it's your call.
- **P4. Sample data controls.** Add "Remove sample people only", which keeps yours.
  Change "Restore samples" so it adds the sample people alongside yours instead of
  replacing them.
- **P5. Richer Prepare hooks.** Use all interests, preferences, experiences and the last
  few entries, not only the first of each.
- **P6. Smarter reminders.**
  - goal-linked reminders and a "follow up" type
  - a "done" state
  - upcoming weekly dates shown ahead of time
  - optionally, a desktop notification at a chosen time (this is the deferred "minimal
    notifications" idea)
- **P7. Skills and Me.**
  - link skill goals to skill levels
  - store achievements and show an unlock notice
  - edit your name and focus in Me
  - use the onboarding focus to tailor Home and Coach
- **P8. Code signing.** This removes the "unknown publisher" SmartScreen warning. It needs
  a paid certificate.
- **Deferred ideas**, from [vision.md](vision.md#deferred-ideas):
  - the ~20-question survey
  - per-dimension meaningfulness
  - an activity heatmap
  - a readable/PDF person summary

  Each still needs its own proposal. Per-dimension sliders already exist in Adjust and
  could be reused. Journal entries already carry ISO dates for a heatmap.

## Housekeeping

Done in 1.0.27: unused icon variants and `src/assets` removed, every lint warning cleared, and `no-undef` made an error. Still open: a stale-build guard for packaging by hand ([known-issues.md](known-issues.md)).
