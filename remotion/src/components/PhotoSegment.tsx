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
  let scale = 1;
  let tx = 0;
  if (motion === 'zoom-in') scale = 1 + zoomSpan * t;
  else if (motion === 'zoom-out') scale = maxScale - zoomSpan * t;
  else {
    scale = maxScale;                          // pans need full headroom to avoid edges
    const panPct = 4.5;                        // total horizontal travel, % of width
    tx = (motion === 'pan-left' ? 1 : -1) * (panPct / 2 - panPct * t);
  }
  const origin = anchor ? `${anchor.x * 100}% ${anchor.y * 100}%` : '50% 50%';
  return (
    <AbsoluteFill style={{ backgroundColor: '#FAFBFC', overflow: 'hidden' }}>
      <Img src={staticFile(src)} style={{
        width: '100%', height: '100%', objectFit: 'cover',
        transform: `scale(${scale}) translateX(${tx}%)`,
        transformOrigin: origin,
      }} />
    </AbsoluteFill>
  );
};
