import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { runPaths, loadConfig, eventIdFromDate } from './lib/config.mjs';
import { loadManifest, saveManifest, hold } from './lib/manifest.mjs';

// Pure: describe the Drive re-parent for a rejected item, or null if there's
// nothing to move (e.g. the item was seeded locally, not pulled from Drive).
export function planReject(item, cfg) {
  if (!item.sourceId) return null;
  return { fileId: item.sourceId, addParents: cfg.rejectedFolderId, removeParents: cfg.processedFolderId };
}

// --- gws adapters (not unit-tested; validated by the live run) ---

function gws(args) {
  const cfg = loadConfig();
  const env = {
    ...process.env,
    GOOGLE_WORKSPACE_CLI_CONFIG_DIR: path.join(process.env.USERPROFILE, '.config', 'gws-accounts', cfg.gwsAccount),
  };
  return execFileSync(process.execPath, [cfg.gwsJs, ...args], { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'inherit'] });
}

function moveFile({ fileId, addParents, removeParents }) {
  gws(['drive', 'files', 'update', '--params', JSON.stringify({ fileId, addParents, removeParents, fields: 'id,parents' })]);
}

// Entry point: node mark-rejected.mjs <event-iso-date> <itemId> <reason...>
export async function main(isoDate, itemId, reason) {
  const cfg = loadConfig();
  const eventId = eventIdFromDate(isoDate);
  const paths = runPaths(eventId);
  const manifest = loadManifest(paths.manifest);

  const item = manifest.items.find(i => i.id === itemId);
  if (!item) {
    console.error(`no item with id ${itemId} in ${paths.manifest}`);
    process.exit(1);
  }

  const move = planReject(item, cfg);
  if (move) {
    try {
      moveFile(move);
    } catch (err) {
      // Manifest is the source of truth for what publish.mjs skips, so a
      // failed Drive move doesn't corrupt anything — the item just stays
      // visible in Processed/ instead of Rejected/ until moved by hand.
      console.error(`Warning: failed to move ${item.sourceFile} (${item.sourceId}) to Rejected/: ${err.message}`);
    }
  } else {
    console.error(`Item ${itemId} has no sourceId (not pulled from Drive) — skipping Drive move.`);
  }

  hold(manifest, itemId, reason);
  saveManifest(paths.manifest, manifest);
  console.log(`Marked ${itemId} held: ${reason}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [isoDate, itemId, ...reasonParts] = process.argv.slice(2);
  if (!isoDate || !itemId || reasonParts.length === 0) {
    console.error('usage: node mark-rejected.mjs <YYYY-MM-DD> <itemId> <reason...>');
    process.exit(1);
  }
  main(isoDate, itemId, reasonParts.join(' ')).catch(err => { console.error(err); process.exit(1); });
}
