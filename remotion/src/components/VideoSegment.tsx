import React from 'react';
import { AbsoluteFill, Freeze, OffthreadVideo, Sequence, staticFile, useVideoConfig } from 'remotion';

type Props = { src: string; trimStartSec: number; trimEndSec: number; totalFrames: number };

// Plays [trimStart, trimEnd) muted; if the slot (durFrames + tail) outlasts the
// trim, the last trimmed frame freezes — same behavior as the ffmpeg tpad path.
export const VideoSegment: React.FC<Props> = ({ src, trimStartSec, trimEndSec, totalFrames }) => {
  const { fps } = useVideoConfig();
  const startFrom = Math.round(trimStartSec * fps);
  const endAt = Math.round(trimEndSec * fps);
  const trimFrames = endAt - startFrom;
  const url = staticFile(src);
  const fill: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover' };
  return (
    <AbsoluteFill style={{ backgroundColor: '#FAFBFC' }}>
      <Sequence durationInFrames={Math.min(trimFrames, totalFrames)} layout="none">
        <OffthreadVideo src={url} muted startFrom={startFrom} endAt={endAt} style={fill} />
      </Sequence>
      {totalFrames > trimFrames && (
        <Sequence from={trimFrames} layout="none">
          <Freeze frame={endAt - 1}>
            <OffthreadVideo src={url} muted style={fill} />
          </Freeze>
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
