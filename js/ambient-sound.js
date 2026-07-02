const STORAGE_KEY = 'blindsail-ambient-enabled';
const audio = new Audio('audio/ambient-waves.mp3');
audio.loop = true;
let userWantsAmbient = localStorage.getItem(STORAGE_KEY) === 'true';
let duckedForMedia = false;

const toggle = document.getElementById('ambient-toggle');

function applyState() {
  toggle.setAttribute('aria-pressed', String(userWantsAmbient));
  if (userWantsAmbient && !duckedForMedia) {
    audio.play().catch(() => {});
  } else {
    audio.pause();
  }
}

toggle.addEventListener('click', () => {
  userWantsAmbient = !userWantsAmbient;
  localStorage.setItem(STORAGE_KEY, String(userWantsAmbient));
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
