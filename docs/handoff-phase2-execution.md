# Handoff prompt — Phase 2: execute the publishing pipeline plan

Paste this into the new session:

---

Execute the phase 2 implementation plan at `docs/superpowers/plans/2026-07-02-publishing-pipeline.md` using superpowers:subagent-driven-development. Check project memory (blindsail-phase2-pipeline-decisions) for locked decisions — don't re-ask settled questions.

Sequencing: **code tasks first (Tasks 1, 3–15, 17)** — they need no credentials; the Cloud/YouTube calls are isolated adapters and everything unit-tests offline. **Defer the human/setup tasks (2: Drive folder, 13 Step 2: OAuth smoke, 16: GCP project + secrets + spike)** until just before the live June 13 run (Task 18). Task 19 (README) can go anytime after 17.

Notes:
- The plan is adversarial-review-hardened (Fable 5, 15 findings applied — see its self-review appendix). Follow the code blocks as written; the corrections are already folded in.
- Task 16's spike (unlisted YouTube upload not locked private) is a hard **gate** before Task 18 — don't skip it.
- Task 18 needs me at the keyboard (GCP console, OAuth consent, listening/watching checks) — pause and tell me when you get there.
- Output rule: never echo file contents or code blocks into chat — file tools only, one-line status reports, offer Notepad for review (see repo CLAUDE.md).
- Cloudflare Pages deploy was still unresolved as of 2026-07-02 — it does not block anything; don't troubleshoot it unless I ask.
