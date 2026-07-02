// scripts/pipeline/__tests__/asr.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wordsToCues, transcriptFromWords } from '../asr.mjs';

const words = [
  { word: 'We', start: 0.0, end: 0.3 },
  { word: 'cast', start: 0.3, end: 0.7 },
  { word: 'off', start: 0.7, end: 1.0 },
  { word: 'at', start: 3.0, end: 3.2 },
  { word: 'noon', start: 3.2, end: 3.6 },
];

test('wordsToCues groups words into cues, breaking on a long gap', () => {
  const cues = wordsToCues(words, { maxGap: 1.0, maxWords: 12 });
  assert.equal(cues.length, 2);
  assert.equal(cues[0].text, 'We cast off');
  assert.equal(cues[0].start, 0.0);
  assert.equal(cues[0].end, 1.0);
  assert.equal(cues[1].text, 'at noon');
});

test('wordsToCues caps cue length at maxWords', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ word: `w${i}`, start: i * 0.1, end: i * 0.1 + 0.05 }));
  const cues = wordsToCues(many, { maxGap: 5, maxWords: 8 });
  assert.ok(cues.every(c => c.text.split(' ').length <= 8));
});

test('transcriptFromWords joins into a single readable string', () => {
  assert.equal(transcriptFromWords(words), 'We cast off at noon');
});
