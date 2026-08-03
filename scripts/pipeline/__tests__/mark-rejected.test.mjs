// scripts/pipeline/__tests__/mark-rejected.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planReject } from '../mark-rejected.mjs';

const cfg = { processedFolderId: 'processedFolder', rejectedFolderId: 'rejectedFolder' };

test('planReject re-parents from Processed/ to Rejected/ when the item has a sourceId', () => {
  const move = planReject({ sourceId: 'f1' }, cfg);
  assert.deepEqual(move, { fileId: 'f1', addParents: 'rejectedFolder', removeParents: 'processedFolder' });
});

test('planReject returns null for items with no sourceId (not pulled from Drive)', () => {
  const move = planReject({ sourceId: null }, cfg);
  assert.equal(move, null);
});
