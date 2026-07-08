import { createAdButton } from './ad-button.js';

async function fetchItems(url) {
  const response = await fetch(url);
  if (!response.ok) return null;
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) return null;
  const data = await response.json();
  return Array.isArray(data.items) ? data.items : null;
}

// Returns { items, source } where source is the URL the data came from.
async function loadMediaWithSource() {
  try {
    const local = await fetchItems('media.local.json').catch(() => null);
    if (local) return { items: local, source: 'media.local.json' };
    const fallback = await fetchItems('media.json');
    if (fallback) return { items: fallback, source: 'media.json' };
  } catch (err) {
    console.error('Failed to load media data:', err);
  }
  return { items: [], source: null };
}

export async function loadMedia() {
  return (await loadMediaWithSource()).items;
}

export function renderPhotoCard(item) {
  const card = document.createElement('article');
  card.className = 'media-card';
  const img = document.createElement('img');
  img.src = item.src;
  img.alt = item.alt;
  img.loading = 'lazy';
  const caption = document.createElement('p');
  caption.textContent = item.caption;
  card.append(img, caption, createAdButton(item.adAudio));
  return card;
}

export function renderVideoCard(item) {
  const card = document.createElement('article');
  card.className = 'media-card';
  const heading = document.createElement('p');
  heading.textContent = item.caption;
  const player = document.createElement('div');
  player.className = 'able-player-mount';
  if (item.youtubeId || item.localSrc) {
    player.dataset.youtubeId = item.youtubeId ?? '';
    player.dataset.localSrc = item.localSrc ?? '';
    player.dataset.poster = item.poster ?? '';
    player.dataset.vtt = item.vtt ?? '';
    player.dataset.adTrack = item.adTrack ?? '';
  } else {
    const placeholder = document.createElement('p');
    placeholder.className = 'video-placeholder';
    placeholder.textContent = 'Video coming soon.';
    player.append(placeholder);
  }
  const transcript = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Transcript';
  transcript.append(summary, document.createTextNode(item.transcript ?? 'Transcript not yet available.'));
  card.append(heading, player, transcript);
  return card;
}

// Human-readable heading for a Logbook event group. Grouping keys stay as-is;
// only the visible text changes.
function formatEventHeading(event, eventItems) {
  const dates = new Set(eventItems.map(i => i.date).filter(Boolean));
  if (dates.size === 1) {
    const parsed = new Date(`${[...dates][0]}T00:00:00`);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
  }
  if (event === 'unknown-event') return 'Undated';
  return event
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export async function renderLogbook(container) {
  const items = await loadMedia();
  const byEvent = new Map();
  for (const item of items) {
    const key = item.event ?? 'unknown-event';
    if (!byEvent.has(key)) byEvent.set(key, []);
    byEvent.get(key).push(item);
  }
  const newestDate = eventItems => eventItems.reduce((max, i) => (i.date > max ? i.date : max), '');
  const groups = [...byEvent.entries()].sort((a, b) => newestDate(b[1]).localeCompare(newestDate(a[1])));
  for (const [event, eventItems] of groups) {
    const section = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = formatEventHeading(event, eventItems);
    section.append(heading);
    for (const item of eventItems) {
      section.append(item.type === 'video' ? renderVideoCard(item) : renderPhotoCard(item));
    }
    container.append(section);
  }
}

export async function renderVoices(container) {
  const { items, source } = await loadMediaWithSource();
  let voices = items.filter(i => i.person);
  if (voices.length === 0 && source === 'media.local.json') {
    // Local QA data may lack interview items; fall back to the published
    // media.json so Voices never renders empty.
    const fallback = await fetchItems('media.json').catch(() => null);
    if (fallback) voices = fallback.filter(i => i.person);
  }
  if (voices.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'voices-empty';
    empty.textContent = 'Interview debriefs are coming soon — check back as more sailors share their stories.';
    container.append(empty);
    return;
  }
  for (const item of voices) {
    container.append(renderVideoCard(item));
  }
}
