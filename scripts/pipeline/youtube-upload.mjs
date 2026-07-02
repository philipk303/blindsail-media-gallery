import { createReadStream, readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { google } from 'googleapis';
import { runPaths, eventIdFromDate, loadConfig, REPO_ROOT } from './lib/config.mjs';
import { loadManifest, saveManifest, setState, fail, listByState } from './lib/manifest.mjs';

export function uploadMetadata(video, ytCfg) {
  return {
    snippet: {
      title: (video.title || 'BlindSail SF Bay').slice(0, 100),
      description: video.description || '',
      tags: video.tags || ['BlindSail', 'sailing', 'accessibility'],
      categoryId: ytCfg.categoryId,
    },
    status: { privacyStatus: ytCfg.privacyStatus, selfDeclaredMadeForKids: false },
  };
}

function youtubeClient() {
  const clientRaw = JSON.parse(readFileSync(path.join(REPO_ROOT, 'secrets', 'youtube-oauth-client.json'), 'utf8'));
  const c = clientRaw.installed || clientRaw.web;
  const oauth2 = new google.auth.OAuth2(c.client_id, c.client_secret, 'http://localhost:5544/oauth2callback');
  const tokens = JSON.parse(readFileSync(path.join(REPO_ROOT, 'secrets', 'youtube-token.json'), 'utf8'));
  oauth2.setCredentials(tokens);
  return google.youtube({ version: 'v3', auth: oauth2 });
}

async function insertVideo(youtube, filePath, meta) {
  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: meta,
    media: { body: createReadStream(filePath) },
  });
  return res.data.id;
}

export async function main(isoDate) {
  const cfg = loadConfig();
  const eventId = eventIdFromDate(isoDate);
  const paths = runPaths(eventId);
  const manifest = loadManifest(paths.manifest);
  const youtube = youtubeClient();

  // Reel FIRST — it's the event's lead item, and quota is scarce:
  // videos.insert costs 1600 units of the 10,000/day default (~6 uploads/day).
  // The manifest saves after every upload, and a quota error leaves the
  // remaining items in their pre-upload state, so the next day's run resumes.
  const reelFile = path.join(paths.reel, `${eventId}-reel.mp4`);
  if (!manifest.reel) manifest.reel = {};
  if (!manifest.reel.youtubeId && existsSync(reelFile)) {
    try {
      const meta = uploadMetadata(
        { title: manifest.reel.title || `BlindSail — ${eventId}`, description: manifest.reel.narrationText || '', tags: ['BlindSail', 'highlight reel'] },
        cfg.youtube,
      );
      manifest.reel.youtubeId = await insertVideo(youtube, reelFile, meta);
    } catch (err) {
      if (/quota/i.test(err.message)) {
        console.error('quota exhausted — re-run tomorrow to resume uploads');
        saveManifest(paths.manifest, manifest);
        return;
      }
      manifest.reel.failReason = `youtube: ${err.message}`;
    }
    saveManifest(paths.manifest, manifest);
  }

  // Individual videos.
  for (const item of listByState(manifest, 'narrated').filter(i => i.kind === 'video')) {
    try {
      const meta = uploadMetadata(
        { title: item.caption, description: item.transcript || '', tags: ['BlindSail', 'sailing'] },
        cfg.youtube,
      );
      item.youtubeId = await insertVideo(youtube, path.join(paths.root, item.rendition), meta);
      setState(manifest, item.id, 'uploaded');
    } catch (err) {
      if (/quota/i.test(err.message)) {
        // Leave the item 'narrated' (NOT failed) so tomorrow's run picks it up.
        console.error(`quota exhausted — ${item.id} stays queued; re-run tomorrow`);
        break;
      }
      fail(manifest, item.id, `youtube: ${err.message}`);
    }
    saveManifest(paths.manifest, manifest); // save after each upload (resumable)
  }
  console.log('YouTube upload pass complete.');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const isoDate = process.argv[2];
  if (!isoDate) { console.error('usage: node youtube-upload.mjs <YYYY-MM-DD>'); process.exit(1); }
  main(isoDate).catch(err => { console.error(err); process.exit(1); });
}
