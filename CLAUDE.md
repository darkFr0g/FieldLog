# CLAUDE.md — Field Log project brief

Context for any Claude Code session working on this repo. Read this first.

## What this is

**Field Log** — a single-page web app used daily by a Con Edison **Construction
Representative** for gas-utility construction inspection in the **Bronx, NY**.
It runs entirely client-side, works offline, and installs to the iPhone home
screen as a PWA. **Primary device is an iPhone** — optimize for that.

**Live:** https://darkfr0g.github.io/FieldLog/
**Repo:** https://github.com/darkFr0g/FieldLog

### Tools inside the app (4 nav tabs: Route / Day / History / Settings)
**Day** = DLR crews + Mileage merged onto one page (shared date header; the
Mileage section's stops derive from the day's DLR crews so locations live in one
place). Sections below described separately.
- **Route Sheet Extractor** — parses `.xlsx` route sheets (SheetJS), shows the
  inspector's assigned jobs and CCI staffing status. Inspector name defaults to
  "Jeremiah Flavin". Tabs: **Covering** / **Owned** (your jobs) + a one-at-a-time
  **contractor filter** chip row (themed per contractor logo color) + an **All
  jobs** view (everyone's jobs: location · contractor · WR#/WO# · inspector, with
  filter + sort + **type-of-work filter**). The 3 status pills — Contingency
  (yellow) / Hold Point (blue) / Pressure Test = Fusing Peer (red) — are
  collectively called **"Urgent Tasks"**; colored when active, grayed when not,
  and active ones show on the collapsed DLR crew block next to the foreman.
  **Hold Point** chip copies a standardized Photos album name (and can fire an
  iOS Shortcut named `FieldLog Album` when the Settings → Photos toggle is on).
  **Map my stops / Map drive** open Google Maps routed through the day's stops,
  cleaned by the smart address shortener (`shortAddr`).
