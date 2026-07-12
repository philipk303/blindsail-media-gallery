import React from 'react';
import { Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

// Signature transition: the incoming segment is revealed behind a soft
// wave-edged matte (art/wipe-matte.svg — solid body, wavy faded leading edge)
// sweeping left-to-right. Used ONLY at title->first and last->end boundaries.
//
// KILL CRITERION (spec): if visual QA reads this as gimmicky, set
// WATER_WIPE_ENABLED = false and every wipe becomes a plain dissolve. Never
// let the wipe block shipping.
export const WATER_WIPE_ENABLED = true;

export const WaterWipe: React.FC<{ children: React.ReactNode; transitionFrames: number }> =
  ({ children, transitionFrames }) => {
    const frame = useCurrentFrame();
    const { width } = useVideoConfig();
    const p = interpolate(frame, [0, transitionFrames], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.ease), // smooth start/stop, no hard pop
    });
    if (!WATER_WIPE_ENABLED) {
      return <div style={{ opacity: p, width: '100%', height: '100%' }}>{children}</div>;
    }
    if (p >= 1) return <div style={{ width: '100%', height: '100%' }}>{children}</div>;
    // Matte geometry (px, not %): matte is 2.5x screen width; its solid body is
    // the left 72%. Sweep from fully off-screen-left (nothing revealed) to the
    // solid body covering the whole frame (fully revealed, no fade visible) so
    // the p>=1 unmasked handoff is seamless.
    const maskW = width * 2.5;
    const solidW = maskW * 0.72;
    const xStart = -maskW;
    const xEnd = width - solidW;
    const x = xStart + (xEnd - xStart) * p;
    const mask = `url(${staticFile('art/wipe-matte.svg')})`;
    return (
      <div style={{
        width: '100%', height: '100%',
        WebkitMaskImage: mask, maskImage: mask,
        WebkitMaskSize: `${maskW}px 100%`, maskSize: `${maskW}px 100%`,
        WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
        WebkitMaskPosition: `${x.toFixed(1)}px 0`, maskPosition: `${x.toFixed(1)}px 0`,
      }}>{children}</div>
    );
  };
