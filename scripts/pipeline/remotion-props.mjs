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
