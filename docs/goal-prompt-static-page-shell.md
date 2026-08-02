# /goal prompt — BlindSail static page shell

Paste this as the /goal input:

---

Build the static page shell for the BlindSail SF Bay media gallery companion page, following `design.md` (project root) as the single source of truth — do not re-litigate design decisions already made there.

Scope: Home ("A Day on the Water"), Voices, and Logbook pages — plain HTML/CSS/JS, no framework, no build step — implementing the "Light Air" visual theme (palette, hand-drawn SVG line art and animations, Josefin Sans Light + Nunito Sans typography, "blown in" title animation, ambient "Sounds of the bay" toggle), Able Player integration for video, audio-description play buttons on photos, and full WCAG 2.1 AA accessibility scaffolding (skip links, keyboard operability, focus states, "How to use this page" section, reduced-motion handling).

Render Logbook and Voices client-side from a runtime-fetched `media.json`; since the publishing skill doesn't exist yet, hand-author a small representative sample `media.json` for dev/testing using **real local photos from `BlindSail-JJ-1/`** (good descriptive filenames already seed usable alt text) — reference them from outside the repo's tracked tree or keep the folder gitignored per design.md, so nothing real gets committed or deployed before the screening pipeline exists in a later goal. Home narrative is hand-authored HTML per design.md's four-chapter structure.

Out of scope for this goal: the publishing skill (Drive pull, conversion, screening, captions/AD generation, YouTube upload) and highlight-reel assembly — those are separate follow-on goals.

Repo: create the GitHub repo and connect it as part of this goal — the plan's commit/push steps and Cloudflare Pages deploy depend on it existing.

Agents: run build/review subagents on Fable 5.

Process:
1. Use the `superpowers:writing-plans` skill to produce an implementation plan, saved to `docs/superpowers/plans/`, broken into bite-sized TDD-style tasks with exact file paths.
2. Self-review the plan against every relevant section of `design.md` for coverage gaps before finalizing.
3. Execute via `superpowers:subagent-driven-development` (fresh subagent per task, review between tasks), on Fable 5.
4. After the full shell is built, run a **final adversarial review pass**: a programmer subagent for code-quality/correctness review, and a graphic-designer subagent to critique visual execution of the "Light Air" theme against design.md (palette, typography, motion, hand-drawn line art) — not per-task, just once at the end.
5. Verify with an axe accessibility scan, manual keyboard/reduced-motion check, and **Chrome DevTools MCP + Playwright CLI** browser testing (navigate all three pages, exercise AD play buttons, Able Player AD toggle, keyboard-only nav, and the "Sounds of the bay" toggle) before declaring done; report honestly on anything untested (e.g., NVDA pass, since that needs a human).

Success criteria (from design.md): axe passes WCAG 2.1 AA on all three pages; keyboard-only navigation works including AD button and Able Player AD toggle; page respects `prefers-reduced-motion`; initial load stays within a mobile-friendly budget even with local test media.
