# Field Log — Feature List & User Guide

*Con Edison Construction Representative field app · Bronx, NY*
**Live:** https://darkfr0g.github.io/FieldLog/ · current version shown in the header of every page.

Field Log runs entirely in your browser, works offline, and installs to your iPhone home screen like a native app. Your data lives on the device and (when signed in) syncs privately across all your devices.

---

## Quick start

1. Open **https://darkfr0g.github.io/FieldLog/** on your iPhone in Safari.
2. **Share → Add to Home Screen** → it becomes an app icon.
3. **Settings → Sync & Account** → enter your email + a password (first time creates the account) so your data follows you to all 4 devices.
4. On the **Route** tab, load the day's `.xlsx` route sheet → everything flows from there.

**Installing on a laptop:** open the link in Chrome/Edge → click the install icon in the address bar (or menu → "Install Field Log"). In Safari on Mac: **File → Add to Dock**.

---

## The five tabs

Field Log is organized into five tabs along the bottom: **Route · Day · Jobs · History · Settings**.

### 1. Route — load the sheet, see your assignments

- **Load a route sheet:** drag-drop or tap to browse for the `.xlsx`. The work **date** is read from the file name (falls back to the Summary tab). Parsing works **offline**.
- **Date + summary line:** shows the route date and "*N job rows → N DLR blocks*."
- **Assignment tabs:**
  - **Flavin (Covering)** — jobs you're covering.
  - **Owned** — jobs you own.
  - **All jobs** — everyone's jobs, with filters (contractor / inspector / type of work), sort, and a copyable **WR#/WO# summary** at the bottom.
  - **CRs** — the CR/inspector attendance roster (IN / Out / Nights). **Tap a name to see that inspector's jobs.**
- **Contractor filter chips** — themed by contractor color; tap one to show just that contractor's jobs.
- **CCI bar** — coordinator attendance across the top (one line).
- **Job cards** show location, Ticket #, Contingency, contractor + foreman, work description, WO#, permit hours, CCI, job owner, Code 753, and the **Urgent Tasks** pills (Contingency / Hold Point / Pressure Test).
  - **Text foreman** — green button opens Messages pre-filled ("Good morning, I'm covering you on…").
- **Foreman spread** — a covered job flags **"Foreman also on N other jobs →"** when that foreman is assigned elsewhere; tap it (or a lead's name) to see every job that foreman is on and which CR covers each.
- **Buttons:**
  - **Generate DLR from Route Sheet →** builds your Day blocks.
  - **Map my stops (Google Maps)** — see *Map My Stops* below.
  - **View spreadsheet** — read-only grid of the actual uploaded workbook, tab per sheet (syncs across devices).
  - **Load another file** / **Clear loaded route** (wipes the loaded route on this device).

### 2. Day — the Daily Log Report (DLR)

The working page for the day's crews.

- **Header:** the work date, a **Save** button, **Refresh ↻** (pull latest from other devices), the "synced … ago" stamp, and the version.
- **Job blocks** (generated from the route, or **+ Add Crew** manually):
  - Job number, **WR# / WO#**, location, contractor color, and **crew leads with their ITS#** (ordered Labor → Mechanic → Welder).
  - **Urgent Tasks** row: **Contingency**, **Hold Point**, **Pressure Test** pills — colored when active.
  - **Hold Point info →** — opens a sheet with the WR#, Contractor, and Foreman as tap-to-copy rows plus a button to open the Con Edison Hold Point portal (the portal auto-fills the rest from the WR#).
  - **Equipment** and **Employee Trades** with +/– counts. **Tap an item's name (⇄) to swap it** for another (e.g. Backhoe → Excavator) keeping the count. Default crew pre-fills Foreman, Operating Engineer, Laborers×4, Flagger×2, Chauffeur, Pick Up Truck, Backhoe, Compressor Truck, Dump Truck.
  - **Comments**, optional **T&E**.
- **WR#/WO# list** at the bottom — WR# on one line, WO# on a separate line (cWorx prefers WO#s), each value **color-matched to its job block**, each with its own **Copy** button.
- **Actions:**
  - **Submit Log** — saves the day to History.
  - **Share to Notes / OneNote** — clean plain-text report to the iOS share sheet.
  - **Copy formatted (table)** — rich text with a real table for pasting into Notes.

### 3. Jobs — your persistent job ledger

A running list of every job you've been assigned, building up across every route sheet you load.

- **Active / Completed** sub-tabs.
- Jobs are deduped by **WR#/WO#**; each row shows location, WR#/WO#, contractor color, and a **"field data"** flag when you've recorded details.
- **Tap a job → Field Data** (your cut sheet), which stays attached to that job permanently:
  - **Location/Crew:** Contractor, Foreman, Mechanic.
  - **Address:** House No, Street Name, Left/Right Cross Street.
  - **Field Measurements:** POE (LRW/RLW), CL→PL, PL→BL, CL→BL, Main, Cover, Service, Street Width, Main Connection, Customer POE.
  - **Cuts:** Cut 1–5.
- **Save field data**, **Share / copy field data** (clean text export), **Mark finished** (moves the job to **Completed**), or **Delete**.

### 4. History — your daily journal

Every calendar day gets a slot, grouped by month.

- **Months** are headers with a log count and are **collapsible** (tap to fold; it remembers).
- Within a month, days are grouped into **Sunday-start weeks**; a week that crosses a month shows a **↑ / ↓** arrow.
- **Days with a submitted log** are expandable cards — **Edit** (edit the log right in place: location, tickets, foremen, trade/equipment counts, comments, T&E), **Open in Day** (load it into the full Day editor), **Duplicate / Copy / Share / Delete**, an **EDITED** badge, and the saved time.
- **Days with no log** show a slim **"No log — tap to start"** row (weekday empties in amber, weekends in indigo with a SAT/SUN pill) — tap to open the Day page for that date.
- **Search** (narrows to matching logs) and **sort** (date / created / last-edited).
- **Export** (top-right) → CSV or text report for a date range.
- One log per date — re-submitting overwrites it.

### 5. Settings

- **Sync & Account** — sign in / out, **Forgot password?** (emails a reset link).
- **Profile** — name, employee #, roll, vehicle, plate, phone, home address (seeds form headers and the Maps start point).
- **Master Lists** — edit your own Trades (19) and Equipment (21) lists.
- **Contingencies → Saved contingencies** — browse/load everything you've saved (see below).
- **Photos** — toggle the Hold Point → iOS "FieldLog Album" shortcut.
- **Data** — **Back up all data** (.json), **Restore from backup**, **Clear all data**.
- **Check for updates** (About) — forces the latest version.

---

## Key workflows

### Contingencies
Open from a job's **Contingency** chip (pre-fills that job) or **Settings → Saved contingencies**.
- Fields: Contingency #, Layout, Code 753/811, Contractor, Scope, Dimensions (L×W×D), two cross-street **pinpoints**, one or more **Facility/mains**, Additional comments, Inspector.
- **+ Add second excavation** — a second dig with its own dimensions, pinpoints, and main; it's numbered "2." in the email (leave its main blank to inherit the first one's).
- **Compose Email** (opens your mail app with subject + body) or **Copy formatted (bold)** (paste into the email body — no subject line).
- **Save contingency for later** — stores the whole form; reload any saved one to reuse/resend. Saved contingencies **sync across your devices**.

