import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRemotionProps } from '../remotion-props.mjs';

const cfg = { width: 1920, height: 1080, fps: 30, dissolveSeconds: 0.75,
  dipSeconds: 0.4, wipeSeconds: 0.9, maxKenBurnsScale: 1.07 };
const srcOf = (seg) => `run/test-event/${seg.id}.bin`;

test('frame math: cumulative rounding, totalFrames exact, no drift', () => {
  const segs = [
    { id: 'a', kind: 'photo', seconds: 4 },
    { id: 'b', kind: 'video', in: 1, out: 4.5 },
    { id: 'c', kind: 'photo', seconds: 4 },
  ];
  const effDurs = [4.033, 3.5, 6.5]; // awkward narration-driven durations
  const p = buildRemotionProps(segs, effDurs, cfg, srcOf);
  assert.equal(p.totalFrames, Math.round((4.033 + 3.5 + 6.5) * 30));
  assert.equal(p.segments[0].startFrame, 0);
  p.segments.forEach((s, i) => {
    if (i > 0) assert.equal(s.startFrame, p.segments[i-1].startFrame + p.segments[i-1].durFrames);
  });
  const last = p.segments.at(-1);
  assert.equal(last.startFrame + last.durFrames, p.totalFrames);
});

test('tails equal the NEXT segment transition frames; last has none', () => {
  const segs = [
    { id: 'a', kind: 'photo', seconds: 4 },
    { id: 'b', kind: 'photo', seconds: 4 },
  ];
  const p = buildRemotionProps(segs, [4, 4], cfg, srcOf);
  assert.equal(p.segments[0].tailFrames, p.segments[1].transitionInFrames);
  assert.equal(p.segments[1].tailFrames, 0);
  assert.equal(p.segments[0].transitionIn, 'none'); // first segment: no transition
  assert.equal(p.segments[1].transitionIn, 'wind');
  assert.equal(p.segments[1].transitionInFrames, Math.round(0.75 * 30));
});

test('video→video gets dip; card boundaries get wipe', () => {
  const segs = [
    { id: 't', kind: 'card', seconds: 4, card: { variant: 'title', title: 'T' } },
    { id: 'v1', kind: 'video', in: 0, out: 4 },
    { id: 'v2', kind: 'video', in: 0, out: 4 },
    { id: 'e', kind: 'card', seconds: 5.5, card: { variant: 'end', url: 'blindsail.org' } },
  ];
  const p = buildRemotionProps(segs, [4, 4, 4, 5.5], cfg, srcOf);
  assert.equal(p.segments[1].transitionIn, 'wipe');  // title -> first shot
  assert.equal(p.segments[2].transitionIn, 'dip');   // video -> video
  assert.equal(p.segments[3].transitionIn, 'wipe');  // last shot -> end card
});

test('passthrough of motion/anchor/lowerThird and video trim', () => {
  const segs = [{ id: 'v', kind: 'video', in: 2, out: 7, lowerThird: 'David Cook — Student Sailor',
    subThird: 'San Francisco Bay · June 13' },
    { id: 'p', kind: 'photo', seconds: 4, motion: 'pan-right', anchor: { x: 0.3, y: 0.4 } }];
  const p = buildRemotionProps(segs, [5, 4], cfg, srcOf);
  assert.equal(p.segments[0].trimStartSec, 2);
  assert.equal(p.segments[0].trimEndSec, 7);
  assert.equal(p.segments[0].lowerThird, 'David Cook — Student Sailor');
  assert.equal(p.segments[1].motion, 'pan-right');
  assert.deepEqual(p.segments[1].anchor, { x: 0.3, y: 0.4 });
  assert.equal(p.segments[1].src, 'run/test-event/p.bin');
  assert.equal(p.fps, 30);
  assert.equal(p.maxKenBurnsScale, 1.07);
});
