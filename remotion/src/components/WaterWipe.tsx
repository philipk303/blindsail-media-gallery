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
