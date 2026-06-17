# CLAUDE.md — Field Log project brief

Context for any Claude Code session working on this repo. Read this first.

## What this is

**Field Log** — a single-page web app used daily by a Con Edison **Construction
Representative** for gas-utility construction inspection in the **Bronx, NY**.
It runs entirely client-side, works offline, and installs to the iPhone home
screen as a PWA. **Primary device is an iPhone** — optimize for that.

**Live:** https://darkfr0g.github.io/FieldLog/
**Repo:** https://github.com/darkFr0g/FieldLog

### Two tools inside the app
- **Route Sheet Extractor** — parses `.xlsx` route sheets (SheetJS), shows the
  inspector's assigned jobs grouped by WO# / Location, and shows CCI staffing
  status. Inspector name defaults to "Jeremiah Flavin".
- **DLR (Daily Log Report)** — generates crew blocks from the route sheet
  (grouped by WO# / Location), pre-filled with the standard crew
  (Foreman 1, Operating Engineer 1, Laborers 4, Flagger 2, Pick Up Truck 1,
  Backhoe 1, Compressor Truck 1). Add/remove trades & equipment per block,
  Comments, optional T&E section. Saves to `localStorage`; exports CSV / text;
  shares to iOS Notes / OneNote. History tab lists submitted logs (Edit / Share
  / Delete). One log per date — re-submitting the same date overwrites it.

All data (logs, drafts, master lists) lives in the browser `localStorage` on the
device. Nothing is sent to a server.

## Architecture / conventions

- **No build step.** Plain static files served as-is. Don't add a bundler,
  framework, or npm unless explicitly asked — the simplicity is intentional.
- **Vanilla JS**, ES5-style (`var`, `function`), matching the existing code.
  No modules, no TypeScript. Keep new code in the same idiom.
- Files:
  - `index.html` — markup only (nav, 4 pages, modals, picker sheet)
  - `css/styles.css` — all styles (CSS variables in `:root`)
  - `js/app.js` — all logic (route parsing, DLR, history, export, share)
  - `vendor/xlsx.full.min.js` — SheetJS, **vendored locally** for offline use
    (do NOT switch back to a CDN — offline parsing in the field depends on this)
  - `manifest.json`, `sw.js` — PWA
  - `icons/` — app icons; regenerate all sizes from `icons/icon-source.png`
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
  (`vendor/xlsx`, icons); runtime cache for Google Fonts.
- When you change icons or other cache-first assets, **bump `CACHE_VERSION`** in
  `sw.js` (currently `fieldlog-v2`) so devices re-fetch them.
- iOS home-screen icons do NOT auto-update — the user must delete and re-add the
  home-screen shortcut to get a new icon.

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

## Open ideas / backlog

- **"Copy formatted (real tables)" button** — copy rich `text/html` (with a real
  `<table>`) to the clipboard so pasting into Notes/OneNote produces an actual
  table + bold (the only way to get true tables; share sheet can't). Would work
  into both Notes and OneNote. Not yet built.
- Possible: "Edited" indicator / last-modified timestamp on History entries.

## Local development

Static files, but the service worker needs `http://` (not `file://`). There's a
no-dependency PowerShell static server at `.claude/serve.ps1` (gitignored) wired
into `.claude/launch.json` for the preview tool on port 8123. Node/Python are not
installed on the dev machine (Windows); icon generation uses .NET `System.Drawing`
via PowerShell.
