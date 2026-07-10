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

## Publishing pipeline (phase 2)

Turns a sailing event's volunteer media into a published Logbook entry with a narrated highlight reel. Runs locally as the `blindsail-publish` Claude Code skill — nothing publishes unattended.

**First-time setup:** follow `docs/pipeline-setup.md` (GCP project, `secrets/`).

**Run:** in Claude Code, say "publish the 2026-06-13 sail" (or invoke `/blindsail-publish`). The skill pulls/convert/screens/captions/narrates/reels/uploads/publishes, holding anything off-mission or unsafe for your approval, then commits and pushes on your OK.

**Approve held items:** the skill lists held items with reasons; approve the ones you want and it resumes them.

**Takedown:** remove the item's object from `media.json`, `git push`. For a video, also set it Private on YouTube (studio.youtube.com).

**Successor handover:** repo `philipk303/blindsail-media-gallery`; hosting a Cloudflare Worker with static assets (`wrangler.toml`, deploy via `npx wrangler deploy` from a staged clean copy — the repo root has 1GB+ gitignored raw media); video on philipk303's YouTube (unlisted); Google auth via gws (Drive) + the BlindSail GCP project (TTS/Speech/YouTube). Transfer GCP project ownership and grant repo access to hand off.
