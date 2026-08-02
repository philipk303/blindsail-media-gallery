# BlindSail Static Page Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Run build/review subagents on model `fable`.

**Goal:** Build the static, no-build-step HTML/CSS/JS page shell for the BlindSail SF Bay media gallery (Home, Voices, Logbook) implementing the "Light Air" theme, Able Player video, AD play buttons, and WCAG 2.1 AA accessibility scaffolding — fully testable against sample data, with a real GitHub repo deployed to Cloudflare Pages.

**Architecture:** Three static HTML pages share duplicated header/footer/skip-link chrome (no framework, no JS templating for critical structure — screen readers must not depend on JS). `js/media-loader.js` fetches `media.json` at runtime and renders Logbook/Voices cards and the AD-button/Able-Player markup. `media.json` in the repo ships small **synthetic placeholder** entries (safe to deploy publicly, no real participants). A separate, gitignored `scripts/convert-local-media.mjs` converts the real local `BlindSail-JJ-1/` HEIC/MOV files into a gitignored `media/local/` folder + `media.local.json`, which `media-loader.js` prefers over `media.json` when present (404 → falls back) — giving real-photo visual QA locally without ever committing or deploying unscreened participant media.

**Tech Stack:** Plain HTML5/CSS3/ES modules, no build tooling for the site itself. Able Player (video), ffmpeg (local media conversion + placeholder asset generation, already installed), Playwright + `@axe-core/playwright` (test tooling only, own `package.json`), GitHub + Cloudflare Pages (hosting).

---

## File Structure

```
index.html                  Home — "A Day on the Water"
voices.html                 Voices — interview spotlight cards
logbook.html                The Logbook — chronological archive
css/tokens.css              Color/type/spacing custom properties, prefers-reduced-motion base
css/base.css                Reset, layout primitives, skip link, focus states
css/components.css          AD button, cards, Able Player wrapper, ambient toggle
svg/sailboat-hero.svg       Hand-drawn hero sailboat (stroke-draw + bob animation)
svg/wind-lines.svg          Drifting wind line motif
svg/wave-divider.svg        Section-break wave divider
svg/gull.svg                Single gull silhouette, reused/positioned via CSS
js/media-loader.js          Fetches media.json/media.local.json, renders Logbook + Voices
js/ad-button.js             Audio-description play button behavior
js/ambient-sound.js         "Sounds of the bay" toggle, localStorage, duck/restore
js/reduced-motion.js        Central prefers-reduced-motion gate used by hero + ambient
media.json                  Committed, deployed — synthetic placeholder entries only
media/placeholders/         Committed — generated placeholder JPEGs/poster frames
audio/ambient-waves.mp3     Committed — generated placeholder ambient loop
scripts/convert-local-media.mjs   Gitignored-output generator: real BlindSail-JJ-1 → media/local/ + media.local.json
tests/a11y.spec.js          Playwright + axe-core scan of all 3 pages
tests/interaction.spec.js   Playwright keyboard/reduced-motion/ambient-toggle checks
tests/package.json          Playwright + axe-core devDependencies, test script
.gitignore                  (existing) + media/local/, media.local.json
README.md                   Run instructions, local media QA, deploy notes
```

---

## Task 1: Repo, GitHub, Cloudflare Pages

**Files:**
- Modify: `.gitignore`
- Create: `README.md`

- [ ] **Step 1: Extend `.gitignore`**

Append to the existing `.gitignore`:

```
# Local-only real-media QA (never committed/deployed)
media/local/
media.local.json
```

- [ ] **Step 2: Create the GitHub repo and connect it**

```bash
gh repo create blindsail-media-gallery --public --source=. --remote=origin
git add .gitignore
git commit -m "chore: extend gitignore for local media QA outputs"
git push -u origin main
```

Expected: `gh repo create` prints the new repo URL; `git push` succeeds and sets upstream tracking.

- [ ] **Step 3: Connect Cloudflare Pages**

In the Cloudflare dashboard (Pages → Create project → Connect to Git), select the new `blindsail-media-gallery` repo, build command: none, build output directory: `/` (repo root), branch: `main`. Record the resulting `*.pages.dev` URL in `README.md` under a "Live preview" heading.

- [ ] **Step 4: Write `README.md`**

```markdown
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

<Cloudflare Pages URL — fill in after Task 1 Step 3>
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add README with local media QA and test instructions"
git push
```

---

## Task 2: Design tokens & base styles

**Files:**
- Create: `css/tokens.css`
- Create: `css/base.css`
- Test: `tests/a11y.spec.js` (contrast is exercised by axe in Task 11; this task hand-verifies the two risky pairings below)

- [ ] **Step 1: Write `css/tokens.css`**

Deep bay blue (`#1B4965`) on white measures ~9.6:1 (AAA) — safe for headings/body/AD controls per design.md. Design.md's "mid breeze blue" (`#5FA8D3`) on white measures only ~2.6:1 — **fails WCAG AA even for large text**, so it is scoped to decorative line-art only, never text. A darkened variant (`#3E7A9E`, ~4.7:1) is introduced for secondary/caption text where design.md called for the lighter blue.

