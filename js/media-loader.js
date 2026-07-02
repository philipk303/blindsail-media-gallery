import { createAdButton } from './ad-button.js';

async function loadMedia() {
  const localResponse = await fetch('media.local.json').catch(() => null);
  if (localResponse && localResponse.ok) {
    return (await localResponse.json()).items;
  }
  const response = await fetch('media.json');
  return (await response.json()).items;
}

function renderPhotoCard(item) {
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

function renderVideoCard(item) {
  const card = document.createElement('article');
  card.className = 'media-card';
  const heading = document.createElement('p');
  heading.textContent = item.caption;
  const player = document.createElement('div');
  player.className = 'able-player-mount';
  player.dataset.youtubeId = item.youtubeId ?? '';
  player.dataset.localSrc = item.localSrc ?? '';
  player.dataset.poster = item.poster ?? '';
  player.dataset.vtt = item.vtt ?? '';
  player.dataset.adTrack = item.adTrack ?? '';
  const transcript = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Transcript';
  transcript.append(summary, document.createTextNode(item.transcript ?? 'Transcript not yet available.'));
  card.append(heading, player, transcript);
  return card;
}

export async function renderLogbook(container) {
  const items = await loadMedia();
  const byEvent = new Map();
  for (const item of items) {
    const key = item.event ?? 'unknown-event';
    if (!byEvent.has(key)) byEvent.set(key, []);
    byEvent.get(key).push(item);
  }
  for (const [event, eventItems] of [...byEvent.entries()].sort().reverse()) {
    const section = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = event;
    section.append(heading);
    for (const item of eventItems) {
      section.append(item.type === 'video' ? renderVideoCard(item) : renderPhotoCard(item));
    }
    container.append(section);
  }
}

export async function renderVoices(container) {
  const items = await loadMedia();
  for (const item of items.filter(i => i.person)) {
    container.append(renderVideoCard(item));
  }
}
