# AGENTS.md — handoff & working agreement for AI assistants

You are helping maintain **Field Log**, a personal field app used **daily, in
production**, by one Con Edison Construction Representative in the Bronx.
Claude has been the primary maintainer; this file is the handoff so any
assistant (ChatGPT/Codex, Claude, etc.) can work on the repo safely.

**Read `CLAUDE.md` first** — it is the full project brief (architecture, data
model, feature map, backlog) and is kept current. `USER_GUIDE.md` is the
user-facing feature guide. This file adds the rules of engagement.

## What this is (30 seconds)

- Single-page PWA: parses `.xlsx` route sheets, generates Daily Log Reports,
  tracks jobs/contingencies/history, syncs across the user's devices via his
  private Firebase. Live at https://darkfr0g.github.io/FieldLog/
- **Primary device is an iPhone** (installed to home screen). Optimize for iOS
  Safari standalone mode.
- The user is not a programmer. Explain in plain English, ship working
  increments, and report honestly (if something failed, say so).

## Hard rules — do not break these

1. **No build step. Ever.** Plain static files: `index.html`, `css/styles.css`,
   `js/app.js`. No npm, no bundler, no framework, no TypeScript, no modules.
2. **Match the code idiom:** ES5-style vanilla JS (`var`, `function`),
   single-quote strings, compact style. No arrow functions / let / const /
   template literals in `js/app.js`.
3. **Relative paths only** (`./...`). The site lives under the `/FieldLog/`
   subpath; absolute `/` paths break it.
4. `vendor/xlsx.full.min.js` (SheetJS) stays **vendored locally** — offline
   parsing in the field depends on it. Never switch it to a CDN.
5. **Every ship bumps the version**: `APP_VERSION` in `js/app.js` (single
   source; the UI badges read it). Sequence: v15.5 → v15.6 → …
6. If you change **cache-first assets** (icons, vendor files) or `sw.js`
   itself, bump `CACHE_VERSION` in `sw.js`.
7. **Deploy = push to `main`** → GitHub Actions → GitHub Pages (auto,
   ~1–2 min). **Always verify the workflow run concluded `success`** via
   `https://api.github.com/repos/darkFr0g/FieldLog/actions/runs?per_page=1`.
   The Pages queue has silently dropped/failed deploys before — a push is NOT
   a deploy until the run says success.
8. **Never clobber user data.** All data lives in `localStorage` + the user's
   Firebase (`users/{uid}/…`). Deletes must use tombstones
   (`{deleted:true, savedAt}`); merges are newest-`savedAt`-wins. Don't purge
   or migrate stored data without an explicit ask.
9. Keep **`CLAUDE.md` updated** when you add/change features or sync docs —
   it is the cross-device memory. Update `USER_GUIDE.md` for user-facing
   changes. Treat this file the same way.

## How to verify changes (what Claude does)

- `node --check js/app.js` after every edit (also `sw.js` if touched).
- Serve the repo root with any static server (`python3 -m http.server 8123`)
  and drive it with Playwright/headless Chromium: seed state via
  `page.evaluate` (e.g. set `currentCrews`, `logs`, `localStorage` keys, call
  `renderCrews()`/`showPage(...)`), assert behavior, and screenshot.
- The service worker needs `http://`, not `file://`.
- Show the user a screenshot of anything visual before/when shipping.

## Architecture crib sheet

- `js/app.js` — ALL logic (~3k lines): route parsing, DLR crews, jobs ledger,
  contingencies, history, share/export, cloud sync, appearance.
- `index.html` — markup only (nav, 5 pages, modals). Firebase compat SDK from
  gstatic CDN loads before `app.js` (plain globals).
- `css/styles.css` — all styles; CSS variables in `:root`; dark theme via
  `:root[data-theme="dark"]`, accents via `data-accent`, density via
  `.density-compact`.
- Sync model, Firestore doc layout, and feature specifics: see `CLAUDE.md`
  ("Cloud sync" section is authoritative).
- Known deploy quirk: GitHub Pages serves `max-age=600`; the SW fetches the
  shell with `cache:'no-cache'` and `checkForUpdate()` compares the live
  `APP_VERSION` — don't regress this.

## Working style with the user

- He messages from his iPhone mid-shift; keep replies short, lead with what
  shipped and the version number, one screenshot when visual.
- Ship small and immediately; he tests live within minutes.
- If a request is ambiguous, make the sensible call and say what you chose —
  don't stall on questions. If it's genuinely destructive/irreversible, ask.
- Backlog priorities live at the bottom of `CLAUDE.md` (#1 is true Google
  Maps route optimization via the Directions API).