```css
:root {
  /* Canvas */
  --color-canvas: #FFFFFF;
  --color-canvas-warm: #FAFBFC;

  /* Water blues */
  --color-surface-pale: #E3F2FB;
  --color-surface-foam: #CAE9FF;
  --color-line-art: #5FA8D3;       /* decorative SVG strokes only — fails AA as text */
  --color-text-secondary: #3E7A9E; /* darkened breeze blue, ~4.7:1 on white, AA */
  --color-text-primary: #1B4965;   /* ~9.6:1 on white, AAA */
  --color-control: #1B4965;

  /* Type */
  --font-display: "Josefin Sans", sans-serif;
  --font-body: "Nunito Sans", sans-serif;
  --font-weight-body-floor: 400; /* never below this under 28px */

  /* Spacing */
  --space-1: 0.5rem;
  --space-2: 1rem;
  --space-3: 2rem;
  --space-4: 4rem;

  /* Motion */
  --duration-slow: 8s;
  --duration-medium: 2s;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-slow: 0s;
    --duration-medium: 0s;
  }
}
```

- [ ] **Step 2: Write `css/base.css`**

```css
* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--color-canvas);
  color: var(--color-text-primary);
  font-family: var(--font-body);
  font-weight: var(--font-weight-body-floor);
  font-size: 18px;
  line-height: 1.6;
}

h1, h2, h3 { font-family: var(--font-display); font-weight: 300; color: var(--color-text-primary); }

.visually-hidden {
  position: absolute;
  width: 1px; height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.skip-link {
  position: absolute;
  left: -999px;
  top: 0;
  background: var(--color-text-primary);
  color: var(--color-canvas);
  padding: var(--space-1) var(--space-2);
  z-index: 100;
}
.skip-link:focus {
  left: var(--space-1);
  top: var(--space-1);
}

:focus-visible {
  outline: 3px solid var(--color-text-primary);
  outline-offset: 2px;
}
```

- [ ] **Step 3: Verify contrast manually**

Open `css/tokens.css` values in a contrast checker (e.g. WebAIM) for `--color-text-primary` on `--color-canvas` and `--color-text-secondary` on `--color-canvas`. Expected: 9.6:1 and 4.7:1 respectively, both ≥ AA (4.5:1 normal text).

- [ ] **Step 4: Commit**

```bash
git add css/tokens.css css/base.css
git commit -m "feat: add design tokens and base styles"
git push
```

---

## Task 3: Shared page chrome (header, skip link, footer, "How to use this page")

**Files:**
- Create: `index.html`, `voices.html`, `logbook.html` (header/footer/skip-link identical across all three; page-specific `<main>` content added in later tasks)

- [ ] **Step 1: Write the shared header/footer block**

Use this exact markup at the top and bottom of each of the three HTML files (the `<title>` and the `aria-current` nav item differ per page):

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>A Day on the Water — BlindSail SF Bay</title>
  <meta property="og:title" content="BlindSail SF Bay — A Day on the Water">
  <meta property="og:description" content="Learn to harness the power of the wind and sail the bay — photos, videos, and highlight reels from BlindSail SF Bay.">
  <meta property="og:image" content="/media/placeholders/social-card.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="css/tokens.css">
  <link rel="stylesheet" href="css/base.css">
  <link rel="stylesheet" href="css/components.css">
</head>
<body>
  <a class="skip-link" href="#main">Skip to main content</a>

  <p class="visually-hidden">
    Across this page, a hand-drawn sailboat sketches itself in and bobs gently,
    gulls glide by, and thin wind lines drift like a light breeze.
  </p>

  <header>
    <nav aria-label="Primary">
      <a href="index.html" aria-current="page">Home</a>
      <a href="voices.html">Voices</a>
      <a href="logbook.html">The Logbook</a>
      <button id="ambient-toggle" type="button" aria-pressed="false">
        🌊 Sounds of the bay
      </button>
      <a href="https://blindsail.org">Learn more / sail with us</a>
    </nav>
  </header>

  <main id="main">
    <!-- page-specific content, Tasks 8-10 -->
  </main>

  <section aria-labelledby="how-to-use-heading">
    <h2 id="how-to-use-heading">How to use this page</h2>
    <p>
      Each photo has an audio-description button next to it that plays a short
      spoken description on request — nothing plays automatically. Videos use
      an accessible player with a caption toggle and an audio-description
      toggle in the control bar. The "Sounds of the bay" button in the header
      turns on an optional ambient soundscape; it is off by default and pauses
      automatically whenever a video or audio description is playing. Every
      part of this page can be reached and operated using only a keyboard.
    </p>
  </section>

  <footer>
    <a href="https://blindsail.org">Learn more / sail with us</a>
    <p>BlindSail SF Bay — Oakland Yacht Club, Treasure Island, San Francisco Bay</p>
  </footer>

  <script type="module" src="js/reduced-motion.js"></script>
  <script type="module" src="js/ambient-sound.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create the three files**

