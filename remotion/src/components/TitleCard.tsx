import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';

const CardShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 6; // slow gradient breathing
  return (
    <AbsoluteFill style={{
      background: `linear-gradient(${170 + drift}deg, ${theme.white} 0%, ${theme.paleBlue} 55%, ${theme.skyBlue} 100%)`,
      alignItems: 'center', justifyContent: 'center',
    }}>{children}</AbsoluteFill>
  );
};

const RiseIn: React.FC<{ children: React.ReactNode; delayFrames?: number }> = ({ children, delayFrames = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const d = Math.round(0.6 * fps);
  const p = interpolate(frame - delayFrames, [0, d], [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * 24}px)`, textAlign: 'center' }}>{children}</div>;
};

// Type-in-motion rule: Josefin 600 (never Light — hairlines shimmer under
// video compression). Airy feel via tracking and whitespace, not stroke weight.
export const TitleCard: React.FC<{ title: string; date: string | null }> = ({ title, date }) => (
  <CardShell>
    <RiseIn>
      <div style={{ fontFamily: theme.display, fontWeight: 600, fontSize: 96,
        color: theme.bayBlue, letterSpacing: '0.04em' }}>{title}</div>
    </RiseIn>
    {date && (
      <RiseIn delayFrames={8}>
        <div style={{ fontFamily: theme.body, fontWeight: 600, fontSize: 36,
          color: theme.breezeBlue, marginTop: 18 }}>{date}</div>
      </RiseIn>
    )}
    <RiseIn delayFrames={14}>
      <Img src={staticFile('art/wave-divider.svg')} style={{ width: 420, marginTop: 44 }} />
    </RiseIn>
  </CardShell>
);

export const EndCard: React.FC<{ line: string | null; url: string }> = ({ line, url }) => (
  <CardShell>
    <RiseIn>
      <Img src={staticFile('art/gull.svg')} style={{ width: 130, marginBottom: 34 }} />
    </RiseIn>
    {line && (
      <RiseIn delayFrames={6}>
        <div style={{ fontFamily: theme.display, fontWeight: 600, fontSize: 64,
          color: theme.bayBlue }}>{line}</div>
      </RiseIn>
    )}
    <RiseIn delayFrames={14}>
      <div style={{ fontFamily: theme.body, fontWeight: 700, fontSize: 42,
        color: theme.breezeBlue, marginTop: 26, letterSpacing: '0.02em' }}>{url}</div>
    </RiseIn>
  </CardShell>
);
