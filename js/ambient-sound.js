const STORAGE_KEY = 'blindsail-ambient-enabled';

// localStorage can throw (SecurityError in private browsing / blocked storage).
// If it does, persistence is silently off but the toggle still works this session.
function readStoredPreference() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}
function writeStoredPreference(value) {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Persistence unavailable; ignore.
  }
}

const audio = new Audio('audio/ambient-waves.mp3');
audio.loop = true;
audio.preload = 'none';
let userWantsAmbient = readStoredPreference();
let duckedForMedia = false;
let retryOnGestureArmed = false;

const toggle = document.getElementById('ambient-toggle');

function armGestureRetry() {
  if (retryOnGestureArmed) return;
  retryOnGestureArmed = true;
  const retry = () => {
    document.removeEventListener('pointerdown', retry);
    document.removeEventListener('keydown', retry);
    retryOnGestureArmed = false;
    if (userWantsAmbient && !duckedForMedia) {
      audio.play().catch(() => {});
    }
  };
  document.addEventListener('pointerdown', retry, { once: false });
  document.addEventListener('keydown', retry, { once: false });
}

function applyState() {
  toggle.setAttribute('aria-pressed', String(userWantsAmbient));
  if (userWantsAmbient && !duckedForMedia) {
    // aria-pressed reflects user *intent*; if autoplay is blocked, recover
    // playback on the first user gesture.
    audio.play().catch(() => armGestureRetry());
  } else {
    audio.pause();
  }
}

toggle.addEventListener('click', () => {
  userWantsAmbient = !userWantsAmbient;
  writeStoredPreference(userWantsAmbient);
  applyState();
});

// Exposed for AD buttons / Able Player instances to duck ambient sound
export function duckAmbient() {
  duckedForMedia = true;
  applyState();
}
export function restoreAmbient() {
  duckedForMedia = false;
  applyState();
}

applyState();
