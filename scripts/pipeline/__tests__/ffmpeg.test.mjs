// scripts/pipeline/__tests__/ffmpeg.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { photoArgs, videoArgs, posterArgs } from '../lib/ffmpeg.mjs';

test('photoArgs builds a single-frame scaled JPEG conversion (HEIC-safe)', () => {
  const args = photoArgs('in.HEIC', 'out.jpg', 1600);
  assert.deepEqual(args, [
    '-y', '-i', 'in.HEIC', '-update', '1', '-frames:v', '1',
    '-vf', 'scale=1600:-2', 'out.jpg',
  ]);
});

test('videoArgs builds an H.264/AAC web MP4 at a target width', () => {
  const args = videoArgs('in.MOV', 'out.mp4', 1280);
  assert.deepEqual(args, [
    '-y', '-i', 'in.MOV', '-vf', 'scale=1280:-2',
    '-c:v', 'libx264', '-crf', '23', '-preset', 'medium',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', 'out.mp4',
  ]);
});

test('posterArgs grabs one frame at a timestamp', () => {
  const args = posterArgs('in.mp4', 'poster.jpg', 1);
  assert.deepEqual(args, [
    '-y', '-ss', '1', '-i', 'in.mp4', '-update', '1', '-frames:v', '1', 'poster.jpg',
  ]);
});

test('arg builders never inline user strings into a single shell token', () => {
  // A filename with shell metacharacters must remain one array element, unescaped.
  const args = photoArgs('a; rm -rf ~.HEIC', 'out.jpg', 800);
  assert.ok(args.includes('a; rm -rf ~.HEIC'));
});
