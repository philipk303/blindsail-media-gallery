# BlindSail SF Bay — Media Gallery Companion Page: Design

*This document supersedes `docs/superpowers/specs/2026-07-01-blindsail-media-showcase-design.md` and is the working design we develop from.*

## Purpose & Framing

A **companion gallery page** for BlindSail SF Bay (blindsail.org) — linked from the main site, not a replacement for it. Its job is **awareness**: show the organization, its mission, and above all the **empowerment and independence of its students**, through the program's own photos, videos, and auto-produced highlight reels.

Not a fundraising or conversion page. No donate/volunteer CTA blocks. The page tells the story; blindsail.org handles the asks. A simple, persistent link back to blindsail.org ("Learn more / sail with us") in header and footer is the only navigation off-page.

Secondary goal: a near-zero-friction path for volunteers to contribute new media from their phones after each sailing event.

## Voice & Content Emphasis

- Lead with **highlight reels** — the produced, narrated recaps of each sailing day are the marquee content, not buried in an archive.
- Students shown as sailors, not subjects: at the helm, trimming sheets, driving the boat. Captions and narration emphasize what they're *doing*.
- Org context woven in lightly: name, one-line mission ("Learn to harness the power of the wind and sail the bay"), all-volunteer nature, home waters (Oakland Yacht Club / Treasure Island, San Francisco Bay).
- Warm, first-person, human tone. Short sentences. Sailors' own words (from debrief interviews) wherever possible.

## Visual Theme — "Light Air"

Light, breezy, wind-and-water feel. White and blues. Hand-drawn.

