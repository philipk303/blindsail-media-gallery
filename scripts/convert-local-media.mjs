import { execFileSync } from 'node:child_process';
import { readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const SRC_PHOTOS = 'BlindSail-JJ-1/Blind Sail-JJ-1/Photos';
const SRC_VIDEOS = 'BlindSail-JJ-1/Blind Sail-JJ-1/Video clips';
const OUT_DIR = 'media/local';

for (const src of [SRC_PHOTOS, SRC_VIDEOS]) {
  if (!existsSync(src)) {
    console.error(`Not found: ${src}. Run this from the repo root with BlindSail-JJ-1/ present.`);
    process.exit(1);
  }
}

mkdirSync(OUT_DIR, { recursive: true });

function ffmpeg(args) {
  execFileSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'] });
}

// Filename-heuristic chapter assignment for photos.
function photoChapter(base) {
  // Debrief takes priority over OYC/slips ("Post sail debrief at OYC" is a
  // back-at-dock moment, not an arrival shot).
  if (/debrief/i.test(base)) return 'back-at-dock';
  if (base.includes('OYC') || /slips/i.test(base)) return 'welcome-aboard';
  if (base.includes('Pulling away')) return 'cast-off';
  if (/helm/i.test(base)) return 'at-helm';
  return null;
}

function videoChapter(base) {
  if (base.startsWith('Pulling away')) return 'cast-off';
  if (/^Debrief with /.test(base)) return 'back-at-dock';
  return null;
}

function videoPerson(base) {
  const match = base.match(/^Debrief with (.+)$/);
  return match ? match[1] : null;
}

const items = [];

for (const file of readdirSync(SRC_PHOTOS)) {
  const base = path.parse(file).name;
  const outFile = `${OUT_DIR}/${base}.jpg`;
  if (!existsSync(outFile)) {
    ffmpeg(['-y', '-i', `${SRC_PHOTOS}/${file}`, '-update', '1', '-frames:v', '1', '-vf', 'scale=1200:-2', outFile]);
  }
  items.push({
    id: `local-${base.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    type: 'photo',
    src: outFile,
    alt: base,
    caption: base,
    adAudio: null,
    chapter: photoChapter(base),
    event: 'local-qa',
    date: '2026-06-13'
  });
}

for (const file of readdirSync(SRC_VIDEOS)) {
  const base = path.parse(file).name;
  const outFile = `${OUT_DIR}/${base}.mp4`;
  const posterFile = `${OUT_DIR}/${base}-poster.jpg`;
  if (!existsSync(outFile)) {
    ffmpeg(['-y', '-i', `${SRC_VIDEOS}/${file}`, '-vf', 'scale=1280:-2', '-c:v', 'libx264', '-crf', '23', '-c:a', 'aac', outFile]);
  }
  if (!existsSync(posterFile)) {
    ffmpeg(['-y', '-i', outFile, '-update', '1', '-frames:v', '1', '-ss', '1', posterFile]);
  }
  items.push({
    id: `local-${base.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    type: 'video',
    youtubeId: null,
    localSrc: outFile,
    poster: posterFile,
    caption: base,
    vtt: null,
    adTrack: null,
    transcript: null,
    person: videoPerson(base),
    chapter: videoChapter(base),
    event: 'local-qa',
    date: '2026-06-13'
  });
}

writeFileSync('media.local.json', JSON.stringify({ items }, null, 2));
console.log(`Wrote ${items.length} items to media.local.json (gitignored, local QA only).`);
