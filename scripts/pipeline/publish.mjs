import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { runPaths, publishedDir, eventIdFromDate, REPO_ROOT } from './lib/config.mjs';
import { loadManifest, saveManifest, setState, hold, listByState } from './lib/manifest.mjs';
import { run as ffmpegRun, posterArgs } from './lib/ffmpeg.mjs';

const mediaPath = (eventId, file) => `media/${eventId}/${file}`;

// Accessibility gate: nothing publishes with missing or filename-derived text.
// (design.md: "Filename-derived captions never publish"; alt + AD are the
// project's core promise to its audience.)
const FILENAMEY = /^(img|dsc|mvi|pxl|dji|gopro?)[\s_-]*\d+$/i;
const texty = (s) => typeof s === 'string' && s.trim().length > 0;

export function publishBlockers(item) {
  const blockers = [];
  if (!texty(item.caption) || FILENAMEY.test(item.caption.trim())) blockers.push('caption missing or filename-derived');
  if (item.kind === 'photo') {
    if (!texty(item.alt) || FILENAMEY.test(item.alt.trim())) blockers.push('alt text missing or filename-derived');
    if (!item.adAudio) blockers.push('no AD audio rendered');
  } else {
    if (!item.youtubeId) blockers.push('no youtubeId');
    if (item.hasSpeech && !item.captionVtt) blockers.push('spoken video without captions');
    if (!item.adVtt && !texty(item.adDecision)) blockers.push('no AD track and no recorded adDecision');
  }
  return blockers;
}

export function toMediaItem(item, eventId) {
  if (item.kind === 'photo') {
    return {
      id: item.id, type: 'photo',
      src: mediaPath(eventId, `${item.id}.jpg`),
      alt: item.alt, caption: item.caption,
      adAudio: item.adAudio ? mediaPath(eventId, `${item.id}-ad.mp3`) : null,
      chapter: item.chapter, event: item.event, date: item.date,
    };
  }
  return {
    id: item.id, type: 'video',
    youtubeId: item.youtubeId,
    poster: mediaPath(eventId, `${item.id}-poster.jpg`),
    caption: item.caption,
    vtt: item.captionVtt ? mediaPath(eventId, `${item.id}.vtt`) : null,
    adTrack: item.adVtt ? mediaPath(eventId, `${item.id}-ad.vtt`) : null,
    transcript: item.transcript, person: item.person,
    chapter: item.chapter, event: item.event, date: item.date,
  };
}

export function mergeItems(mediaJson, newItems) {
  const items = [...mediaJson.items];
  for (const nu of newItems) {
    const idx = items.findIndex(i => i.id === nu.id);
    if (idx >= 0) items[idx] = nu; else items.push(nu);
  }
  return { ...mediaJson, items };
}

// Copy a run-relative artifact into the committed media/<event>/ dir.
function publishArtifact(paths, outDir, relFromRun, destName) {
  if (!relFromRun) return;
  const srcAbs = path.join(paths.root, relFromRun);
  if (!existsSync(srcAbs)) return;
  copyFileSync(srcAbs, path.join(outDir, destName));
}

export function main(isoDate) {
  const eventId = eventIdFromDate(isoDate);
  const paths = runPaths(eventId);
  const outDir = publishedDir(eventId);
  mkdirSync(outDir, { recursive: true });
  const manifest = loadManifest(paths.manifest);

  // Only items that reached 'uploaded' (videos) or 'narrated' (photos) and are not held/failed publish.
  const ready = manifest.items.filter(i =>
    !i.held && i.state !== 'failed' &&
    ((i.kind === 'photo' && ['narrated', 'published'].includes(i.state)) ||
     (i.kind === 'video' && ['uploaded', 'published'].includes(i.state))));

  const newMedia = [];
  for (const item of ready) {
    const blockers = publishBlockers(item);
    if (blockers.length > 0) {
      // Never a silent drop (design.md Error Handling) — hold with reasons.
      hold(manifest, item.id, `publish blocked: ${blockers.join('; ')}`);
      continue;
    }
    if (item.kind === 'photo') {
      publishArtifact(paths, outDir, item.rendition, `${item.id}.jpg`);
      publishArtifact(paths, outDir, item.adAudio, `${item.id}-ad.mp3`);
    } else {
      publishArtifact(paths, outDir, item.poster, `${item.id}-poster.jpg`);
      publishArtifact(paths, outDir, item.captionVtt, `${item.id}.vtt`);
      publishArtifact(paths, outDir, item.adVtt, `${item.id}-ad.vtt`);
    }
    newMedia.push(toMediaItem(item, eventId));
    setState(manifest, item.id, 'published');
  }

  // Reel as the lead video of the event (design.md: Logbook entry led by its reel).
  if (manifest.reel && manifest.reel.youtubeId) {
    const reelPoster = path.join(paths.reel, `${eventId}-reel-poster.jpg`);
    // grab a poster from the reel if not already present
    if (!existsSync(reelPoster)) {
      try { ffmpegRun(posterArgs(path.join(paths.reel, `${eventId}-reel.mp4`), reelPoster, 1)); } catch { /* poster is best-effort */ }
    }
    publishArtifact(paths, outDir, path.relative(paths.root, reelPoster), `${eventId}-reel-poster.jpg`);
    publishArtifact(paths, outDir, path.relative(paths.root, path.join(paths.reel, `${eventId}-reel.vtt`)), `${eventId}-reel.vtt`);
    newMedia.unshift({
      id: `${eventId}-reel`, type: 'video', youtubeId: manifest.reel.youtubeId,
      poster: mediaPath(eventId, `${eventId}-reel-poster.jpg`),
      caption: manifest.reel.title || `BlindSail — ${eventId}`,
      vtt: mediaPath(eventId, `${eventId}-reel.vtt`),
      adTrack: null, transcript: manifest.reel.narrationText || null,
      person: null, chapter: null, event: eventId, date: isoDate, isReel: true,
    });
  }

  const mediaJsonFile = path.join(REPO_ROOT, 'media.json');
  const mediaJson = JSON.parse(readFileSync(mediaJsonFile, 'utf8'));
  const merged = mergeItems(mediaJson, newMedia);
  writeFileSync(mediaJsonFile, JSON.stringify(merged, null, 2) + '\n');
  saveManifest(paths.manifest, manifest);

  console.log(`Published ${newMedia.length} item(s) into media.json and media/${eventId}/.`);
  const held = listByState(manifest, 'held').length;
  const failed = listByState(manifest, 'failed').length;
  if (held || failed) console.log(`Held: ${held}, Failed: ${failed} — review before the next run.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const isoDate = process.argv[2];
  if (!isoDate) { console.error('usage: node publish.mjs <YYYY-MM-DD>'); process.exit(1); }
  main(isoDate);
}
