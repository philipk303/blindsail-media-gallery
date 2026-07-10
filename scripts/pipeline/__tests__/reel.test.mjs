import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateShotlist, segmentDuration, effectiveDurations, narrationCues, photoSegmentArgs, videoSegmentArgs, ambientVideoArgs, ambientSilenceArgs, mixAudioArgs } from '../reel.mjs';

const cfg = { width: 1280, height: 720, fps: 30, photoSeconds: 4, crossfadeSeconds: 0.5 };

test('validateShotlist rejects a shotlist with no segments', () => {
  assert.throws(() => validateShotlist({ title: 't', segments: [] }), /no segments/i);
});

test('segmentDuration uses seconds for photos and out-in for videos', () => {
  assert.equal(segmentDuration({ kind: 'photo', seconds: 4 }), 4);
  assert.equal(segmentDuration({ kind: 'video', in: 2, out: 7 }), 5);
});

test('effectiveDurations extends a segment to fit its narration plus margin', () => {
  const segs = [{ kind: 'photo', seconds: 4 }, { kind: 'video', in: 0, out: 6 }];
  const eff = effectiveDurations(segs, [6.2, 3.0], 0.3);
  assert.equal(eff[0], 6.5); // narration longer than the 4s photo -> extended
  assert.equal(eff[1], 6);   // narration fits -> planned duration kept
});

test('narrationCues lays narration end-to-end across effective durations', () => {
  const segs = [
    { kind: 'photo', seconds: 4, narration: 'A.' },
    { kind: 'video', in: 0, out: 6, narration: 'B.' },
  ];
  const cues = narrationCues(segs, [4, 6]);
  assert.deepEqual(cues, [
    { start: 0, end: 4, text: 'A.' },
    { start: 4, end: 10, text: 'B.' },
  ]);
});

test('photoSegmentArgs pads to aspect then Ken Burns zooms at target size/fps', () => {
  const args = photoSegmentArgs('in.jpg', 'seg.mp4', 4, cfg);
  const vf = args[args.indexOf('-vf') + 1];
  assert.ok(vf.includes('force_original_aspect_ratio=decrease')); // portrait photos must not stretch
  assert.ok(vf.includes('zoompan'));
  assert.equal(args[args.length - 1], 'seg.mp4');
});

test('videoSegmentArgs trims with -ss/-to and freezes the last frame when narration runs long', () => {
  const exact = videoSegmentArgs('in.mp4', 'seg.mp4', 2, 7, 5, cfg);
  assert.ok(exact.includes('-ss') && exact.includes('-to'));
  assert.ok(!exact[exact.indexOf('-vf') + 1].includes('tpad'));
  const extended = videoSegmentArgs('in.mp4', 'seg.mp4', 2, 7, 6.5, cfg);
  assert.ok(extended[extended.indexOf('-vf') + 1].includes('tpad=stop_mode=clone:stop_duration=1.5'));
});

test('ambientVideoArgs keeps the clip audio, drops video, and pads to the effective duration', () => {
  const args = ambientVideoArgs('in.mp4', 'amb.mp3', 2, 7, 6.5);
  assert.ok(args.includes('-vn')); // audio only
  assert.ok(args[args.indexOf('-af') + 1].includes('apad=whole_dur=6.5')); // padded to effDur
  assert.deepEqual([args[args.indexOf('-ar') + 1], args[args.indexOf('-ac') + 1]], ['24000', '1']); // 24kHz mono
  assert.equal(args[args.indexOf('-t') + 1], '6.5');
});

test('ambientSilenceArgs emits exact-length 24kHz-mono silence for a photo slot', () => {
  const args = ambientSilenceArgs('amb.mp3', 4);
  assert.ok(args.join(' ').includes('anullsrc=r=24000:cl=mono'));
  assert.equal(args[args.indexOf('-t') + 1], '4');
});

test('mixAudioArgs stream-copies video and ducks the ambient bed under the narration', () => {
  const args = mixAudioArgs('silent.mp4', 'ambient.mp3', 'narration.mp3', 'reel.mp4');
  const filter = args[args.indexOf('-filter_complex') + 1];
  assert.ok(filter.includes('sidechaincompress')); // narration ducks the ambient
  assert.ok(filter.includes('normalize=0'));        // narration stays at full level
  assert.equal(args[args.indexOf('-c:v') + 1], 'copy'); // video not re-encoded
  assert.deepEqual([args[args.indexOf('-map') + 1]], ['0:v:0']);
});
