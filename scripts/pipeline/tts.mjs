import { writeFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { runPaths, eventIdFromDate, loadConfig } from './lib/config.mjs';
import { loadManifest, saveManifest, setState, fail, listByState } from './lib/manifest.mjs';

export function synthRequest(text, ttsCfg) {
  if (!text || !text.trim()) throw new Error('empty TTS text: refusing to render silence');
  return {
    input: { text },
    voice: { languageCode: ttsCfg.languageCode, name: ttsCfg.voiceName },
    audioConfig: { audioEncoding: ttsCfg.audioEncoding },
  };
}

// Adapter: lazily import the client so unit tests don't need credentials.
async function synthesize(text, ttsCfg, outFile) {
  const { TextToSpeechClient } = await import('@google-cloud/text-to-speech');
  const client = new TextToSpeechClient(); // ADC via GOOGLE_APPLICATION_CREDENTIALS
  const [res] = await client.synthesizeSpeech(synthRequest(text, ttsCfg));
  await writeFile(outFile, res.audioContent, 'binary');
}

// Render adAudio for every 'captioned' photo that has an adScript.
export async function main(isoDate) {
  const cfg = loadConfig();
  const eventId = eventIdFromDate(isoDate);
  const paths = runPaths(eventId);
  mkdirSync(paths.audio, { recursive: true });
  const manifest = loadManifest(paths.manifest);

  for (const item of listByState(manifest, 'captioned')) {
    if (item.kind !== 'photo') { setState(manifest, item.id, 'narrated'); continue; }
    if (!item.adScript) { fail(manifest, item.id, 'tts: no adScript written'); continue; }
    const out = path.join(paths.audio, `${item.id}-ad.mp3`);
    try {
      await synthesize(item.adScript, cfg.tts, out);
      item.adAudio = path.relative(paths.root, out);
      setState(manifest, item.id, 'narrated');
    } catch (err) {
      fail(manifest, item.id, `tts: ${err.message}`);
    }
  }
  saveManifest(paths.manifest, manifest);
  console.log(`Narrated ${listByState(manifest, 'narrated').length} item(s).`);
}

// Reusable helper for the reel stage: render one narration line to a file.
export async function renderNarrationLine(text, outFile) {
  await synthesize(text, loadConfig().tts, outFile);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const isoDate = process.argv[2];
  if (!isoDate) { console.error('usage: node tts.mjs <YYYY-MM-DD>'); process.exit(1); }
  main(isoDate).catch(err => { console.error(err); process.exit(1); });
}
