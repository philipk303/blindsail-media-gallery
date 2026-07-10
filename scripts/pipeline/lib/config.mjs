import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// repo root is two levels up from scripts/pipeline/lib
export const REPO_ROOT = path.resolve(HERE, '..', '..', '..');

const MONTHS = ['january','february','march','april','may','june',
  'july','august','september','october','november','december'];

// '2026-06-13' -> 'june-13-2026'
export function eventIdFromDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${MONTHS[m - 1]}-${d}-${y}`;
}

export function runPaths(eventId) {
  const root = path.join(REPO_ROOT, 'pipeline', 'runs', eventId);
  return {
    root,
    incoming: path.join(root, 'incoming'),
    renditions: path.join(root, 'renditions'),
    audio: path.join(root, 'audio'),
    reel: path.join(root, 'reel'),
    manifest: path.join(root, 'manifest.json'),
    shotlist: path.join(root, 'shotlist.json'),
  };
}

export function publishedDir(eventId) {
  return path.join(REPO_ROOT, 'media', eventId);
}

export function loadConfig() {
  const raw = readFileSync(path.join(REPO_ROOT, 'config', 'pipeline.config.json'), 'utf8');
  return JSON.parse(raw);
}
