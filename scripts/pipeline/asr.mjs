import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { runPaths, eventIdFromDate, loadConfig } from './lib/config.mjs';
import { loadManifest, saveManifest, hold, fail } from './lib/manifest.mjs';
import { buildVtt } from './lib/vtt.mjs';
import { run } from './lib/ffmpeg.mjs';

export function transcriptFromWords(words) {
  return words.map(w => w.word).join(' ');
}

// Group word-timings into caption cues. Break when a silence gap exceeds
// maxGap, or when a cue reaches maxWords.
export function wordsToCues(words, { maxGap = 1.2, maxWords = 12 } = {}) {
  const cues = [];
  let cur = null;
  for (const w of words) {
    if (cur && (w.start - cur.end > maxGap || cur.words.length >= maxWords)) {
      cues.push({ start: cur.start, end: cur.end, text: cur.words.join(' ') });
      cur = null;
    }
    if (!cur) cur = { start: w.start, end: w.end, words: [] };
    cur.words.push(w.word);
    cur.end = w.end;
  }
  if (cur) cues.push({ start: cur.start, end: cur.end, text: cur.words.join(' ') });
  return cues;
}

// Adapter: extract mono 16k WAV in <60s chunks — the *sync* recognize API
// rejects audio over ~1 minute, and debrief interviews exceed it. PCM WAV
// splits sample-exactly at the segment boundary, so timing offsets are exact.
// Upgrade path for very long interviews: GCS staging + longRunningRecognize.
const CHUNK_SECONDS = 55;

async function transcribe(videoFile, chunkDir, id, asrCfg) {
  const pattern = path.join(chunkDir, `${id}-chunk-%03d.wav`);
  run(['-y', '-i', videoFile, '-vn', '-ac', '1', '-ar', '16000',
    '-f', 'segment', '-segment_time', String(CHUNK_SECONDS), pattern]);
  const { readFileSync, readdirSync } = await import('node:fs');
  const chunks = readdirSync(chunkDir).filter(f => f.startsWith(`${id}-chunk-`)).sort();
  const speech = await import('@google-cloud/speech');
  const client = new speech.SpeechClient(); // ADC via GOOGLE_APPLICATION_CREDENTIALS
  const words = [];
  for (const [idx, chunk] of chunks.entries()) {
    const audioBytes = readFileSync(path.join(chunkDir, chunk)).toString('base64');
    const [response] = await client.recognize({
      audio: { content: audioBytes },
      config: {
        encoding: 'LINEAR16', sampleRateHertz: 16000,
        languageCode: asrCfg.languageCode, model: asrCfg.model,
        enableWordTimeOffsets: true, enableAutomaticPunctuation: true,
      },
    });
    const offset = idx * CHUNK_SECONDS;
    const toSec = (t) => Number(t?.seconds ?? 0) + Number(t?.nanos ?? 0) / 1e9;
    for (const result of response.results ?? []) {
      for (const w of result.alternatives?.[0]?.words ?? []) {
        words.push({ word: w.word, start: offset + toSec(w.startTime), end: offset + toSec(w.endTime) });
      }
    }
  }
  return words;
}

export async function main(isoDate) {
  const cfg = loadConfig();
  const eventId = eventIdFromDate(isoDate);
  const paths = runPaths(eventId);
  const manifest = loadManifest(paths.manifest);

  // Caption spoken videos that haven't been captioned yet. Pre-upload states
  // only — a re-run must never demote an already-uploaded/published item.
  for (const item of manifest.items.filter(i => i.kind === 'video' && i.hasSpeech && !i.captionVtt
    && ['captioned', 'narrated'].includes(i.state))) {
    try {
      const videoFile = path.join(paths.root, item.rendition);
      const words = await transcribe(videoFile, paths.renditions, item.id, cfg.asr);
      if (words.length === 0) {
        hold(manifest, item.id, 'asr: no speech recognized — confirm hasSpeech, then clearHold and re-run');
        continue;
      }
      const cues = wordsToCues(words);
      const vttPath = path.join(paths.renditions, `${item.id}.vtt`);
      writeFileSync(vttPath, buildVtt(cues));
      item.captionVtt = path.relative(paths.root, vttPath);
      item.transcript = transcriptFromWords(words);
    } catch (err) {
      fail(manifest, item.id, `asr: ${err.message}`);
    }
  }
  saveManifest(paths.manifest, manifest);
  console.log('Captioning pass complete.');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const isoDate = process.argv[2];
  if (!isoDate) { console.error('usage: node asr.mjs <YYYY-MM-DD>'); process.exit(1); }
  main(isoDate).catch(err => { console.error(err); process.exit(1); });
}
