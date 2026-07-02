// scripts/pipeline/__tests__/drive-pull.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planPulls } from '../drive-pull.mjs';

const remote = [
  { id: 'f1', name: 'IMG_1234.HEIC', mimeType: 'image/heic' },
  { id: 'f2', name: 'DSC_0007.MOV', mimeType: 'video/quicktime' },
  { id: 'f3', name: 'notes.txt', mimeType: 'text/plain' },
];

test('planPulls keeps only image/video files, skips already-seen ids', () => {
  const seen = new Set(['f1']);
  const plan = planPulls(remote, seen, 'june-13-2026');
  assert.equal(plan.length, 1);
  assert.equal(plan[0].sourceId, 'f2');
  assert.equal(plan[0].kind, 'video');
  assert.equal(plan[0].id, 'june-13-2026-dsc-0007');
});

test('planPulls classifies HEIC/JPEG as photo and mov/mp4 as video', () => {
  const plan = planPulls(remote, new Set(), 'e');
  const kinds = Object.fromEntries(plan.map(p => [p.sourceId, p.kind]));
  assert.equal(kinds.f1, 'photo');
  assert.equal(kinds.f2, 'video');
  assert.equal(kinds.f3, undefined); // txt dropped
});
