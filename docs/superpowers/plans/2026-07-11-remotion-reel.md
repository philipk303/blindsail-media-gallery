# Remotion Highlight-Reel Visual Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ffmpeg visual assembly (stages 2–3 of `reel.mjs`) with a Remotion-rendered silent reel — title/end cards, crossfades, varied Ken Burns, lower-thirds, uniform grade — while keeping the existing audio pipeline (narration timing, ambient bed, ducking, VTT) byte-for-byte intact and keeping the ffmpeg path as an automatic fallback.

**Architecture:** `reel.mjs` still runs stages 1 (narration render + `effectiveDurations`) and 4–7 (narration concat, ambient bed, mux, VTT). A new step 3 builds a props JSON (`remotion-props.mjs`), stages assets into `remotion/public/run/<event>/`, and calls `remotion-render.mjs` (bundle → selectComposition → renderMedia, muted). ffprobe verifies duration/fps/size; any failure falls back to the existing ffmpeg segment path. Title/end cards become synthetic segments *before* stage 1 so narration/ambient/VTT treat them uniformly.

**Tech Stack:** Remotion 4.x (pinned exact), React 18, TypeScript (remotion/ only), existing Node ESM pipeline (`node --test`), ffmpeg/ffprobe.

**Critical invariant (read before any task):** The audio tracks are built as an end-to-end concat of `effectiveDurations`. The video's total frame count MUST equal `round(sum(effDurs) * fps)`. Therefore **do NOT use `@remotion/transitions` / `TransitionSeries`** — it overlaps segments and shortens total duration, desyncing every narration cue. Instead: each segment occupies its exact slot `[startFrame, startFrame + durFrames)`; a segment additionally renders `tailFrames` of extra visual content (photos keep drifting, videos freeze) *underneath* the next segment, and the incoming segment animates opacity/mask over its `transitionInFrames`. Total duration never changes.

**Frame math (no drift):** per-segment frames come from cumulative rounding, not per-segment rounding:
`startFrame_i = round(sum(effDurs[0..i-1]) * fps)`, `durFrames_i = round(sum(effDurs[0..i]) * fps) - startFrame_i`, `totalFrames = round(sum * fps)`.

---

## File structure

```
remotion/                        # NEW — self-contained Remotion project
  package.json                   # pinned exact versions
  tsconfig.json
  src/index.ts                   # registerRoot
  src/Root.tsx                   # <Composition id="Reel"> + calculateMetadata
  src/Reel.tsx                   # timeline: slots, tails, transitions
  src/theme.ts                   # brand tokens (palette, type, durations)
  src/fonts.ts                   # @remotion/fonts loadFont from public/fonts
  src/components/Grade.tsx       # near-invisible normalize wrapper
  src/components/Scrim.tsx       # text-over-footage contrast backing
  src/components/PhotoSegment.tsx# Ken Burns variants, anchor, 1.07 cap
  src/components/VideoSegment.tsx# OffthreadVideo muted + Freeze tail
  src/components/LowerThird.tsx  # rounded chip + optional subThird
  src/components/TitleCard.tsx   # + EndCard in same file
  src/components/WaterWipe.tsx   # luma-matte mask wrapper (kill criterion)
  public/fonts/                  # JosefinSans[wght].ttf, NunitoSans[...].ttf (committed)
  public/art/                    # wave-divider.svg, gull.svg (copied from svg/)
  public/run/                    # per-render staged renditions (GITIGNORED)
scripts/pipeline/remotion-props.mjs      # NEW — shotlist+effDurs → props JSON (pure, tested)
scripts/pipeline/remotion-render.mjs     # NEW — stage assets, bundle, render, ffprobe-verify
scripts/pipeline/reel.mjs                # MODIFIED — card expansion, renderer switch, fallback
scripts/pipeline/__tests__/remotion-props.test.mjs  # NEW
scripts/pipeline/__tests__/reel.test.mjs            # MODIFIED — schema + expansion tests
scripts/pipeline/remotion-smoke.mjs      # NEW — manual 2-segment real-render check
config/pipeline.config.json              # MODIFIED — 1080p + transition/card tokens
.gitignore                               # MODIFIED
```

---

### Task 1: Config tokens + gitignore

**Files:**
- Modify: `config/pipeline.config.json`
- Modify: `.gitignore`

- [ ] **Step 1: Update reel config** — replace the `"reel"` block with:

```json
"reel": {
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "photoSeconds": 4,
  "crossfadeSeconds": 0.5,
  "dissolveSeconds": 0.75,
  "dipSeconds": 0.4,
  "wipeSeconds": 0.9,
  "titleSeconds": 4,
  "endSeconds": 5.5,
  "maxKenBurnsScale": 1.07
}
```

(`crossfadeSeconds` is kept — the ffmpeg fallback config shape must not change. 1080p per designer review; render time rises, acceptable.)

- [ ] **Step 2: Gitignore** — append:

```
# Remotion reel renderer
remotion/node_modules/
remotion/public/run/
```

- [ ] **Step 3: Commit** — `git add config/pipeline.config.json .gitignore && git commit -m "chore: reel config tokens + remotion gitignore"`

---

### Task 2: Shotlist schema extensions (TDD)

**Files:**
- Modify: `scripts/pipeline/reel.mjs` (validateShotlist)
- Test: `scripts/pipeline/__tests__/reel.test.mjs`

- [ ] **Step 1: Write failing tests** — append to `reel.test.mjs`:

```js
test('validateShotlist rejects a bad motion variant and accepts good ones', () => {
  const seg = { id: 'a', kind: 'photo', seconds: 4 };
  assert.throws(() => validateShotlist({ title: 't', segments: [{ ...seg, motion: 'spin' }] }), /motion/i);
  assert.ok(validateShotlist({ title: 't', segments: [{ ...seg, motion: 'pan-left' }] }));
});

test('validateShotlist rejects out-of-range anchor', () => {
  const seg = { id: 'a', kind: 'photo', seconds: 4, anchor: { x: 1.5, y: 0.5 } };
  assert.throws(() => validateShotlist({ title: 't', segments: [seg] }), /anchor/i);
});

test('validateShotlist requires title text on titleCard and url on endCard', () => {
  const base = { title: 't', segments: [{ id: 'a', kind: 'photo', seconds: 4 }] };
  assert.throws(() => validateShotlist({ ...base, titleCard: { date: 'June 13' } }), /titleCard/i);
  assert.throws(() => validateShotlist({ ...base, endCard: { line: 'x' } }), /endCard/i);
  assert.ok(validateShotlist({ ...base,
    titleCard: { title: 'First Sail', date: 'June 13, 2026', narration: 'n' },
    endCard: { line: 'Come sail with us.', url: 'blindsail.org', narration: 'n' } }));
});
```

