import { duckAmbient, restoreAmbient } from './ambient-sound.js';

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
  const status = document.createElement('span');
  status.className = 'visually-hidden';
  status.setAttribute('aria-live', 'polite');

  button.addEventListener('click', () => {
    duckAmbient();
    status.textContent = 'Playing audio description';
    audio.currentTime = 0;
    audio.play();
  });
  audio.addEventListener('ended', () => {
    status.textContent = 'Audio description finished';
    restoreAmbient();
  });

  const wrapper = document.createElement('span');
  wrapper.append(button, status);
  return wrapper;
}
