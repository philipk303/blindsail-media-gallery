// scripts/pipeline/__tests__/youtube-upload.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uploadMetadata } from '../youtube-upload.mjs';

test('uploadMetadata sets unlisted status and a titled snippet', () => {
  const meta = uploadMetadata(
    { title: 'A sailor at the helm', description: 'Debrief clip', tags: ['sailing'] },
    { privacyStatus: 'unlisted', categoryId: '29' },
  );
  assert.equal(meta.snippet.title, 'A sailor at the helm');
  assert.equal(meta.snippet.categoryId, '29');
  assert.deepEqual(meta.snippet.tags, ['sailing']);
  assert.equal(meta.status.privacyStatus, 'unlisted');
  assert.equal(meta.status.selfDeclaredMadeForKids, false);
});

test('uploadMetadata truncates a title over 100 chars (YouTube hard limit)', () => {
  const long = 'x'.repeat(150);
  const meta = uploadMetadata({ title: long, description: '' }, { privacyStatus: 'unlisted', categoryId: '29' });
  assert.ok(meta.snippet.title.length <= 100);
});
