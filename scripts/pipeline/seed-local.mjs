import { readdirSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { itemId } from './lib/heuristics.mjs';
import { runPaths, eventIdFromDate } from './lib/config.mjs';
import { newManifest, addItem, saveManifest, loadManifest } from './lib/manifest.mjs';

const PHOTO_EXT = new Set(['.heic', '.jpg', '.jpeg', '.png']);
const VIDEO_EXT = new Set(['.mov', '.mp4', '.m4v']);

// node seed-local.mjs <YYYY-MM-DD> "<source-dir>"
export function main(isoDate, srcDir) {
  const eventId = eventIdFromDate(isoDate);
  const paths = runPaths(eventId);
  mkdirSync(paths.incoming, { recursive: true });
  const manifest = existsSync(paths.manifest) ? loadManifest(paths.manifest) : newManifest(eventId);
  const seen = new Set(manifest.items.map(i => i.sourceFile));

  let added = 0;
  for (const name of readdirSync(srcDir)) {
    const ext = path.extname(name).toLowerCase();
    const kind = PHOTO_EXT.has(ext) ? 'photo' : VIDEO_EXT.has(ext) ? 'video' : null;
    if (!kind || seen.has(name)) continue;
    copyFileSync(path.join(srcDir, name), path.join(paths.incoming, name));
    addItem(manifest, { id: itemId(eventId, name), kind, sourceFile: name, date: isoDate });
    added++;
  }
  saveManifest(paths.manifest, manifest);
  console.log(`Seeded ${added} local file(s) into ${paths.incoming}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [isoDate, srcDir] = process.argv.slice(2);
  if (!isoDate || !srcDir) { console.error('usage: node seed-local.mjs <YYYY-MM-DD> "<source-dir>"'); process.exit(1); }
  main(isoDate, srcDir);
}
