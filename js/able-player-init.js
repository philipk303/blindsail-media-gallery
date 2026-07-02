// Mounts Able Player instances into .able-player-mount placeholders
// rendered by media-loader.js. Able Player v5 is loaded as a classic
// script in <head> (with jQuery), exposing the AblePlayer global.
// Dynamically created players must omit data-able-player and be
// constructed directly: new AblePlayer(videoElement).
import { duckAmbient, restoreAmbient } from './ambient-sound.js';

export function mountAblePlayers(root = document) {
  for (const mount of root.querySelectorAll('.able-player-mount')) {
    const video = document.createElement('video');
    if (mount.dataset.poster) {
      video.poster = mount.dataset.poster;
    }

    if (mount.dataset.youtubeId) {
      video.setAttribute('data-youtube-id', mount.dataset.youtubeId);
    } else if (mount.dataset.localSrc) {
      const source = document.createElement('source');
      source.src = mount.dataset.localSrc;
      source.type = 'video/mp4';
      video.append(source);
    } else {
      continue; // nothing to play
    }

    if (mount.dataset.vtt) {
      const captions = document.createElement('track');
      captions.kind = 'captions';
      captions.src = mount.dataset.vtt;
      captions.default = true;
      video.append(captions);
    }
    if (mount.dataset.adTrack) {
      const descriptions = document.createElement('track');
      descriptions.kind = 'descriptions';
      descriptions.src = mount.dataset.adTrack;
      video.append(descriptions);
    }

    mount.replaceChildren(video);
    // eslint-disable-next-line no-undef
    new AblePlayer(video);
    video.addEventListener('play', duckAmbient);
    video.addEventListener('pause', restoreAmbient);
    video.addEventListener('ended', restoreAmbient);
  }
}