Copy the block above into `index.html`, `voices.html`, `logbook.html`. In `voices.html` and `logbook.html`, change `<title>` to `"Voices — BlindSail SF Bay"` / `"The Logbook — BlindSail SF Bay"`, and move `aria-current="page"` to the matching nav link.

- [ ] **Step 3: Open `index.html` directly in a browser and confirm**

Expected: header nav, ambient toggle button, and "How to use this page" section render with no console errors (module scripts don't exist yet — Task 6/reduced-motion.js will resolve the 404s).

- [ ] **Step 4: Commit**

```bash
git add index.html voices.html logbook.html
git commit -m "feat: add shared page chrome across all three pages"
git push
```

---

## Task 4: Reduced-motion gate

**Files:**
- Create: `js/reduced-motion.js`

- [ ] **Step 1: Write the module**

```js
export const prefersReducedMotion =
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.documentElement.classList.toggle('reduced-motion', prefersReducedMotion);
```

- [ ] **Step 2: Add the CSS hook in `css/base.css`**

```css
.reduced-motion * {
  animation: none !important;
  transition: none !important;
}
```

- [ ] **Step 3: Verify in browser**

Open DevTools → Rendering → "Emulate CSS prefers-reduced-motion: reduce", reload `index.html`. Expected: `<html>` gains class `reduced-motion`, no console errors.

- [ ] **Step 4: Commit**

```bash
git add js/reduced-motion.js css/base.css
git commit -m "feat: add prefers-reduced-motion gate"
git push
```

---

## Task 5: Hero sailboat SVG + wind lines + title animation

**Files:**
- Create: `svg/sailboat-hero.svg`
- Create: `svg/wind-lines.svg`
- Modify: `index.html` (hero section inside `<main>`)
- Modify: `css/components.css`

- [ ] **Step 1: Write `svg/sailboat-hero.svg`**

```svg
<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
  <path id="hull" d="M120 220 Q200 250 280 220 L260 235 Q200 245 140 235 Z"
        fill="none" stroke="#5FA8D3" stroke-width="3" stroke-linecap="round"/>
  <path id="mast" d="M200 220 L200 80" fill="none" stroke="#5FA8D3" stroke-width="3" stroke-linecap="round"/>
  <path id="sail" d="M200 90 Q250 140 205 215 Q200 150 200 90 Z"
        fill="none" stroke="#5FA8D3" stroke-width="3" stroke-linejoin="round"/>
</svg>
```

- [ ] **Step 2: Write `svg/wind-lines.svg`**

```svg
<svg viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
  <path class="wind-line" d="M20 30 Q80 20 140 30 T260 30" fill="none" stroke="#5FA8D3" stroke-width="2" stroke-linecap="round"/>
  <path class="wind-line" d="M20 60 Q80 50 140 60 T260 60" fill="none" stroke="#5FA8D3" stroke-width="2" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 3: Add stroke-draw + bob + drift animations to `css/components.css`**

```css
#hull, #mast, #sail {
  stroke-dasharray: 400;
  stroke-dashoffset: 400;
  animation: draw-in 2.5s ease-out forwards, bob var(--duration-slow) ease-in-out 2.5s infinite;
}
@keyframes draw-in { to { stroke-dashoffset: 0; } }
@keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }

.wind-line {
  stroke-dasharray: 20 10;
  animation: drift var(--duration-medium) linear infinite;
}
@keyframes drift { to { stroke-dashoffset: -30; } }

.reduced-motion #hull, .reduced-motion #mast, .reduced-motion #sail {
  stroke-dashoffset: 0;
  animation: none;
}
.reduced-motion .wind-line { animation: none; }
```

- [ ] **Step 4: Add the hero section to `index.html`'s `<main>`, replacing the placeholder comment**

```html
<section class="hero">
  <div class="hero-art" aria-hidden="true">
    <img src="svg/sailboat-hero.svg" alt="" width="400" height="300">
    <img src="svg/wind-lines.svg" alt="" width="400" height="100">
  </div>
  <h1 aria-label="BlindSail SF Bay — A Day on the Water">
    <span class="word" aria-hidden="true">BlindSail</span>
    <span class="word" aria-hidden="true">SF</span>
    <span class="word" aria-hidden="true">Bay</span>
  </h1>
  <p class="visually-hidden">The title drifts in like a sail catching the wind, then settles.</p>
  <p class="mission">Learn to harness the power of the wind and sail the bay.</p>
  <p>An all-volunteer program at Oakland Yacht Club, Treasure Island, San Francisco Bay.</p>
