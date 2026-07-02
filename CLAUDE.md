# BlindSail Media Gallery — Project Instructions

## No file content in chat — hard rule

Never output code blocks, file contents, or large text in the chat window when reading or writing files:

- **Reading:** Grep to locate, then Read with `offset`/`limit`. Quote ≤10 lines max, with a `file:line` reference.
- **Writing/editing:** Use Write/Edit tools directly. Report "updated X" in one sentence — never paste the content into chat.
- **Prose:** No multi-section recaps or tables restating file content. A few sentences plus file references.
- **Review:** Offer to open files in Notepad (`start notepad "path"`) when the user needs to read them.

(Subagent prompts passed via the Agent tool are tool parameters, not chat output — full task text there is fine.)

## Project facts

- `design.md` (project root) is the design source of truth. Do not re-litigate settled decisions.
- Raw media (`BlindSail-JJ-1/`, `6-13 Sailing -pk/`, HEIC/MOV/MP4, `media/local/`, `media.local.json`) is gitignored — never commit or deploy real participant media before the screening pipeline exists.
- GitHub: `philipk303/blindsail-media-gallery` (public), default branch `main`. Hosting: Cloudflare Pages.
- Video hosting: philipk303's personal YouTube account, unlisted uploads. Pipeline credentials: philipk303@gmail.com via gws CLI.
- Audience is blind/low-vision users — accessibility regressions are the highest-severity class of defect. WCAG 2.1 AA is the floor; axe + keyboard tests live in `tests/`.
