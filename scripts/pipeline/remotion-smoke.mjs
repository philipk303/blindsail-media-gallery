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

const cfg = { width: 1920, height: 1080, fps: 30, dissolveSeconds: 0.75,
  dipSeconds: 0.4, wipeSeconds: 0.9, maxKenBurnsScale: 1.07 };

const stage = path.join(REPO_ROOT, 'remotion', 'public', 'run', 'smoke');
mkdirSync(stage, { recursive: true });
const testJpg = path.join(stage, 'p.jpg');
if (!existsSync(testJpg)) {
  run(['-y', '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=1', '-frames:v', '1', testJpg]);
}

const segments = [
  { id: '__title__', kind: 'card', seconds: 3,
    card: { variant: 'title', title: 'Smoke Test', date: 'Fixture' } },
  { id: 'p', kind: 'photo', seconds: 3, motion: 'pan-right',
    lowerThird: 'Test Person — Fixture Role' },
];
const props = buildRemotionProps(segments, [3, 3], cfg, () => 'run/smoke/p.jpg');
const out = path.join(stage, 'smoke.mp4');
await renderSilentReel('smoke', props, out);
const dur = ffprobeDuration(out);
if (Math.abs(dur - 6) > 0.15) throw new Error(`smoke: duration ${dur}, expected ~6`);
console.log(`smoke OK: ${out} (${dur.toFixed(2)}s)`);
