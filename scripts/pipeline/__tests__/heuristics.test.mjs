// scripts/pipeline/__tests__/heuristics.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, itemId } from '../lib/heuristics.mjs';

test('slugify lowercases and dash-collapses', () => {
  assert.equal(slugify('IMG_1234 (2).HEIC'), 'img-1234-2-heic');
  assert.equal(slugify('Pulling away from OYC'), 'pulling-away-from-oyc');
});

test('itemId namespaces a source filename under the event', () => {
  assert.equal(itemId('june-13-2026', 'IMG_1234.HEIC'), 'june-13-2026-img-1234');
});

test('itemId strips the extension before slugging', () => {
  assert.equal(itemId('june-13-2026', 'DSC_0007.MOV'), 'june-13-2026-dsc-0007');
});
