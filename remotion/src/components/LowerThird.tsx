import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';

type Props = { name: string; subThird: string | null; segFrames: number };

// Compact rounded chip (NOT a full-width news bar): name in Nunito Sans 700,
// role in 400 at ~70%, pale blue on deep bay blue (AA-passing pairing).
// Enter fade+rise ~250ms (spring OK — UI element), hold ~4s, exit fade.
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
