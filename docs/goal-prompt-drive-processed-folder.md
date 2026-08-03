# Next-session prompt — Drive "Processed" folder move

Paste everything below the line into a fresh session in this project.

---

Build a feature that moves volunteer media into a `Processed/` subfolder in Google Drive after the pipeline ingests it, so the volunteer upload folder doesn't grow without bound and dedup stops depending on machine-local state.

## Why this is worth doing

`scripts/pipeline/drive-pull.mjs` is currently read-only against Drive — it does `files.list` (line 44) and `files.get` (line 49) and nothing else. Re-processing is prevented only by a `seen` set of Drive file IDs built from the local run manifest at line 60. That manifest lives in `pipeline/runs/<event>/manifest.json`, which is **gitignored and exists on exactly one machine with no backup**. Lose it, or switch machines, and the next `drive-pull` re-downloads and re-processes the entire folder as brand-new items. Moving files server-side makes the Drive folder itself the dedup state.

## Decide this first, with me, before writing code

**When does the move fire?** I have not decided. Present the tradeoff and get my answer:

- **(a) At download time** — in `drive-pull.mjs`, immediately after each successful `files.get`. Simplest, and it's the option that actually fixes the fragile dedup. But "processed" then means "downloaded"; an item screened out at Stage 3 has still been moved.
- **(b) At publish time** — Stage 9 (`scripts/pipeline/publish.mjs`), only for items that actually shipped. Semantically truer to "after processing," but it requires threading `sourceId` through to publish, and held/rejected items sit in the volunteer folder indefinitely.

**Sub-question, either way:** do screened-out/held items go to `Processed/` as well, to a separate `Rejected/`, or stay put?

Do not pick for me. Ask, then build.

## Constraints and facts you need

- Drive access goes through the **`gws` CLI**, not the GCP service-account credentials. `docs/pipeline-setup.md:15` is explicit that the Drive API is unused by those creds. The adapter is the `gws()` helper at `drive-pull.mjs:32` — note it shells `node <gws JS entry>` because the `.cmd` shim isn't `execFileSync`-able.
- Source folder ID is `driveFolderId` in `config/pipeline.config.json`. Account is `philipk303@gmail.com`.
- The move itself is a Drive `files.update` with `addParents` / `removeParents`.
- **Always use Bash, not PowerShell, for `gws` calls with `--params`** — PowerShell mangles the JSON braces.
- Decide and tell me whether the `Processed/` folder is auto-created on first run, looked up by name, or pinned by a new ID in `config/pipeline.config.json`. I lean toward a pinned ID for predictability, but argue me out of it if auto-create is better.

## Testing

- Runner is `node --test`, run from `scripts/pipeline/` (`npm test`).
- Follow the existing style in `scripts/pipeline/__tests__/drive-pull.test.mjs` — it tests the **pure** `planPulls` function with plain fixtures and no network. Keep the new move logic split the same way: a pure planner that decides what moves where (unit-tested) and a thin `gws` adapter (not unit-tested, comment it as validated by the live run, matching the existing `// --- gws adapters ---` convention at line 30).
- Do not run a live pull against the real volunteer folder without asking me first.

## Failure handling — get this right

A move that fails after a successful download must not silently corrupt state. Decide and justify: does a failed move abort the run, or log and continue with the item still recorded in the manifest? Partial-state bugs here are the main risk in this feature.

## Project rules that apply

- `CLAUDE.md` — never print file contents or code blocks into chat. Report "updated X" in one sentence and reference `file:line`. Offer Notepad for review.
- Deploy is **not** automatic on push. This is a Cloudflare Worker with static assets — `npx wrangler deploy`. (No deploy should be needed for this change; it's pipeline-only, nothing the site serves.)
- Commit and push only when I ask.

## Starting state

`main` @ `8a3e337`, working tree clean, everything pushed. No work on this feature has been started — the previous session only read `drive-pull.mjs`.
