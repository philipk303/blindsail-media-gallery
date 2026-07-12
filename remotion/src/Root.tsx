import React from 'react';
import { Composition } from 'remotion';
import { Reel, ReelProps } from './Reel';

// Timing always comes from props (calculateMetadata) — Remotion never decides
// durations; the pipeline's frame math is the single source of truth.
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
