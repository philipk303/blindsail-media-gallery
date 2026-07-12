// Renders a 2-segment fixture (title card + generated test photo) through the
// REAL Remotion pipeline and ffprobe-verifies the output. Usage:
//   node scripts/pipeline/remotion-smoke.mjs
// Not part of `node --test` — needs the remotion install + Chromium download
// and minutes of render time. Run once after install and after any Remotion
// upgrade.
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './lib/config.mjs';
import { run, ffprobeDuration } from './lib/ffmpeg.mjs';
import { buildRemotionProps } from './remotion-props.mjs';
import { renderSilentReel } from './remotion-render.mjs';

const cfg = { width: 1920, height: 1080, fps: 30, dissolveSeconds: 1.0,
  dipSeconds: 0.5, wipeSeconds: 1.4, maxKenBurnsScale: 1.07 };

const stage = path.join(REPO_ROOT, 'remotion', 'public', 'run', 'smoke');
mkdirSync(stage, { recursive: true });
// Brand-toned fixture (pale blue -> bay blue gradient), NOT a rainbow test
// pattern — QA reads the wipe/motion against something plausible.
const testJpg = path.join(stage, 'p.jpg');
if (!existsSync(testJpg)) {
  run(['-y', '-f', 'lavfi', '-i',
    'gradients=size=1920x1080:c0=0xCAE9FF:c1=0x1B4965:x0=0:y0=0:x1=1920:y1=1080',
    '-frames:v', '1', testJpg]);
}
const testJpg2 = path.join(stage, 'p2.jpg');
if (!existsSync(testJpg2)) {
  run(['-y', '-f', 'lavfi', '-i',
    'gradients=size=1920x1080:c0=0x1B4965:c1=0xE3F2FB:x0=1920:y0=0:x1=0:y1=1080',
    '-frames:v', '1', testJpg2]);
}

const segments = [
  { id: '__title__', kind: 'card', seconds: 4,
    card: { variant: 'title', title: 'Smoke Test', date: 'Fixture' } },
  { id: 'p', kind: 'photo', seconds: 5, motion: 'pan-right',
    lowerThird: 'Test Person — Fixture Role' },
  { id: 'p2', kind: 'photo', seconds: 5, motion: 'zoom-in' }, // wind transition into this
];
const srcs = { p: 'run/smoke/p.jpg', p2: 'run/smoke/p2.jpg' };
const props = buildRemotionProps(segments, [4, 5, 5], cfg, (seg) => srcs[seg.id]);
const out = path.join(stage, 'smoke.mp4');
await renderSilentReel('smoke', props, out);
const dur = ffprobeDuration(out);
if (Math.abs(dur - 14) > 0.15) throw new Error(`smoke: duration ${dur}, expected ~14`);
console.log(`smoke OK: ${out} (${dur.toFixed(2)}s)`);
