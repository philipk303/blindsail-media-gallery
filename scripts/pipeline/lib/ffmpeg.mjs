import { execFileSync } from 'node:child_process';

// Single source of truth for shelling out to ffmpeg. Args array only — never a
// shell string. A prior review caught a shell-injection risk from interpolated
// ffmpeg strings; keep every caller on this path.
export function run(args, opts = {}) {
  return execFileSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'], ...opts });
}

export function runCapture(args) {
  return execFileSync('ffmpeg', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// Adapter: media duration in seconds via ffprobe (not unit-tested; exercised
// live by the reel stage, which sizes segments to fit their narration).
export function ffprobeDuration(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file], { encoding: 'utf8' });
  return parseFloat(out.trim());
}

// HEIC and other stills: force a single frame + -update 1 so ffmpeg treats the
// output as one image, then scale to `width` keeping even height (-2).
export function photoArgs(src, out, width) {
  return ['-y', '-i', src, '-update', '1', '-frames:v', '1', '-vf', `scale=${width}:-2`, out];
}

export function videoArgs(src, out, width) {
  return [
    '-y', '-i', src, '-vf', `scale=${width}:-2`,
    '-c:v', 'libx264', '-crf', '23', '-preset', 'medium',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out,
  ];
}

export function posterArgs(src, out, seconds) {
  return ['-y', '-ss', String(seconds), '-i', src, '-update', '1', '-frames:v', '1', out];
}
