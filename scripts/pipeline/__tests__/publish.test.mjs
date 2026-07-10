import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMediaItem, mergeItems, publishBlockers } from '../publish.mjs';

test('toMediaItem maps a published photo to the loader schema', () => {
  const item = {
    id: 'e-img-1', kind: 'photo', event: 'june-13-2026', date: '2026-06-13',
    alt: 'A sailor grips the tiller, smiling.', caption: 'At the helm.',
    chapter: 'at-helm', person: null,
    adAudio: 'audio/e-img-1-ad.mp3',
  };
  const media = toMediaItem(item, 'june-13-2026');
  assert.deepEqual(media, {
    id: 'e-img-1', type: 'photo',
    src: 'media/june-13-2026/e-img-1.jpg',
    alt: 'A sailor grips the tiller, smiling.',
    caption: 'At the helm.',
    adAudio: 'media/june-13-2026/e-img-1-ad.mp3',
    chapter: 'at-helm', event: 'june-13-2026', date: '2026-06-13',
  });
});

test('toMediaItem maps a published video with youtubeId and tracks', () => {
  const item = {
    id: 'e-vid-1', kind: 'video', event: 'june-13-2026', date: '2026-06-13',
    caption: 'Debrief with David.', person: 'David Cook', chapter: null,
    youtubeId: 'abc123', transcript: 'We had a great sail.',
    captionVtt: 'renditions/e-vid-1.vtt', adVtt: 'renditions/e-vid-1-ad.vtt',
    hasSpeech: true,
  };
  const media = toMediaItem(item, 'june-13-2026');
  assert.equal(media.type, 'video');
  assert.equal(media.youtubeId, 'abc123');
  assert.equal(media.poster, 'media/june-13-2026/e-vid-1-poster.jpg');
  assert.equal(media.vtt, 'media/june-13-2026/e-vid-1.vtt');
  assert.equal(media.adTrack, 'media/june-13-2026/e-vid-1-ad.vtt');
  assert.equal(media.person, 'David Cook');
});

test('mergeItems replaces items with the same id and appends new ones', () => {
  const existing = { items: [{ id: 'keep' }, { id: 'e-img-1', caption: 'old' }] };
  const merged = mergeItems(existing, [{ id: 'e-img-1', caption: 'new' }, { id: 'e-img-2' }]);
  const ids = merged.items.map(i => i.id);
  assert.deepEqual(ids, ['keep', 'e-img-1', 'e-img-2']);
  assert.equal(merged.items.find(i => i.id === 'e-img-1').caption, 'new'); // upgraded in place
});

test('publishBlockers blocks null/filename-derived alt or caption and missing AD', () => {
  const photo = { id: 'p', kind: 'photo', alt: null, caption: 'IMG_1234', adAudio: null };
  const blockers = publishBlockers(photo);
  assert.ok(blockers.some(b => /alt/.test(b)));
  assert.ok(blockers.some(b => /caption/.test(b)));
  assert.ok(blockers.some(b => /AD audio/.test(b)));
});

test('publishBlockers passes a fully written photo and gates spoken-video captions', () => {
  const photo = { id: 'p', kind: 'photo', alt: 'A sailor at the helm.', caption: 'Driving the boat.', adAudio: 'audio/p-ad.mp3' };
  assert.deepEqual(publishBlockers(photo), []);
  const video = { id: 'v', kind: 'video', caption: 'Debrief.', youtubeId: 'x', hasSpeech: true, captionVtt: null, adVtt: null, adDecision: 'not-needed — the speaker describes the scene' };
  assert.ok(publishBlockers(video).some(b => /captions/.test(b)));
});
