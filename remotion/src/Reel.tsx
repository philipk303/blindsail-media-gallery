import React from 'react';
import { AbsoluteFill, Easing, Sequence, interpolate, useCurrentFrame } from 'remotion';
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
  transitionIn: 'none' | 'dissolve' | 'dip' | 'wipe' | 'wind';
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
// duration-shortening overlap (which would desync every narration cue).
const TransitionIn: React.FC<{ seg: Seg; children: React.ReactNode }> = ({ seg, children }) => {
  const frame = useCurrentFrame();
  const n = seg.transitionInFrames;
  if (seg.transitionIn === 'none' || seg.transitionIn === 'wind' || n === 0) {
    // wind: the incoming shot just sits there, fully visible — the OUTGOING
    // segment does all the work (TransitionOut blows it off the screen above).
    return <>{children}</>;
  }
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

// Outgoing wind animation: during this segment's tail (while the next segment
// is already visible underneath), the whole shot is "caught by a gust" —
// accelerating off to the right with a slight loft, tilt, and motion blur.
// zIndex 1 flips it ABOVE the (DOM-later) incoming segment for the overlap.
const TransitionOut: React.FC<{
  nextTransition: Seg['transitionIn'] | null; durFrames: number; tailFrames: number;
  children: React.ReactNode;
}> = ({ nextTransition, durFrames, tailFrames, children }) => {
  const frame = useCurrentFrame();
  if (nextTransition !== 'wind' || tailFrames === 0) return <>{children}</>;
  const p = interpolate(frame, [durFrames, durFrames + tailFrames], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: Easing.in(Easing.quad), // gust builds — slow catch, fast exit
  });
  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative', zIndex: 1,
      transform: `translateX(${(p * 108).toFixed(2)}%) translateY(${(-p * 6).toFixed(2)}%) rotate(${(p * 2).toFixed(2)}deg)`,
      filter: p > 0 ? `blur(${(p * 6).toFixed(1)}px)` : undefined,
    }}>{children}</div>
  );
};

export const Reel: React.FC<ReelProps> = ({ segments, maxKenBurnsScale }) => (
  <AbsoluteFill style={{ backgroundColor: theme.offWhite }}>
    <Grade>
      {segments.map((seg, i) => (
        <Sequence key={i} from={seg.startFrame} durationInFrames={seg.durFrames + seg.tailFrames}>
          <TransitionOut nextTransition={segments[i + 1]?.transitionIn ?? null}
            durFrames={seg.durFrames} tailFrames={seg.tailFrames}>
            <TransitionIn seg={seg}>
              <SegmentVisual seg={seg} maxScale={maxKenBurnsScale} />
            </TransitionIn>
            {seg.lowerThird && (
              <LowerThird name={seg.lowerThird} subThird={seg.subThird} segFrames={seg.durFrames} />
            )}
          </TransitionOut>
        </Sequence>
      ))}
    </Grade>
  </AbsoluteFill>
);
