import { duckAmbient, restoreAmbient } from './ambient-sound.js';

// Only one audio description plays at a time. Track the current one so
// starting another AD stops it, and so ambient sound is only restored when
// the *currently playing* AD ends (not when a previously stopped one fires
// its events).
let currentAd = null;

function stopCurrentAd() {
  if (!currentAd) return;
  const stopped = currentAd;
  currentAd = null;
  stopped.audio.pause();
  stopped.audio.currentTime = 0;
  stopped.status.textContent = '';
}

export function createAdButton(adAudioSrc) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ad-button';
  button.textContent = 'Play audio description';

  if (!adAudioSrc) {
    button.disabled = true;
    button.textContent = 'Audio description not yet available';
    return button;
  }

  const audio = new Audio(adAudioSrc);
  audio.preload = 'none';
  const status = document.createElement('span');
  status.className = 'visually-hidden';
  status.setAttribute('aria-live', 'polite');
  const entry = { audio, status };

  function failCleanup() {
    if (currentAd !== entry) return; // superseded by a later AD; not a real failure
    currentAd = null;
    status.textContent = 'Audio description could not be played';
    restoreAmbient();
  }

  button.addEventListener('click', () => {
    stopCurrentAd();
    currentAd = entry;
    duckAmbient();
    audio.currentTime = 0;
    audio.play().then(() => {
      if (currentAd === entry) status.textContent = 'Playing audio description';
    }).catch(() => failCleanup());
  });

  audio.addEventListener('error', () => {
    if (currentAd === entry) failCleanup();
  });

  audio.addEventListener('ended', () => {
    if (currentAd !== entry) return; // stale event from a stopped AD
    currentAd = null;
    status.textContent = 'Audio description finished';
    restoreAmbient();
  });

  const wrapper = document.createElement('span');
  wrapper.append(button, status);
  return wrapper;
}
