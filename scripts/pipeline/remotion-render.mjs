import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { REPO_ROOT } from './lib/config.mjs';
import { ffprobeDuration } from './lib/ffmpeg.mjs';

const REMOTION_DIR = path.join(REPO_ROOT, 'remotion');

// remotion/'s node_modules is a separate tree from scripts/pipeline/'s, so
// resolve its packages relative to remotion/package.json. Lazy: the ffmpeg
// fallback must work on machines without remotion installed.
function remotionModules() {
  const req = createRequire(path.join(REMOTION_DIR, 'package.json'));
  const { bundle } = req('@remotion/bundler');
  const { selectComposition, renderMedia } = req('@remotion/renderer');
  return { bundle, selectComposition, renderMedia };
}

// Copies each segment's rendition into remotion/public/run/<event>/ so
// staticFile() can serve it, returns the srcOf mapper used by the props builder.
export function stageAssets(eventId, segments, manifestById, paths) {
  const stageDir = path.join(REMOTION_DIR, 'public', 'run', eventId);
  rmSync(stageDir, { recursive: true, force: true });
  mkdirSync(stageDir, { recursive: true });
  const srcMap = new Map();
  for (const seg of segments) {
    if (seg.kind === 'card') continue;
    const item = manifestById.get(seg.id);
    if (!item) throw new Error(`remotion-render: shotlist references unknown item ${seg.id}`);
    const abs = path.join(paths.root, item.rendition);
    const name = `${seg.id}${path.extname(item.rendition)}`;
    cpSync(abs, path.join(stageDir, name));
    srcMap.set(seg.id, `run/${eventId}/${name}`);
  }
  return (seg) => srcMap.get(seg.id);
}

export async function renderSilentReel(eventId, props, outPath) {
  const { bundle, selectComposition, renderMedia } = remotionModules();

  const runDir = path.join(REMOTION_DIR, 'public', 'run', eventId);
  mkdirSync(runDir, { recursive: true });
  writeFileSync(path.join(runDir, 'props.json'), JSON.stringify(props));

  const serveUrl = await bundle({ entryPoint: path.join(REMOTION_DIR, 'src', 'index.ts') });
  const composition = await selectComposition({ serveUrl, id: 'Reel', inputProps: props });
  // Cap parallelism and the offthread-video frame cache: the default
  // concurrency (= CPU count) spawns enough Chrome compositors to OOM-kill
  // them (SIGKILL) on machines with modest RAM. Both are env-overridable.
  const concurrency = Number(process.env.BLINDSAIL_REEL_CONCURRENCY) || 1;
  const offthreadVideoCacheSizeInBytes =
    Number(process.env.BLINDSAIL_REEL_VIDEO_CACHE_BYTES) || 256 * 1024 * 1024;
  await renderMedia({
    composition, serveUrl, codec: 'h264', muted: true,
    outputLocation: outPath, inputProps: props,
    pixelFormat: 'yuv420p',
    concurrency,
    offthreadVideoCacheSizeInBytes,
    // Cold renders load two local fonts before the first frame; the default
    // 28s delayRender timeout can trip on slower machines. Env-overridable.
    timeoutInMilliseconds: Number(process.env.BLINDSAIL_REEL_TIMEOUT_MS) || 120000,
  });

  // Contract check: rendered duration must match the audio the mux expects.
  const expected = props.totalFrames / props.fps;
  const actual = ffprobeDuration(outPath);
  if (Math.abs(actual - expected) > 0.15) {
    throw new Error(`remotion-render: duration mismatch (expected ${expected.toFixed(2)}s, got ${actual.toFixed(2)}s)`);
  }
  return outPath;
}
