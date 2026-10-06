# Roadmap

Where Layers stands against [vision.md](vision.md), what was decided along the way, and
what comes next. Last updated 2026-10-06, after 1.0.32 (anything since is at the top of
[History](#history), marked not released yet).

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
| Onboarding | ✅ Done | Three steps with a progress bar: you, your people (tap or type, with how close they are), and notifications. Restore from a backup is offered too. Name and focus can be changed in Me. The focus drives Today's "Try this next". |
| Sample data separable | ✅ Done (1.0.28) | "Remove sample people" keeps yours, and "Add sample people" adds them alongside your own. |
| Works with zero people | ✅ Done | Checked by both the app tests and the end-to-end tests. |
| Data-model migration | ✅ Done | Saved data has a version number (2), and older saves are migrated once at startup. Old dates, skill history and login items are upgraded in place too. |
| People & Layers | ✅ Done | Every layer change gets a dated timeline step. Logging keeps the dimensions inside the layer (P3 option C), so Adjust agrees with the layer shown, and its preview shows any change of percentage. |
| Goals | ✅ Mostly | Skill goals move with their skills (1.0.28). Goals linked to a reminder move when it's logged. Every part of a goal works by keys (2026-10-06), and logs record the goals they moved. |
| Coach, Prepare | ✅ Done (1.0.28) | Hooks come from all saved interests, plans, preferences, things to ask about, recent topics and reflections. Personal experiences are kept for Layer 3 and closer. |
| Coach, Analyse | ✅ Works (sample conversations) | It's still a prototype on four sample chats. Real screenshot analysis is a later idea. |
| Social skills | ✅ Done | The chart records points, and achievements are stored with dates. Strength and focus come from your real levels. |
| Journal | ✅ Done (1.0.28) | Edit or delete an entry. Filters by person, type and period, plus search, which includes reflections. Every filter row fits on screen (1.0.29). |
| Logging flow | ✅ Done | The quick log asks only for the date, how meaningful it was and a note. Each extra (ratings, active listening, something new, goals, reflection) opens in its own small sheet from a chip. Every step works from the keyboard. |
| Calendar and reminders | ✅ Done (1.0.30) | Today is the main screen and the centre tab: your day, the week and month, plans in three steps (or lots at once), key dates, ideas, and Windows notifications that arrive with Layers closed. Reminders snooze; "How did it go?" logs or ticks. |
| Me / Settings | ✅ Done | Profile, notifications, backup, privacy and sample controls. |
| Keyboard shortcuts | ✅ Done | All of them work (the list is under `?`), and the planning and logging steps show their keys. Esc closes only the top sheet, and Ctrl/Alt combinations don't trigger single-key shortcuts. |

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
- The filters are: past week, past month and 3 months. *(Built 2026-10-06: logs now record the goals they moved, so the goal filter is there; logs from before then aren't under any goal.)* A goal filter was skipped because
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

## Drafted next (2026-10-06)

Everything still open, in one place, drafted on 2026-10-06 after the plan fixes. It
replaces the older lists (what was left of "after the second live test", the smaller
fixes and the deferred ideas). Within each group, the order is the suggested one.

**Your answers (2026-10-06):** release 1.0.32 now; **all of B and C** in the next batch,
with **Add photos from a folder** (7); and **Layers on your phone** (9) as the next big
task, starting with a proposal. Each piece is committed and installed on its own, and
anything that turns out bigger than drafted comes back to you first.

### A. Release 1.0.32 ✅ Released 2026-10-06

Built since 1.0.31 and so far only on this laptop: initials and photos as avatars (new
people start as initials in their layer's colours), **Every weekday** for plans, and
copies of a plan no longer called overlaps. Smart App Control is checked first, as
always. **Yes: now, before the next batch.**

### B. Small: finish the keyboard ✅ Built 2026-10-06

1. ✅ **Keys for the sheets that still need the mouse**: the full goal editor (Goals, and
   Edit on a goal), **Add info** on a profile, **Edit your profile** in Me, the interest
   picker, and Coach's **Prepare**. The same pattern as the rest: a letter for each
   section, 1–9 for choices, Esc or Tab out of a text box, Enter saves.
2. ✅ **The goal-variant chevron** by keyboard (V on a goal card).
3. ✅ **Focus**: moves into a sheet when it opens and back to where you were when it closes,
   and the icon-only buttons get labels (for screen readers, and tooltips).

### C. Small: setting up and plans ✅ Built 2026-10-06

4. ✅ **Key dates while setting up**: a birthday (or another date) on each person's card,
   by keys (D, then the day and month).
5. ✅ **Change one day of a repeating plan**: editing a repeating plan asks **This day
   only** or **Every time**, so Thursday's check-in can move to 4 PM without changing the
   rest. Today a change always applies every time it repeats.
6. ✅ **Goals on journal entries**: each log keeps which goals it moved, the Journal gets a
   goal filter (as the vision lists), and a goal shows the logs that moved it.

### D. Photos for your people

Your `PFP` folder has nine pictures (eight screenshots and a WhatsApp photo), not named
after anyone. Two ways to use them; **you picked 7, built 2026-10-06** (see History):

7. ✅ **Add photos from a folder**, in Layers: pick a folder, and it shows each picture in
   turn with the crop circle already on the face's middle; 1–9 or a name picks who it's
   for, S skips, Enter goes on. One Undo for the lot. Everything stays on this computer.
8. **I crop them for you** now: you say who's who, and I make a square, centred,
   evened-out copy of each to add with U. Opening them here sends them to Anthropic.

### E. The next big task: you picked Layers on your phone

9. **Layers on your phone** *(picked)*: the proposal is
   [below](#proposal-layers-on-your-phone-2026-10-06), waiting for your answers.

The other three stay here for later:

10. **Your other calendars** (school, uni, work, Google or Outlook): read-only first,
   from a calendar's private link, so Today shows your timetable and planning warns about
   clashes. Two-way later. It saves typing in things like Mentor every weekday.
11. **Activity and a one-page summary**: a GitHub-style calendar of the last six months
   on each profile (and one for everyone on the Journal), shaded by how much and how
   meaningful; tapping a day filters the Journal. **Export summary** makes a one-page PDF
   of someone: layer, dimensions, what you know, timeline, goals and recent logs.
12. **Real conversation analysis**: Analyse a pasted or screenshotted chat instead of the
   four samples. It needs an AI model: a local one (private, but heavy) or a cloud one
   that runs only when you ask, with a clear warning. The privacy principle comes first,
   so it needs its own decision.

### F. Housekeeping (nothing you'd notice; these can just be done)

13. **Stale-build guard** for packaging by hand: fail if `electron/app/index.html` is
    older than `src/` ([known-issues.md](known-issues.md)).
14. **Analyse: more suggestion tones.** Only "continue the topic" has natural, playful
    and deeper versions; two sample chats have none.
15. ✅ **`PFP/` kept out of git**, in this laptop's own exclude list (`.git/info/exclude`),
    so local builds aren't labelled "uncommitted" and releases aren't held up by it.

### Later, or dropped

- **Other avatar styles**: drawn faces, one flat emoji set, a rings monogram, line icons.
- **Code signing** (P8): only needed for other people's laptops.
- **The 20-question survey** for someone you already know: covered by the closeness
  questions ("How close are you two?" when adding, "Where are we now?" on a profile).
  Dropped unless you still want the longer version.
- Already done from the old lists: a version number on saved data, Undo for deletes,
  per-dimension ratings and desktop notifications.

## Proposal: Layers on your phone (2026-10-06)

You picked this as the next big task, starting with a proposal.

**Your answers (2026-10-06):** the recommended plan, starting with step 1 now; **no
Mac**, so GitHub's macOS machines build it; the sync file in **OneDrive**. Step 1 is
built (below); the Apple Developer account is needed at step 3.

### Where it starts from

Layers is already a web app inside a Windows shell (Electron), laid out phone-first, and
its logic (`src/lib/`) has no Windows-only code. The Windows parts (notifications handed
to Windows, the tray, the quick-add box, backups to a folder) go through one bridge
(`window.layersSystem`), so a phone can supply its own. What isn't ready is **syncing**:
only plans carry `updatedAt`, and deleted things aren't remembered, so two copies can't
be merged yet.

### The routes

| | How | Good | Costs and limits |
|---|---|---|---|
| **A. A home-screen web app** | The same Layers at a web address; Safari's "Add to Home Screen" | Free, quick, works offline | Its data lives in Safari's storage for that site. A reminder at a set time needs a push server (iPhone web apps can't schedule their own). The page has to be hosted somewhere public (the code, not your data). |
| **B. An iPhone app from the same code** *(recommended)* | Capacitor wraps the web app in a native iPhone app | Reminders scheduled on the phone itself, no server; a proper icon; room for Face ID later | The Apple Developer Program (US$99 a year), to put it on your phone through TestFlight or the App Store. Building needs macOS: a Mac, or GitHub's macOS build machines. |
| **C. A new native app (Swift)** | Rewritten for iPhone | The most native feel; the Watch shares it | A rewrite, against the working principles, and months of work |

The **Apple Watch** needs a small native watchOS app alongside B (Capacitor doesn't do
watches). It comes after the phone.

### Keeping the laptop and phone in step

1. **Backups only**: export on one, restore on the other. Works today, but it replaces
   everything each time.
2. **A sync file in your own cloud folder** *(recommended)*: your Documents folder is
   already in OneDrive (the daily backups land there). Both copies of Layers would read and
   write one **encrypted** sync file in it, with a passphrase only you know, merging record
   by record by when each last changed. Microsoft would only ever see scrambled data, and
   there's no server of ours. The riskiest part is the phone reaching that file (through
   the Files app's OneDrive or iCloud Drive), so it gets checked first.
3. **A small sync server**: changes arrive at once, but it's a server to run, pay for and
   trust with your data, even encrypted.

### Suggested steps, each usable on its own

1. ✅ **Sync-ready data** (nothing you'd see; built 2026-10-06): `updatedAt` on people, logs and goals as
   well as plans; deleted things remembered for a while; a merge with thorough tests. It
   helps the laptop on its own too (safer restores).
2. **The phone check**: try OneDrive's or iCloud's folder from a test iPhone app, before
   anything else depends on it.
3. **The iPhone app** with Capacitor: built on GitHub's macOS machines, on your phone
   through TestFlight. Reminders through Capacitor's local notifications, from the same
   `plannedNotifications` the laptop uses. Touch-sized controls where the laptop leans
   on keys.
4. **Sync** between the two through the encrypted file.
5. **The Watch**, later: today's plans, and "How did it go?".

### What it needs from you

- An **Apple Developer** account (US$99 a year), in your name.
- Whether you have a **Mac** (otherwise GitHub builds it).
- Where the sync file lives: **OneDrive** (already on the laptop) or **iCloud Drive**.
- A **passphrase** for the sync file, kept by you; Layers can't recover it.

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
- **Where it lives:** Today is the centre tab (Ctrl+3) and the screen Layers opens on.
  Ctrl+2 is People, whose map shows how close you are. The month grid is a Day/Month
  switch at the top of Today (or M).
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

**Changed after you tried it** (2026-10-04):
- Reminders before a plan, or as it starts, only offer **Snooze** (10 min, 1 hour,
  Tomorrow). Log it and ticking off wait for "How did it go?", since nothing has
  happened yet. The same goes for an open plan in Layers: before it starts it offers
  Edit, Plan it again and Delete.
- Today moved to the **centre tab**, swapping places with Coach. Ctrl+1–5 follow the tabs,
  so Today is Ctrl+3.
- **Putting in a lot of plans:** **Save + another** (Shift+Enter) keeps the planning sheet
  open for the next one and lists what's been added; **Several days** saves the same plan
  on each day picked; **Mon–Fri** for weekly routines; **Plan it again** (C) copies a plan.
- **Fewer clicks:** 1–9 or typing a name picks people when logging or planning; on
  "When?", 1–7 picks the day and T, L, R, A and G step through time, length, repeat,
  reminder and goal; on Today, L and J answer "How did it go?" and I plans the first idea.

## Next big task: quality of life (decided 2026-10-05)

Your answers to ten quality-of-life questions. All ten are built: the quick wins (3, 8,
9 and 10), the notifications (4, 6 and 7), and the bigger pieces (2, 1 and 5)
[described below](#drafted-next-ctrlk-the-wide-layout-and-the-quick-add-box).

| | Question | Your answer |
|---|---|---|
| 1 | Use more of the laptop screen? | **Wider on desktop**: when the window is wide, the month grid beside your day and the people list beside a profile; still phone-sized when narrow |
| 2 | A Ctrl+K box to jump anywhere? | **Yes, everything**: people, plans, pages and actions ("plan coffee", "dark mode", "export") |
| 3 | Undo after deleting, ticking or logging? | **Undo on all of them**, for a few seconds, on the message at the bottom. ✅ Built: 7 s, or Ctrl+Z |
| 4 | Rate a plan from its "How did it go?" notification? | **Both**: rate 1–5 right in the notification (saved as a quick log), or Log it for the full log. ✅ Built: Casual, Good, Personal and Deep (2 to 5; Windows allows five buttons, so "very brief" is left to the full log), and Log it… |
| 5 | Ctrl+Shift+L from anywhere in Windows | **A tiny quick-add box**: log or plan in a few keys without the full window |
| 6 | Nudges to keep in touch | **A weekly catch-up list** (who you haven't seen, with Plan buttons) and **a notification when someone close goes quiet** (Personal or Close, past their usual gap). ✅ Built: the list on Saturday mornings (the day can be changed in Me); "gone quiet" once, at noon, when it's been half as long again as usual |
| 7 | A weekly review? | **Sunday evening**: a notification opens your week (who you saw, plans done, goals moved), then plan next week in one go. ✅ Built: Sundays at 7:00 PM, an hour before the evening heads-up; W on Today opens it any day |
| 8 | How early for birthdays and key dates? | **A week before, the day before, and on the morning**. ✅ Built, with a Plan something button; a switch in Me |
| 9 | Automatic backups? | **Daily, keeping the last 14**, in a Layers backups folder. ✅ Built: Documents\Layers backups, shown in Me |
| 10 | Light and dark mode | **Follow Windows**, changing when it does. ✅ Built: "Match Windows" is the default, Light and Dark still in Me |

## Drafted next: Ctrl+K, the wide layout and the quick-add box

The three bigger quality-of-life pieces (2, 1 and 5 above), drafted on 2026-10-05 with
your answers to four more questions (in bold), and built the same day, each installed on
its own. Changes made while building are marked.

### Ctrl+K: jump to anything ✅ Built

- **Ctrl+K** anywhere in Layers, even over a sheet, opens a box at the top with the
  cursor in it. `/` stays as the people and journal search.
- **Empty**, it lists your next plan, the last few things you jumped to, and Log and
  Plan.
- **Typing** shows the best matches first, up to eight:
  - **People**, by any part of the name or by initials. **Enter opens their profile; →
    or Tab shows Log, Plan and Prepare** for them. "plan priya", "log sam" and "prep
    alex" go straight there.
  - **Plans** from two weeks back to four weeks ahead, by title or person. Enter opens
    the plan on its day.
  - **Pages**: Today, Month, People, Coach, Journal, Me, Goals and Your week.
  - **Actions**: Log, Plan, Add a person, New goal, Add photos from a folder (2026-10-06), Light, Dark, Match Windows, Export a
    backup, Restore from a backup, Open the backups folder, Check for updates, Keyboard
    shortcuts, and Start over (which only opens its sheet). *(Changed while building: New
    goal and Restore in place of Add a key date, which needs a person first.)*
  - **A sentence**, read the same way as the quick-add box below: "coffee with priya fri
    10am" offers "Plan: Coffee with Priya, Fri 9 Oct, 10:00 AM" as the top row.
- **Keys**: ↑ and ↓ move, Enter picks, → shows a person's actions, ← goes back, Esc
  closes. *(Changed while building: numbers don't pick rows, since they're part of what
  you type, like "fri 10am".)* Enter saves a typed plan or a rated log at once, with Undo;
  **Ctrl+Enter** opens it in full instead.

### Wider on desktop ✅ Built

- When the window is about **900 px wide or more** (maximised, or dragged wider),
  Layers fills the window instead of the phone-shaped card. Narrower, it stays exactly
  as now.
- **Today**: your day on the left and the **month grid always on the right**. Clicking a
  day in the month shows it on the left, so M isn't needed (it still works).
- **People**: the **list on the left and the open profile on the right**. The list stays
  while you go from person to person; Backspace closes the profile.
- **Coach, Journal and Me** (and Goals): one centred column 760 px wide, so lines don't
  get too long to read.
- **The tabs stay as the bottom bar**, with the sliding pill.
- **Sheets** open as a centred panel 540 px wide, rather than across the whole window
  from the bottom. Their keys don't change.

### The quick-add box: Ctrl+Shift+L ✅ Built

- **Ctrl+Shift+L** anywhere in Windows opens a small box at the top of the screen, over
  whatever you're doing, without bringing up the Layers window. Layers has to be
  running, in the tray, as it is after login.
- **Type a sentence**; a preview underneath shows exactly what will be saved, and
  **Enter saves it**. Esc, or clicking somewhere else, closes the box without saving.
- **Plans**: "coffee with priya fri 10am", "dinner with sam and alex tomorrow 7pm 2h",
  "gym every mon wed fri 7am", "call mum sunday".
  - **Who**: the names of people in Layers; a first name is enough. A name Layers
    doesn't know stays in the title, and the preview says so.
  - **What**: coffee, call, dinner or lunch, hang out, study and check in pick that
    template. Anything else ("gym") becomes the title.
  - **When**: today, tomorrow, a weekday (the next one), "next fri", "12 oct" or "12/10"
    (day first). Times like "10am", "7:30pm", "19:00" or "noon". Without a time, the
    template's usual one (coffee 10:00 AM, call 6:00 PM, dinner 6:30 PM).
  - **How long**: "2h" or "90m", or the template's usual length.
  - **Repeats**: "every day", "weekdays" or "every mon wed".
- **Logs** start with "log" or say what happened: "log priya deep", "talked to sam",
  "coffee with alex yesterday good". A rating word (brief, casual, good, personal, deep)
  or 1–5 sets how meaningful it was; without one, the preview asks for a number. It's
  saved as a quick log, like rating from a notification.
- After saving, the box shows "Saved" with what was added, then closes. **Ctrl+Z**, in
  the box or in Layers, undoes it.
- **Ctrl+Enter opens it in Layers** instead: the full plan or log sheet, filled in, for
  anything a sentence can't say.
- **Ctrl+Alt+L opens Layers itself**, which is what Ctrl+Shift+L used to do. Me lists
  both shortcuts, and says if another app already uses either.

**Defaults chosen** (each is easy to change):
- the 900 px width
- Ctrl+Alt+L to open Layers
- dates read day first, as in New Zealand
- a log without a rating asks for one rather than guessing

**How it's built**, so each piece stays contained:
- **Ctrl+K**: `lib/jump.js` finds and ranks the matches, and `JumpSheet` shows them.
- **Wide layout**: a CSS breakpoint, plus a `useWide()` hook for the two split pages. The
  narrow layout's code is left alone.
- **Quick-add**: `lib/sentence.js` reads the sentences (shared with Ctrl+K, with many
  unit tests). A second small window (frameless, on top, kept off the taskbar) loads the
  same page in quick-add mode. It hands what you typed to the main window, which saves it
  as if you'd done it there.
- **Tests**: app tests for all three, and an end-to-end test that opens the real quick-add
  box in the packaged app, with a temporary data folder as always.

## History

### Ready for syncing (after 1.0.32, not released yet)

Step 1 of Layers on your phone. Nothing looks different: what Layers saves (and every
backup) now says when each person, log, plan, goal and your profile last changed, and
what was deleted in the last 90 days. A merge that brings two copies together record by
record is written and tested, ready for the phone and the OneDrive sync file.

### Photos from a folder (after 1.0.32, not released yet)

- **Photos** on People (or Ctrl+K, "Add photos from a folder"): choose a folder, then go
  through its pictures one at a time. Each starts in the circle (the upper middle of a
  portrait, where a face usually is). **1–9** or typing a name picks who it's for, and a
  picture named after someone ("Kai.jpg") starts on them. **Shift+arrows** move it and
  **+ −** zoom (or drag and the slider). **Enter** uses it and goes on, or skips it with
  nobody picked; **Backspace** goes back.
- At the end, Enter gives everyone picked their photo, with **one Undo** for the lot.
  Only the small circle is kept, on this computer.
- **Finding faces** *(you said yes)*: each picture starts on its face. Rather than
  bundling a model, Layers asks **Windows' own face detector** (the one the Photos app
  uses), once for the whole folder, on this computer; it found the face in all nine of
  your PFP pictures in under two seconds. Pictures without a face start on the upper
  middle. The avatar picker's single Photo does the same.

### Keys for the last sheets, and focus (after 1.0.32, not released yet)

- **A goal** (Add goal on a profile or Goals, and Edit): **1–7** a relationship goal,
  **S** the next skill goal, **C** your own, **V** its more specific versions (the
  chevron is a proper button now; 1–6 pick one), **E** the description, **D** a due
  date (2 weeks, a month, 3 months, none), **← →** who it's for, **Enter** creates it.
- **Add info** on a profile: type straight away, Esc, then **← →** the icon and **T**
  temporary; Enter saves. The **+** beside each section is labelled ("Add to
  Interests").
- **Your profile** in Me: **N** your name, **1–4** your focus, Enter saves.
- **Coach, Prepare**: **← →** who you're about to talk to, **L** log the conversation,
  **A** analyse a chat with them, **O** their profile; **1** and **2** switch Prepare and
  Analyse.
- **Focus** moves into a sheet when it opens and back to where you were when it closes,
  for Tab and screen readers. A dialog that deletes something starts on **Cancel**, so
  Enter there is safe. The calendar picker's month arrows are labelled too.

### Key dates while setting up (after 1.0.32, not released yet)

- Each person's card while setting up has **🎂 Birthday**; **D** adds one for the newest
  person. Type the day ("14 Mar", "14/3", or with the year, "14 March 2008"), then
  Enter. Another date (an exam, an anniversary) works the same way after the birthday.
- The same typed box is in **Add date** on a profile, with **Y** for every year or just
  once and Backspace to go back. The calendar picker is still there.

### Goals on journal entries (after 1.0.32, not released yet)

- Each log remembers which goals it moved. The Journal says so on the entry ("Moved:
  Learn more") and has a **goal filter** (the 🎯 list, under the periods). Logs from
  before today don't record it, so they aren't under any goal.
- A goal that logs have moved shows **N logs** (on Goals and on the profile), which opens
  the Journal on them.

### One day of a repeating plan (after 1.0.32, not released yet)

- Editing a repeating plan from one of its days asks what to change: **Only Thu 8** (O)
  or **Every time**. Only that day makes it a plan of its own, so it can move to another
  time or day, or be renamed, and the repeat skips that day. Every time is as before.
- **Deleting** it asks the same: Only that day, or Every time. Both have Undo.

### Every weekday, and copies of a plan (1.0.32)

You found that editing a plan couldn't make it every weekday, and that it said it
overlapped itself. Your five "Check in with Alexa" plans were five copies from **Several
days** (Mon 5 to Fri 9); moving one onto another's day warned about the other copy.

- **Repeat** has **Every weekday** (Monday to Friday), also when editing; R reaches it.
  Plans already set to Mon–Fri open on it. Everywhere a plan's days are shown, Mon–Fri
  reads "Every weekday".
- Editing one of several copies (the same title, people and time), a copy on the same
  day is called a copy, not an overlap.
- Making that copy repeat replaces the copies on the days it now covers, so it's on each
  day once. The sheet says so before you save, and the message has Undo. Copies already
  ticked off stay.

### Initials and photos as avatars (1.0.32)

You said the emoji avatars still didn't look quite right, and picked initials and photos
from six styles (the others were drawn faces, one flat emoji set, a rings monogram and
line icons; say if you want any of them later).

- **Initials** ("EM" for Ethan M, "Is" for Isla), in their layer's colours (which change
  as they move) or one of eight others. **New people start this way**; you can pick
  anything else.
- **Photos**: Photo in the avatar picker, **U** (or Choose a picture) opens the file box,
  then drag or the arrows move it in the circle and the slider (or + and -) zooms. Only a
  small 160 px circle is kept, on this computer and in your backups.
- The picker's groups are now Initials, Photo, People, Faces, Animals and Things (G).
  Avatars people already have are unchanged.

### Second live test (1.0.31)

What you found trying it again on 2026-10-05, and what changed:

- **People in a wide window** starts as the list on its own in the middle; picking
  someone slides it to the left with their profile beside it, and closing the profile
  slides it back. **Add person** is a big button first in the row, next to the search
  box, and **A** on People does the same.
- **A key into every note box, and out again**: the quick note shows **N** on its right,
  and **Esc** once you're in (Tab leaves too). The same goes for editing a journal entry
  (N for the note, F for how it felt, 1 to 5, Enter saves), How it felt, Something new,
  and Add detail, which now has keys too: 1 to 9 and 0 for its topics, N for your own
  words, Backspace back.
- **Redo**: **Ctrl+Y** (or Ctrl+Shift+Z) puts back what Ctrl+Z took away, while "Undone"
  shows, which now has a Redo button too. It won't redo once something else has changed,
  since that would be lost.
- **Ctrl+K, a person's actions by letter**: after → or Tab on someone, **O** opens them,
  **L** logs, **P** plans and **R** prepares to talk. The highlighted person says "log,
  plan, prepare →".
- **Quick add**: **w** is short for **with** ("coffee w priya fri 10am", "movie w sam sat
  7pm"; "w/sam" works too), and a word like movie, games or revise names the plan
  ("Movie with Sam") rather than "Activity with Sam". The box closes 40% sooner after
  saving (under a second). **Ctrl+Y** redoes an undo there, and opened again within a few
  seconds the empty box says what was just saved, so Ctrl+Z still undoes it.
- **Ctrl+Alt+L sends Layers back** when it's already in front (minimised, so the app you
  were in comes back), and brings it forward otherwise.
- **"How close are you two?"**: adding someone asks a few quick questions, from "Would
  they say hi if you passed in a corridor?" to "Would you watch a movie together, just
  the two of you?" and "Could you sit in silence and it still feel comfortable?". **Y**,
  **S** or **N** answers (Yes, Sort of, No), Backspace goes back. It stops once the answers
  stop being mostly yes, so an acquaintance takes two questions and a best friend eleven,
  then shows where that puts them (Layer 2, 60% in, say); **1–4** picks another layer,
  **Q** asks again, Enter adds them there. **L** skips the questions.
- **A better avatar picker**, when adding or editing someone and while setting up: 40
  people (with hair, ages, jobs), faces, animals and things, in groups (**G**), with skin
  tones for people (**T**) and the arrows to move through them, a big preview beside the
  name, and the grid shown in the tone you've picked. Avatars you already have are all
  still there. **/** finds one by name ("dog", "red hair"). While setting up, tapping
  someone's avatar (or **A** for the newest) opens it.
- **The People list from the keyboard**: ↑ ↓ mark people, closest first, and Enter opens
  them; beside an open profile ↑ ↓ go straight to the next. In the search box, Enter opens
  the first match.
- **Logging with someone already picked** (their profile, Ctrl+K's L) starts at "What did
  you do?".
- **Where are we now?** on a profile (or **W** on someone in Ctrl+K) asks the closeness
  questions again and moves them where the answers put them, with Undo.
- **Getting started** on Today, for a new circle: add your first person, log your first
  chat, plan your first thing, try Ctrl+K and the quick-add box. Each ticks itself off;
  Hide puts "Try this next" back.
- **Setting up**: **Shift+Enter** adds someone and asks the same questions (plain Enter
  just adds them), their card says where they landed, and **Questions** (Q for the newest)
  asks again. The first screen has
  keys too (Esc out of your name, then 1–4 for what brings you here, E to explore, R to
  restore), and the last one lists the keys worth knowing.

### The quick-add box (1.0.31)

**Ctrl+Shift+L** from anywhere in Windows opens a small box at the top of the screen.
Type a plan or a log ("coffee with priya fri 10am", "log sam deep"), check the preview,
and Enter saves it (Ctrl+Z undoes it); Ctrl+Enter opens it in Layers instead.
**Ctrl+Alt+L** now brings Layers forward.

### Wider on desktop (1.0.31)

From 900 px wide (maximised, or dragged wider), Layers fills the window: Today has the
month beside the day, People the list beside the open profile, the other pages a
readable centred column, and sheets open as a centred panel. The tabs stay at the
bottom. Narrower, it's the phone-shaped card as before.

### Ctrl+K: jump to anything (1.0.31)

People (→ for Log, Plan and Prepare), plans, pages and actions, "plan sam", and plans
or logs typed as a sentence ("coffee with priya fri 10am", "log sam deep"), saved with
Enter or opened in full with Ctrl+Enter. See
[Ctrl+K](#ctrlk-jump-to-anything--built) above.

### Live-test feedback (1.0.31)

What you found trying it on 2026-10-05, and what changed:

- **Picking people** (the number keys were hard to see, and stopped at 9): people are
  closest first, as on the People tab, with solid number badges. Past nine, type a name,
  or move with the arrows and pick with Space.
- **A plan's title was already filled in**: a title brought by Plan again no longer sticks
  when you go back and pick a template. **Esc or Tab leaves the title box** (any text box
  in a sheet with keys), so the keys work again; the next Esc closes the sheet.
- **A new goal wherever you log or plan**: **+ New goal** (`+`) on "When?" and on the
  log's Goals (now there even before someone has goals). Pick one of seven suggestions or
  write your own, optionally a more specific version (V) and a due date (D); Enter
  creates it, and the plan or log picks it.
- **The day popup**: on Today, ↑ ↓ move a week (← → still a day). **Enter**, or tapping the
  day that's picked, opens the day: its plans, key dates and logs; ← → move days, ↑ ↓ and
  Enter open a plan, P plans something. **Coach tips** (T) on a plan with people: tips
  for that kind of plan, what you know about them (what to follow up on, what you last
  talked about and noted, their interests), their key dates around it, and the goal it
  moves. An open plan has Coach tips too.

### Quality of life: notifications (1.0.31)

- **Rate a plan from "How did it go?"**: Casual, Good, Personal or Deep logs it without
  opening Layers and ticks it off; Log it… opens the full log.
- **Weekly catch-up list** (Saturday mornings) with Plan buttons, and a **"gone quiet"**
  nudge for Personal and Close people when it's been longer than usual.
- **Sunday review** at 7:00 PM: who you saw, plans done, goals moved, who to catch up
  with, then Plan next week. W on Today opens it any day.

### Quality of life: the quick wins (1.0.31)

- **Undo** on the message after a delete, a tick, a log or a saved plan, or Ctrl+Z.
- **Birthdays and key dates** remind you a week before, the evening before and on the
  morning, each with **Plan something**.
- **Daily backups** in Documents\Layers backups, the newest 14 kept; Me shows the latest
  and opens the folder.
- **Match Windows**: light or dark follows Windows, as it changes.

### Clearer pages, starting over, setting up (1.0.31)

You asked for the page you're on to stand out, a visual effect when opening a page, easier
plan setup, and a more thorough, easier "Delete my data and start over".

- **Which page you're on:** the tab sits on a glowing pill that slides to the new tab, with
  a ripple and an icon hop; the page slides in from the side its tab is on and starts at
  the top.
- **Planning:** **Plan again** (Q–R) repeats a recent plan in one key; "When?" sums the
  plan up in a line and warns when it overlaps something already planned.
- **Starting over:** choose what to clear (everything by default), save a backup in one
  key, then press and hold to delete. Clearing only some things keeps you where you are.
- **Setting up again:** a progress bar; Restore from a backup; people tapped from
  suggestions or typed, each with how close you are; notification switches; and Plan
  something first.

### The calendar as the main screen (1.0.30)

Today is the centre tab: your day planned out, with the week strip, the month grid on M,
"How did it go?", ideas and goals. Plans take three tap-and-key steps, and **Save +
another** and **Several days** put in a lot at once. Profiles get **Plan something** and
**Key dates**. Windows delivers the reminders (with Snooze), summaries and "How did it
go?" (Log it or Just tick it) with Layers closed. See [The
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
