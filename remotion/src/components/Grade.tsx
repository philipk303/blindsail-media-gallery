import React from 'react';
import { AbsoluteFill } from 'remotion';

// Near-invisible normalization only — "neutral and consistent, not a look".
// NO black-lift/warmth (reads as faded-Instagram and un-matches mixed footage).
export const Grade: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ filter: 'saturate(1.03) contrast(1.02)' }}>{children}</AbsoluteFill>
);
