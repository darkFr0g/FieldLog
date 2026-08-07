# Cipher

**NATO phonetic & binary translator** — paste anything and it just works.
Offline-first PWA, installs to the iPhone home screen.

## What it does

- **Paste text** → get it as NATO phonetics ("Bravo Romeo Oscar…") and binary.
- **Paste NATO words** → decoded back to plain text (accepts Alfa/Alpha,
  Juliet/Juliett, Xray/X-ray, and radio digits Tree/Fower/Fife/Niner).
- **Paste binary** → decoded back to text (UTF-8, 8-bit groups, spacing and
  punctuation ignored).
- **Auto-detects** which of the three you pasted — no mode switching needed
  (manual override chips are there if you want them).
- **Read screenshot** — pick/paste/drop an image and it's OCR'd on-device via
  Tesseract.js (lazy-loaded from CDN on first use, then cached by the service
  worker so it works offline afterward).

Everything runs client-side. Nothing is uploaded anywhere.

## Architecture

Same conventions as [FieldLog](https://github.com/darkFr0g/FieldLog):

- **No build step.** Plain static files: `index.html`, `css/styles.css`,
  `js/app.js`, `manifest.json`, `sw.js`, `icons/`.
- Vanilla ES5-style JS, relative paths everywhere (Pages subpath-safe).
- Service worker: network-first app shell (deploys go live when online, app
  still opens offline), cache-first runtime cache for the OCR engine.
- Push to `main` → auto-deploys via GitHub Actions → Pages.

## Deploy notes

- The workflow auto-enables Pages on first run (`configure-pages` with
  `enablement: true`). If the first run fails on that step, set Pages source
  to "GitHub Actions" once in repo Settings → Pages and re-run.
- Bump `CACHE_VERSION` in `sw.js` and the `.vbadge` in `index.html` every ship.
