export function formatTimestamp(seconds) {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(millis, 3)}`;
}

// segments: [{ start, end, text }]
export function buildVtt(segments) {
  if (!segments || segments.length === 0) throw new Error('no segments: refusing to write an empty VTT track');
  const lines = ['WEBVTT', ''];
  for (const seg of segments) {
    lines.push(`${formatTimestamp(seg.start)} --> ${formatTimestamp(seg.end)}`);
    lines.push(seg.text);
    lines.push('');
  }
  return lines.join('\n');
}
