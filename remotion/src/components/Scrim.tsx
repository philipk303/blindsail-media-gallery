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