- [ ] **Step 2: Run to verify failure** — `cd scripts/pipeline && node --test __tests__/reel.test.mjs` → the three new tests FAIL (validateShotlist currently accepts anything with title+segments).

- [ ] **Step 3: Implement** — in `reel.mjs`, replace `validateShotlist` body:

```js
const MOTIONS = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right'];

export function validateShotlist(shotlist) {
  if (!shotlist || !Array.isArray(shotlist.segments) || shotlist.segments.length === 0) {
    throw new Error('reel: shotlist has no segments');
  }
  if (!shotlist.title) throw new Error('reel: shotlist has no title');
  for (const seg of shotlist.segments) {
    if (seg.motion !== undefined && !MOTIONS.includes(seg.motion)) {
      throw new Error(`reel: unknown motion "${seg.motion}" (allowed: ${MOTIONS.join(', ')})`);
    }
    if (seg.anchor !== undefined) {
      const { x, y } = seg.anchor;
      if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) {
        throw new Error(`reel: anchor out of range for ${seg.id} (0..1 relative coords)`);
      }
    }
  }
  if (shotlist.titleCard && !shotlist.titleCard.title) {
    throw new Error('reel: titleCard requires a title');
  }
  if (shotlist.endCard && !shotlist.endCard.url) {
    throw new Error('reel: endCard requires a url');
  }
  return shotlist;
}
```

- [ ] **Step 4: Run tests** — same command → all PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(reel): shotlist schema for motion/anchor/cards"`

---

### Task 3: Card expansion + card support in duration/ambient helpers (TDD)

Cards become ordinary segments BEFORE narration timing so every downstream stage (narration, ambient, VTT, fallback) handles them with zero special cases.

**Files:**
- Modify: `scripts/pipeline/reel.mjs`
- Test: `scripts/pipeline/__tests__/reel.test.mjs`

- [ ] **Step 1: Failing tests:**

```js
import { expandShotlist } from '../reel.mjs'; // add to existing import line

test('expandShotlist turns cards into first/last segments with card kind', () => {
  const sl = { title: 't',
    titleCard: { title: 'First Sail', date: 'June 13, 2026', narration: 'First Sail.' },
    endCard: { line: 'Come sail.', url: 'blindsail.org', narration: 'blindsail dot org.' },
    segments: [{ id: 'a', kind: 'photo', seconds: 4, narration: 'A.' }] };
  const cfg = { titleSeconds: 4, endSeconds: 5.5 };
  const segs = expandShotlist(sl, cfg);
  assert.equal(segs.length, 3);
  assert.deepEqual([segs[0].kind, segs[2].kind], ['card', 'card']);
  assert.equal(segs[0].card.variant, 'title');
  assert.equal(segs[0].seconds, 4);
  assert.equal(segs[2].card.variant, 'end');
  assert.equal(segs[2].seconds, 5.5);
  assert.equal(segs[2].narration, 'blindsail dot org.');
});

test('expandShotlist without cards returns segments unchanged', () => {
  const sl = { title: 't', segments: [{ id: 'a', kind: 'photo', seconds: 4 }] };
  assert.deepEqual(expandShotlist(sl, { titleSeconds: 4, endSeconds: 5.5 }), sl.segments);
});

test('segmentDuration handles card segments via seconds', () => {
  assert.equal(segmentDuration({ kind: 'card', seconds: 5.5 }), 5.5);
});
```

- [ ] **Step 2: Verify failure** — `node --test __tests__/reel.test.mjs` → FAIL (`expandShotlist` not exported; segmentDuration returns `undefined - undefined`).

- [ ] **Step 3: Implement** in `reel.mjs`:

```js
// Cards become ordinary segments so narration timing, the ambient bed, the VTT,
// and the fallback renderer need zero special cases.
export function expandShotlist(shotlist, reelCfg) {
  const segs = [...shotlist.segments];
  if (shotlist.titleCard) {
    segs.unshift({ id: '__title__', kind: 'card', seconds: reelCfg.titleSeconds,
      narration: shotlist.titleCard.narration ?? null,
      card: { variant: 'title', title: shotlist.titleCard.title, date: shotlist.titleCard.date ?? null } });
  }
  if (shotlist.endCard) {
    segs.push({ id: '__end__', kind: 'card', seconds: reelCfg.endSeconds,
      narration: shotlist.endCard.narration ?? null,
      card: { variant: 'end', line: shotlist.endCard.line ?? null, url: shotlist.endCard.url } });
  }
  return segs;
}
```

and change `segmentDuration` to:

```js
export function segmentDuration(seg) {
  return seg.kind === 'video' ? (seg.out - seg.in) : seg.seconds;
}
```

- [ ] **Step 4: Run tests** → PASS (including all pre-existing reel tests — `segmentDuration` change is behavior-preserving for photo/video).
- [ ] **Step 5: Commit** — `git commit -am "feat(reel): expand title/end cards into ordinary segments"`

---

### Task 4: Props builder `remotion-props.mjs` (TDD)

Pure function: expanded segments + effDurs + cfg + manifest lookup → the props JSON the Remotion composition consumes. All timing decisions happen HERE (Remotion never decides timing).

**Files:**
- Create: `scripts/pipeline/remotion-props.mjs`
- Test: `scripts/pipeline/__tests__/remotion-props.test.mjs`

- [ ] **Step 1: Failing tests** — create the test file:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRemotionProps } from '../remotion-props.mjs';

const cfg = { width: 1920, height: 1080, fps: 30, dissolveSeconds: 0.75,
  dipSeconds: 0.4, wipeSeconds: 0.9, maxKenBurnsScale: 1.07 };
const srcOf = (seg) => `run/test-event/${seg.id}.bin`;

test('frame math: cumulative rounding, totalFrames exact, no drift', () => {
  const segs = [
    { id: 'a', kind: 'photo', seconds: 4 },
    { id: 'b', kind: 'video', in: 1, out: 4.5 },
    { id: 'c', kind: 'photo', seconds: 4 },
  ];
  const effDurs = [4.033, 3.5, 6.5]; // awkward narration-driven durations
  const p = buildRemotionProps(segs, effDurs, cfg, srcOf);
  assert.equal(p.totalFrames, Math.round((4.033 + 3.5 + 6.5) * 30));
  assert.equal(p.segments[0].startFrame, 0);
  p.segments.forEach((s, i) => {
    if (i > 0) assert.equal(s.startFrame, p.segments[i-1].startFrame + p.segments[i-1].durFrames);
  });
  const last = p.segments.at(-1);
  assert.equal(last.startFrame + last.durFrames, p.totalFrames);
});

