// scripts/pipeline/__tests__/convert.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renditionTargets } from '../convert.mjs';

test('renditionTargets maps a photo item to one jpg output', () => {
  const t = renditionTargets({ id: 'e-img-1', kind: 'photo', sourceFile: 'IMG_1.HEIC' }, '/run/renditions');
  assert.match(t.rendition, /e-img-1\.jpg$/);
  assert.equal(t.poster, null);
});

test('renditionTargets maps a video item to mp4 + poster jpg', () => {
  const t = renditionTargets({ id: 'e-vid-1', kind: 'video', sourceFile: 'V.MOV' }, '/run/renditions');
  assert.match(t.rendition, /e-vid-1\.mp4$/);
  assert.match(t.poster, /e-vid-1-poster\.jpg$/);
});
