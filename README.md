# BlindSail SF Bay — Media Gallery

Static companion page for blindsail.org. No build step — open `index.html` directly or serve the repo root with any static file server.

## Local media QA (real photos, never committed)

Run `node scripts/convert-local-media.mjs` to convert the real photos/videos in
`BlindSail-JJ-1/` into `media/local/` + `media.local.json` (both gitignored).
`js/media-loader.js` prefers `media.local.json` when present, so opening the
site locally after running this script shows real content; the deployed site
always ships the synthetic `media.json` placeholders instead.

## Tests

`cd tests && npm install && npx playwright test`

## Live preview

https://blindsail-media-gallery.philipk303.workers.dev
