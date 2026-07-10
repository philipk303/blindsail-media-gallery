// scripts/pipeline/__tests__/vtt.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTimestamp, buildVtt } from '../lib/vtt.mjs';

test('formatTimestamp renders WebVTT HH:MM:SS.mmm', () => {
  assert.equal(formatTimestamp(0), '00:00:00.000');
  assert.equal(formatTimestamp(3.5), '00:00:03.500');
  assert.equal(formatTimestamp(3661.25), '01:01:01.250');
});

test('buildVtt emits a WEBVTT header and one cue per segment', () => {
  const vtt = buildVtt([
    { start: 0, end: 2.5, text: 'A sailor takes the helm.' },
    { start: 2.5, end: 5, text: 'The boat heels into the wind.' },
  ]);
  const expected = [
    'WEBVTT',
    '',
    '00:00:00.000 --> 00:00:02.500',
    'A sailor takes the helm.',
    '',
    '00:00:02.500 --> 00:00:05.000',
    'The boat heels into the wind.',
    '',
  ].join('\n');
  assert.equal(vtt, expected);
});

test('buildVtt throws on an empty segment list (never write an empty track)', () => {
  assert.throws(() => buildVtt([]), /no segments/i);
});
