// scripts/pipeline/__tests__/tts.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { synthRequest } from '../tts.mjs';

test('synthRequest shapes a Cloud TTS request with the configured Neural2 voice', () => {
  const req = synthRequest('A sailor grips the tiller.', { languageCode: 'en-US', voiceName: 'en-US-Neural2-C', audioEncoding: 'MP3' });
  assert.deepEqual(req, {
    input: { text: 'A sailor grips the tiller.' },
    voice: { languageCode: 'en-US', name: 'en-US-Neural2-C' },
    audioConfig: { audioEncoding: 'MP3' },
  });
});

test('synthRequest rejects empty text (never render silence)', () => {
  assert.throws(() => synthRequest('   ', { languageCode: 'en-US', voiceName: 'v', audioEncoding: 'MP3' }), /empty/i);
});
