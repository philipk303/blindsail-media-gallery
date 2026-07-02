import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { runPaths, eventIdFromDate, loadConfig } from './lib/config.mjs';
import { loadManifest } from './lib/manifest.mjs';
import { run, ffprobeDuration } from './lib/ffmpeg.mjs';
import { buildVtt } from './lib/vtt.mjs';
import { renderNarrationLine } from './tts.mjs';

export function validateShotlist(shotlist) {
  if (!shotlist || !Array.isArray(shotlist.segments) || shotlist.segments.length === 0) {
    throw new Error('reel: shotlist has no segments');
  }
  if (!shotlist.title) throw new Error('reel: shotlist has no title');
  return shotlist;
}

export function segmentDuration(seg) {
  return seg.kind === 'photo' ? seg.seconds : (seg.out - seg.in);
}

// Effective duration per segment: never truncate narration (cut-off audio
// description is the project's highest-severity defect) — extend the visual
// to fit the narration plus a breathing margin instead.
export function effectiveDurations(segments, narrationSeconds, margin = 0.3) {
  return segments.map((seg, i) => {
    const planned = segmentDuration(seg);
    const narr = narrationSeconds[i] ?? 0;
    return narr > 0 ? Math.max(planned, Math.round((narr + margin) * 10) / 10) : planned;
  });
}

export function narrationCues(segments, effDurs) {
  const cues = [];
  let t = 0;
  segments.forEach((seg, i) => {
    const dur = effDurs[i];
    if (seg.narration) cues.push({ start: t, end: t + dur, text: seg.narration });
    t += dur;
  });
  return cues;
}

