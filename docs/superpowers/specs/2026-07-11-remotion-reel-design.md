# Remotion Highlight-Reel Visual Layer — Design Spec

Date: 2026-07-11
Status: approved pending owner review
Supersedes: visual-assembly portion of `scripts/pipeline/reel.mjs` (stages 2–3 only)

## Goal

Raise the highlight reel's production value to general-audience standards — animated
title/end cards, branded transitions, varied spring-eased Ken Burns motion, animated
lower-thirds, and a consistent color grade — without touching the proven accessible
audio pipeline. Accessibility remains additive: narration, captions VTT, and AD
guarantees are unchanged and never lower the visual ceiling.

## Decision record

- **Path B (Remotion) chosen** over extending ffmpeg filters (Path A) and human-editor
  handoff (Path C). Owner accepted the cost premium: one-time build effort, headless
  Chromium render runtime, larger install, license verification.
- **Remotion owns visuals only.** The existing audio pipeline (TTS narration,
  `effectiveDurations` never-truncate invariant, per-clip ambient bed, sidechain
  ducking, captions VTT) is kept verbatim. Rationale: that logic is the accessibility
  guarantee (truncated AD narration is the project's highest-severity defect class);
  rebuilding it in new code is pure risk.
- **Generative video (Veo/Flow/Gemini) rejected** for participant footage: hallucinated
  motion on real, named, consenting participants is an authenticity/consent problem.
  May later supply non-representational decorative assets only (v2+).
- **Music bed deferred to v2** (licensing/sourcing question + third ducking input).

## Architecture & data flow

```
shotlist.json (Claude drafts, Stage 7)
  → 1. render narration lines (TTS), measure real durations   [existing]
  → 2. compute effectiveDurations (visual stretches to fit)   [existing]
  → 3. Remotion renders SILENT visual reel at those durations [NEW]
       - input: props JSON {segments, effDurs, theme, titleCard, endCard}
       - output: reel-silent.mp4 (H.264, same size/fps as config)
  → 4. narration track concat                                  [existing]
  → 5. ambient bed concat                                      [existing]
  → 6. ffmpeg mux: silent reel + ducked ambient + narration    [existing]
  → 7. captions VTT from narration cues                        [existing]
```

Only step 3 changes. `reel.mjs` stages 1, 4–7 keep their current code. The current
ffmpeg segment builders (`photoSegmentArgs`, `videoSegmentArgs`, concat) remain in the
repo as the **fallback renderer**.

### New component: `remotion/` project at repo root

- React composition `HighlightReel` consuming a props JSON written by `reel.mjs`.
- Sub-components: `TitleCard`, `EndCard`, `PhotoSegment` (Ken Burns variants),
  `VideoSegment`, `LowerThird`, `WaterWipe` transition, `Grade` wrapper.
- Rendered via `@remotion/renderer` programmatically from `reel.mjs` (no Lambda).
- Timing contract: each segment's frame count = `round(effDur * fps)` — Remotion is
  handed final durations; it never decides timing. Total frames must equal the sum
  ffmpeg expects, verified by ffprobe after render.

## V1 visual feature set

1. **Title card** (~4s): event date + title over animated pale-water gradient;
   Josefin Sans display type fade/rise-in; BlindSail wordmark. Narration reads the
   title (a normal shotlist segment with narration).
2. **End card** (~4s): mission line + blindsail.org, same treatment.
3. **Transitions**: soft ~0.6s cross-dissolves between segments
   (`@remotion/transitions`); one signature "water wipe" for title→first shot and
   last shot→end card only.
4. **Photo motion**: Ken Burns with per-segment `motion` variant
   (`zoom-in | zoom-out | pan-left | pan-right`), spring-eased.
5. **Lower-thirds**: animated name bars (deep bay blue, Nunito Sans, slide in/out)
   for segments with `lowerThird` text, e.g. "David Cook — Student Sailor".
6. **Color grade**: one subtle uniform adjustment (slight lift, gentle warmth) so
   mixed iPhone footage reads as one film. CSS filter in the `Grade` wrapper.

Excluded from v1 (YAGNI): music bed (v2 first), generative decorative assets,
kinetic per-word typography, animated logo sting.

## Brand theme (from design.md, lines 24–33)

- Canvas whites `#FFFFFF`/`#FAFBFC`; pale blues `#E3F2FB`/`#CAE9FF`; mid breeze blue
  `#5FA8D3`; deep bay blue `#1B4965` for type and lower-third bars.
- Display: Josefin Sans (large sizes only). Body/lower-thirds: Nunito Sans.
  Type floor: nothing below weight 400 under 28px-equivalent.
- Voice for card copy: warm, first-person, action-forward (design.md Voice).

## Shotlist schema additions (all optional, backward compatible)

- Per photo segment: `motion: "zoom-in" | "zoom-out" | "pan-left" | "pan-right"`
  (default `zoom-in` = current behavior).
- Per segment: `lowerThird: string` (rendered only if present).
- Top level: `titleCard: { title, date, narration? }`,
  `endCard: { line, url, narration? }`. If absent, reel renders without cards
  (backward compatible with existing shotlists).

## Error handling

- Remotion render failure (Chromium crash, missing asset, timeout) → log, set
  `manifest.reel.renderer = "ffmpeg-fallback"`, and assemble via the existing ffmpeg
  segment path. A broken Remotion install can never block publishing (design.md
  line 120 principle). Success records `renderer: "remotion"`.
- Post-render ffprobe check: duration/fps/size must match expectation before mux;
  mismatch → treated as render failure → fallback.
- Fallback reels skip cards/lower-thirds/transitions (current visual behavior) but
  keep identical audio/captions.

## Testing

- Unit: shotlist schema validation (new fields), frame/duration math
  (`round(effDur*fps)` sums, narration-fit invariant unchanged).
- Integration: render a 2-segment fixture composition (1 photo + title card) to MP4;
  ffprobe-verify duration, fps, dimensions.
- Existing audio-mux and VTT tests untouched and must stay green.
- Human visual QA of the first rendered reel before Stage 10 ship.

## Cost profile (owner-acknowledged)

- Recurring Claude session tokens per publish: unchanged (render is scripted).
- One-time build: ~3–5× Path A effort.
- Runtime: headless Chromium render per reel (slower than ffmpeg-only), larger
  install footprint.

## Open items — resolve BEFORE implementation

1. **Remotion license**: verify current terms; company license required above small
   team size; nonprofit eligibility for BlindSail to be confirmed. Blocking.
2. **Font licensing**: Josefin Sans + Nunito Sans are OFL — expected fine for video
   embedding; verify.
3. **Version pinning**: pin Node + Remotion + Chromium versions in `remotion/`
   package.json for reproducibility on volunteer Windows machines.

## V2 queue (not in scope)

Music bed (licensed/CC0, third ducking input), generative non-representational
decorative assets (title backgrounds, transition textures), animated logo sting.