test('tails equal the NEXT segment transition frames; last has none', () => {
  const segs = [
    { id: 'a', kind: 'photo', seconds: 4 },
    { id: 'b', kind: 'photo', seconds: 4 },
  ];
  const p = buildRemotionProps(segs, [4, 4], cfg, srcOf);
  assert.equal(p.segments[0].tailFrames, p.segments[1].transitionInFrames);
  assert.equal(p.segments[1].tailFrames, 0);
  assert.equal(p.segments[0].transitionIn, 'none'); // first segment: no transition
  assert.equal(p.segments[1].transitionIn, 'dissolve');
  assert.equal(p.segments[1].transitionInFrames, Math.round(0.75 * 30));
});

test('video→video gets dip; card boundaries get wipe', () => {
  const segs = [
    { id: 't', kind: 'card', seconds: 4, card: { variant: 'title', title: 'T' } },
    { id: 'v1', kind: 'video', in: 0, out: 4 },
    { id: 'v2', kind: 'video', in: 0, out: 4 },
    { id: 'e', kind: 'card', seconds: 5.5, card: { variant: 'end', url: 'blindsail.org' } },
  ];
  const p = buildRemotionProps(segs, [4, 4, 4, 5.5], cfg, srcOf);
  assert.equal(p.segments[1].transitionIn, 'wipe');  // title -> first shot
  assert.equal(p.segments[2].transitionIn, 'dip');   // video -> video
  assert.equal(p.segments[3].transitionIn, 'wipe');  // last shot -> end card
});

test('passthrough of motion/anchor/lowerThird and video trim', () => {
  const segs = [{ id: 'v', kind: 'video', in: 2, out: 7, lowerThird: 'David Cook — Student Sailor',
    subThird: 'San Francisco Bay · June 13' },
    { id: 'p', kind: 'photo', seconds: 4, motion: 'pan-right', anchor: { x: 0.3, y: 0.4 } }];
  const p = buildRemotionProps(segs, [5, 4], cfg, srcOf);
  assert.equal(p.segments[0].trimStartSec, 2);
  assert.equal(p.segments[0].trimEndSec, 7);
  assert.equal(p.segments[0].lowerThird, 'David Cook — Student Sailor');
  assert.equal(p.segments[1].motion, 'pan-right');
  assert.deepEqual(p.segments[1].anchor, { x: 0.3, y: 0.4 });
  assert.equal(p.segments[1].src, 'run/test-event/p.bin');
  assert.equal(p.fps, 30);
  assert.equal(p.maxKenBurnsScale, 1.07);
});
```

- [ ] **Step 2: Verify failure** — `node --test __tests__/remotion-props.test.mjs` → FAIL (module not found).

- [ ] **Step 3: Implement** `scripts/pipeline/remotion-props.mjs`:

```js
// Builds the props JSON consumed by remotion/src/Reel.tsx.
// ALL timing lives here: Remotion is handed final frame counts and never
// decides durations. Cumulative rounding keeps video length exactly equal to
// the concatenated audio (the never-desync invariant).

function transitionFor(prev, seg, cfg) {
  if (!prev) return { kind: 'none', seconds: 0 };
  if (prev.kind === 'card' || seg.kind === 'card') return { kind: 'wipe', seconds: cfg.wipeSeconds };
  if (prev.kind === 'video' && seg.kind === 'video') return { kind: 'dip', seconds: cfg.dipSeconds };
  return { kind: 'dissolve', seconds: cfg.dissolveSeconds };
}

