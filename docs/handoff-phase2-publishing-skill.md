# Handoff prompt — Phase 2: publishing skill

Paste this into the new session:

---

Let's plan and build phase 2 of the BlindSail SF Bay media gallery: the publishing skill. Check project memory first (blindsail-gallery-project-state and related) for full context — don't ask me to re-explain what's already there.

Phase 1 (static page shell) is done, tested, and merged to `main`. Build phase 2 against what actually exists, not assumptions:

- Read `media.json` and `js/media-loader.js` at the repo root (`C:\Users\phili\OneDrive\Documents\Claude Projects\Blind Sail Media`) to see the real item schema and the exact loader functions (`loadMedia`, `renderPhotoCard`, `renderVideoCard`, `renderLogbook`, `renderVoices`) this skill's output must feed.
- Read `design.md`'s "Media Pipeline" section for the process spec: Drive pull → HEIC/video conversion → AI screening (auto-publish clean items, hold suspicious/off-mission/uncaptionable ones, flag possible bystanders/minors) → caption/alt/AD script generation → neural TTS narration → highlight reel shot-list + FFmpeg assembly → YouTube upload → `media.json` write → commit/push.
- `scripts/convert-local-media.mjs` (already built for local dev QA) is a useful reference for the ffmpeg conversion patterns (HEIC needs `-update 1 -frames:v 1`; use `execFileSync` with an args array, never shell-interpolated strings — a prior review caught a shell-injection risk from this exact pattern).

Key settled facts (see memory for detail — don't re-litigate):
- Video hosts on philipk303's personal YouTube account, **unlisted**, using philipk303@gmail.com gws credentials for both Drive pull and YouTube upload.
- Publishing runs as a local Claude Code skill on the owner's subscription — no API key, no cloud automation, gated on the owner running it.
- Real test data is ready: `BlindSail-JJ-1/` (16 photos + 4 videos, descriptive filenames) and `6-13 Sailing -pk/` (10 photos + 6 videos, ~480MB, raw camera filenames) — both gitignored locally. The June 13 sail is the intended first real end-to-end pipeline test.
- Output rule: never echo file contents or code blocks into chat when reading/writing — see the project's `CLAUDE.md` (repo root) and the `keep-chat-output-small` memory. Use file tools directly, report in one sentence, offer Notepad for review.

Process: use `superpowers:writing-plans` for the implementation plan (self-review against every relevant design.md subsection), then `superpowers:subagent-driven-development` to execute, with a final adversarial review pass (programmer + relevant domain reviewer) before calling it done. Confirm scope and any open questions with me before writing the plan.

One loose end from phase 1 you may need to check: Cloudflare Pages deploy was mid-troubleshoot in a separate session — ask me if it's resolved before assuming the live site works, but it doesn't block phase 2 work (Drive pull, conversion, and skill logic all run locally).
