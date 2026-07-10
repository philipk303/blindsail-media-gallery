# Publishing pipeline — one-time setup

All credentials live in the gitignored `secrets/` folder. Never commit them.

## 1. GCP project

- Project: **BlindSail Media Gallery GCP**, project ID `blindsail-media-gallery-gcp`.
- Recorded in `config/pipeline.config.json` as `gcpProjectId`.

## 2. APIs enabled (same project)

- Cloud Text-to-Speech API
- Cloud Speech-to-Text API
- YouTube Data API v3
- Drive API (unused by this pipeline — Drive access goes through the existing `gws` CLI, not these credentials)

## 3. Service account (Cloud TTS + Speech-to-Text)

- IAM & Admin → Service Accounts → `blindsail-pipeline@blindsail-media-gallery-gcp.iam.gserviceaccount.com`.
- JSON key saved as `secrets/service-account.json`.
- Set the env var when running the skill (Bash): `export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/secrets/service-account.json"`
- Auth is machine-to-machine (no consent screen) — verified with a live `listVoices` (TTS) and `recognize` (Speech-to-Text) call.

## 4. OAuth client (YouTube upload)

- APIs & Services → OAuth consent screen → External; `philipk303@gmail.com` added as a test user; scope `.../auth/youtube.upload`.
- Credentials → OAuth client ID → **Desktop app** → downloaded JSON → `secrets/youtube-oauth-client.json`.
- Ran `cd scripts/pipeline && node youtube-auth.mjs`, consented as philipk303, which wrote `secrets/youtube-token.json`.
- Note: the app is unverified (testing mode). The consent screen shows a "Google hasn't verified this app" warning — click **Advanced → Go to app (unsafe)** to proceed. Only test users added to the consent screen can authorize.
- Note: the `youtube.upload` scope does **not** include read or delete permission — `videos.list`/`videos.delete` calls with this token fail with `insufficientPermissions`. That's expected; the pipeline only ever calls `videos.insert`.

## 5. Verify

- `secrets/` holds: `service-account.json`, `youtube-oauth-client.json`, `youtube-token.json`, `.gitkeep`.
- Cloud TTS and Speech-to-Text auth confirmed with live API calls (not just client construction).

## 6. Spike — confirm unlisted API uploads aren't locked private (GATE) — PASSED 2026-07-02

Uploaded a throwaway 2-second test clip via the API (`videos.insert`, `privacyStatus: unlisted`). Confirmed in YouTube Studio:
visibility read **Unlisted** (not locked private), and the video played back correctly. Test video deleted afterward.
No YouTube API audit request was needed — first-try unlisted uploads worked cleanly from this unverified/testing-mode project.
