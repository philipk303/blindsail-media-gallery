import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export const ITEM_STATES = [
  'pulled', 'converted', 'screened', 'captioned',
  'narrated', 'uploaded', 'published', 'held', 'failed',
];

export function newManifest(event) {
  return { event, createdAt: new Date().toISOString(), items: [] };
}

function find(manifest, id) {
  const item = manifest.items.find(i => i.id === id);
  if (!item) throw new Error(`no item with id ${id}`);
  return item;
}

export function addItem(manifest, { id, kind, sourceFile, sourceId = null, date }) {
  // Two volunteers' phones can both produce IMG_1234 — suffix colliding ids.
  let uniqueId = id;
  for (let n = 2; manifest.items.some(i => i.id === uniqueId); n++) uniqueId = `${id}-${n}`;
  const item = {
    id: uniqueId, kind, sourceFile, sourceId, date, event: manifest.event,
    state: 'pulled', held: false, holdReason: null, failReason: null,
    // produced artifacts (filled by later stages), all relative to repo root
    rendition: null, poster: null,
    alt: null, caption: null, chapter: null, person: null, hasSpeech: null,
    adScript: null, adAudio: null, adDecision: null,
    captionVtt: null, adVtt: null, transcript: null,
    youtubeId: null,
  };
  manifest.items.push(item);
  return item;
}

export function setState(manifest, id, state) {
  if (!ITEM_STATES.includes(state)) throw new Error(`unknown state: ${state}`);
  const item = find(manifest, id);
  if (item.state === 'held') throw new Error(`item ${id} is held; clear the hold before advancing`);
  item.state = state;
  return item;
}

export function hold(manifest, id, reason) {
  const item = find(manifest, id);
  item.state = 'held';
  item.held = true;
  item.holdReason = reason;
  return item;
}

// Human-approved un-hold: resets held/holdReason/failReason and state together.
// (Hand-editing only `state` would leave held=true and the item silently
// skipped at publish.)
export function clearHold(manifest, id, backToState) {
  if (!ITEM_STATES.includes(backToState)) throw new Error(`unknown state: ${backToState}`);
  const item = find(manifest, id);
  item.held = false;
  item.holdReason = null;
  item.failReason = null;
  item.state = backToState;
  return item;
}

export function fail(manifest, id, reason) {
  const item = find(manifest, id);
  item.state = 'failed';
  item.failReason = reason;
  return item;
}

export function listByState(manifest, state) {
  return manifest.items.filter(i => i.state === state);
}

export function saveManifest(file, manifest) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(manifest, null, 2));
}

export function loadManifest(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}
