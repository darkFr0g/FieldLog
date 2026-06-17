# Field Log

A single-page web app for daily Con Edison gas-utility construction inspection work in the Bronx. It runs entirely in the browser, works offline, and installs to the iPhone home screen as a PWA.

**Live:** https://darkfr0g.github.io/FieldLog/

## Tools

- **Route Sheet Extractor** — parses `.xlsx` route sheets, shows assigned jobs grouped by WO# / Location, and displays CCI staffing status.
- **DLR (Daily Log Report)** — generates crew blocks from the route sheet (grouped by WO# / Location) pre-filled with the standard crew (Foreman 1, Operating Engineer 1, Laborers 4, Flagger 2, Pick Up Truck 1, Backhoe 1, Compressor Truck 1). Uses exact cWorx / Maximo trade and equipment names. Add/remove trades and equipment per block, add Comments, an optional T&E section, save to `localStorage`, and export to CSV or text.

All data (logs, drafts, master lists) lives in the browser's `localStorage` on the device — nothing is sent to a server.

## Project structure

```
index.html                  Markup (nav, pages, modals)
css/styles.css              All styles
js/app.js                   All app logic (route parsing, DLR, history, export)
vendor/xlsx.full.min.js     SheetJS, vendored locally for offline use
icons/                      PWA / home-screen icons
manifest.json               PWA manifest
sw.js                       Service worker (offline cache)
.github/workflows/deploy.yml  Auto-deploy to GitHub Pages on push to main
```

No build step — these are plain static files.

## Deployment

Pushing to `main` triggers the GitHub Actions workflow, which publishes the repo to GitHub Pages.

### One-time setup (already done once per repo)

In the repository: **Settings → Pages → Build and deployment → Source → "GitHub Actions"**.

After the first successful workflow run, the app is live at the URL above.

## Local development

It's just static files, but a service worker requires `http://`, not `file://`. Serve the folder with any static server, e.g.:

```powershell
# Python 3
python -m http.server 8000
# then open http://localhost:8000/
```

## Installing on iPhone

1. Open the live URL in **Safari**.
2. Tap the **Share** button → **Add to Home Screen**.
3. Launch from the home-screen icon — it opens full-screen and works offline.

## Offline behaviour

The service worker precaches the app shell and the xlsx library, so the app and route-sheet parsing work with no signal. App shell files use a network-first strategy, so deploys go live as soon as the device is back online. To force a hard refresh of all cached assets, bump `CACHE_VERSION` in [`sw.js`](sw.js).

## Related projects

- **[Field Hub (workFr0g)](https://github.com/darkFr0g/workFr0g)** — sibling PWA
  with XCMG item search and gas field-reference tools.
- _Retired:_ **RouteExtractor** — its route-sheet parsing was folded into Field Log.