### Hold Point
- On the Day block, **Hold Point info →** gives you the three fields you type into the Con Edison Hold Point portal (WR#, Contractor, Foreman) as tap-to-copy rows, plus a button to open the portal. Enter the WR# there and it auto-fills the rest.
- The **Hold Point** chip also copies a standardized Photos album name (and can fire the iOS "FieldLog Album" shortcut if enabled in Settings → Photos).

### Map My Stops (Google Maps)
- Opens a sheet that routes **from Home → your stops → back Home** (round trip).
- **Home start/end** anchors frame the list; each stop has a **numbered badge**; reorder with the **↑ / ↓** controls (grayed at the ends), remove with **×**, or **+ Add stop**.
- **Smart order** does a free north→south sweep (a rough heuristic, not true optimization — real optimization is on the roadmap).
- **Area appended to each** (e.g. "Bronx, NY") improves geocoding accuracy.
- **Open route in Google Maps** or **Copy list**.
- Google Maps caps waypoints at ~9–10; you'll get a warning past that.

### Cloud sync

- **Devices out of step?** Settings → Sync & Account → **Force full re-sync** — run it on each device (signed in, online). It re-pulls everything from the cloud, merges newest-wins, and pushes back so all devices converge.

- Sign in once (**Settings → Sync & Account**) and everything mirrors to your **own private Firebase** so your 4 devices share one dataset.
- Local-first: the app fully works offline; it syncs when you're online and signed in.
- **Newest change wins** per record; deletes stick (they don't resurrect).
- The **Refresh ↻** button on Route/Day/History pulls the latest immediately; a "synced … ago" stamp shows freshness.

### Backup & restore
- **Settings → Data → Back up all data** exports a `.json` with your logs, drafts, master lists, **saved contingencies**, and **jobs**.
- **Restore from backup** merges it back in (and, when signed in, re-syncs to your account). This is also how one-off imports (like pre-made contingencies) get added.

---

## Keyboard shortcuts (laptop/desktop, on the Day page)

| Shortcut | Action |
|---|---|
| **Ctrl / ⌘ + S** | Save draft |
| **Ctrl / ⌘ + Alt + S** | Submit Log |

---

## Tips

- **Updating:** home-screen apps can't be hard-refreshed. The app checks for a new version on launch and shows a "New version ready" banner; **Settings → Check for updates** forces it. The version is shown on every page — make sure all your devices read the same one.
- **New icon after an update:** iOS doesn't auto-update the home-screen icon — delete and re-add the shortcut to refresh it.
- **Notes look best** with the font set to **Monospaced** (the Aa toggle) so the crew/equipment columns line up.
- **Reload the route sheet** after a big update so newly-added data (like foreman ITS#, the jobs ledger, the raw-sheet viewer) populates.

---

*This guide is kept in the repo (`USER_GUIDE.md`) so it syncs to every device through GitHub. If a feature changes, the guide is updated alongside it.*