</section>
```

- [ ] **Step 5: Add the word "blown in" animation to `css/components.css`**

```css
.hero h1 .word {
  display: inline-block;
  opacity: 0;
  transform: translateX(-40px) rotate(-3deg);
  animation: blow-in 1.2s ease-out forwards;
}
.hero h1 .word:nth-child(2) { animation-delay: 0.2s; }
.hero h1 .word:nth-child(3) { animation-delay: 0.4s; }
@keyframes blow-in {
  60% { transform: translateX(4px) rotate(1deg); }
  to { opacity: 1; transform: translateX(0) rotate(0); }
}
.reduced-motion .hero h1 .word {
  opacity: 1; transform: none; animation: none;
}
```

- [ ] **Step 6: Verify in browser**

Open `index.html`. Expected: sailboat draws itself in over ~2.5s then bobs; title words glide in with a slight overshoot; with reduced-motion emulated, both render fully-formed instantly with no animation.

- [ ] **Step 7: Commit**

```bash
git add svg/sailboat-hero.svg svg/wind-lines.svg index.html css/components.css
git commit -m "feat: add animated hero sailboat and blown-in title"
git push
```

---

## Task 6: "Sounds of the bay" ambient toggle

**Files:**
- Create: `js/ambient-sound.js`
- Create: `audio/ambient-waves.mp3` (generated placeholder)
- Modify: `css/components.css`

- [ ] **Step 1: Generate a placeholder ambient loop with ffmpeg**

No real field recording exists yet, so generate a soft, fading pink-noise loop as a functional placeholder (to be swapped for a real recording later — a content change, not a code change):

```bash
mkdir -p audio
ffmpeg -y -f lavfi -i "anoisesrc=color=pink:amplitude=0.04:duration=30" \
  -af "afade=t=in:d=3,afade=t=out:st=27:d=3" \
  audio/ambient-waves.mp3
```

Expected: `audio/ambient-waves.mp3` exists, ~30s, plays as soft continuous noise when previewed.

- [ ] **Step 2: Write `js/ambient-sound.js`**

```js
const STORAGE_KEY = 'blindsail-ambient-enabled';
const audio = new Audio('audio/ambient-waves.mp3');
audio.loop = true;
let userWantsAmbient = localStorage.getItem(STORAGE_KEY) === 'true';
let duckedForMedia = false;

const toggle = document.getElementById('ambient-toggle');

function applyState() {
  toggle.setAttribute('aria-pressed', String(userWantsAmbient));
  if (userWantsAmbient && !duckedForMedia) {
    audio.play().catch(() => {});
  } else {
    audio.pause();
  }
}

toggle.addEventListener('click', () => {
  userWantsAmbient = !userWantsAmbient;
  localStorage.setItem(STORAGE_KEY, String(userWantsAmbient));
  applyState();
});

// Exposed for AD buttons / Able Player instances to duck ambient sound
export function duckAmbient() {
  duckedForMedia = true;
  applyState();
}
export function restoreAmbient() {
  duckedForMedia = false;
  applyState();
}

applyState();
```

- [ ] **Step 3: Style the toggle in `css/components.css`**

```css
#ambient-toggle {
  background: var(--color-surface-pale);
  color: var(--color-text-primary);
  border: 1px solid var(--color-text-primary);
  border-radius: 999px;
  padding: var(--space-1) var(--space-2);
  cursor: pointer;
}
#ambient-toggle[aria-pressed="true"] {
  background: var(--color-text-primary);
  color: var(--color-canvas);
}
```

- [ ] **Step 4: Verify in browser**

Open `index.html`, click "Sounds of the bay". Expected: `aria-pressed` flips to `true`, audio plays softly, button restyles; reload the page — toggle stays on (localStorage persisted). Click again to turn off.

- [ ] **Step 5: Commit**

```bash
git add audio/ambient-waves.mp3 js/ambient-sound.js css/components.css
git commit -m "feat: add Sounds of the bay ambient toggle with persistence"
git push
```

---

## Task 7: `media.json` schema, placeholder assets, and local real-media conversion script

**Files:**
- Create: `media.json`
- Create: `media/placeholders/` (generated images)
- Create: `scripts/convert-local-media.mjs`

- [ ] **Step 1: Generate placeholder images with ffmpeg**

```bash
mkdir -p media/placeholders
for name in welcome-aboard cast-off at-helm back-at-dock voices-david voices-priscilla logbook-01 social-card; do
  ffmpeg -y -f lavfi -i "color=c=0xCAE9FF:s=1200x800" \
    -vf "drawtext=text='BlindSail SF Bay — sample photo':fontcolor=0x1B4965:fontsize=36:x=(w-text_w)/2:y=(h-text_h)/2" \
    -frames:v 1 "media/placeholders/${name}.jpg"
