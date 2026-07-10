// scripts/pipeline/__tests__/config.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventIdFromDate, runPaths, publishedDir, loadConfig } from '../lib/config.mjs';

test('eventIdFromDate turns an ISO date into a slug', () => {
  assert.equal(eventIdFromDate('2026-06-13'), 'june-13-2026');
});

test('runPaths derives all working subdirs under a run', () => {
  const p = runPaths('june-13-2026');
  assert.match(p.root, /pipeline[\\/]runs[\\/]june-13-2026$/);
  assert.match(p.incoming, /incoming$/);
  assert.match(p.renditions, /renditions$/);
  assert.match(p.audio, /audio$/);
  assert.match(p.reel, /reel$/);
  assert.match(p.manifest, /manifest\.json$/);
  assert.match(p.shotlist, /shotlist\.json$/);
});

test('publishedDir points into the committed media tree', () => {
  assert.match(publishedDir('june-13-2026'), /media[\\/]june-13-2026$/);
});

test('loadConfig reads pipeline.config.json and exposes the voice name', () => {
  const cfg = loadConfig();
  assert.equal(cfg.tts.voiceName, 'en-US-Neural2-C');
});
