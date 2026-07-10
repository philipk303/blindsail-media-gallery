// scripts/pipeline/__tests__/manifest.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  newManifest, addItem, setState, hold, clearHold, fail, listByState,
  saveManifest, loadManifest, ITEM_STATES,
} from '../lib/manifest.mjs';

test('newManifest starts empty with an event id', () => {
  const m = newManifest('june-13-2026');
  assert.equal(m.event, 'june-13-2026');
  assert.deepEqual(m.items, []);
});

test('addItem seeds a pulled item with a stable id and defaults', () => {
  const m = newManifest('june-13-2026');
  const item = addItem(m, { id: 'june-13-2026-img-1234', kind: 'photo', sourceFile: 'IMG_1234.HEIC', date: '2026-06-13' });
  assert.equal(item.state, 'pulled');
  assert.equal(item.held, false);
  assert.equal(item.event, 'june-13-2026');
  assert.equal(m.items.length, 1);
});

test('setState advances an item; unknown state throws', () => {
  const m = newManifest('e');
  addItem(m, { id: 'a', kind: 'photo', sourceFile: 'a.heic', date: '2026-06-13' });
  setState(m, 'a', 'converted');
  assert.equal(m.items[0].state, 'converted');
  assert.throws(() => setState(m, 'a', 'bogus'), /unknown state/i);
});

test('hold marks item held with a reason and freezes advancement', () => {
  const m = newManifest('e');
  addItem(m, { id: 'a', kind: 'photo', sourceFile: 'a.heic', date: '2026-06-13' });
  hold(m, 'a', 'possible bystander in frame');
  const held = listByState(m, 'held');
  assert.equal(held.length, 1);
  assert.equal(held[0].holdReason, 'possible bystander in frame');
  assert.throws(() => setState(m, 'a', 'converted'), /held/i);
});

test('fail marks item failed with a reason', () => {
  const m = newManifest('e');
  addItem(m, { id: 'a', kind: 'video', sourceFile: 'a.mov', date: '2026-06-13' });
  fail(m, 'a', 'ffmpeg transcode error');
  assert.equal(listByState(m, 'failed')[0].failReason, 'ffmpeg transcode error');
});

test('save then load round-trips the manifest', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'bsm-'));
  try {
    const file = path.join(dir, 'manifest.json');
    const m = newManifest('june-13-2026');
    addItem(m, { id: 'a', kind: 'photo', sourceFile: 'a.heic', date: '2026-06-13' });
    saveManifest(file, m);
    const loaded = loadManifest(file);
    assert.deepEqual(loaded, m);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('clearHold un-holds and restores a workable state', () => {
  const m = newManifest('e');
  addItem(m, { id: 'a', kind: 'photo', sourceFile: 'a.heic', date: '2026-06-13' });
  hold(m, 'a', 'possible bystander in frame');
  clearHold(m, 'a', 'screened');
  assert.equal(m.items[0].state, 'screened');
  assert.equal(m.items[0].held, false);
  assert.equal(listByState(m, 'held').length, 0);
});

test('addItem suffixes a colliding id instead of corrupting state', () => {
  const m = newManifest('e');
  addItem(m, { id: 'e-img-1234', kind: 'photo', sourceFile: 'x1-IMG_1234.HEIC', date: '2026-06-13' });
  const second = addItem(m, { id: 'e-img-1234', kind: 'photo', sourceFile: 'x2-IMG_1234.HEIC', date: '2026-06-13' });
  assert.equal(second.id, 'e-img-1234-2');
});

test('ITEM_STATES lists the pipeline states', () => {
  assert.ok(ITEM_STATES.includes('published'));
  assert.ok(ITEM_STATES.includes('held'));
});