// Ken Burns still: aspect-preserving scale + pad at 2x target (zoom quality),
// then a linear zoom to 1.15 across the segment. A single still-image input
// with zoompan d=frames yields exactly `frames` output frames at `fps`.
export function photoSegmentArgs(src, out, seconds, cfg) {
  const frames = Math.round(seconds * cfg.fps);
  const w2 = cfg.width * 2;
  const h2 = cfg.height * 2;
  const vf = [
    `scale=${w2}:${h2}:force_original_aspect_ratio=decrease`,
    `pad=${w2}:${h2}:(ow-iw)/2:(oh-ih)/2`,
    `zoompan=z='1+0.15*on/${frames}':d=${frames}:s=${cfg.width}x${cfg.height}:fps=${cfg.fps}`,
    `setsar=1`,
  ].join(',');
  return ['-y', '-i', src, '-vf', vf,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', out];
}

// Video trim normalized to the same size/fps/SAR, silent (narration is added
// later). If the narration needs more time than the trim, freeze the last
// frame (tpad clone) rather than cutting the narration.
export function videoSegmentArgs(src, out, inS, outS, effDur, cfg) {
  const trimmed = outS - inS;
  let vf = `scale=${cfg.width}:${cfg.height}:force_original_aspect_ratio=decrease,` +
    `pad=${cfg.width}:${cfg.height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${cfg.fps}`;
  if (effDur > trimmed + 0.01) {
    vf += `,tpad=stop_mode=clone:stop_duration=${Math.round((effDur - trimmed) * 10) / 10}`;
  }
  return ['-y', '-ss', String(inS), '-to', String(outS), '-i', src, '-vf', vf,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', out];
}

// Adapter entry point.
export async function main(isoDate) {
  const cfg = loadConfig();
  const reelCfg = cfg.reel;
  const eventId = eventIdFromDate(isoDate);
  const paths = runPaths(eventId);
  mkdirSync(paths.reel, { recursive: true });
  const manifest = loadManifest(paths.manifest);
  const shotlist = validateShotlist(JSON.parse(readFileSync(paths.shotlist, 'utf8')));
  const byId = new Map(manifest.items.map(i => [i.id, i]));

  // 1) Narration FIRST: render each line, measure its real duration so the
  //    visuals can be sized to fit it.
  const narrFiles = [];
  const narrDurs = [];
  for (let idx = 0; idx < shotlist.segments.length; idx++) {
    const seg = shotlist.segments[idx];
    if (!seg.narration) { narrFiles.push(null); narrDurs.push(0); continue; }
    const nOut = path.join(paths.reel, `narr-${String(idx).padStart(3, '0')}.mp3`);
    await renderNarrationLine(seg.narration, nOut);
    narrFiles.push(nOut);
    narrDurs.push(ffprobeDuration(nOut));
  }
  const effDurs = effectiveDurations(shotlist.segments, narrDurs);

  // 2) Visual segments at their effective durations — all normalized to
  //    identical codec/size/fps/SAR so the concat demuxer can stream-copy.
  const segFiles = [];
  shotlist.segments.forEach((seg, idx) => {
    const item = byId.get(seg.id);
    if (!item) throw new Error(`reel: shotlist references unknown item ${seg.id}`);
    const src = path.join(paths.root, item.rendition);
    const segOut = path.join(paths.reel, `seg-${String(idx).padStart(3, '0')}.mp4`);
    if (seg.kind === 'photo') run(photoSegmentArgs(src, segOut, effDurs[idx], reelCfg));
    else run(videoSegmentArgs(src, segOut, seg.in, seg.out, effDurs[idx], reelCfg));
    segFiles.push(segOut);
  });

  // 3) Concat visuals (identically-encoded segments; Task 18 ffprobe-verifies
  //    the join on the first live run).
  const listFile = path.join(paths.reel, 'segments.txt');
  writeFileSync(listFile, segFiles.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
  const silentReel = path.join(paths.reel, 'reel-silent.mp4');
  run(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', silentReel]);

  // 4) Narration track: pad every slot to its effective duration in ONE
  //    uniform format (24kHz mono — Neural2's MP3 output rate) so the concat
  //    can't splice mismatched sample rates/channels, then concat with
  //    re-encode. No truncation: effDur >= narration duration by construction.
  const padded = [];
  shotlist.segments.forEach((seg, idx) => {
    const dur = effDurs[idx];
    const padOut = path.join(paths.reel, `narrpad-${String(idx).padStart(3, '0')}.mp3`);
    if (narrFiles[idx]) {
      run(['-y', '-i', narrFiles[idx], '-af', `apad=whole_dur=${dur}`, '-t', String(dur),
        '-ar', '24000', '-ac', '1', '-b:a', '48k', padOut]);
    } else {
      run(['-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', String(dur),
        '-b:a', '48k', padOut]);
    }
    padded.push(padOut);
  });
  const narrConcatList = path.join(paths.reel, 'narration.txt');
  writeFileSync(narrConcatList, padded.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
  const narrTrack = path.join(paths.reel, 'narration.mp3');
  run(['-y', '-f', 'concat', '-safe', '0', '-i', narrConcatList,
    '-ar', '24000', '-ac', '1', '-b:a', '48k', narrTrack]);

  // 5) Mux. Audio and video are the same length by construction, so no
  //    -shortest (which risked truncating the final narration line).
  const finalReel = path.join(paths.reel, `${eventId}-reel.mp4`);
  run(['-y', '-i', silentReel, '-i', narrTrack, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
    '-map', '0:v:0', '-map', '1:a:0', '-movflags', '+faststart', finalReel]);

  // 6) Captions VTT from narration cues at the effective timings.
  const cues = narrationCues(shotlist.segments, effDurs);
  const vttPath = path.join(paths.reel, `${eventId}-reel.vtt`);
  writeFileSync(vttPath, buildVtt(cues));

  console.log(`Reel assembled: ${finalReel}`);
  console.log(`Reel captions:  ${vttPath}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const isoDate = process.argv[2];
  if (!isoDate) { console.error('usage: node reel.mjs <YYYY-MM-DD>'); process.exit(1); }
  main(isoDate).catch(err => { console.error(err); process.exit(1); });
}