- **DLR (Daily Log Report)** — generates crew blocks from the route sheet
  (grouped by WO# / Location), pre-filled with the standard crew
  (Foreman 1, Operating Engineer 1, Laborers 4, Flagger 2, Chauffeur 1,
  Pick Up Truck 1, Backhoe 1, Compressor Truck 1, Dump Truck 1). Add/remove
  trades & equipment per block,
  Comments, optional T&E. Saves to `localStorage`; exports CSV / text; **shares
  plain-text** to iOS Notes/OneNote and **"Copy formatted (table)"** copies rich
  `text/html` with a real table. ⌘S/Ctrl+S saves a draft on desktop.
- **Mileage** — daily odometer/mileage capture, the foundation for replacing the
  monthly Excel workbook (see below). Per day: Shift / OT (prominent) / Contact
  (CCI) / POET# / Work Code / Expenses / Notes (header carries from the previous
  day), plus stops pre-loaded from the **loaded route sheet** (location + ticket #).
  You enter **miles driven** per stop; one Start odometer carries the running
  total; computes per-leg + daily miles and the rolling end odometer. "Copy stops
  from another day", "Load from route", and "Map drive" buttons.
- **History** — lists submitted logs (Edit / Duplicate / Copy / Share / Delete),
  with search + sort (log date / created / last-edited) and an EDITED badge +
  saved timestamp. One log per date — re-submitting overwrites it.
- **Settings** — Sync & Account, **Profile** (name/employee #/roll/vehicle/plate/
  phone/home address — seeds form headers + the Maps start), master lists, Photos
  shortcut toggle, Data (backup/restore + clear), Check for updates.

Data (logs, drafts, master lists, mileage) lives in the browser `localStorage`.
**Optional cloud sync** mirrors it to the user's private Firebase so the user's
4 devices share one dataset (see "Cloud sync" below); with sync off, nothing
leaves the device.

## Architecture / conventions

- **No build step.** Plain static files served as-is. Don't add a bundler,
  framework, or npm unless explicitly asked — the simplicity is intentional.
- **Vanilla JS**, ES5-style (`var`, `function`), matching the existing code.
  No modules, no TypeScript. Keep new code in the same idiom.
- Files:
  - `index.html` — markup only (nav, 5 pages, modals, picker sheet). Loads the
    Firebase **compat** SDK (app/auth/firestore) from the gstatic CDN before
    `app.js` — these are plain globals, so still no build step.
  - `css/styles.css` — all styles (CSS variables in `:root`)
  - `js/app.js` — all logic (route parsing, DLR, mileage, history, export, share,
    cloud sync)
  - `vendor/xlsx.full.min.js` — SheetJS, **vendored locally** for offline use
    (do NOT switch back to a CDN — offline parsing in the field depends on this)
  - `manifest.json`, `sw.js` — PWA
  - `icons/` — app icons; regenerate all sizes from `icons/icon-source.png`
- **Version badge** lives in `index.html` (`.vbadge`) and is bumped every ship;
  keep it in sync with `CACHE_VERSION` mentions here.
- **Relative paths everywhere** (`./...`). The site is served from the
  `/FieldLog/` Pages subpath, so absolute `/` paths break it.

## Deploy

- **Push to `main` → auto-deploys** via `.github/workflows/deploy.yml`
  (GitHub Actions → Pages). No manual step; Pages source is already set to
  "GitHub Actions" in repo settings.
- After pushing, the live site updates in ~1–2 min. Verify via the public API:
  `https://api.github.com/repos/darkFr0g/FieldLog/actions/runs?per_page=1`
  and by fetching the changed file from the live URL.

## Service worker / caching (important when shipping updates)

- `sw.js`: **network-first** for the app shell (HTML/CSS/JS/manifest) so deploys
  go live when the device is online; **cache-first** for static heavy assets
  (`vendor/xlsx`, icons, **Firebase SDK from gstatic**); runtime cache for Google
  Fonts. Firebase backend calls (googleapis/firebaseio) are never intercepted.
- When you change icons or other cache-first assets, **bump `CACHE_VERSION`** in
  `sw.js` (currently `fieldlog-v4`) so devices re-fetch them.
- iOS home-screen icons do NOT auto-update — the user must delete and re-add the
  home-screen shortcut to get a new icon.
- **Home-screen PWAs can't be hard-refreshed.** App auto-checks for a new SW on
  launch and shows a "New version ready — tap to refresh" banner; Settings →
  About → "Check for updates" forces it. Bump the version badge every ship.

## Cloud sync (Firebase — Firestore + email/password Auth)

Local-first: `localStorage` stays the on-device source of truth and the app works
fully offline; when signed in & online it mirrors to the user's **own private
Firebase project** (`bullfrog-field-log`). One inspector across 4 devices (2
iPhones + 2 Surface laptops).
- **Auth:** email + password (in-app, no Safari redirect — works in the iOS
  standalone PWA; magic links do **not**, due to Safari/PWA storage split). First
  sign-in auto-creates the account; session persists.
- **Data model:** `users/{uid}/logs/{date}` (one doc per DLR log, live `onSnapshot`),
  `users/{uid}/meta/{drafts|lists|mileage|profile|route|working}` (single docs).
  **Live across devices** (onSnapshot, newest `savedAt` wins): logs, mileage,
  drafts, the loaded **route** (JSON — load the sheet on one device, all get it),
  and the in-progress **DLR scratchpad** (`working`, debounced push). So
  Route/Day/Month stay uniform across the 4 devices without submitting. Config +
  security rules were set in the Firebase console (each user locked to
  `users/{uid}/**`).
- **Conflicts:** newest `savedAt` wins per record. **Deletes use tombstones**
  (`{deleted:true, savedAt}`) so a delete sticks across devices and never
  resurrects (a stale device re-syncing won't re-upload it).
- **Backup/Restore** (Settings → Data): export/import all data as JSON; restore
  merges logs/drafts (backup wins on same date) and replaces master lists.

## iOS Notes / OneNote share format (`buildLogText` in app.js)

The Share button (DLR page + each History entry) uses `navigator.share` to push
a **plain-text** report into the iOS share sheet (Notes, OneNote, Mail, etc.),
with a clipboard-copy fallback on desktop.

`buildLogText(log)` is a **clean plain-text** report (symbols removed; the
earlier `••••`/`<^>`/`::::`/`++++` template style was dropped as "ugly"):
- First line `Daily Log Report — <full weekday, month day, year>` (becomes the
  Notes title; carries the **route-sheet date**, not the export date)
- Per crew: `CREW n`, then aligned labels `Crew Lead:` / `Contractor:` /
  `Location:` / `WO/WR#:`
- **CREW / EQUIPMENT grid as aligned monospaced text columns** (real Notes
  tables can't be injected via the share sheet — plain text only)
- `Task:` / `Description:` always; **`Labor Crew:` / `Mechanic:` / `Welders:`
  only appear when that trade is on the crew** (Laborers / Maintenance Engineer
  / Welders). Comments ride on `Labor Crew:` (else `Description:`). `T&E:`/`OT:`
  line only when T&E is toggled.
- **Striking rule (`━━━…`) between crews**; subtle blank-line separation within.
- Short names via `TRADE_ABBR` / `EQUIP_ABBR`: Foreman→FOREMAN, Operating
  Engineer→OPERATOR, Laborers→LABORER, Maintenance Engineer→MECH,
  Welders→WELDER, Chauffeur→CHAFF, Flagger→FLAGGER; Pick Up Truck→4x4 TRK,
  Compressor Truck→COMP TRK, Box Truck→BOX TRK, Weld Truck→WELD TRK,
  Dump Truck→DUMP TRK.

Columns align best when the Notes font is set to **Monospaced** (Aa toggle).

## Route-sheet date (`parseDateFromName` / `parseSummaryDate`)

The DLR work date comes from the uploaded **file name** (`BxCMG MM.DD.YY ...xlsx`),
falling back to **Summary!A1** (e.g. "Thursday, June 11, 2026"), then today.
`generateDLR` sets the DLR date picker from it, so the date flows into the
shared-note title and History.

## Text the foreman (assignment cards)

The route sheet embeds the foreman's number in the **Contractor's Foreman**
field, e.g. `123456- Mike Jones (281-330-8004)`. `renderFlavinJobs` shows the
cleaned name (`foremanName`) plus a green **"Text foreman"** button — an
`sms:+1…&body=…` link (`extractPhone` / `normPhone` / `smsHref`) that opens
iOS Messages prefilled with "Good morning, I'm covering you on `<Ticket #>`
`<Location>` today".

## Foreman / lead classification (DLR crew blocks)

Each DLR block lists its lead(s) ordered **Labor → Mechanic → Welder**. Type is
derived from the job's **Work Description (col J)** via `foremanType()`: `weld*`
→ welder; `cut out / service transfer / install dead main / pressure test / main
cut` → mechanic; `excavate / backfill / restoration / test pit / cathodic` →
labor; anything else (e.g. Support) → other (sorts last). Names come from col A
**Contractor's Foreman** + col B **Mechanics/Fusers/Welders** (deduped). The
crew block also has interactive **Contingency** (opens the contingency email) and
**Hold Point** (copies the album name / fires the Shortcut) chips, same as Route.

## Master lists (exact cWorx/Maximo names — keep exact)

Defined as `CWORX_TRADES` (19) and `CWORX_EQUIPMENT` (21) in `app.js`; users can
edit their own copies in Settings (stored in `localStorage`).

Trades: Foreman, Laborers, Operating Engineer, Flagger, Welders, Fuser,
Chauffeur, Maintenance Engineer, Crane Operator, Drill Runner, Electrician,
Engineer, Coaters, Police Support, Pump Engineer, Sawcutter, Timberman,
Administration, Other.

Equipment: Pick Up Truck, Backhoe, Compressor Truck, Box Truck, Weld Truck,
Dump Truck, Boom Truck, Flatbed Truck, Attenuator Truck, Crane, Excavator,
Vacuum Truck, Van, Zim Mixer, Light Tower, Plate Tamper, Port Compressor, Pumps,
Rocksplitter, Sawcut Equipment, Other.

## Big project: replace the monthly Excel mileage workbook

> **PAUSED (v11.3).** The **Mileage** section (on Day) and the **Month** tab are
> **hidden in the UI** — the user said the mileage approach "isn't working out as
> planned." All the code (mileage capture, `renderMonth`, `buildCIMileageHTML`,
> `exportCIMileage`, etc.) is **left intact**; only the entry points are hidden
> (`display:none` on `#nav-month`, the Day `.day-divider` Mileage toggle, and
> `#mileage-body`). To bring it back, remove those three `display:none`s. Revisit
> the whole approach before re-enabling.

The user keeps a macro-heavy `.xlsm` (`3-Mileage <Month> top dog.xlsm`, built with
a separate "Claude-in-Excel" agent — it has its own `Claude Log` sheet) that is
the monthly system of record: **INPUT** (daily mileage hand-entry), **CI Mileage
Form** (CI-660-1 reimbursement), **Daily Log** (per-stop PDF), **TI-1** (truck
inspection), Payroll, Records, plus a **`#DLR`** sheet whose columns exactly match
Field Log's CSV export. Goal: **Field Log absorbs capture + generates the
submission PDFs, retiring the workbook.** Incremental, keep Excel as the safety
net until each PDF is faithful.
- **Done:** (1) Mileage capture tab — odometer-on-arrival per stop is actually
  **miles driven per leg** + one Start odometer that carries the running total;
  stops pre-load from the loaded route (shortened address + ticket, QIAS stripped);
  day fields Shift/OT/CCI/POET#/Work Code/Expenses/Notes carry forward; "Copy
  stops from another day" + "Map drive". (Profile) seeded form-header profile.
  (2) **CI Mileage Form PDF** — `buildCIMileageHTML` renders the user's CI-660-1
  layout for the month from the mileage data; `exportCIMileage` prints via
  `window.print()` (print-only `#printArea`, `@media print` isolates it → Save as
  PDF / email).
- **Next:** (3) **Daily Log PDF** (per-stop detail), (4) **TI-1** as a stored
  template — must be **pixel-identical** to the user's version (re-share when building).
- **Maps:** `openMapsWith` round-trips home → stops → home (origin/dest = Profile
  home); `shortAddr` cleans addresses (drops cross-streets when a house # exists,
  else keeps first cross street; strips `WR…` job prefix); "Smart order" does a
  free north→south street-number sweep (true optimization would need a paid API).
- Workbook dropdown master values to reuse: Shift (`2 - 07:00-15:00` / `3 -
  15:00-23:00` / `1 - 23:00-07:00`), POET# (`XCMG - 216172870002` / `MP -
  228728990001` / `BOTH`), CCI (K. Garcia / E. Kelly / V. Cornwall / J. Connors),
  Work Code (Field/Training/Office/CFOR/WFH/Vacation/Holiday/NY-PFL), OT 0–5 by
  0.5. Rates: mileage 0.7/mi, car wash 48/mo, boots 200/yr, meal 18, vehicle
  bonus 1000/yr.

## Open ideas / backlog

- **Make it a "real" iOS app (project — pending a Mac mini purchase).** Three
  tiers, cheapest→most:
  1. *PWA polish (no Mac, free, do anytime):* iOS splash screens
     (`apple-touch-startup-image`, no white flash on launch), status-bar style +
     `theme-color`, kill web-isms (disable long-press callout / text-select on
     buttons, stop overscroll bounce), light haptics on Save/Submit, and **real
     iOS push** (16.4+ home-screen PWAs) — could turn the "Crews updated on
     another device" banner into an actual push via the existing Firebase sync.
  2. *Capacitor wrapper (needs macOS):* wraps the **exact** current web app in a
     native shell → App Store eligibility + native camera (Hold Point albums),
     background sync, local notifications, file access for PDFs. Adds a build
     step for the wrapper only. Requires a Mac (hence the Mac mini) **or** a
     cloud-Mac build (GitHub Actions `macos` runner / Codemagic / Appflow) +
     **$99/yr Apple Developer** acct for on-device installs / TestFlight.
  3. *Native Swift rewrite:* not worth it for a personal field tool — skip.
  Recommendation: Tier 1 anytime (I can do it in-repo, no tooling); Tier 2 once
  the Mac mini lands and only if a PWA truly can't do what's needed.
- **iOS Shortcut for Hold Point album** — app already fires
  `shortcuts://run-shortcut?name=FieldLog%20Album&text=<album name>` when the
  Settings → Photos toggle is on; user still needs to build the `FieldLog Album`
  shortcut (Take Photos → Save to Photo Album = Shortcut Input). Paused.
- **Custom domain** `log.<domain>` on GitHub Pages — domain bought via iCloud+
  (email-only on Apple's side; registered at Cloudflare/GoDaddy where DNS is
  managed). Not set up yet.
- **(shipped)** Copy formatted (real tables); History "Edited" indicator +
  sort; backup/restore; locked deletes; per-contractor themes; contingency
  "Copy formatted" now omits the subject line (pastes into the email body).

## Local development

Static files, but the service worker needs `http://` (not `file://`). There's a
no-dependency PowerShell static server at `.claude/serve.ps1` (gitignored) wired
into `.claude/launch.json` for the preview tool on port 8123. Node/Python are not
installed on the dev machine (Windows); icon generation uses .NET `System.Drawing`
via PowerShell.

## How we work together (sessions & memory)

This brief is written here on purpose: **`CLAUDE.md` is committed to the repo, so
it syncs across every device through GitHub** — including the user's iPhone, which
is the primary device. It is the one piece of context guaranteed to load in any
session, on any device.

- **`memory/` does NOT sync across devices.** It lives in the local `.claude`
  folder of whichever machine wrote it (desktop). iOS sessions can't see it. So
  anything durable that the iPhone needs to know belongs **here in `CLAUDE.md`**,
  not in a memory note.
- **Organize chats by workstream, not by device.** One working chat per repo:
  - *Field Log* work → the iOS chat (primary device); the older desktop "v1"
    thread is kept only as origin/history.
  - *Field Hub (workFr0g)* work → its own chat, rooted in the `workFr0g` repo so
    that repo's `CLAUDE.md` loads. Separate repo = separate memory.
  - *Cross-repo / GitHub / setup* work → a general desktop chat.
- A fresh chat loses nothing important as long as durable facts live in this file
  (and the code itself). Don't rely on reading old conversations — write the
  decision down here instead.
- **Related repo:** [Field Hub / workFr0g](https://github.com/darkFr0g/workFr0g)
  carries its own `CLAUDE.md` with the same convention.
