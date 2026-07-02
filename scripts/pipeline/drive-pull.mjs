import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { itemId } from './lib/heuristics.mjs';
import { runPaths, loadConfig, eventIdFromDate } from './lib/config.mjs';
import {
  newManifest, addItem, saveManifest, loadManifest,
} from './lib/manifest.mjs';

function classify(mimeType, name) {
  const ext = path.extname(name).toLowerCase();
  if (mimeType.startsWith('image/') || ['.heic', '.jpg', '.jpeg', '.png'].includes(ext)) return 'photo';
  if (mimeType.startsWith('video/') || ['.mov', '.mp4', '.m4v'].includes(ext)) return 'video';
  return null;
}

// Pure: decide what to pull. remoteFiles: [{id,name,mimeType}], seenIds: Set.
export function planPulls(remoteFiles, seenIds, eventId) {
  const plan = [];
  for (const f of remoteFiles) {
    if (seenIds.has(f.id)) continue;
    const kind = classify(f.mimeType, f.name);
    if (!kind) continue;
    plan.push({ sourceId: f.id, sourceFile: f.name, kind, id: itemId(eventId, f.name) });
  }
  return plan;
}

// --- gws adapters (not unit-tested; validated by the live run) ---

function gws(args) {
  const cfg = loadConfig();
  const env = {
    ...process.env,
    GOOGLE_WORKSPACE_CLI_CONFIG_DIR: path.join(process.env.USERPROFILE, '.config', 'gws-accounts', cfg.gwsAccount),
  };
  // node <gws JS entry> — the .cmd shim isn't execFileSync-able (see Step 3 note).
  return execFileSync(process.execPath, [cfg.gwsJs, ...args], { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'inherit'] });
}

function listRemote(folderId) {
  const out = gws(['drive', 'files', 'list', '--params',
    JSON.stringify({ q: `'${folderId}' in parents and trashed = false`, fields: 'files(id,name,mimeType)', pageSize: 1000 })]);
  return JSON.parse(out).files ?? [];
}

function download(fileId, destPath) {
  gws(['drive', 'files', 'get', '--params', JSON.stringify({ fileId, alt: 'media' }), '--output', destPath]);
}

// Entry point: node drive-pull.mjs <event-iso-date>
export async function main(isoDate) {
  const cfg = loadConfig();
  const eventId = eventIdFromDate(isoDate);
  const paths = runPaths(eventId);
  mkdirSync(paths.incoming, { recursive: true });

  const manifest = existsSync(paths.manifest) ? loadManifest(paths.manifest) : newManifest(eventId);
  const seen = new Set(manifest.items.map(i => i.sourceId).filter(Boolean));

  const remote = listRemote(cfg.driveFolderId);
  const plan = planPulls(remote, seen, eventId);

  for (const p of plan) {
    // Prefix with the Drive file id so two volunteers' identical camera
    // filenames (IMG_1234.HEIC) can't overwrite each other in incoming/.
    const localName = `${p.sourceId.slice(0, 8)}-${p.sourceFile}`;
    download(p.sourceId, path.join(paths.incoming, localName));
    addItem(manifest, { id: p.id, kind: p.kind, sourceFile: localName, sourceId: p.sourceId, date: isoDate });
  }
  saveManifest(paths.manifest, manifest);
  console.log(`Pulled ${plan.length} new file(s) into ${paths.incoming}; manifest has ${manifest.items.length} item(s).`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const isoDate = process.argv[2];
  if (!isoDate) { console.error('usage: node drive-pull.mjs <YYYY-MM-DD>'); process.exit(1); }
  main(isoDate).catch(err => { console.error(err); process.exit(1); });
}