export function buildRemotionProps(segments, effDurs, cfg, srcOf) {
  const fps = cfg.fps;
  let elapsed = 0;
  let prevEnd = 0;
  const out = segments.map((seg, i) => {
    elapsed += effDurs[i];
    const startFrame = prevEnd;
    const endFrame = Math.round(elapsed * fps);
    prevEnd = endFrame;
    const t = transitionFor(segments[i - 1], seg, cfg);
    return {
      kind: seg.kind,
      src: seg.kind === 'card' ? null : srcOf(seg),
      card: seg.card ?? null,
      startFrame,
      durFrames: endFrame - startFrame,
      tailFrames: 0, // filled below from the NEXT segment's transition
      trimStartSec: seg.kind === 'video' ? seg.in : null,
      trimEndSec: seg.kind === 'video' ? seg.out : null,
      motion: seg.motion ?? 'zoom-in',
      anchor: seg.anchor ?? null,
      lowerThird: seg.lowerThird ?? null,
      subThird: seg.subThird ?? null,
      transitionIn: t.kind,
      transitionInFrames: Math.round(t.seconds * fps),
    };
  });
  out.forEach((s, i) => {
    if (i < out.length - 1) s.tailFrames = out[i + 1].transitionInFrames;
  });
  return {
    fps, width: cfg.width, height: cfg.height,
    maxKenBurnsScale: cfg.maxKenBurnsScale,
    totalFrames: Math.round(elapsed * fps),
    segments: out,
  };
}
```

- [ ] **Step 4: Run tests** → PASS.
- [ ] **Step 5: Commit** — `git add remotion-props.mjs __tests__/remotion-props.test.mjs && git commit -m "feat(reel): remotion props builder with exact frame math"`

---

### Task 5: Scaffold the Remotion project

**Files:**
- Create: `remotion/package.json`, `remotion/tsconfig.json`, `remotion/src/index.ts`, `remotion/src/theme.ts`, `remotion/src/fonts.ts`
- Create: `remotion/public/fonts/` (2 TTFs), `remotion/public/art/` (2 SVGs)

- [ ] **Step 1: package.json** — create `remotion/package.json`:

```json
{
  "name": "blindsail-reel",
  "private": true,
  "scripts": { "studio": "remotion studio src/index.ts" },
  "dependencies": {},
  "devDependencies": {}
}
```

- [ ] **Step 2: Install with exact pins** (from `remotion/`):

```
npm install --save-exact remotion@4 @remotion/cli@4 @remotion/bundler@4 @remotion/renderer@4 @remotion/fonts@4 react@18 react-dom@18
npm install --save-dev --save-exact typescript@5 @types/react@18
```

Expected: package.json now lists exact versions (all `@remotion/*` MUST be the identical version — Remotion refuses mixed versions). Commit `package-lock.json`.

- [ ] **Step 3: tsconfig.json:**

```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "jsx": "react-jsx", "strict": true, "noEmit": true,
    "lib": ["DOM", "ES2022"]
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Fonts (OFL, committed)** — download the two variable TTFs into `remotion/public/fonts/`:

```
curl -L -o "remotion/public/fonts/JosefinSans.ttf" "https://github.com/google/fonts/raw/main/ofl/josefinsans/JosefinSans%5Bwght%5D.ttf"
curl -L -o "remotion/public/fonts/NunitoSans.ttf" "https://github.com/google/fonts/raw/main/ofl/nunitosans/NunitoSans%5BYTLC,opsz,wdth,wght%5D.ttf"
```

Verify both files are >100KB (`ls -l remotion/public/fonts`). If a URL 404s (Google occasionally renames axis lists), browse https://github.com/google/fonts/tree/main/ofl/nunitosans and use the actual filename. Local files = deterministic offline renders (no fonts.gstatic.com fetch).

- [ ] **Step 5: Art assets:**

```
mkdir -p remotion/public/art
cp svg/wave-divider.svg svg/gull.svg remotion/public/art/
```

- [ ] **Step 6: theme.ts:**

```ts
// Brand tokens from design.md "Light Air" — deep blue is scarce, whites/pale
// blues dominant. Type floor for VIDEO: Josefin 400–600 only (Light shimmers
// under compression).
export const theme = {
  white: '#FFFFFF',
  offWhite: '#FAFBFC',
  paleBlue: '#E3F2FB',
  skyBlue: '#CAE9FF',
  breezeBlue: '#5FA8D3',
  bayBlue: '#1B4965',
  display: 'Josefin Sans',
  body: 'Nunito Sans',
  lowerThird: {
    holdSeconds: 4,
    enterMs: 250,
    safeMarginPct: 5,
  },
} as const;
```

- [ ] **Step 7: fonts.ts:**

```ts
import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';

export const fontsReady = Promise.all([
  loadFont({ family: 'Josefin Sans', url: staticFile('fonts/JosefinSans.ttf') }),
  loadFont({ family: 'Nunito Sans', url: staticFile('fonts/NunitoSans.ttf') }),
]);
```

- [ ] **Step 8: index.ts:**

```ts
import { registerRoot } from 'remotion';
import { Root } from './Root';

registerRoot(Root);
```

(`Root.tsx` arrives in Task 7 — the project won't typecheck until then; that's fine, don't run anything yet.)

- [ ] **Step 9: Commit** — `git add remotion && git commit -m "feat(remotion): scaffold project, pinned deps, fonts, brand tokens"`

---

### Task 6: Visual components

**Files:**
- Create: `remotion/src/components/Grade.tsx`, `Scrim.tsx`, `PhotoSegment.tsx`, `VideoSegment.tsx`, `LowerThird.tsx`, `TitleCard.tsx`, `WaterWipe.tsx`

- [ ] **Step 1: Grade.tsx** — near-invisible normalization only (spec: "neutral and consistent, not a look"; NO black-lift/warmth):

```tsx
import React from 'react';
import { AbsoluteFill } from 'remotion';

export const Grade: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ filter: 'saturate(1.03) contrast(1.02)' }}>{children}</AbsoluteFill>
);
```

- [ ] **Step 2: Scrim.tsx** — the contrast rule: every text block over footage sits on this:

```tsx
import React from 'react';

// Subtle bottom-up gradient scrim sized to the text block, not full-frame.
// Keeps AA contrast over bright water / white sails without dimming the shot.
export const Scrim: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> =
  ({ children, style }) => (
    <div style={{
      background: 'linear-gradient(to top, rgba(11,42,60,0.55), rgba(11,42,60,0.35) 70%, rgba(11,42,60,0))',
      borderRadius: 12, padding: '14px 22px 12px', display: 'inline-block', ...style,
    }}>{children}</div>
  );
```

- [ ] **Step 3: PhotoSegment.tsx** — documentary Ken Burns: near-linear drift, still moving at the cut, 1.07 cap, anchor honored. `totalFrames` includes the tail so motion continues under the incoming crossfade:

```tsx
import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';

type Props = {
  src: string;
  totalFrames: number; // durFrames + tailFrames
  motion: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right';
  anchor: { x: number; y: number } | null;
  maxScale: number;
};

export const PhotoSegment: React.FC<Props> = ({ src, totalFrames, motion, anchor, maxScale }) => {
  const frame = useCurrentFrame();
  // Linear drift — deliberately NOT eased. Springs on camera moves read as
  // whip/settle (designer review); documentary drift is constant-velocity.
  const t = interpolate(frame, [0, totalFrames], [0, 1], { extrapolateRight: 'clamp' });
  const zoomSpan = maxScale - 1;
  let scale = 1, tx = 0, ty = 0;
  if (motion === 'zoom-in') scale = 1 + zoomSpan * t;
  else if (motion === 'zoom-out') scale = maxScale - zoomSpan * t;
  else {
    scale = 1 + zoomSpan / 2;                 // pans need headroom to avoid edges
    const panPct = 1.6;                        // total horizontal travel, % of width
    tx = (motion === 'pan-left' ? 1 : -1) * (panPct / 2 - panPct * t);
  }
  const origin = anchor ? `${anchor.x * 100}% ${anchor.y * 100}%` : '50% 50%';
  return (
    <AbsoluteFill style={{ backgroundColor: '#FAFBFC', overflow: 'hidden' }}>
      <Img src={staticFile(src)} style={{
        width: '100%', height: '100%', objectFit: 'cover',
        transform: `scale(${scale}) translateX(${tx}%) translateY(${ty}%)`,
        transformOrigin: origin,
      }} />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 4: VideoSegment.tsx** — trimmed, muted, frozen last frame for narration overrun and tail:

```tsx
import React from 'react';
import { AbsoluteFill, Freeze, OffthreadVideo, Sequence, staticFile, useVideoConfig } from 'remotion';

type Props = { src: string; trimStartSec: number; trimEndSec: number; totalFrames: number };

// Plays [trimStart, trimEnd) muted; if the slot (durFrames + tail) outlasts the
// trim, the last trimmed frame freezes — same behavior as the ffmpeg tpad path.
export const VideoSegment: React.FC<Props> = ({ src, trimStartSec, trimEndSec, totalFrames }) => {
  const { fps } = useVideoConfig();
  const startFrom = Math.round(trimStartSec * fps);
  const endAt = Math.round(trimEndSec * fps);
  const trimFrames = endAt - startFrom;
  const url = staticFile(src);
  const fill: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' };
  return (
    <AbsoluteFill style={{ backgroundColor: '#FAFBFC' }}>
      <Sequence durationInFrames={Math.min(trimFrames, totalFrames)} layout="none">
        <OffthreadVideo src={url} muted startFrom={startFrom} endAt={endAt} style={fill} />
      </Sequence>
      {totalFrames > trimFrames && (
        <Sequence from={trimFrames} layout="none">
          <Freeze frame={endAt - 1}>
            <OffthreadVideo src={url} muted style={fill} />
          </Freeze>
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 5: LowerThird.tsx** — rounded chip, two-tier type, fade+rise 250ms (spring fine — UI element), holds ~4s, fades out; title-safe margins; optional subThird line:

```tsx
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';

type Props = { name: string; subThird: string | null; segFrames: number };

export const LowerThird: React.FC<Props> = ({ name, subThird, segFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enterFrames = Math.round((theme.lowerThird.enterMs / 1000) * fps);
  const holdFrames = Math.min(Math.round(theme.lowerThird.holdSeconds * fps), segFrames - enterFrames * 2);
  const exitStart = enterFrames + holdFrames;
  const enter = spring({ frame, fps, durationInFrames: enterFrames, config: { damping: 200 } });
  const exit = interpolate(frame, [exitStart, exitStart + enterFrames], [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const opacity = Math.min(enter, exit);
  const rise = (1 - enter) * 14;
  const [role, ...rest] = name.includes(' — ') ? name.split(' — ').reverse() : [null];
  const display = rest.length ? rest.reverse().join(' — ') : name;
  return (
    <div style={{
      position: 'absolute', left: '5%', bottom: '7%',
      opacity, transform: `translateY(${rise}px)`,
    }}>
      <div style={{
        background: theme.bayBlue, borderRadius: 14, padding: '14px 26px',
        display: 'inline-block', boxShadow: '0 4px 18px rgba(11,42,60,0.25)',
      }}>
        <div style={{ fontFamily: theme.body, fontWeight: 700, fontSize: 34, color: theme.skyBlue }}>
          {display}
        </div>
        {role && (
          <div style={{ fontFamily: theme.body, fontWeight: 400, fontSize: 24, color: theme.skyBlue, opacity: 0.92 }}>
            {role}
          </div>
        )}
      </div>
      {subThird && (
        <div style={{
          marginTop: 8, fontFamily: theme.body, fontWeight: 600, fontSize: 22,
          color: theme.white, textShadow: '0 1px 6px rgba(11,42,60,0.6)',
        }}>{subThird}</div>
      )}
    </div>
  );
};
```

- [ ] **Step 6: TitleCard.tsx** (contains both cards) — animated pale-water gradient, Josefin 600, wave flourish, gull on end card:

```tsx
import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';

const CardShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 6; // slow gradient breathing
  return (
    <AbsoluteFill style={{
      background: `linear-gradient(${170 + drift}deg, ${theme.white} 0%, ${theme.paleBlue} 55%, ${theme.skyBlue} 100%)`,
      alignItems: 'center', justifyContent: 'center',
    }}>{children}</AbsoluteFill>
  );
};

const RiseIn: React.FC<{ children: React.ReactNode; delayFrames?: number }> = ({ children, delayFrames = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const d = Math.round(0.6 * fps);
  const p = interpolate(frame - delayFrames, [0, d], [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * 24}px)`, textAlign: 'center' }}>{children}</div>;
};

export const TitleCard: React.FC<{ title: string; date: string | null }> = ({ title, date }) => (
  <CardShell>
    <RiseIn>
      <div style={{ fontFamily: theme.display, fontWeight: 600, fontSize: 96,
        color: theme.bayBlue, letterSpacing: '0.04em' }}>{title}</div>
    </RiseIn>
    {date && (
      <RiseIn delayFrames={8}>
        <div style={{ fontFamily: theme.body, fontWeight: 600, fontSize: 36,
          color: theme.breezeBlue, marginTop: 18 }}>{date}</div>
      </RiseIn>
    )}
    <RiseIn delayFrames={14}>
      <Img src={staticFile('art/wave-divider.svg')} style={{ width: 420, marginTop: 44 }} />
    </RiseIn>
  </CardShell>
);

export const EndCard: React.FC<{ line: string | null; url: string }> = ({ line, url }) => (
  <CardShell>
    <RiseIn>
      <Img src={staticFile('art/gull.svg')} style={{ width: 130, marginBottom: 34 }} />
    </RiseIn>
    {line && (
      <RiseIn delayFrames={6}>
        <div style={{ fontFamily: theme.display, fontWeight: 600, fontSize: 64,
          color: theme.bayBlue }}>{line}</div>
      </RiseIn>
    )}
    <RiseIn delayFrames={14}>
      <div style={{ fontFamily: theme.body, fontWeight: 700, fontSize: 42,
        color: theme.breezeBlue, marginTop: 26, letterSpacing: '0.02em' }}>{url}</div>
    </RiseIn>
  </CardShell>
);
```

- [ ] **Step 7: WaterWipe.tsx** — luma-matte-style CSS mask using the wave art, sweeping left→right over the incoming segment. KILL CRITERION lives here as a one-flag bailout:

```tsx
import React from 'react';
import { interpolate, staticFile, useCurrentFrame } from 'remotion';

// Signature transition: the incoming segment is revealed behind a soft wave
// edge (mask-image from the site's hand-drawn wave art), sweeping across over
// transitionInFrames. Used ONLY at title->first and last->end boundaries.
//
// KILL CRITERION (spec): if visual QA reads this as gimmicky, set
// WATER_WIPE_ENABLED = false and every wipe becomes a plain dissolve. Never
// let the wipe block shipping.
export const WATER_WIPE_ENABLED = true;

export const WaterWipe: React.FC<{ children: React.ReactNode; transitionFrames: number }> =
  ({ children, transitionFrames }) => {
    const frame = useCurrentFrame();
    const p = interpolate(frame, [0, transitionFrames], [0, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    if (!WATER_WIPE_ENABLED) {
      return <div style={{ opacity: p, width: '100%', height: '100%' }}>{children}</div>;
    }
    if (p >= 1) return <div style={{ width: '100%', height: '100%' }}>{children}</div>;
    const mask = `url(${staticFile('art/wave-divider.svg')})`;
    // Oversized mask slides across; wave edge leads the reveal.
    const pos = `${(p * 200 - 100).toFixed(2)}% 50%`;
    return (
      <div style={{
        width: '100%', height: '100%',
        WebkitMaskImage: mask, maskImage: mask,
        WebkitMaskSize: '300% 300%', maskSize: '300% 300%',
        WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
        WebkitMaskPosition: pos, maskPosition: pos,
      }}>{children}</div>
    );
  };
```

(If the wave SVG turns out to be an unsuitable matte shape in Studio preview, the fallback inside the kill criterion ships. Do not iterate more than once on making the wipe pretty — that's post-v1 polish.)

- [ ] **Step 8: Commit** — `git add remotion/src/components && git commit -m "feat(remotion): visual components (grade, scrim, kenburns, video, lower-third, cards, wipe)"`

---

### Task 7: Reel timeline + Root composition

**Files:**
- Create: `remotion/src/Reel.tsx`, `remotion/src/Root.tsx`

- [ ] **Step 1: Reel.tsx** — the timeline. Slots + tails + incoming transition animation. Later segments stack on top; the previous segment's tail plays underneath:

```tsx
import React from 'react';
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from 'remotion';
import { Grade } from './components/Grade';
import { PhotoSegment } from './components/PhotoSegment';
import { VideoSegment } from './components/VideoSegment';
import { LowerThird } from './components/LowerThird';
import { TitleCard, EndCard } from './components/TitleCard';
import { WaterWipe } from './components/WaterWipe';
import { theme } from './theme';
import './fonts';

export type Seg = {
  kind: 'photo' | 'video' | 'card';
  src: string | null;
  card: { variant: 'title' | 'end'; title?: string; date?: string | null; line?: string | null; url?: string } | null;
  startFrame: number; durFrames: number; tailFrames: number;
  trimStartSec: number | null; trimEndSec: number | null;
  motion: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right';
  anchor: { x: number; y: number } | null;
  lowerThird: string | null; subThird: string | null;
  transitionIn: 'none' | 'dissolve' | 'dip' | 'wipe';
  transitionInFrames: number;
};
export type ReelProps = {
  fps: number; width: number; height: number;
  maxKenBurnsScale: number; totalFrames: number; segments: Seg[];
};

const SegmentVisual: React.FC<{ seg: Seg; maxScale: number }> = ({ seg, maxScale }) => {
  const total = seg.durFrames + seg.tailFrames;
  if (seg.kind === 'card') {
    return seg.card!.variant === 'title'
      ? <TitleCard title={seg.card!.title!} date={seg.card!.date ?? null} />
      : <EndCard line={seg.card!.line ?? null} url={seg.card!.url!} />;
  }
  if (seg.kind === 'photo') {
    return <PhotoSegment src={seg.src!} totalFrames={total} motion={seg.motion}
      anchor={seg.anchor} maxScale={maxScale} />;
  }
  return <VideoSegment src={seg.src!} trimStartSec={seg.trimStartSec!}
    trimEndSec={seg.trimEndSec!} totalFrames={total} />;
};

// Incoming-transition wrapper. Runs INSIDE the segment's Sequence (frame 0 =
// segment start). The previous segment's tail is visible underneath, so an
// opacity ramp here is a true crossfade — without TransitionSeries's
// duration-shortening overlap.
const TransitionIn: React.FC<{ seg: Seg; children: React.ReactNode }> = ({ seg, children }) => {
  const frame = useCurrentFrame();
  const n = seg.transitionInFrames;
  if (seg.transitionIn === 'none' || n === 0) return <>{children}</>;
  if (seg.transitionIn === 'wipe') {
    return <WaterWipe transitionFrames={n}>{children}</WaterWipe>;
  }
  if (seg.transitionIn === 'dip') {
    // Dip-through-white: white overlay fades out fast (airy brand; avoids
    // smearing two moving clips through a dissolve).
    const white = interpolate(frame, [0, n], [1, 0], { extrapolateRight: 'clamp' });
    return (
      <div style={{ width: '100%', height: '100%' }}>
        {children}
        <AbsoluteFill style={{ backgroundColor: theme.offWhite, opacity: white, pointerEvents: 'none' }} />
      </div>
    );
  }
  const opacity = interpolate(frame, [0, n], [0, 1], { extrapolateRight: 'clamp' });
  return <div style={{ opacity, width: '100%', height: '100%' }}>{children}</div>;
};

export const Reel: React.FC<ReelProps> = ({ segments, maxKenBurnsScale }) => (
  <AbsoluteFill style={{ backgroundColor: theme.offWhite }}>
    <Grade>
      {segments.map((seg, i) => (
        <Sequence key={i} from={seg.startFrame} durationInFrames={seg.durFrames + seg.tailFrames}>
          <TransitionIn seg={seg}>
            <SegmentVisual seg={seg} maxScale={maxKenBurnsScale} />
          </TransitionIn>
          {seg.lowerThird && (
            <LowerThird name={seg.lowerThird} subThird={seg.subThird} segFrames={seg.durFrames} />
          )}
        </Sequence>
      ))}
    </Grade>
  </AbsoluteFill>
);
```

- [ ] **Step 2: Root.tsx** — composition metadata comes from props (Remotion never decides timing):

```tsx
import React from 'react';
import { Composition } from 'remotion';
import { Reel, ReelProps } from './Reel';

const defaultProps: ReelProps = {
  fps: 30, width: 1920, height: 1080, maxKenBurnsScale: 1.07, totalFrames: 150,
  segments: [{
    kind: 'card', src: null,
    card: { variant: 'title', title: 'BlindSail Preview', date: 'Studio' },
    startFrame: 0, durFrames: 150, tailFrames: 0,
    trimStartSec: null, trimEndSec: null, motion: 'zoom-in', anchor: null,
    lowerThird: null, subThird: null, transitionIn: 'none', transitionInFrames: 0,
  }],
};

export const Root: React.FC = () => (
  <Composition
    id="Reel"
    component={Reel}
    durationInFrames={150}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={defaultProps}
    calculateMetadata={({ props }) => ({
      durationInFrames: props.totalFrames,
      fps: props.fps,
      width: props.width,
      height: props.height,
    })}
  />
);
```

- [ ] **Step 3: Typecheck** — from `remotion/`: `npx tsc --noEmit` → no errors.

- [ ] **Step 4: Studio smoke-look** — `npm run studio` from `remotion/` opens the Studio on localhost; the default title card should render with Josefin Sans over the gradient. This is a *look* check only (5 minutes, don't polish). Close it after.

- [ ] **Step 5: Commit** — `git add remotion/src && git commit -m "feat(remotion): reel timeline, transitions, root composition"`

---

### Task 8: Render driver `remotion-render.mjs`

**Files:**
- Create: `scripts/pipeline/remotion-render.mjs`

- [ ] **Step 1: Implement.** Stages assets into `remotion/public/run/<event>/`, writes props, bundles, renders muted H.264, ffprobe-verifies:

```js
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './lib/config.mjs';
import { ffprobeDuration } from './lib/ffmpeg.mjs';

const REMOTION_DIR = path.join(REPO_ROOT, 'remotion');

// Copies each segment's rendition into remotion/public/run/<event>/ so
// staticFile() can serve it, returns the srcOf mapper used by the props builder.
export function stageAssets(eventId, segments, manifestById, paths) {
  const stageDir = path.join(REMOTION_DIR, 'public', 'run', eventId);
  rmSync(stageDir, { recursive: true, force: true });
  mkdirSync(stageDir, { recursive: true });
  const srcMap = new Map();
  for (const seg of segments) {
    if (seg.kind === 'card') continue;
    const item = manifestById.get(seg.id);
    if (!item) throw new Error(`remotion-render: shotlist references unknown item ${seg.id}`);
    const abs = path.join(paths.root, item.rendition);
    const name = `${seg.id}${path.extname(item.rendition)}`;
    cpSync(abs, path.join(stageDir, name));
    srcMap.set(seg.id, `run/${eventId}/${name}`);
  }
  return (seg) => srcMap.get(seg.id);
}

export async function renderSilentReel(eventId, props, outPath) {
  // Lazy imports: keep the pipeline importable on machines without remotion
  // installed (the ffmpeg fallback must not require these packages).
  const { bundle } = await import(path.join(REMOTION_DIR, 'node_modules', '@remotion', 'bundler', 'dist', 'index.js'))
    .then(m => m.bundle ? m : m.default ?? m);
  const renderer = await import(path.join(REMOTION_DIR, 'node_modules', '@remotion', 'renderer', 'dist', 'index.js'));
  const { selectComposition, renderMedia } = renderer.selectComposition ? renderer : (renderer.default ?? renderer);

  const propsFile = path.join(REMOTION_DIR, 'public', 'run', eventId, 'props.json');
  writeFileSync(propsFile, JSON.stringify(props));

  const serveUrl = await bundle({ entryPoint: path.join(REMOTION_DIR, 'src', 'index.ts') });
  const composition = await selectComposition({ serveUrl, id: 'Reel', inputProps: props });
  await renderMedia({
    composition, serveUrl, codec: 'h264', muted: true,
    outputLocation: outPath, inputProps: props,
    pixelFormat: 'yuv420p',
  });

  // Contract check: rendered duration must match the audio the mux expects.
  const expected = props.totalFrames / props.fps;
  const actual = ffprobeDuration(outPath);
  if (Math.abs(actual - expected) > 0.15) {
    throw new Error(`remotion-render: duration mismatch (expected ${expected.toFixed(2)}s, got ${actual.toFixed(2)}s)`);
  }
  return outPath;
}
```

**Implementation note for the engineer:** the dynamic-import dance above is because `remotion/`'s node_modules is a separate tree from `scripts/pipeline/`'s. FIRST try the simple thing — `const { bundle } = await import('@remotion/bundler')` with `remotion/package.json` deps — by running Task 10's smoke script. Node resolves package imports relative to the importing FILE, so imports from `scripts/pipeline/` will NOT see `remotion/node_modules`. If the simple form fails (expected), use `createRequire`:

```js
import { createRequire } from 'node:module';
const requireFromRemotion = createRequire(path.join(REMOTION_DIR, 'package.json'));
const { bundle } = requireFromRemotion('@remotion/bundler');
const { selectComposition, renderMedia } = requireFromRemotion('@remotion/renderer');
```

`createRequire` is the cleaner mechanism — prefer it over the dist-path import shown above; the dist-path variant is the fallback if the packages are ESM-only and `require()` throws `ERR_REQUIRE_ESM`.

- [ ] **Step 2: Commit** — `git add remotion-render.mjs && git commit -m "feat(reel): remotion render driver with duration contract check"`

---

### Task 9: Wire into `reel.mjs` with fallback (TDD for the pure parts)

**Files:**
- Modify: `scripts/pipeline/reel.mjs` (`main()` + new `cardFallbackArgs`)
- Test: `scripts/pipeline/__tests__/reel.test.mjs`

- [ ] **Step 1: Failing test** for the ffmpeg card fallback (cards must render as plain brand-color clips so the fallback keeps A/V length aligned):

```js
import { cardFallbackArgs } from '../reel.mjs'; // add to import line

test('cardFallbackArgs renders an exact-length pale-blue clip at size/fps', () => {
  const args = cardFallbackArgs('card.mp4', 4, cfg);
  const src = args[args.indexOf('-i') + 1];
  assert.ok(src.includes('c=0xE3F2FB'));
  assert.ok(src.includes(`s=${cfg.width}x${cfg.height}`));
  assert.ok(src.includes(`r=${cfg.fps}`));
  assert.equal(args[args.indexOf('-t') + 1], '4');
  assert.equal(args[args.length - 1], 'card.mp4');
});
```

- [ ] **Step 2: Verify failure** — `node --test __tests__/reel.test.mjs` → FAIL (not exported).

- [ ] **Step 3: Implement `cardFallbackArgs`** in `reel.mjs`:

```js
// Fallback renderer can't draw cards (no Remotion, and ffmpeg drawtext font
// resolution on Windows is fragile) — a plain brand-color clip keeps the A/V
// timeline aligned; the narration still reads the card's text aloud.
export function cardFallbackArgs(out, seconds, cfg) {
  return ['-y', '-f', 'lavfi',
    '-i', `color=c=0xE3F2FB:s=${cfg.width}x${cfg.height}:r=${cfg.fps}`,
    '-t', String(seconds),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', out];
}
```

- [ ] **Step 4: Run tests** → PASS.

- [ ] **Step 5: Rework `main()`** in `reel.mjs`. The changes, in order:

(a) After `validateShotlist`, expand cards and use `segments` everywhere `shotlist.segments` was used:

```js
  const shotlist = validateShotlist(JSON.parse(readFileSync(paths.shotlist, 'utf8')));
  const segments = expandShotlist(shotlist, reelCfg);
```

(all subsequent `shotlist.segments` references become `segments` — narration loop, ambient loop, cue building).

(b) In the ambient-bed loop, cards produce silence exactly like photos (the existing `else` branch already does this since only `kind === 'video'` gets clip audio — verify, no code change expected).

(c) Replace step 2–3 (visual segments + concat) with renderer selection:

```js
  // 2-3) Silent visual reel: Remotion (production) or ffmpeg (fallback).
  const silentReel = path.join(paths.reel, 'reel-silent.mp4');
  let renderer = 'remotion';
  if (process.env.BLINDSAIL_REEL_RENDERER === 'ffmpeg') {
    renderer = 'ffmpeg-forced';
    assembleWithFfmpeg(segments, effDurs, byId, paths, reelCfg, silentReel);
  } else {
    try {
      const { stageAssets, renderSilentReel } = await import('./remotion-render.mjs');
      const { buildRemotionProps } = await import('./remotion-props.mjs');
      const srcOf = stageAssets(eventId, segments, byId, paths);
      const props = buildRemotionProps(segments, effDurs, reelCfg, srcOf);
      await renderSilentReel(eventId, props, silentReel);
    } catch (err) {
      console.error(`remotion render failed, falling back to ffmpeg: ${err.message}`);
      renderer = 'ffmpeg-fallback';
      assembleWithFfmpeg(segments, effDurs, byId, paths, reelCfg, silentReel);
    }
  }
```

(d) Extract the existing step-2/3 code verbatim into `assembleWithFfmpeg`, adding the card case:

```js
function assembleWithFfmpeg(segments, effDurs, byId, paths, reelCfg, silentReel) {
  const segFiles = [];
  segments.forEach((seg, idx) => {
    const segOut = path.join(paths.reel, `seg-${String(idx).padStart(3, '0')}.mp4`);
    if (seg.kind === 'card') {
      run(cardFallbackArgs(segOut, effDurs[idx], reelCfg));
    } else {
      const item = byId.get(seg.id);
      if (!item) throw new Error(`reel: shotlist references unknown item ${seg.id}`);
      const src = path.join(paths.root, item.rendition);
      if (seg.kind === 'photo') run(photoSegmentArgs(src, segOut, effDurs[idx], reelCfg));
      else run(videoSegmentArgs(src, segOut, seg.in, seg.out, effDurs[idx], reelCfg));
    }
    segFiles.push(segOut);
  });
  const listFile = path.join(paths.reel, 'segments.txt');
  writeFileSync(listFile, segFiles.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
  run(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', silentReel]);
}
```

(e) After the final mux, record the renderer in the manifest (add `saveManifest` to the existing `lib/manifest.mjs` import):

```js
  manifest.reel = { ...(manifest.reel ?? {}), renderer };
  saveManifest(paths.manifest, manifest);
  console.log(`Reel renderer:  ${renderer}`);
```

- [ ] **Step 6: Full unit suite** — `cd scripts/pipeline && node --test` → ALL tests pass (pre-existing + new).

- [ ] **Step 7: Commit** — `git commit -am "feat(reel): remotion renderer with automatic ffmpeg fallback"`

---

### Task 10: Real-render smoke script (manual integration test)

Not part of `node --test` (needs remotion install + Chromium download + minutes of render time). Run once now, and after any Remotion upgrade.

**Files:**
- Create: `scripts/pipeline/remotion-smoke.mjs`

- [ ] **Step 1: Implement:**

```js
// Renders a 2-segment fixture (title card + generated test photo) through the
// REAL Remotion pipeline and ffprobe-verifies the output. Usage:
//   node scripts/pipeline/remotion-smoke.mjs
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './lib/config.mjs';
import { run, ffprobeDuration } from './lib/ffmpeg.mjs';
import { buildRemotionProps } from './remotion-props.mjs';
import { renderSilentReel } from './remotion-render.mjs';

const cfg = { width: 1920, height: 1080, fps: 30, dissolveSeconds: 0.75,
  dipSeconds: 0.4, wipeSeconds: 0.9, maxKenBurnsScale: 1.07 };

const stage = path.join(REPO_ROOT, 'remotion', 'public', 'run', 'smoke');
mkdirSync(stage, { recursive: true });
const testJpg = path.join(stage, 'p.jpg');
if (!existsSync(testJpg)) {
  run(['-y', '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=1', '-frames:v', '1', testJpg]);
}

const segments = [
  { id: '__title__', kind: 'card', seconds: 3,
    card: { variant: 'title', title: 'Smoke Test', date: 'Fixture' } },
  { id: 'p', kind: 'photo', seconds: 3, motion: 'pan-right',
    lowerThird: 'Test Person — Fixture Role' },
];
const props = buildRemotionProps(segments, [3, 3], cfg, () => 'run/smoke/p.jpg');
const out = path.join(stage, 'smoke.mp4');
await renderSilentReel('smoke', props, out);
const dur = ffprobeDuration(out);
if (Math.abs(dur - 6) > 0.15) throw new Error(`smoke: duration ${dur}, expected ~6`);
console.log(`smoke OK: ${out} (${dur.toFixed(2)}s)`);
```

**Note:** `renderSilentReel` writes `props.json` into `public/run/smoke/` and `stageAssets` is bypassed (srcOf is hand-rolled) — that's intentional; staging is exercised in the live run.

- [ ] **Step 2: Run it** — `node scripts/pipeline/remotion-smoke.mjs`. First run downloads Remotion's headless Chromium (~a few minutes). Expected final line: `smoke OK: ... (6.00s)`. Debug import-resolution errors here (see Task 8 note) — this is the step that proves the createRequire strategy.

- [ ] **Step 3: Watch the output file** (open `remotion/public/run/smoke/smoke.mp4` in the default player via `start`): title card text renders in brand type, wipe reveals the test pattern, lower-third chip appears and exits. This is the human QA gate for the components.

- [ ] **Step 4: Commit** — `git add remotion-smoke.mjs && git commit -m "test(reel): remotion real-render smoke script"`

---

### Task 11: Docs + skill update

**Files:**
- Modify: `.claude/skills/blindsail-publish/SKILL.md` (Stage 7)
- Modify: `README.md` (if it documents the reel — check first)

- [ ] **Step 1: Update Stage 7 in SKILL.md** — after the `reel.mjs` command line, add:

```markdown
The reel renders via Remotion (title/end cards, transitions, lower-thirds) and
falls back to plain ffmpeg assembly automatically if the render fails — check
`manifest.reel.renderer` afterwards; `ffmpeg-fallback` means publish proceeds
but flag it to the owner. Optional shotlist fields: per-photo `motion`
(`zoom-in|zoom-out|pan-left|pan-right`) + `anchor {x,y}`, per-segment
`lowerThird`/`subThird`, top-level `titleCard {title,date,narration}` and
`endCard {line,url,narration}`. First run: `cd remotion && npm install`.
```

- [ ] **Step 2: Grep README** — `grep -n "reel" README.md`; if Stage 7 is described there, mirror the one-paragraph note. If not, skip.

- [ ] **Step 3: Commit** — `git commit -am "docs: remotion reel renderer in publishing skill"`

---

### Task 12: Full verification

- [ ] **Step 1: Unit suite** — `cd scripts/pipeline && node --test` → all pass.
- [ ] **Step 2: Typecheck** — `cd remotion && npx tsc --noEmit` → clean.
- [ ] **Step 3: Smoke render** — `node scripts/pipeline/remotion-smoke.mjs` → `smoke OK`.
- [ ] **Step 4: Fallback path proof** — `BLINDSAIL_REEL_RENDERER=ffmpeg` env var set, run the smoke's ffmpeg equivalent implicitly via unit tests (the fallback assembly functions are the pre-existing, already-tested ffmpeg path + `cardFallbackArgs`). No extra work — just confirm the env-var branch exists in `main()` by code review.
- [ ] **Step 5: Commit anything outstanding; report** — summarize renderer status, smoke result, and that the live end-to-end (real event render) happens in the pipeline test run, not this plan.

---

## Self-review notes

- **Spec coverage:** cards (T3/T6), transitions incl. dip + wipe + kill criterion (T4/T6/T7), Ken Burns variants + cap + anchor (T4/T6), lower-thirds + subThird (T6), grade (T6), contrast/scrim (T6), type pinning 400–600 (T6 — components use 600/700/400≥22px), fallback + renderer recording (T9), duration contract (T4/T8), fonts local OFL (T5), version pinning (T5), 1080p (T1), docs (T11). Music bed, generative assets: correctly absent (v2).
- **Known judgment calls encoded:** no TransitionSeries (duration contract); cards expanded pre-narration; fallback cards are plain color clips; smoke render is manual, not in `node --test`.