- **Palette** (kept airy — pale tones dominate, deep blue is scarce):
  - Canvas: white / warm off-white (#FFFFFF / #FAFBFC), with lots of it — whitespace is the primary design material
  - Water blues: pale sky/foam (#E3F2FB, #CAE9FF) carry most surfaces and hairlines; mid breeze blue (#5FA8D3) for secondary text and line art; deep bay blue (#1B4965) reserved for headings, body text, and AD controls only
  - No third color family. Accents come from the photography itself.
  - All text/background pairings meet WCAG AA (body text targets AAA).
- **Illustration**: custom **hand-drawn-style SVG line art**, single-weight imperfect strokes in bay blue — sailboat, curling wind lines, wave sets, gulls, compass rose. Drawn for this site (not stock), used as section dividers, background flourishes, and empty-state art.
- **Motion — "wind"**: the page should feel like it's in a light breeze. Hand-drawn animation moments throughout: the hero sailboat draws itself in on first load (SVG stroke animation) and gently bobs; wind lines continuously redraw and drift; gulls drift slowly across section breaks; wave dividers undulate almost imperceptibly; clouds ease across the hero sky. All of it slow, soft, and loopable without demanding attention — garnish, never load-bearing. Everything honors `prefers-reduced-motion` (static art when set), and nothing parallaxes or hijacks scroll.
- **Ambient soundscape — "Sounds of the bay"**: an optional, clearly labeled toggle in the header. Off by default (autoplay audio is both browser-blocked and hostile to screen-reader users). When the visitor turns it on: a soft loop of small waves against a shore and rigging/dock ambience, with an occasional gentle sail luff and the occasional distant seagull call (sparse and randomized so it never becomes a pattern the ear tracks). It automatically ducks to silence whenever any video, reel, or audio description is playing and fades back after. Choice persists across visits (localStorage). Keyboard-operable, named in the "How to use this page" section, and compliant with WCAG 1.4.2 because it only ever plays by explicit user choice.
- **Typography — light and flowing, with a floor**: display face is a light, airy, flowing sans (e.g., Josefin Sans Light 300 or similar) used only at large sizes — the hero title and section headings. Body face is a soft rounded humanist sans (e.g., Nunito Sans 400) at 18px+. Hard accessibility floor: no weight below 400 under 28px, and no decorative/script faces for body copy — low-vision readers are this site's core audience.
- **Title animation — "blown in"**: on first load, the hero title's words drift in as if carried by the breeze — a soft leftward-to-settled glide with a slight luff — then settle. Accessible treatment: the heading carries its full text for assistive tech immediately (`aria-label`; animated letter/word spans are `aria-hidden`), and a visually-hidden sentence describes the effect once settled ("The title drifts in like a sail catching the wind, then settles") — the animation itself gets described, the same courtesy the photos get. `prefers-reduced-motion` renders the title static.
- **All animations get described**: the page's decorative motion — the self-sketching bobbing sailboat, gliding gulls, breathing wind lines, swaying waves — is `aria-hidden` individually but described once, collectively, in accessible text (a short visually-hidden scene-setter near the top of the page, repeated in "How to use this page"): e.g., "Across this page, a hand-drawn sailboat sketches itself in and bobs gently, gulls glide by, and thin wind lines drift like a light breeze." One evocative description rather than per-element chatter, so screen reader users get the atmosphere without the clutter.
- **Photography**: full-bleed and large. Real people, real water, never stock. Hand-drawn elements frame the photos; they never compete with them.

## Site Structure

Three views of one media library, one page apiece:

1. **Home — "A Day on the Water"**: opens with the org name, mission line, and the **latest highlight reel** front and center. Below it, a hand-curated four-chapter narrative built from the best media:
   1. *Welcome Aboard* — arriving at OYC, meeting instructors and crew
   2. *Cast Off* — leaving the slip, getting underway
   3. *At the Helm* — VI sailors driving, trimming, sailing the boat
   4. *Back at the Dock* — debrief, community, celebration
   Chapters use a split-panel scroll layout (story text anchored, imagery scrolling) that linearizes cleanly for screen readers and small screens.
2. **Voices** — interview spotlight cards (launching with the David Cook and Priscilla Aguiar debriefs): video, captions, transcript, audio description. Grows as more interviews are recorded. Manually curated.
3. **The Logbook** — chronological archive: each sailing event is an entry led by its highlight reel, with the day's individual photos/videos beneath. Newest first. This is where volunteer uploads land automatically.

Standout Logbook items can be manually promoted into the home narrative or Voices.

## Accessibility Model

Target: WCAG 2.1 AA + Section 508, verified by axe scan plus a manual NVDA pass before launch.

- **Photos**: descriptive alt text (screen readers) + visible caption + an **audio-description play button** beside each image — clearly labeled, keyboard-operable, plays a pre-rendered narrator-style description. Nothing auto-plays (WCAG 1.4.2); AD and screen reader never collide because the button is user-invoked.
- **Videos & reels**: **Able Player** wrapping the YouTube-hosted video, with our own WebVTT caption track and `kind="descriptions"` AD track layered on top — AD toggle lives in the player controls (508 §503.4). Transcript below each video.
- **"How to use this page"**: short plain-language section explaining the AD buttons, player controls, and keyboard navigation.
- Full keyboard operability, skip links, logical headings, visible focus states.
- **TTS voice** for AD narration and reel voiceover: natural neural voice (e.g., Edge neural TTS — free), chosen by listening test. Never a robotic default.

## Video Hosting — YouTube

BlindSail has no YouTube channel of its own, so video is hosted on the site owner's personal YouTube account (**philipk303**) as **unlisted** uploads (updated 2026-07-01; supersedes the original org-channel assumption):

- The publishing skill uploads processed videos and highlight reels via the YouTube Data API using philipk303@gmail.com credentials, unlisted by default (unlisted still embeds fine and stays off the account's public page).
- On the page, every video is embedded through **Able Player's YouTube integration**, which keeps our accessible controls, caption track, and AD track regardless of YouTube's own player limitations.
- Benefits: free, unlimited, in-house for the org, no separate storage service; YouTube also becomes a secondary discovery channel for the reels.
- Poster images and photos live in the site repo; no other media storage service needed.

## Media Pipeline

### Volunteer upload

A **shared Google Drive folder** link (+ QR code at events). Volunteers upload straight from their phones — no form, no accounts, no app. Optional conventions (event-day subfolder, descriptive filenames), but the pipeline works with zero metadata.

### Publishing skill (local, subscription-powered)

A **local Claude Code skill** on the site owner's PC using the existing Claude subscription — no API key, no cloud automation, no per-item cost. Run after each sailing event (1–2×/month in season); nothing publishes between runs.

Per run:

1. Pull new files from the shared Drive folder (gws CLI).
2. Convert HEIC → JPEG/WebP renditions; transcode video to web MP4; generate poster frames (FFmpeg).
3. **Screen each item** (Claude in-session): on-mission, appropriate, quality above floor?
   - Clean items **auto-publish** this run.
   - Suspicious, off-mission, inappropriate, or uncaptionable items are **held** for explicit human approval. Filename-derived captions never publish.
   - Items that appear to include identifiable non-participants (bystanders, minors) are flagged for human review.
4. Write caption, alt text, and AD script per item (Claude in-session).
5. Render AD narration audio (neural TTS).
6. **Build the burst's highlight reel**: Claude reviews sampled keyframes, audio transcripts, and captions → writes a shot list (clip order, trim points, per-photo duration with pan/zoom, narration line per segment, title). FFmpeg executes the shot list mechanically: trims, Ken Burns stills, title cards, captions, crossfades, narration/AD track.
7. Upload videos + reel to the org's YouTube channel (API); update `media.json`; commit and push → Cloudflare Pages deploys.

Published items and reels can be **upgraded in place** later (edit AD script or shot list, re-run that step) — no takedown, no downtime.

Consent/media releases are handled by the org's existing intake process (out of scope), backed by the screening flag above.

### Abuse posture

The Drive link will circulate. Exposure is bounded: nothing reaches the public page without the skill running on the owner's machine, and the skill screens everything first. Takedown = remove the item from `media.json`, push (documented one-liner in the README); YouTube items additionally set private via the channel.

## Hosting & Tech Stack

- **Site hosting**: Cloudflare Pages (free), static site in a GitHub repo. Own shareable URL; linked from blindsail.org.
- **Video**: org YouTube channel (above). **Images**: in-repo, responsive renditions.
- **Site**: plain HTML/CSS/JS, no framework, no build step. Logbook and Voices render client-side from a runtime-fetched `media.json` (id, type, youtubeId/urls, caption, alt, AD audio ref, VTT refs, chapter/event tags, people, date). Home narrative is hand-authored HTML referencing the same assets.
- **Player**: Able Player everywhere.
- **Social cards**: Open Graph + Twitter meta with a strong preview image, so shared links unfurl properly.

## Performance Budget

- Initial load ≤ 3MB; responsive images (`srcset`, WebP/AVIF with JPEG fallback); below-the-fold lazy-loaded.
- Video never autoplays; poster frame until click-to-play (also avoids YouTube's embed weight until interaction).
- Mobile-first — shared links open mostly on phones.

## Error Handling

- Conversion, caption/AD, or upload failures **hold the item** with a logged reason — never silent drops, never degraded auto-publish.
- A failed skill run is resumable; published items unaffected, unprocessed items stay queued.
- A reel that fails assembly publishes the burst's individual items without a reel and flags the failure. Logbook renders sensibly for empty months.

## Sustainability

- Running cost ≈ $0 (free hosting + existing Claude subscription + free TTS + YouTube).
- Bus factor: if the skill never runs again, the page degrades gracefully to a static gallery of everything published.
- README documents: running the skill, approving held items, takedown, and successor handover (GitHub access, Claude Code, gws CLI auth, YouTube channel access).

## Success Criteria

- Volunteer: phone photo → shared Drive folder unassisted in under a minute.
- One skill run: test burst (3+ photos, 1 video) → published Logbook entry **with assembled highlight reel on YouTube**, clean items auto-published, a planted off-mission item correctly held.
- NVDA user can navigate, play a photo's AD button, and toggle AD on a video, keyboard-only.
- axe passes WCAG 2.1 AA on all three pages; home ≤ 3MB initial load on mobile; links unfurl with a proper social card.

## Out of Scope

- Fundraising/CTA features (blindsail.org's job).
- Consent/release collection (org's existing process).
- CMS or web review UI (review happens in the Claude Code session / repo).
- Unattended scheduled publishing (deliberately gated on the owner running the skill).
- Embedding into blindsail.org (standalone, linkable).
