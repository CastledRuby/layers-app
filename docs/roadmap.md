# Roadmap

Where Layers stands against [vision.md](vision.md), what was decided along the way, and
what comes next. Last updated 2026-10-04, with 1.0.28.

**How it got here:**

1. An audit of 1.0.26 on 2026-10-03 found 22 bugs: the code was read, a fresh install
   was clicked through, and the installed app was inspected.
2. 1.0.27 fixed all 22 and added the testing system ([testing.md](testing.md)).
3. 1.0.28 built proposals P1, P2 and P4 to P7 overnight. The owner said "go with what
   you think, I can change it in the morning", so every choice made on their behalf is
   listed under [Decisions to review](#decisions-to-review). 1.0.28 is tested and
   committed but **not yet released**, because Windows started blocking new unsigned
   builds; see [Needs your decision](#needs-your-decision).

Following the [working principles](vision.md#working-principles), anything that changes
how the app behaves for you is listed with the default chosen, so it can be changed.

## Status against the vision

| Area | Status | Notes |
|---|---|---|
| Portable + installer `.exe` | ✅ Done | |
| Icon and Windows identity | ✅ Done (1.0.27) | `Layers.exe` is "Layers" by CastledRuby, with the Layers icon. The tray icon follows the taskbar's light or dark mode. |
| Single instance, `--quit`, tray | ✅ Done | Checked end-to-end on every release. Closing to the tray no longer holds up a Windows shutdown. |
| Full local persistence | ✅ Done | Everything is saved: people, journal, goals, events, skills with history, achievements with dates, profile and settings. Saved data is checked at startup, and damaged data is kept and explained. |
| Onboarding | ✅ Done | Name and focus can be changed in Me (1.0.28). The focus drives Home's "Try this next". |
| Sample data separable | ✅ Done (1.0.28) | "Remove sample people" keeps yours, and "Add sample people" adds them alongside your own. |
| Works with zero people | ✅ Done | Checked by both the app tests and the end-to-end tests. |
| Data-model migration | 🟡 Mostly | Old dates, skill history and logins are upgraded in place. Saved data still has no version number; see [Next](#next). |
| People & Layers | 🟡 Mostly | Every layer change gets a dated timeline step, and Adjust previews where saving would put someone. **Logging and Adjust still use different maths: [P3](#p3-one-progress-model) needs your decision.** |
| Goals | ✅ Mostly | Skill goals move with their skills (1.0.28). Goals linked to a reminder move when it's logged. The variant chevron still can't be reached by keyboard. |
| Coach, Prepare | ✅ Done (1.0.28) | Hooks come from all saved interests, plans, preferences, things to ask about, recent topics and reflections. Personal experiences are kept for Layer 3 and closer. |
| Coach, Analyse | ✅ Works (sample conversations) | It's still a prototype on four sample chats. Real screenshot analysis is a later idea. |
| Social skills | ✅ Done | The chart records points, and achievements are stored with dates. Strength and focus come from your real levels. |
| Journal | ✅ Done (1.0.28) | Edit or delete an entry. Filters by person, type, period and layer, plus search, which includes reflections. |
| Logging flow | ✅ Done (1.0.28) | The quick log is unchanged. The optional "More details" adds new info, what stood out, which goals moved, and a reflection. |
| Events / reminders | ✅ Done (1.0.28) | One-off and weekly, with a done state, goal links and "remind me to follow up". Desktop notifications fire at the reminder's time, and can be switched off in Me. |
| Me / Settings | ✅ Done | Profile, notifications, backup, privacy and sample controls. |
| Keyboard shortcuts | ✅ Done | All 12 work. Esc closes only the top sheet, and Ctrl/Alt combinations don't trigger single-key shortcuts. |

## Decisions to review

These are the choices made overnight on your behalf. Each is easy to change. Say which,
and how.

**Logging (P1)**
- "More details" is **closed by default**, so the quick log stays quick. The
  active-listening checklist stayed where it was rather than moving into it.
- "What stood out?" adds **+3** to that dimension.
- **Every** active goal of the people logged still moves by default, as before. Untick
  one to leave it alone.
- Topics picked with "+ Add detail" are saved to the profile **only when logging with
  one person**:
  - hobby-type topics become interests
  - school/work and life topics become temporary "Important" items
  - custom text stays in the note only

**Journal (P2)**
- Editing or deleting an entry changes the record, **not progress already added**. Taking
  progress back out would mean replaying everything since.
- The filters are: past week, past month, past 3 months, and each layer. A goal filter was
  skipped because entries don't record goals yet.

**Sample people (P4)**
- Removing the samples **resets your skills to 0%** if they came with the samples. It also
  works out achievements again from your own data.
- Adding the samples gives you the example skill levels **only if** all your skills are at
  0%.

**Prepare (P5)**
- Personal experiences only show for **Layer 3 and closer**, following Social Penetration
  Theory: surface topics first, personal ones once the relationship is personal.
- There are up to six hooks.

**Reminders (P6)**
- Desktop notifications are **on by default**. They fire within 15 minutes of the
  reminder's time, once a day each, including from the tray. Clicking one opens Layers.
- A weekly reminder can be "done for today" or "skipped" for a day. Logging a reminder
  marks it done.
- "Remind me to follow up" (the bell on temporary details) is set for **3 days later at
  9:00 AM**.

**Skills and Me (P7)**
- Skill goals move **+20** each time their skill rises.
- "Active Listener" now counts **conversations** with active listening ticked, as its
  description always said. It used to count ticks, so if you'd ticked several in one
  conversation it may now show as locked until you reach 5 conversations.
- Achievements earned by loading data (startup, samples, an import) are recorded without
  a notice. Ones you earn by using the app get a 🏅 toast.
- "Try this next" on Home:
  - "Building new friendships": add people, or ask a newer one about something they
    mentioned.
  - "Deepening close relationships": plan something with your closest relationship.
  - "My own social skills": this week's skill challenge.
  - "A bit of everything": takes turns day by day.

**Fixes (1.0.27)**
- New people start 20% into their layer, and the sample people's numbers were adjusted to
  match.
- The timeline's last step reads "Current: Layer N, Name, as of <date>" instead of "Now".
- Unreadable saved data is kept under `layers-app-state-v1-unreadable-<time>` in the app's
  storage, and a notice explains it.

## Needs your decision

### Windows is blocking new builds (read this first)

Since 12:51 AM on 2026-10-04, Windows **Smart App Control** has been enforcing on this
laptop. It refuses to start every new, unsigned build of `Layers.exe`. The installed
1.0.27 is unaffected: Windows already accepted that exact file, and it keeps running.

**What this means:** 1.0.28 is finished and passes all its tests. It's committed on this
computer but **not released**. Publishing it would make your 1.0.27 auto-update to an exe
Windows may refuse to start. The end-to-end tests can't run on new builds here either; the
release script now stops with a clear message instead of publishing
([testing.md](testing.md#when-windows-blocks-the-build)).

**Options:**

1. **Code signing (P8, recommended).** Signed apps from a trusted certificate are allowed,
   which also fixes installs and auto-updates for anyone you share Layers with.
   - Azure Trusted Signing, about US$10 a month, is the quickest.
   - An OV certificate is roughly US$200–400 a year.
   - Once you have one, wiring it into `npm run release` is small.
2. **Turn Smart App Control off** (Windows Security > App & browser control). It's your
   security setting, and Windows can't turn it back on without a reinstall. Then
   `npm run release` publishes and installs 1.0.28 as usual.

### P3. One progress model

**The problem.** Two numbers both describe how close you are to someone:

- the **layer and its 0–100% meter**
- the **six dimensions**

Logging moves the dimensions 2–5 times faster than the meter, on purpose: a quick chat
still credits the dimensions, but only meaningful logs (rated 4–5) move the meter.
Adjust, though, places someone on a layer from the *average of the dimensions*: 25-point
bands, as the vision specifies. After a few weeks of logging the two disagree. Alex might
be at Layer 3, 72%, while his dimensions average 76, which is Layer 4. Since 1.0.27,
Adjust shows where saving would put someone and does nothing when you haven't moved a
slider. Moving any slider, though, re-places them from the dimensions.

**Options**

| | What changes | Good | Cost |
|---|---|---|---|
| **A. Dimensions drive everything** | The layer and meter are always worked out from the dimension average. Logging moves the dimensions more slowly, tuned so a meaningful log moves the meter about 5–10%. | One number, so Adjust, logging and charts always agree. Matches "absolute band mapping". | The dimension bars move about 4× slower. Existing people need a one-off migration: their dimensions are scaled so the average matches their current layer and %, which changes bars you've seen. |
| **B. The meter drives the layer; dimensions describe** | Adjust sets the layer and % directly (a layer picker and a slider). The dimension sliders become "impressions" that never move layers. | No migration, and logging stays as it is. Simple to explain. | Drops the vision's "Adjust uses an absolute band mapping". Two numbers stay, but they no longer contradict each other. |
| **C. Keep both, held in step** *(recommended)* | Logging can't push the dimension average above the top of the current layer's band until the meter levels up; after a level-up it continues in the new band. Adjust keeps the band mapping. A one-off migration scales existing dimensions into their layer's band, proportionally, so their shape is kept. | Keeps the per-layer meter, the slow meaningful-only progress and absolute Adjust, all as the vision describes. Adjust becomes predictable: unchanged sliders land where the person already is. | The dimension bars pause near the top of a band until a level-up. The one-off migration lowers some bars for people whose dimensions ran ahead. |

**Recommendation: C.** It keeps every behaviour the vision names and removes the
contradiction. The migration is a scaling, not a reset. A note on first launch would
explain it.

### P8. Code signing

This is now **needed, not just nice to have**: see above. It also removes Windows'
"unknown publisher" warning when installing and updating. It needs a code-signing
certificate, which is paid: roughly US$100–400 a year, or Azure Trusted Signing at about
US$10 a month. Once there is one, `npm run release` can sign with it.

## Next

These are small and contained, so they can go in the next batch.

1. **A version number on saved data.** It would make future changes to the data model
   explicit migrations rather than backfills. It goes alongside P3 if P3 needs a
   migration.
2. **Undo for deletes.** Removing a person, an entry, a goal or a reminder shows a toast
   with "Undo" for a few seconds. It's safer than a confirm dialog alone.
3. **Keyboard and screen-reader pass.**
   - Make the goal-variant chevron reachable by keyboard.
   - Move focus into a sheet when it opens and back when it closes.
   - Label the remaining icon-only buttons.
4. **Stale-build guard** for packaging by hand: fail if `electron/app/index.html` is
   older than `src/` ([known-issues.md](known-issues.md)).
5. **A goal on journal entries.** Store which goals a log moved (from P1's "Goals this
   moved"), then add the journal goal filter the vision listed.
6. **Analyse: more suggestion tones.** Only "continue the topic" has natural, playful and
   deeper versions; two sample chats have none.

## Later: the deferred ideas, sketched

Each still needs a yes before it's built. These sketches are where the proposal would
start.

- **Quick survey for someone you already know** (about 20 questions).
  - Where: Add person gets "Not starting from zero? Answer a quick survey".
  - How: about 20 one-tap questions in four short groups (how often you talk, what you
    share, trust and support, time together), each answered on 1–5.
  - Result: the answers set the six dimensions, and the layer and percentage come from
    them the same way Adjust works. The answers are kept, so it can be retaken later.
- **Per-dimension meaningfulness.**
  - This grows out of P1's "What stood out?": turn the chips into optional 1–5 ratings for
    each dimension (trust 4, depth 2, ...).
  - Goals that name a dimension ("Have deeper conversations") then move with that
    dimension's rating instead of the overall one.
- **Activity heatmap.**
  - Where: an "Activity" section on each profile, plus one for everyone on the Journal.
  - What: a GitHub-style calendar of the last 6 months, shaded by how many and how
    meaningful the logs were. Journal entries already carry ISO dates.
  - Tapping a day filters the journal to it.
- **Readable person summary (PDF).**
  - Profile > "Export summary" makes a one-page printable summary: layer and progress,
    the six dimensions, what you know about them, timeline, goals and recent entries.
  - Electron's `printToPDF` saves it as a PDF. Nothing leaves the device unless you send
    it.
- **Minimal desktop notifications**: ✅ done in 1.0.28 (reminders and the daily
  check-in, each with a switch in Me).
- **Real conversation analysis.** Analyse a pasted or screenshotted conversation instead
  of the four samples. It would need an AI model, which raises a privacy question for a
  local-first app. Options: a local model (private, but heavy), or a cloud API that only
  runs when you ask, with a clear warning. This needs its own proposal, and the vision's
  privacy principle comes first.

## History

### Proposals built in 1.0.28

P1 (progressive "More details" when logging), P2 (journal editing and filters), P4
(sample people controls), P5 (richer Prepare hooks), P6 (smarter reminders and
notifications) and P7 (skills and Me). Their defaults are under [Decisions to
review](#decisions-to-review). P3 and P8 are under [Needs your
decision](#needs-your-decision).

### Batch 1: fixes

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
