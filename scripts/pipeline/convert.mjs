import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { runPaths, eventIdFromDate } from './lib/config.mjs';
import { loadManifest, saveManifest, setState, fail, listByState } from './lib/manifest.mjs';
import { run, photoArgs, videoArgs, posterArgs } from './lib/ffmpeg.mjs';

const PHOTO_WIDTH = 1600;
const VIDEO_WIDTH = 1280;

export function renditionTargets(item, renditionsDir) {
  if (item.kind === 'photo') {
    return { rendition: path.join(renditionsDir, `${item.id}.jpg`), poster: null };
  }
  return {
    rendition: path.join(renditionsDir, `${item.id}.mp4`),
    poster: path.join(renditionsDir, `${item.id}-poster.jpg`),
  };
}

export function main(isoDate) {
  const eventId = eventIdFromDate(isoDate);
  const paths = runPaths(eventId);
  mkdirSync(paths.renditions, { recursive: true });
  const manifest = loadManifest(paths.manifest);

  for (const item of listByState(manifest, 'pulled')) {
    const src = path.join(paths.incoming, item.sourceFile);
    const t = renditionTargets(item, paths.renditions);
    try {
      if (item.kind === 'photo') {
        run(photoArgs(src, t.rendition, PHOTO_WIDTH));
      } else {
        run(videoArgs(src, t.rendition, VIDEO_WIDTH));
        run(posterArgs(t.rendition, t.poster, 1));
      }
      item.rendition = path.relative(paths.root, t.rendition);
      if (t.poster) item.poster = path.relative(paths.root, t.poster);
      setState(manifest, item.id, 'converted');
    } catch (err) {
      fail(manifest, item.id, `convert: ${err.message}`);
    }
  }
  saveManifest(paths.manifest, manifest);
  const failed = listByState(manifest, 'failed').length;
  console.log(`Converted ${listByState(manifest, 'converted').length} item(s); ${failed} failed (held for review).`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const isoDate = process.argv[2];
  if (!isoDate) { console.error('usage: node convert.mjs <YYYY-MM-DD>'); process.exit(1); }
  main(isoDate);
}
