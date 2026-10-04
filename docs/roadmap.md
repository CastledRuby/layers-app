# Roadmap

Where Layers stands against [vision.md](vision.md), what was decided along the way, and
what comes next. Last updated 2026-10-04, with 1.0.28.

**How it got here:**

1. An audit of 1.0.26 on 2026-10-03 found 22 bugs: the code was read, a fresh install
   was clicked through, and the installed app was inspected.
2. 1.0.27 fixed all 22 and added the testing system ([testing.md](testing.md)).
3. 1.0.28 built proposals P1, P2 and P4 to P7 overnight. The owner said "go with what
   you think, I can change it in the morning", so every choice made on their behalf is
   listed under [Decisions to review](#decisions-to-review). Windows Smart App Control
   held the release back until the owner turned it off on 2026-10-04. By then 1.0.28
   also had the per-dimension ratings, P3 option C and the quick log redesign.

Following the [working principles](vision.md#working-principles), anything that changes
how the app behaves for you is listed with the default chosen, so it can be changed.

## Status against the vision

| Area | Status | Notes |
|---|---|---|
| Portable + installer `.exe` | ✅ Done | |
| Icon and Windows identity | ✅ Done (1.0.27) | `Layers.exe` is "Layers" by CastledRuby, with the Layers icon. The tray icon follows the taskbar's light or dark mode. |
| Single instance, `--quit`, tray | ✅ Done | Checked end-to-end on every release. Closing to the tray no longer holds up a Windows shutdown. |
| Full local persistence | ✅ Done | Everything is saved: people, journal, goals, events, skills with history, achievements with dates, profile and settings. Saved data is checked at startup, and damaged data is kept and explained. |
| Onboarding | ✅ Done | Name and focus can be changed in Me (1.0.28). The focus drives Today's "Try this next". |
| Sample data separable | ✅ Done (1.0.28) | "Remove sample people" keeps yours, and "Add sample people" adds them alongside your own. |
| Works with zero people | ✅ Done | Checked by both the app tests and the end-to-end tests. |
| Data-model migration | ✅ Done | Saved data has a version number (2), and older saves are migrated once at startup. Old dates, skill history and login items are upgraded in place too. |
| People & Layers | ✅ Done | Every layer change gets a dated timeline step. Logging keeps the dimensions inside the layer (P3 option C), so Adjust agrees with the layer shown, and its preview shows any change of percentage. |
| Goals | ✅ Mostly | Skill goals move with their skills (1.0.28). Goals linked to a reminder move when it's logged. The variant chevron still can't be reached by keyboard. |
| Coach, Prepare | ✅ Done (1.0.28) | Hooks come from all saved interests, plans, preferences, things to ask about, recent topics and reflections. Personal experiences are kept for Layer 3 and closer. |
| Coach, Analyse | ✅ Works (sample conversations) | It's still a prototype on four sample chats. Real screenshot analysis is a later idea. |
| Social skills | ✅ Done | The chart records points, and achievements are stored with dates. Strength and focus come from your real levels. |
| Journal | ✅ Done (1.0.28) | Edit or delete an entry. Filters by person, type and period, plus search, which includes reflections. Every filter row fits on screen (1.0.29). |
| Logging flow | ✅ Done | The quick log asks only for the date, how meaningful it was and a note. Each extra (ratings, active listening, something new, goals, reflection) opens in its own small sheet from a chip. Every step works from the keyboard. |
| Calendar and reminders | ✅ Done (1.0.30) | Today is the main screen: your day, the week and month, plans in three steps, key dates, ideas, and Windows notifications that arrive with Layers closed, with Done, Log it and Snooze. |
| Me / Settings | ✅ Done | Profile, notifications, backup, privacy and sample controls. |
| Keyboard shortcuts | ✅ Done | All 12 work. Esc closes only the top sheet, and Ctrl/Alt combinations don't trigger single-key shortcuts. |

## Decisions to review

These are the choices made overnight on your behalf. Each is easy to change. Say which,
and how.

**Logging (P1)**
- *(Changed at your request.)* The quick log keeps only the date, how meaningful it was
  and a note. **Active listening moved out of it** into its own sheet, with the other
  extras. It's the one that used to be part of every log, so it's ticked less often now
  unless you press L.
- *(Replaced at your request.)* "What stood out?" became a **1–5 rating per dimension**.
  A rated dimension grows by `rating × 2.2` (1 → +2, 5 → +11). Goals about one dimension
  move by its rating.
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
- The filters are: past week, past month and 3 months. A goal filter was skipped because
  entries don't record goals yet.
- *(Changed at your request, 1.0.29.)* Every filter row fits on screen, with nothing to scroll
  sideways. So types show only their emoji (the name is the tooltip), and **the layer filter
  was removed**; each person chip shows their layer's colour instead. It's easy to bring
  back, perhaps in place of something else.

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
- "Try this next" on Today:
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

### Smart App Control (resolved 2026-10-04)

From 12:51 AM on 2026-10-04, Windows **Smart App Control** refused to start every new,
unsigned build of `Layers.exe` on this laptop, so 1.0.28 waited. You turned Smart App
Control off the same day, and 1.0.28 was released and installed as usual. If it's ever
turned back on, the end-to-end tests stop the release with a clear message
([testing.md](testing.md#when-windows-blocks-the-build)), and code signing (P8) is the
fix.

### P3. One progress model

**Decided: option C, released in 1.0.28.** You chose C on 2026-10-04. It's built: `keepDimsInLayer` runs after every log, and saved
data version 2 migrates older saves once. See
[state-and-data.md](renderer/state-and-data.md#dimensions-stay-inside-the-layer). The
analysis that led to it is below for the record.

#### The original proposal

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

Not needed on this laptop now that Smart App Control is off, but it would be for
anyone else whose Windows has it on. It also removes Windows'
"unknown publisher" warning when installing and updating. It needs a code-signing
certificate, which is paid: roughly US$100–400 a year, or Azure Trusted Signing at about
US$10 a month. Once there is one, `npm run release` can sign with it.

## The calendar (built in 1.0.30)

You asked for a fully working calendar with notifications, as the main part of the app:
"when I open Layers I should see my day planned out", with the month grid close at hand
and the map of how close you are on its own key. Your answers to the ten questions
(2026-10-04) set what it does, and all of it is built:

| | Question | Your answer |
|---|---|---|
| 1 | Where it lives | A new **Calendar tab**, the sixth (Ctrl+6) |
| 2 | First view | A **month grid**: dots on busy days, and tapping a day lists it below |
| 3 | What's on it | Everything: **events and reminders**, **past interactions** from the journal, **birthdays and key dates** from profiles (yearly), and **goal due dates** |
| 4 | Repeats | **Weekly** on chosen days, and **daily** (birthdays and anniversaries repeat yearly) |
| 5 | When notifications come | A **set time before**, chosen per event, plus a **morning summary** of the day and an **evening heads-up** for tomorrow |
| 6 | Notification buttons | **Open** in Layers, **Snooze**, **Mark done**, and **Log it** (the quick log, filled in) |
| 7 | After an event | **Ask how it went**, with the option to **just tick it off** |
| 8 | With Layers closed | Notifications **still arrive with Layers fully closed** (Windows schedules them ahead) |
| 9 | Adding with little typing | **Templates**, **tap a day then pick**, **"Plan something" on a profile**, and **smart suggestions** ("You haven't seen Priya in 3 weeks") |
| 10 | Other calendars | **Private and local first**, built so **two-way sync** can come later |

Layers is meant to reach the **iPhone, the App Store and maybe the Apple Watch** later. So
the calendar's data is portable and ready to sync:
- stable ids
- an `updatedAt` on each event
- dates and times stored plainly, not as text
- the logic kept in `lib/`, away from Windows-only code

**Defaults chosen** (each is easy to change):
- **Where it lives:** Today is the first tab and the screen Layers opens on. Ctrl+2 is
  People, whose map shows how close you are. The month grid is a Day/Month switch at the
  top of Today (or M).
- **Plans:** they last an hour unless the template says otherwise. New ones remind you 15
  minutes before; that's set in Me.
- **Snoozes:** 10 minutes, 1 hour, or the same time tomorrow.
- **Summaries:** the morning summary at 8:00 AM and the evening heads-up at 8:00 PM, on
  days with something on. Both times can be changed in Me.
- **How did it go?** asks when a plan with people ends, if it isn't done yet.
- **Month dots:** the month grid leaves daily routines out, so special days stand out.
- **Moved from the old Home:**
  - the four numbers went to the top of Me
  - Prepare and Analyse are in the Coach tab
  - "Haven't caught up" became Ideas
  - Recent activity is the Journal

## Next: smaller fixes

These are small and contained, so they can go in the next batch.

1. ~~**A version number on saved data.**~~ Done with P3 (`dataVersion: 2`).
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
- **Per-dimension meaningfulness**: ✅ built at your request, in 1.0.28. More details
  rates each dimension 1–5, by keyboard or click. Each rating drives its dimension, and
  goals about a dimension move by its rating.
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

### The calendar as the main screen (1.0.30)

Today is the first tab: your day planned out, with the week strip, the month grid on M,
"How did it go?", ideas and goals. Plans take three tap-and-key steps. Profiles get
**Plan something** and **Key dates**. Windows delivers the reminders, summaries and
"How did it go?" with Layers closed, with Done, Log it and Snooze buttons. See [The
calendar](#the-calendar-built-in-1030).

### Rings brand, fewer keystrokes, tidier Journal (1.0.29)

- **Brand: direction A, Rings**, chosen from four drafts ([branding/README.md](../branding/README.md)).
  - `npm run brand:render` draws it into the exe and installer icon (`icon.ico`, with
    simplified 16–32 px images), the tray icons (16 px and `@2x`), the installer's side
    panel and the favicon.
  - The empty People view and onboarding have Rings illustrations in the theme's colours.
- **Less typing**:
  - "Something new" offers tap-to-add suggestions for every category. Interests use the
    topic lists; the others use `INFO_TEMPLATES`.
  - "How did it feel?" builds the reflection from tapped phrases (`REFLECTION_TEMPLATES`),
    with typing optional.
- **Journal**: the time and type filters fit on one line each; see Decisions to review.

### Quick log redesign and polish (1.0.28)

You asked for the quick log to stay quick, with extra details in their own pop-ups, for
the date overlap to be fixed, and for better fonts, colours, assets and motion.

- **The quick log**:
  - It's titled after what's logged ("Talked with Priya").
  - It asks only for the date (a small chip), how meaningful it was and a note.
  - Rate each part, Active listening, Something new, Goals moved and How it felt are
    chips. Each one opens its own small sheet, and once filled in its chip shows a
    summary.
- **Keyboard**: every step has keys, shown next to what they do: 1–2, 1–6, Enter, 1–5,
  N, D, R, L, I, G, F, and Backspace to go back
  ([app-structure.md](renderer/app-structure.md#keyboard-shortcuts)).
- **The date overlap**: the date button showed through "Add detail". Each sheet is now
  its own layer.
- **Colours**:
  - Text on the accent colour is dark in dark mode (it was white on light blue, about
    2.5:1).
  - The sheet backdrop is darker in dark mode, and toasts are light there.
- **Motion and controls**:
  - Sheets slide away when closed, and steps slide forward and back.
  - Choices pop when picked; tiles lift on hover; buttons press in.
  - Sheets have a handle and a back arrow, text boxes glow while you type, and the type
    is a little tighter.

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
