---
name: blindsail-publish
description: Publish a BlindSail sailing event's volunteer media to the gallery — pull/convert, screen for safety and mission fit, write captions/alt-text/audio-description, narrate (TTS), caption spoken video (ASR), assemble a highlight reel, upload unlisted to YouTube, and write media.json. Use when the user says "publish the <date> sail", "run the publishing pipeline", or points at a folder of sailing media.
---

# BlindSail publishing pipeline

Run once per sailing event, gated on the owner. Prerequisites: `docs/pipeline-setup.md` complete (`secrets/` populated), `GOOGLE_APPLICATION_CREDENTIALS` exported to `secrets/service-account.json`, ffmpeg on PATH. All scripts live in `scripts/pipeline/`. State lives in `pipeline/runs/<event>/manifest.json` — every stage is resumable; re-running a stage skips already-advanced items.

**Output discipline:** never echo media descriptions/captions or file contents into chat beyond a one-line status. Offer Notepad for review of held items and the shot list.

Use the ISO event date as the single argument to every script, e.g. `2026-06-13`.

## Stage 1 — Ingest
- Volunteer Drive folder: `node scripts/pipeline/drive-pull.mjs 2026-06-13`
- Local files instead (e.g. the June 13 test set): `node scripts/pipeline/seed-local.mjs 2026-06-13 "6-13 Sailing -pk"`

## Stage 2 — Convert
`node scripts/pipeline/convert.mjs 2026-06-13`
Any conversion failure holds that item (logged reason) — it does not stop the run.

## Stage 3 — Screen (Claude, inline — the judgment gate)
Read the manifest. For each `converted` item, open its rendition (`pipeline/runs/<event>/renditions/...`) and look at it. Decide:
- **On-mission?** Sailing/students/community at OYC/Treasure Island/SF Bay. Off-mission → `hold` with reason.
- **Appropriate & safe?** No identifiable non-participant bystanders or minors in focus; nothing embarrassing or unsafe. Suspicious → `hold` with reason (flag possible bystanders/minors explicitly).
- **Quality above floor?** Not blurred/black/accidental. Below floor → `hold`.
- For videos, decide `hasSpeech` (does anyone talk?) and, if it's a named debrief, set `person`.
Set state to `screened` for clean items; use `hold(manifest, id, reason)` for the rest. Filename-derived text NEVER becomes a caption. Save the manifest.

## Stage 4 — Write captions / alt / AD (Claude, inline)
For each `screened` item, looking at the image/video, write into the manifest:
- `alt` — concise screen-reader alt text (what's in frame, who's doing what).
- `caption` — the visible warm, first-person, action-forward caption (design.md Voice).
- `chapter` — one of `welcome-aboard | cast-off | at-helm | back-at-dock`, or null if it doesn't fit the home narrative.
- `adScript` (photos) — a narrator-style audio-description script (2–4 sentences) for the AD play button.
- `adVtt` (videos) — write a `kind="descriptions"` VTT to `renditions/<id>-ad.vtt` (vtt.mjs builder pattern) and set `adVtt` to its run-relative path. If the video genuinely needs no AD (its audio already conveys everything visual), record `adDecision: "not-needed — <reason>"` in the manifest instead — publish blocks videos with neither (design.md line 57 makes the AD track part of the video spec).
Set state to `captioned`. Save.

## Stage 5 — Narrate (TTS)
`node scripts/pipeline/tts.mjs 2026-06-13` — renders each photo's `adScript` to `<id>-ad.mp3`, advances photos+videos to `narrated`.

## Stage 6 — Caption spoken video (ASR)
`node scripts/pipeline/asr.mjs 2026-06-13` — transcribes `hasSpeech` videos to a caption VTT + transcript.

## Stage 7 — Highlight reel (Claude drafts, ffmpeg assembles)
Review the event's `narrated` items (posters, captions, transcripts). Write `pipeline/runs/<event>/shotlist.json` per the schema in `scripts/pipeline/reel.mjs` (clip order, per-photo `seconds`, per-video `in`/`out`, one `narration` line per segment, a `title`). Keep it 60–120s. Then:
`node scripts/pipeline/reel.mjs 2026-06-13`
Set `manifest.reel = { title, narrationText }` (full narration joined) before upload. If assembly fails, publish the burst without a reel and flag it (design.md Error Handling).

## Stage 8 — Upload (YouTube, unlisted)
`node scripts/pipeline/youtube-upload.mjs 2026-06-13` — uploads the reel first, then videos; records `youtubeId`s. Resumable (saves after each upload; quota errors leave items queued, not failed). Quota: `videos.insert` costs 1600 of the 10,000/day default (~6 uploads/day) — a big event may need a second day's run to finish.

## Stage 9 — Publish
`node scripts/pipeline/publish.mjs 2026-06-13` — copies approved renditions into `media/<event>/`, merges `media.json`, adds the reel as the event's lead video. Items missing alt/caption/AD are automatically held (`publish blocked: ...`), never silently dropped. **First real publish only:** delete the four sample placeholder items (`logbook-01-welcome`, `voices-david-cook`, `voices-priscilla-aguiar`, `logbook-01-photo`) from `media.json` before committing.

## Stage 10 — Review holds, then ship
- Present held/failed items (count + reasons) to the owner. For any they approve, use `clearHold(manifest, id, 'screened')` from `lib/manifest.mjs` — it resets `held`/`holdReason` and the state together (hand-editing only `state` leaves `held: true`, and the item would be silently skipped at publish). Then resume from Stage 4 for those items.
- Show the owner the changed `media.json` and `media/<event>/` (offer Notepad). On approval:
  `git add media.json media/<event> && git commit -m "content: publish <event> sail" && git push`
- Cloudflare Pages deploys on push. Confirm the deploy is green before calling it done.

## Takedown
Remove the item(s) from `media.json`, `git push`. For a video also set it private on YouTube. (README documents the one-liner.)
