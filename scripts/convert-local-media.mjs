import { execSync } from 'node:child_process';
import { readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const SRC_PHOTOS = 'BlindSail-JJ-1/Blind Sail-JJ-1/Photos';
const SRC_VIDEOS = 'BlindSail-JJ-1/Blind Sail-JJ-1/Video clips';
const OUT_DIR = 'media/local';

if (!existsSync(SRC_PHOTOS)) {
  console.error(`Not found: ${SRC_PHOTOS}. Run this from the repo root with BlindSail-JJ-1/ present.`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

const items = [];

for (const file of readdirSync(SRC_PHOTOS)) {
  const base = path.parse(file).name;
  const outFile = `${OUT_DIR}/${base}.jpg`;
  execSync(`ffmpeg -y -i "${SRC_PHOTOS}/${file}" -update 1 -frames:v 1 -vf scale=1200:-2 "${outFile}"`);
  items.push({
    id: `local-${base.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    type: 'photo',
    src: outFile,
    alt: base,
    caption: base,
    adAudio: null,
    chapter: null,
    event: 'local-qa',
    date: '2026-06-13'
  });
}

for (const file of readdirSync(SRC_VIDEOS)) {
  const base = path.parse(file).name;
  const outFile = `${OUT_DIR}/${base}.mp4`;
  const posterFile = `${OUT_DIR}/${base}-poster.jpg`;
  execSync(`ffmpeg -y -i "${SRC_VIDEOS}/${file}" -vf scale=1280:-2 -c:v libx264 -crf 23 -c:a aac "${outFile}"`);
  execSync(`ffmpeg -y -i "${outFile}" -update 1 -frames:v 1 -ss 1 "${posterFile}"`);
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
    person: null
  });
}

writeFileSync('media.local.json', JSON.stringify({ items }, null, 2));
console.log(`Wrote ${items.length} items to media.local.json (gitignored, local QA only).`);
