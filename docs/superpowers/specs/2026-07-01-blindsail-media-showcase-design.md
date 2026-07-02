# Blind Sail Media Showcase — Design Spec (v2)

## Purpose

A standalone, shareable web experience showcasing photos and video from **BlindSail SF Bay** (blindsail.org) — an all-volunteer nonprofit teaching blind and visually impaired sailors to sail on San Francisco Bay, sailing out of Oakland Yacht Club and Treasure Island Sailing Center. The site embodies the mission (empowerment, inclusion, independence, connection, community) in its own design: genuinely usable by blind visitors, not just about them.

Secondary goal: a near-zero-friction path for volunteers to contribute new photos/video from their phones after each sailing event.

## Audience & Calls to Action

Audiences: donors/funders, prospective blind sailors and their families, prospective volunteers, and the general public arriving via a shared link.

The site must answer "what is this and what do I do?" fast:

- **Hero**: org name, one-line mission ("Learn to harness the power of the wind and sail the bay"), and immediate visual proof (full-bleed photo or short video).
- **"Get Involved" section** (final chapter of the narrative and persistent in the footer): **Sail With Us** (→ blindsail.org sailing calendar), **Volunteer** (→ blindsail.org volunteer page), and **Support Us** (donation/contact per the org's preferred channel).
- **Legitimacy signals**: affiliation statement linking to blindsail.org; sponsor credits (Oakland Yacht Club, Treasure Island Sailing Center, MarinLink, Peninsula Endowment Fund); racing credibility ("California One" won the Canadian Invitational Blind Sailing Regatta, 2017 & 2018).
- **Social share cards**: Open Graph + Twitter meta tags with a strong preview image so shared links unfurl properly.

## Visual Design Direction

Pattern off BlindSail SF Bay's identity but replace the dated Weebly-era boxed layout with a modern, photo-forward feel:

- **Photography-first**: full-bleed, edge-to-edge use of the program's authentic media. Real people, real water — never stock.
- **Palette**: deep bay navy + sail white + warm sand neutral, with one high-energy accent (regatta orange/gold) for CTAs and the AD play buttons. All pairings meet WCAG AA contrast (AAA for body text where practical).
- **Typography**: large, humanist sans-serif at generous sizes (18px+ body); oversized headings. Big type is both the modern look and an accessibility win.
- **Narrative layout**: split-panel scroll pattern for chapters — story text anchored on one side, imagery scrolling on the other (Obama Foundation-style). Degrades gracefully: linearizes cleanly for screen readers and small screens; honors `prefers-reduced-motion` (no parallax/scroll-triggered animation when set; all motion subtle regardless).
- **Tone**: warm and human, not corporate. Short sentences, first-person quotes from sailors wherever possible.

## Site Structure

Three views of one media library:

1. **"A Day on the Water" (home)** — hand-curated narrative in **four chapters** (sized to current media; more chapters only when the library supports them):
   1. *Welcome Aboard* — arriving at OYC, meeting instructors and crew
   2. *Cast Off* — leaving the slip, getting underway
   3. *At the Helm* — VI sailors driving, trimming, sailing the boat
   4. *Back at the Dock* — debrief, community, celebration → flows into **Get Involved**
2. **"Voices"** — interview spotlight cards (launching with the David Cook and Priscilla Aguiar debriefs), each with video, captions, transcript, and AD. Grows as more interviews are recorded. Manually curated.
3. **"The Logbook"** — chronological archive of all published media and highlight reels, newest first, grouped by event. New volunteer uploads land here via the publishing skill.

Standout Logbook items can be manually promoted into the home narrative or Voices — an editorial action, not automated.

## Accessibility Model

Target: WCAG 2.1 AA + Section 508, verified by automated scan (axe) plus a manual NVDA screen-reader pass before launch.

- **Photos**: every image has (a) descriptive alt text for screen readers, (b) a visible caption, and (c) an **audio-description play button** — a clearly labeled, keyboard-operable button beside the image that plays a pre-rendered spoken description (narrator-style: people, action, setting). Nothing auto-plays; the visitor is always in control (satisfies WCAG 1.4.2 and avoids AD/screen-reader collision, since screen reader users get alt text natively and can choose the richer AD track).
- **Videos**: **Able Player** (open-source, purpose-built for WCAG/508) with synchronized captions, a WebVTT `kind="descriptions"` AD track toggleable from the player's own controls (satisfies 508 §503.4 — AD control at the same level as volume), and a transcript.
- **Highlight reels**: same Able Player treatment; the reel's narration doubles as its AD track.
- **"How to use this site"**: a short, plainly written, prominently linked page explaining the AD buttons, video player controls, and keyboard navigation.
- Full keyboard operability, skip links, logical heading structure, visible focus states throughout.
- **TTS voice**: a natural neural voice (e.g., Edge neural TTS — free), chosen for warmth; never a robotic default. Voice choice is a brand decision and gets a listening test before launch.

## Performance Budget

- Initial page load ≤ 3MB; hero imagery responsive (`srcset`) and modern-format (WebP/AVIF with JPEG fallback); everything below the fold lazy-loaded.
- Video never autoplays with sound; poster frames shown until click-to-play. Source videos (95–140MB .mov) are transcoded to streaming-friendly MP4 renditions before publishing.
- Mobile-first: most shared links open on phones.

## Media Pipeline

### Volunteer upload (the backend)

A **shared Google Drive folder** link (also distributed as a QR code at events). Volunteers upload photos/videos straight from their phone — no form, no new accounts, no app to learn. Optional conventions, not requirements: an event-day subfolder, descriptive filenames. The pipeline must work even when files arrive with no metadata beyond the file itself.

### Publishing skill (local, subscription-powered)

Publishing runs as a **local Claude Code skill** on the site owner's PC, using the existing Claude subscription — **no Claude API key, no cloud automation, no per-item cost**. The owner runs it after each sailing event (typically 1–2×/month in season); nothing publishes between runs.

Per run, the skill:

1. Pulls new files from the shared Drive folder (gws CLI).
2. Converts HEIC → JPEG/WebP renditions; transcodes video to web MP4 with poster frames (FFmpeg).
3. **Screens each item** (Claude, in-session): on-mission, appropriate, quality above floor?
   - **Clean items auto-publish** in this run.
   - **Suspicious, off-mission, inappropriate, or unusable items are held** in a review queue for explicit human approval — they never publish automatically. "No usable caption can be written" counts as held; **filename-derived captions are never published** (quality floor).
4. Writes caption, alt text, and AD script per item (Claude, in-session; drafts reviewed by the owner in the same session or later).
5. Renders AD narration audio via neural TTS.
6. **Builds the highlight reel** for the burst: Claude reviews sampled keyframes, audio transcripts, and captions, then writes a shot list (clip order, trim in/out points, per-photo duration with pan/zoom, narration line per segment, title). An FFmpeg script executes the shot list mechanically — trims, Ken Burns on stills, title cards, captions, crossfades, narration/AD track. The reel publishes as the burst's featured Logbook item.
7. Updates `media.json`, uploads video renditions to R2, commits and pushes → Cloudflare Pages deploys.

Published items and reels can be **upgraded in place later** (edit the AD script or reel shot list, re-run the relevant step) with no takedown or downtime.

Consent/media releases for people shown are handled by the org's existing intake process — out of scope here, but the skill's screening step flags images that look like they include non-participants (e.g., identifiable bystanders/minors) for human review.

### Abuse posture

The Drive link will circulate. Exposure is bounded because nothing reaches the public site without the skill running on the owner's machine, and the skill screens everything first. Rapid takedown = delete the item from `media.json` and push (documented one-liner in the repo README).

## Hosting & Tech Stack

Decisions (no open forks):

- **Hosting**: Cloudflare Pages (free tier), static site in a GitHub repo. Own shareable URL now; linkable/embeddable from blindsail.org later.
- **Video storage**: Cloudflare R2 (free tier — free egress, ~10GB), holding MP4 renditions and poster frames. Images live in the repo.
- **Site**: plain HTML/CSS/JS, no framework or build step. The Logbook and Voices render client-side from a runtime-fetched **`media.json`** manifest (id, type, urls, caption, alt, AD audio ref, VTT refs, chapter/event tags, people, date). The home narrative is hand-authored HTML referencing the same assets.
- **Player**: Able Player for all video and highlight reels.

## Error Handling

- Conversion, transcoding, or caption/AD generation failures **hold the item** with a logged reason — never a silent drop, never a degraded auto-publish.
- A skill run that fails mid-way is resumable: already-published items are unaffected; unprocessed items remain queued.
- Logbook renders sensibly when a month has no events; a reel that fails assembly publishes the burst's individual items without a reel and flags the failure.

## Sustainability

- Running cost ≈ $0 (free hosting tiers + existing Claude subscription + free TTS).
- Bus factor: if the skill never runs again, the site degrades gracefully to a static gallery of everything published so far — nothing breaks.
- The repo README documents: running the skill, approving held items, the takedown one-liner, and how a successor volunteer takes over (prereqs: GitHub access, Claude Code, gws CLI auth).

## Success Criteria / Testing

- A volunteer can go from phone photo → shared Drive folder unassisted in under a minute.
- One skill run turns a test burst (3+ photos, 1 video) into published Logbook items **plus an assembled highlight reel**, with clean items auto-published and a planted off-mission item correctly held for review.
- An NVDA user can navigate the site, operate an AD play button on a photo, and toggle AD on a video, keyboard-only.
- axe passes at WCAG 2.1 AA on home, Logbook, Voices, and item detail templates.
- Home page initial load ≤ 3MB on mobile; shared link unfurls with a proper social card.

## Out of Scope

- Consent/media-release collection (org's existing process).
- A CMS or web-based review UI — review of drafts and held items happens in the Claude Code session / repo.
- Embedding into blindsail.org (standalone site only, designed to be linkable).
- Unattended/scheduled publishing — publishing is deliberately gated on the owner running the skill.