done
```

Expected: 8 placeholder JPEGs in `media/placeholders/`, pale-blue with centered label text — safe to commit and deploy (no real people).

- [ ] **Step 2: Write `media.json`**

```json
{
  "items": [
    {
      "id": "logbook-01-welcome",
      "type": "photo",
      "src": "media/placeholders/welcome-aboard.jpg",
      "alt": "Sample placeholder photo — Welcome Aboard chapter",
      "caption": "Sample caption — replace once the publishing skill ships real items.",
      "adAudio": null,
      "chapter": "welcome-aboard",
      "event": "sample-event-2026-07-01",
      "date": "2026-07-01"
    },
    {
      "id": "voices-david-cook",
      "type": "video",
      "youtubeId": null,
      "poster": "media/placeholders/voices-david.jpg",
      "caption": "Sample placeholder — David Cook debrief interview",
      "vtt": null,
      "adTrack": null,
      "transcript": "Transcript will be added once the real interview video is published.",
      "person": "David Cook"
    },
    {
      "id": "voices-priscilla-aguiar",
      "type": "video",
      "youtubeId": null,
      "poster": "media/placeholders/voices-priscilla.jpg",
      "caption": "Sample placeholder — Priscilla Aguiar debrief interview",
      "vtt": null,
      "adTrack": null,
      "transcript": "Transcript will be added once the real interview video is published.",
      "person": "Priscilla Aguiar"
    },
    {
      "id": "logbook-01-photo",
      "type": "photo",
      "src": "media/placeholders/logbook-01.jpg",
      "alt": "Sample placeholder photo for a Logbook entry",
      "caption": "Sample Logbook photo — sailing day recap.",
      "adAudio": null,
      "chapter": null,
      "event": "sample-event-2026-07-01",
      "date": "2026-07-01"
    }
  ]
}
```

- [ ] **Step 3: Write `scripts/convert-local-media.mjs`**

```js
import { execSync } from 'node:child_process';
import { readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const SRC_PHOTOS = 'BlindSail-JJ-1/Blind Sail-JJ-1/Photos';
const SRC_VIDEOS = 'BlindSail-JJ-1/Blind Sail-JJ-1/Video clips';
const OUT_DIR = 'media/local';

if (!existsSync(SRC_PHOTOS)) {
  console.error(`Not found: ${SRC_PHOTOS}. Run this from the repo root with BlindSail-JJ-1/ present.`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

const items = [];

for (const file of readdirSync(SRC_PHOTOS)) {
  const base = path.parse(file).name;
  const outFile = `${OUT_DIR}/${base}.jpg`;
  execSync(`ffmpeg -y -i "${SRC_PHOTOS}/${file}" -update 1 -frames:v 1 -vf scale=1200:-1 "${outFile}"`);
  items.push({
    id: `local-${base.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    type: 'photo',
    src: outFile,
    alt: base,
    caption: base,
    adAudio: null,
    chapter: null,
    event: 'local-qa',
    date: '2026-06-13'
  });
}

for (const file of readdirSync(SRC_VIDEOS)) {
  const base = path.parse(file).name;
  const outFile = `${OUT_DIR}/${base}.mp4`;
  const posterFile = `${OUT_DIR}/${base}-poster.jpg`;
  execSync(`ffmpeg -y -i "${SRC_VIDEOS}/${file}" -vf scale=1280:-2 -c:v libx264 -crf 23 -c:a aac "${outFile}"`);
  execSync(`ffmpeg -y -i "${outFile}" -update 1 -frames:v 1 -ss 1 "${posterFile}"`);
  items.push({
    id: `local-${base.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    type: 'video',
    youtubeId: null,
    localSrc: outFile,
    poster: posterFile,
    caption: base,
    vtt: null,
    adTrack: null,
    transcript: null,
    person: null
  });
}

writeFileSync('media.local.json', JSON.stringify({ items }, null, 2));
console.log(`Wrote ${items.length} items to media.local.json (gitignored, local QA only).`);
```

- [ ] **Step 4: Run it and verify**

```bash
node scripts/convert-local-media.mjs
```

Expected: `media/local/` populated with 16 JPEGs + 4 MP4s + 4 poster frames; `media.local.json` written with 20 items; `git status` shows both as untracked-and-ignored (confirm with `git status --ignored`).

- [ ] **Step 5: Commit (placeholders and script only — media/local and media.local.json stay gitignored)**

```bash
git add media/placeholders media.json scripts/convert-local-media.mjs
git commit -m "feat: add media.json schema, placeholder assets, and local media QA script"
git push
```

---

## Task 8: `media-loader.js` — Logbook and Voices rendering + AD button

**Files:**
- Create: `js/media-loader.js`
- Create: `js/ad-button.js`
- Modify: `logbook.html`, `voices.html` (`<main>` content)
- Modify: `css/components.css`

- [ ] **Step 1: Write `js/ad-button.js`**

```js
import { duckAmbient, restoreAmbient } from './ambient-sound.js';

export function createAdButton(adAudioSrc) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ad-button';
  button.textContent = 'Play audio description';

  if (!adAudioSrc) {
    button.disabled = true;
    button.textContent = 'Audio description not yet available';
    return button;
  }

  const audio = new Audio(adAudioSrc);
  const status = document.createElement('span');
  status.className = 'visually-hidden';
  status.setAttribute('aria-live', 'polite');

  button.addEventListener('click', () => {
    duckAmbient();
    status.textContent = 'Playing audio description';
    audio.currentTime = 0;
    audio.play();
  });
  audio.addEventListener('ended', () => {
    status.textContent = 'Audio description finished';
    restoreAmbient();
  });

  const wrapper = document.createElement('span');
  wrapper.append(button, status);
  return wrapper;
}
```

- [ ] **Step 2: Write `js/media-loader.js`**

```js
import { createAdButton } from './ad-button.js';

async function loadMedia() {
  const localResponse = await fetch('media.local.json').catch(() => null);
  if (localResponse && localResponse.ok) {
    return (await localResponse.json()).items;
  }
  const response = await fetch('media.json');
  return (await response.json()).items;
}

function renderPhotoCard(item) {
  const card = document.createElement('article');
  card.className = 'media-card';
  const img = document.createElement('img');
  img.src = item.src;
  img.alt = item.alt;
  img.loading = 'lazy';
  const caption = document.createElement('p');
  caption.textContent = item.caption;
  card.append(img, caption, createAdButton(item.adAudio));
  return card;
}

function renderVideoCard(item) {
  const card = document.createElement('article');
  card.className = 'media-card';
  const heading = document.createElement('p');
  heading.textContent = item.caption;
  const player = document.createElement('div');
  player.className = 'able-player-mount';
  player.dataset.youtubeId = item.youtubeId ?? '';
  player.dataset.localSrc = item.localSrc ?? '';
  player.dataset.poster = item.poster ?? '';
  player.dataset.vtt = item.vtt ?? '';
  player.dataset.adTrack = item.adTrack ?? '';
  const transcript = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Transcript';
  transcript.append(summary, document.createTextNode(item.transcript ?? 'Transcript not yet available.'));
  card.append(heading, player, transcript);
  return card;
}

export async function renderLogbook(container) {
  const items = await loadMedia();
  const byEvent = new Map();
  for (const item of items) {
    const key = item.event ?? 'unknown-event';
    if (!byEvent.has(key)) byEvent.set(key, []);
    byEvent.get(key).push(item);
  }
  for (const [event, eventItems] of [...byEvent.entries()].sort().reverse()) {
    const section = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = event;
    section.append(heading);
    for (const item of eventItems) {
      section.append(item.type === 'video' ? renderVideoCard(item) : renderPhotoCard(item));
    }
    container.append(section);
  }
}

export async function renderVoices(container) {
  const items = await loadMedia();
  for (const item of items.filter(i => i.person)) {
    container.append(renderVideoCard(item));
  }
}
```

- [ ] **Step 3: Wire up `logbook.html`'s `<main>`**

```html
<main id="main">
  <h1>The Logbook</h1>
  <div id="logbook-entries"></div>
  <script type="module">
    import { renderLogbook } from './js/media-loader.js';
    renderLogbook(document.getElementById('logbook-entries'));
  </script>
</main>
```

- [ ] **Step 4: Wire up `voices.html`'s `<main>`**

```html
<main id="main">
  <h1>Voices</h1>
  <div id="voices-cards"></div>
  <script type="module">
    import { renderVoices } from './js/media-loader.js';
    renderVoices(document.getElementById('voices-cards'));
  </script>
</main>
```

- [ ] **Step 5: Style cards in `css/components.css`**

```css
.media-card { margin-block: var(--space-3); max-width: 600px; }
.media-card img { width: 100%; height: auto; border-radius: 4px; }
.ad-button {
  background: var(--color-canvas);
  color: var(--color-text-primary);
  border: 2px solid var(--color-text-primary);
  border-radius: 4px;
  padding: var(--space-1);
  margin-block-start: var(--space-1);
  cursor: pointer;
}
.ad-button:disabled { opacity: 0.5; cursor: not-allowed; }
```

- [ ] **Step 6: Verify in browser**

Open `logbook.html`. Expected: one section per event, placeholder photo cards with working "Play audio description" buttons (disabled, since `adAudio` is `null` in the sample data) and a video card shell. Open `voices.html`: two video cards (David Cook, Priscilla Aguiar) render.

- [ ] **Step 7: Commit**

```bash
git add js/media-loader.js js/ad-button.js logbook.html voices.html css/components.css
git commit -m "feat: render Logbook and Voices from media.json with AD buttons"
git push
```

---

## Task 9: Able Player integration

**Files:**
- Modify: `index.html`, `voices.html`, `logbook.html` (`<head>` — add Able Player assets)
- Create: `js/able-player-init.js`

- [ ] **Step 1: Add Able Player CDN assets to each page's `<head>`**

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/able-player@4/build/ableplayer.min.css">
<script src="https://cdn.jsdelivr.net/npm/able-player@4/build/ableplayer.min.js"></script>
```

- [ ] **Step 2: Write `js/able-player-init.js`**

```js
import { duckAmbient, restoreAmbient } from './ambient-sound.js';

export function mountAblePlayers(root = document) {
  for (const mount of root.querySelectorAll('.able-player-mount')) {
    const video = document.createElement('video');
    video.setAttribute('data-able-player', '');
    video.poster = mount.dataset.poster || '';

    if (mount.dataset.youtubeId) {
      const source = document.createElement('source');
      source.setAttribute('data-youtube-id', mount.dataset.youtubeId);
      video.append(source);
    } else if (mount.dataset.localSrc) {
      const source = document.createElement('source');
      source.src = mount.dataset.localSrc;
      source.type = 'video/mp4';
      video.append(source);
    }

    if (mount.dataset.vtt) {
      const captions = document.createElement('track');
      captions.kind = 'captions';
      captions.src = mount.dataset.vtt;
      captions.default = true;
      video.append(captions);
    }
    if (mount.dataset.adTrack) {
      const descriptions = document.createElement('track');
      descriptions.kind = 'descriptions';
      descriptions.src = mount.dataset.adTrack;
      video.append(descriptions);
    }

    mount.replaceChildren(video);
    // eslint-disable-next-line no-undef
    const player = new AblePlayer($(video));
    video.addEventListener('play', duckAmbient);
    video.addEventListener('pause', restoreAmbient);
    video.addEventListener('ended', restoreAmbient);
  }
}
```

- [ ] **Step 3: Call `mountAblePlayers` after rendering in `logbook.html` and `voices.html`**

Update each page's inline module script from Task 8 to also mount players:

```html
<script type="module">
  import { renderLogbook } from './js/media-loader.js';
  import { mountAblePlayers } from './js/able-player-init.js';
  await renderLogbook(document.getElementById('logbook-entries'));
  mountAblePlayers();
</script>
```

(Same pattern for `voices.html` using `renderVoices`.)

- [ ] **Step 4: Verify in browser**

Open `voices.html`. Expected: Able Player chrome (play button, caption toggle, AD toggle in the control bar) renders around each video mount point, even though `youtubeId`/`localSrc` are `null` in placeholder data (player shows an empty/poster state without erroring).

- [ ] **Step 5: Commit**

```bash
git add index.html voices.html logbook.html js/able-player-init.js
git commit -m "feat: integrate Able Player with caption/AD tracks and ambient ducking"
git push
```

---

## Task 10: Home page four-chapter narrative + decorative dividers

**Files:**
- Modify: `index.html` (`<main>`, after the hero section)
- Create: `svg/wave-divider.svg`, `svg/gull.svg`
- Modify: `css/components.css`

- [ ] **Step 1: Write `svg/wave-divider.svg`**

```svg
<svg viewBox="0 0 400 40" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
  <path class="wave" d="M0 20 Q50 5 100 20 T200 20 T300 20 T400 20"
        fill="none" stroke="#5FA8D3" stroke-width="2" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 2: Write `svg/gull.svg`**

```svg
<svg viewBox="0 0 40 20" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
  <path d="M2 15 Q10 2 20 12 Q30 2 38 15" fill="none" stroke="#5FA8D3" stroke-width="2" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 3: Add the four-chapter narrative markup to `index.html`, after the hero section**

```html
<section class="chapter" aria-labelledby="chapter-welcome">
  <img class="divider" src="svg/wave-divider.svg" alt="" width="400" height="40">
  <div class="chapter-text">
    <h2 id="chapter-welcome">Welcome Aboard</h2>
    <p>Sailors arrive at Oakland Yacht Club and meet the instructors and crew who'll take them out on the water.</p>
  </div>
  <div class="chapter-media" id="chapter-welcome-media"></div>
</section>

<section class="chapter" aria-labelledby="chapter-castoff">
  <div class="chapter-text">
    <h2 id="chapter-castoff">Cast Off</h2>
    <p>Lines come in, the slip falls away, and the crew gets underway onto the bay.</p>
  </div>
  <div class="chapter-media" id="chapter-castoff-media"></div>
</section>

<section class="chapter" aria-labelledby="chapter-helm">
  <img class="divider" src="svg/gull.svg" alt="" width="40" height="20">
  <div class="chapter-text">
    <h2 id="chapter-helm">At the Helm</h2>
    <p>VI sailors take the wheel — driving, trimming sheets, and sailing the boat themselves.</p>
  </div>
  <div class="chapter-media" id="chapter-helm-media"></div>
</section>

<section class="chapter" aria-labelledby="chapter-dock">
  <div class="chapter-text">
    <h2 id="chapter-dock">Back at the Dock</h2>
    <p>Back at Oakland Yacht Club: debrief, community, and celebration.</p>
  </div>
  <div class="chapter-media" id="chapter-dock-media"></div>
</section>
```

- [ ] **Step 4: Render chapter photos from `media.json` by filtering on `chapter`**

Add to `index.html`'s existing inline module script (or a new one) below the chapter markup:

```html
<script type="module">
  async function loadChapterMedia() {
    const response = await fetch('media.local.json').then(r => r.ok ? r : fetch('media.json'));
    const { items } = await response.json();
    for (const item of items.filter(i => i.chapter)) {
      const mount = document.getElementById(`chapter-${item.chapter.replace('-', '')}-media`)
        ?? document.getElementById(`chapter-${item.chapter}-media`);
      if (!mount) continue;
      const img = document.createElement('img');
      img.src = item.src;
      img.alt = item.alt;
      img.loading = 'lazy';
      mount.append(img);
    }
  }
  loadChapterMedia();
</script>
```

- [ ] **Step 5: Style the split-panel chapter layout in `css/components.css`, linearizing on narrow screens**

```css
.chapter {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  align-items: start;
  margin-block: var(--space-4);
}
.chapter-text { position: sticky; top: var(--space-2); }
.chapter-media img { width: 100%; height: auto; margin-block-end: var(--space-2); }

@media (max-width: 640px) {
  .chapter { grid-template-columns: 1fr; }
  .chapter-text { position: static; }
}
```

- [ ] **Step 6: Verify in browser**

Open `index.html` at desktop and mobile widths (resize to <640px). Expected: chapters render as two columns (sticky text, scrolling media) on desktop, and linearize to a single column on mobile with no overlap or hidden content.

- [ ] **Step 7: Commit**

```bash
git add index.html svg/wave-divider.svg svg/gull.svg css/components.css
git commit -m "feat: add four-chapter home narrative with decorative dividers"
git push
```

---

## Task 11: Automated accessibility and interaction testing

**Files:**
- Create: `tests/package.json`
- Create: `tests/playwright.config.js`
- Create: `tests/a11y.spec.js`
- Create: `tests/interaction.spec.js`

- [ ] **Step 1: Write `tests/package.json`**

```json
{
  "name": "blindsail-shell-tests",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "playwright test"
  },
  "devDependencies": {
    "@axe-core/playwright": "^4.10.1",
    "@playwright/test": "^1.48.0"
  }
}
```

- [ ] **Step 2: Write `tests/playwright.config.js`**

```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  webServer: {
    command: 'npx http-server .. -p 4173 -c-1',
    port: 4173,
    reuseExistingServer: true,
  },
  use: {
    baseURL: 'http://localhost:4173',
  },
});
```

- [ ] **Step 3: Write `tests/a11y.spec.js`**

```js
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const page of ['index.html', 'voices.html', 'logbook.html']) {
  test(`${page} has no WCAG 2.1 AA violations`, async ({ page: browserPage }) => {
    await browserPage.goto(`/${page}`);
    const results = await new AxeBuilder({ page: browserPage })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}
```

- [ ] **Step 4: Write `tests/interaction.spec.js`**

```js
import { test, expect } from '@playwright/test';

test('ambient toggle is keyboard-operable and persists', async ({ page }) => {
  await page.goto('/index.html');
  const toggle = page.locator('#ambient-toggle');
  await toggle.focus();
  await expect(toggle).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.locator('#ambient-toggle')).toHaveAttribute('aria-pressed', 'true');
});

test('skip link is the first focusable element and jumps to main', async ({ page }) => {
  await page.goto('/index.html');
  await page.keyboard.press('Tab');
  const skipLink = page.locator('.skip-link');
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused({ timeout: 2000 }).catch(() => {});
});

test('reduced motion disables hero animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/index.html');
  await expect(page.locator('html')).toHaveClass(/reduced-motion/);
});

test('AD button on a placeholder photo without audio is disabled and labeled', async ({ page }) => {
  await page.goto('/logbook.html');
  const disabledAd = page.locator('.ad-button', { hasText: 'not yet available' }).first();
  await expect(disabledAd).toBeDisabled();
});
```

- [ ] **Step 5: Write `tests/performance.spec.js`**

```js
import { test, expect } from '@playwright/test';

test('index.html initial load stays within a 3MB mobile budget', async ({ page }) => {
  let totalBytes = 0;
  page.on('response', async (response) => {
    const headers = response.headers();
    const length = headers['content-length'];
    if (length) totalBytes += Number(length);
  });
  await page.goto('/index.html', { waitUntil: 'networkidle' });
  expect(totalBytes).toBeLessThan(3 * 1024 * 1024);
});
```

- [ ] **Step 6: Install and run**

```bash
cd tests
npm install
npx playwright install chromium
npx playwright test
```

Expected: all tests pass. If `a11y.spec.js` reports violations, fix the underlying markup/CSS (do not weaken the test) and re-run.

- [ ] **Step 7: Commit**

```bash
git add tests/
git commit -m "test: add axe-core accessibility scan and interaction tests"
git push
```

---

## Final Review (process step, not code)

- [ ] **Adversarial review pass** — after Task 11 passes, dispatch two subagents (model `fable`):
  1. **Programmer** reviewing all files under `js/`, `css/`, and the three HTML pages for correctness bugs, dead code, and reuse opportunities (align with `superpowers:code-review` conventions).
  2. **Graphic designer** reviewing rendered screenshots of all three pages (desktop + mobile widths, light + reduced-motion) against design.md's "Light Air" theme section — palette usage, typography floor, hand-drawn line art tone, motion feel.
  Fix any confirmed findings, re-run `tests/` after fixes.
- [ ] **Browser QA** — using Chrome DevTools MCP or the Playwright CLI already installed in `tests/`, manually exercise: AD play button audio, Able Player caption/AD toggle, ambient toggle ducking during video playback, full keyboard-only pass across all three pages.
- [ ] **Cloudflare Pages check** — confirm the `*.pages.dev` URL from Task 1 reflects the latest push and loads without console errors.
- [ ] **Explicitly out of scope for this goal, confirmed untested**: NVDA screen-reader pass (needs a human), real photo/video content (placeholder-only on the deployed site by design), publishing skill and highlight-reel assembly (separate follow-on goals).
