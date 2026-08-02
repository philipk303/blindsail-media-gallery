# BlindSail Publishing Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the local Claude Code publishing skill that turns volunteer media (Drive folder or local files) into a screened, captioned, audio-described, YouTube-hosted Logbook entry with an auto-assembled highlight reel, written into `media.json` and pushed.

**Architecture:** A `SKILL.md` workflow orchestrates deterministic Node scripts (Drive pull, ffmpeg convert, Cloud TTS narration, Cloud Speech-to-Text captions, ffmpeg reel assembly, YouTube upload, `media.json` write) while Claude does the vision-and-judgment work inline during the run (screening each image, writing captions/alt-text/AD scripts, drafting the reel shot list). A per-run **manifest** JSON is the single source of pipeline state, making runs resumable and holds explicit. Mechanical steps are scripts; judgment steps are SKILL.md instructions to Claude.

**Tech Stack:** Node.js (ESM `.mjs`, `node:test` runner, zero build step), ffmpeg (via `execFileSync` with an args array — never shell strings), gws CLI (Drive pull, existing philipk303@gmail.com auth), `@google-cloud/text-to-speech` + `@google-cloud/speech` (service-account/ADC auth), `googleapis` (YouTube Data API v3, OAuth2 refresh token). One new dedicated GCP project hosts all three Google APIs.

---

## Decisions locked before this plan (do not re-litigate)

- **TTS:** Google Cloud Text-to-Speech (Neural2). Free tier (1M chars/mo) dwarfs usage (~10–20k chars/mo). Supersedes design.md line 60's "Edge neural TTS" example, consistent with the doc's other 2026-07-01 amendments.
- **Captions:** Google Cloud Speech-to-Text for spoken-word clips (debriefs). Silent sailing footage gets no captions; the reel's captions come free from the TTS narration text.
- **Video host / YouTube auth:** philipk303 personal YouTube, **unlisted**. gws has **no** YouTube API — YouTube uses `googleapis` OAuth2 (user consent → cached refresh token), separate from gws.
- **GCP project:** one **new dedicated BlindSail project** hosts Cloud TTS, Cloud Speech-to-Text, and YouTube Data API. Cloud APIs authenticate with a service-account JSON (`GOOGLE_APPLICATION_CREDENTIALS`); YouTube uses OAuth2.
- **Drive folder:** create the real shared volunteer folder as an early task (Task 2).
- **First end-to-end test data:** `6-13 Sailing -pk/` (raw camera filenames, ~480MB, 10 photos + 6 videos), the first real Logbook entry + reel.
- **Scope:** full 7-stage pipeline in this one plan.

## Non-negotiable constraints (carried from CLAUDE.md / design.md)

- **Never echo file contents/code into chat.** Use file tools; report in one sentence; offer Notepad for review.
- **Never commit or deploy un-screened real media.** Only `publish.mjs`, after explicit approval, copies renditions into `media/<event>/`. Raw media and all pipeline working dirs stay gitignored.
- **ffmpeg/gws always via `execFileSync(cmd, [args])`** — args array, never an interpolated shell string (a prior review caught a shell-injection risk in exactly this pattern).
- **Accessibility is the highest-severity defect class.** Filename-derived captions never publish. Held items never auto-publish. Every AD script and alt text is written by Claude looking at the actual image.

---

## File Structure

```
.claude/skills/blindsail-publish/SKILL.md   # the workflow Claude follows to run the pipeline
scripts/pipeline/
  lib/
    config.mjs        # paths, event-id helpers, voice/model constants, config loader
    manifest.mjs      # per-run item state machine (load/save/addItem/setState/hold/listByState)
    ffmpeg.mjs        # execFileSync wrapper + photo/video/poster arg builders
    heuristics.mjs    # slugify + deterministic id generation
    vtt.mjs           # build WebVTT from timed segments (captions + descriptions tracks)
  drive-pull.mjs      # stage 1: pull new files from shared Drive folder (gws)
  convert.mjs         # stage 2: HEIC->JPEG, video->MP4, poster frames (ffmpeg)
  tts.mjs             # stage 5: render AD narration MP3 (Cloud TTS) + reel narration
  asr.mjs             # captions: Cloud Speech-to-Text -> transcript + timed VTT
  reel.mjs            # stage 6: assemble highlight reel from shotlist.json (ffmpeg)
  youtube-auth.mjs    # one-time OAuth consent -> cache refresh token (gitignored)
  youtube-upload.mjs  # stage 7a: upload video/reel unlisted (googleapis)
  publish.mjs         # stage 7b: copy approved renditions to media/<event>/, merge media.json
  package.json        # ESM, deps, "test" script -> node --test
  __tests__/
    manifest.test.mjs
    ffmpeg.test.mjs
    heuristics.test.mjs
    vtt.test.mjs
    reel.test.mjs
    youtube-upload.test.mjs
    publish.test.mjs
config/
  pipeline.config.json          # non-secret: drive folder id, gcp project id, voice, defaults
secrets/                        # gitignored: service-account.json, youtube-oauth-client.json, youtube-token.json
pipeline/                       # gitignored: runs/<event>/{incoming,renditions,audio,reel,manifest.json,shotlist.json}
media/<event>/                  # committed AFTER approval: <id>.jpg, <id>-poster.jpg, <id>-ad.mp3, <id>.vtt, <id>-ad.vtt
```

**State machine (manifest item `state`):** `pulled -> converted -> screened -> captioned -> narrated -> uploaded -> published`, plus terminal `held` (with `holdReason`) and `failed` (with `failReason`). A `held` or `failed` item never advances until a human clears it.

---

## Task 1: Pipeline scaffolding, gitignore, dependencies

**Files:**
- Create: `scripts/pipeline/package.json`
- Create: `config/pipeline.config.json`
- Modify: `.gitignore`
- Create: `secrets/.gitkeep`

- [ ] **Step 1: Extend `.gitignore`** so pipeline working state, secrets, and Claude worktrees never get committed, while `.claude/skills/` and `media/<event>/` stay committable.

Append to `.gitignore`:

```gitignore

# Publishing pipeline working state & secrets (never committed)
# (secrets/* not secrets/ — ignoring the directory itself would make git never
# descend into it, so the !.gitkeep negation would be dead.)
pipeline/runs/
secrets/*
!secrets/.gitkeep
config/*.local.json
scripts/pipeline/node_modules/

# Claude Code worktrees (local only) — keep skills/ committable
.claude/worktrees/
```

- [ ] **Step 2: Create `secrets/.gitkeep`** (empty file) so the gitignored `secrets/` dir exists in a fresh clone for a successor to drop credentials into.

Content: (empty)

- [ ] **Step 3: Create `scripts/pipeline/package.json`.**

```json
{
  "name": "blindsail-pipeline",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  },
  "dependencies": {
    "@google-cloud/text-to-speech": "^5.3.0",
    "@google-cloud/speech": "^6.7.0",
    "googleapis": "^144.0.0"
  }
}
```

- [ ] **Step 4: Create `config/pipeline.config.json`** with non-secret defaults. `driveFolderId` is filled by Task 2; leave the placeholder now.

```json
{
  "driveFolderId": "REPLACE_IN_TASK_2",
  "gcpProjectId": "REPLACE_WITH_BLINDSAIL_GCP_PROJECT_ID",
  "gwsAccount": "philipk303@gmail.com",
  "gwsJs": "REPLACE_IN_TASK_8_STEP_3",
  "tts": {
    "languageCode": "en-US",
    "voiceName": "en-US-Neural2-C",
    "audioEncoding": "MP3"
  },
  "asr": {
    "languageCode": "en-US",
    "model": "latest_long"
  },
  "youtube": {
    "privacyStatus": "unlisted",
    "categoryId": "29"
  },
  "reel": {
    "width": 1280,
    "height": 720,
    "fps": 30,
    "photoSeconds": 4,
    "crossfadeSeconds": 0.5
  }
}
```

- [ ] **Step 5: Install dependencies.**

Run: `cd "scripts/pipeline" && npm install`
Expected: `node_modules/` created; `@google-cloud/text-to-speech`, `@google-cloud/speech`, `googleapis` resolved. (`scripts/pipeline/node_modules/` is ignored via the Step 1 `.gitignore` addition — the repo's existing `.gitignore` does NOT cover node_modules.)

- [ ] **Step 6: Verify `ffmpeg` is on PATH** (the pipeline shells out to it).

Run: `ffmpeg -version`
Expected: prints a version banner. If "command not found", STOP and tell the user to install ffmpeg before proceeding (the convert/reel stages require it).

- [ ] **Step 7: Commit.**

```bash
git add .gitignore secrets/.gitkeep scripts/pipeline/package.json scripts/pipeline/package-lock.json config/pipeline.config.json
git commit -m "chore: scaffold publishing pipeline (deps, config, gitignore)"
```

---

## Task 2: Create the shared volunteer Drive folder

**Files:**
- Modify: `config/pipeline.config.json`

This is a one-time human-run step using gws (existing philipk303 auth). It is not unit-tested; success = a folder ID recorded in config.

- [ ] **Step 1: Create the folder via gws** (Bash, not PowerShell — JSON braces).

```bash
export GOOGLE_WORKSPACE_CLI_CONFIG_DIR="$USERPROFILE/.config/gws-accounts/philipk303@gmail.com"
GWS="/c/Users/phili/AppData/Roaming/npm/gws"
"$GWS" drive files create --json '{"name":"BlindSail Media Uploads","mimeType":"application/vnd.google-apps.folder"}'
```
Expected: JSON with an `id`. Record that id.

- [ ] **Step 2: Make it link-shareable for uploads (anyone with the link can add files).**

```bash
"$GWS" drive permissions create --params '{"fileId":"<FOLDER_ID>"}' --json '{"role":"writer","type":"anyone"}'
```
Expected: a permission object. (If `drive permissions create` differs in this gws version, run `"$GWS" drive permissions create --help` first to confirm the exact param/body split.)

**Caveat (verify live):** Drive has historically rejected `anyone` + `writer` on folders, and even when accepted, uploading still requires the volunteer to be signed into a Google account — design.md's "no accounts" is approximate. If the permission call is rejected, fall back to sharing with specific volunteer emails (or a file-request-style flow) and note the deviation in design.md.

Note the abuse posture (design.md): the link circulating is acceptable because nothing publishes without the skill running and screening. Report the shareable link to the user for the QR code.

- [ ] **Step 3: Write the folder id into config.** Edit `config/pipeline.config.json`, replacing `"driveFolderId": "REPLACE_IN_TASK_2"` with the real id.

- [ ] **Step 4: Commit** (the folder id is not a secret — it's a shareable public-upload folder).

```bash
git add config/pipeline.config.json
git commit -m "chore: record shared volunteer Drive folder id"
```

---

## Task 3: `config.mjs` — paths and constants

**Files:**
- Create: `scripts/pipeline/lib/config.mjs`
- Test: `scripts/pipeline/__tests__/config.test.mjs`

- [ ] **Step 1: Write the failing test.**

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `cd "scripts/pipeline" && node --test __tests__/config.test.mjs`
Expected: FAIL — cannot find module `../lib/config.mjs`.

- [ ] **Step 3: Write `scripts/pipeline/lib/config.mjs`.**

```javascript
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// repo root is two levels up from scripts/pipeline/lib
export const REPO_ROOT = path.resolve(HERE, '..', '..', '..');

const MONTHS = ['january','february','march','april','may','june',
  'july','august','september','october','november','december'];

// '2026-06-13' -> 'june-13-2026'
export function eventIdFromDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${MONTHS[m - 1]}-${d}-${y}`;
}

export function runPaths(eventId) {
  const root = path.join(REPO_ROOT, 'pipeline', 'runs', eventId);
  return {
    root,
    incoming: path.join(root, 'incoming'),
    renditions: path.join(root, 'renditions'),
    audio: path.join(root, 'audio'),
    reel: path.join(root, 'reel'),
    manifest: path.join(root, 'manifest.json'),
    shotlist: path.join(root, 'shotlist.json'),
  };
}

export function publishedDir(eventId) {
  return path.join(REPO_ROOT, 'media', eventId);
}

export function loadConfig() {
  const raw = readFileSync(path.join(REPO_ROOT, 'config', 'pipeline.config.json'), 'utf8');
  return JSON.parse(raw);
}
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `cd "scripts/pipeline" && node --test __tests__/config.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit.**

```bash
git add scripts/pipeline/lib/config.mjs scripts/pipeline/__tests__/config.test.mjs
git commit -m "feat(pipeline): config paths and constants"
```

---

## Task 4: `manifest.mjs` — the run state machine

**Files:**
- Create: `scripts/pipeline/lib/manifest.mjs`
- Test: `scripts/pipeline/__tests__/manifest.test.mjs`

- [ ] **Step 1: Write the failing test.**

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `cd "scripts/pipeline" && node --test __tests__/manifest.test.mjs`
Expected: FAIL — cannot find module `../lib/manifest.mjs`.

- [ ] **Step 3: Write `scripts/pipeline/lib/manifest.mjs`.**

```javascript
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export const ITEM_STATES = [
  'pulled', 'converted', 'screened', 'captioned',
  'narrated', 'uploaded', 'published', 'held', 'failed',
];

export function newManifest(event) {
  return { event, createdAt: new Date().toISOString(), items: [] };
}

function find(manifest, id) {
  const item = manifest.items.find(i => i.id === id);
  if (!item) throw new Error(`no item with id ${id}`);
  return item;
}

export function addItem(manifest, { id, kind, sourceFile, sourceId = null, date }) {
  // Two volunteers' phones can both produce IMG_1234 — suffix colliding ids.
  let uniqueId = id;
  for (let n = 2; manifest.items.some(i => i.id === uniqueId); n++) uniqueId = `${id}-${n}`;
  const item = {
    id: uniqueId, kind, sourceFile, sourceId, date, event: manifest.event,
    state: 'pulled', held: false, holdReason: null, failReason: null,
    // produced artifacts (filled by later stages), all relative to repo root
    rendition: null, poster: null,
    alt: null, caption: null, chapter: null, person: null, hasSpeech: null,
    adScript: null, adAudio: null, adDecision: null,
    captionVtt: null, adVtt: null, transcript: null,
    youtubeId: null,
  };
  manifest.items.push(item);
  return item;
}

export function setState(manifest, id, state) {
  if (!ITEM_STATES.includes(state)) throw new Error(`unknown state: ${state}`);
  const item = find(manifest, id);
  if (item.state === 'held') throw new Error(`item ${id} is held; clear the hold before advancing`);
  item.state = state;
  return item;
}

export function hold(manifest, id, reason) {
  const item = find(manifest, id);
  item.state = 'held';
  item.held = true;
  item.holdReason = reason;
  return item;
}

// Human-approved un-hold: resets held/holdReason/failReason and state together.
// (Hand-editing only `state` would leave held=true and the item silently
// skipped at publish.)
export function clearHold(manifest, id, backToState) {
  if (!ITEM_STATES.includes(backToState)) throw new Error(`unknown state: ${backToState}`);
  const item = find(manifest, id);
  item.held = false;
  item.holdReason = null;
  item.failReason = null;
  item.state = backToState;
  return item;
}

export function fail(manifest, id, reason) {
  const item = find(manifest, id);
  item.state = 'failed';
  item.failReason = reason;
  return item;
}

export function listByState(manifest, state) {
  return manifest.items.filter(i => i.state === state);
}

export function saveManifest(file, manifest) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(manifest, null, 2));
}

export function loadManifest(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `cd "scripts/pipeline" && node --test __tests__/manifest.test.mjs`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit.**

```bash
git add scripts/pipeline/lib/manifest.mjs scripts/pipeline/__tests__/manifest.test.mjs
git commit -m "feat(pipeline): run manifest state machine"
```

---

## Task 5: `heuristics.mjs` — slug + id generation

**Files:**
- Create: `scripts/pipeline/lib/heuristics.mjs`
- Test: `scripts/pipeline/__tests__/heuristics.test.mjs`

- [ ] **Step 1: Write the failing test.**

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `cd "scripts/pipeline" && node --test __tests__/heuristics.test.mjs`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `scripts/pipeline/lib/heuristics.mjs`.**

```javascript
import path from 'node:path';

export function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function itemId(eventId, sourceFile) {
  const base = path.parse(sourceFile).name;
  return `${eventId}-${slugify(base)}`;
}
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `cd "scripts/pipeline" && node --test __tests__/heuristics.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit.**

```bash
git add scripts/pipeline/lib/heuristics.mjs scripts/pipeline/__tests__/heuristics.test.mjs
git commit -m "feat(pipeline): filename slug and id helpers"
```

---

## Task 6: `ffmpeg.mjs` — safe wrapper + arg builders

The security-critical piece: **args arrays only, no shell**. We TDD the pure arg builders; the `run` adapter is a thin `execFileSync` call verified by the convert/reel stages live.

**Files:**
- Create: `scripts/pipeline/lib/ffmpeg.mjs`
- Test: `scripts/pipeline/__tests__/ffmpeg.test.mjs`

- [ ] **Step 1: Write the failing test.**

```javascript
// scripts/pipeline/__tests__/ffmpeg.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { photoArgs, videoArgs, posterArgs } from '../lib/ffmpeg.mjs';

test('photoArgs builds a single-frame scaled JPEG conversion (HEIC-safe)', () => {
  const args = photoArgs('in.HEIC', 'out.jpg', 1600);
  assert.deepEqual(args, [
    '-y', '-i', 'in.HEIC', '-update', '1', '-frames:v', '1',
    '-vf', 'scale=1600:-2', 'out.jpg',
  ]);
});

test('videoArgs builds an H.264/AAC web MP4 at a target width', () => {
  const args = videoArgs('in.MOV', 'out.mp4', 1280);
  assert.deepEqual(args, [
    '-y', '-i', 'in.MOV', '-vf', 'scale=1280:-2',
    '-c:v', 'libx264', '-crf', '23', '-preset', 'medium',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', 'out.mp4',
  ]);
});

test('posterArgs grabs one frame at a timestamp', () => {
  const args = posterArgs('in.mp4', 'poster.jpg', 1);
  assert.deepEqual(args, [
    '-y', '-ss', '1', '-i', 'in.mp4', '-update', '1', '-frames:v', '1', 'poster.jpg',
  ]);
});

test('arg builders never inline user strings into a single shell token', () => {
  // A filename with shell metacharacters must remain one array element, unescaped.
  const args = photoArgs('a; rm -rf ~.HEIC', 'out.jpg', 800);
  assert.ok(args.includes('a; rm -rf ~.HEIC'));
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `cd "scripts/pipeline" && node --test __tests__/ffmpeg.test.mjs`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `scripts/pipeline/lib/ffmpeg.mjs`.**

```javascript
import { execFileSync } from 'node:child_process';

// Single source of truth for shelling out to ffmpeg. Args array only — never a
// shell string. A prior review caught a shell-injection risk from interpolated
// ffmpeg strings; keep every caller on this path.
export function run(args, opts = {}) {
  return execFileSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'], ...opts });
}

export function runCapture(args) {
  return execFileSync('ffmpeg', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// Adapter: media duration in seconds via ffprobe (not unit-tested; exercised
// live by the reel stage, which sizes segments to fit their narration).
export function ffprobeDuration(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file], { encoding: 'utf8' });
  return parseFloat(out.trim());
}

// HEIC and other stills: force a single frame + -update 1 so ffmpeg treats the
// output as one image, then scale to `width` keeping even height (-2).
export function photoArgs(src, out, width) {
  return ['-y', '-i', src, '-update', '1', '-frames:v', '1', '-vf', `scale=${width}:-2`, out];
}

export function videoArgs(src, out, width) {
  return [
    '-y', '-i', src, '-vf', `scale=${width}:-2`,
    '-c:v', 'libx264', '-crf', '23', '-preset', 'medium',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out,
  ];
}

export function posterArgs(src, out, seconds) {
  return ['-y', '-ss', String(seconds), '-i', src, '-update', '1', '-frames:v', '1', out];
}
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `cd "scripts/pipeline" && node --test __tests__/ffmpeg.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit.**

```bash
git add scripts/pipeline/lib/ffmpeg.mjs scripts/pipeline/__tests__/ffmpeg.test.mjs
git commit -m "feat(pipeline): safe ffmpeg wrapper and arg builders"
```

---

## Task 7: `vtt.mjs` — WebVTT builder (captions + descriptions)

Both the caption track (from ASR) and the AD descriptions track (from Claude's AD script timed to the reel/video) are WebVTT. One builder serves both.

**Files:**
- Create: `scripts/pipeline/lib/vtt.mjs`
- Test: `scripts/pipeline/__tests__/vtt.test.mjs`

- [ ] **Step 1: Write the failing test.**

```javascript
// scripts/pipeline/__tests__/vtt.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTimestamp, buildVtt } from '../lib/vtt.mjs';

test('formatTimestamp renders WebVTT HH:MM:SS.mmm', () => {
  assert.equal(formatTimestamp(0), '00:00:00.000');
  assert.equal(formatTimestamp(3.5), '00:00:03.500');
  assert.equal(formatTimestamp(3661.25), '01:01:01.250');
});

test('buildVtt emits a WEBVTT header and one cue per segment', () => {
  const vtt = buildVtt([
    { start: 0, end: 2.5, text: 'A sailor takes the helm.' },
    { start: 2.5, end: 5, text: 'The boat heels into the wind.' },
  ]);
  const expected = [
    'WEBVTT',
    '',
    '00:00:00.000 --> 00:00:02.500',
    'A sailor takes the helm.',
    '',
    '00:00:02.500 --> 00:00:05.000',
    'The boat heels into the wind.',
    '',
  ].join('\n');
  assert.equal(vtt, expected);
});

test('buildVtt throws on an empty segment list (never write an empty track)', () => {
  assert.throws(() => buildVtt([]), /no segments/i);
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `cd "scripts/pipeline" && node --test __tests__/vtt.test.mjs`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `scripts/pipeline/lib/vtt.mjs`.**

```javascript
export function formatTimestamp(seconds) {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(millis, 3)}`;
}

// segments: [{ start, end, text }]
export function buildVtt(segments) {
  if (!segments || segments.length === 0) throw new Error('no segments: refusing to write an empty VTT track');
  const lines = ['WEBVTT', ''];
  for (const seg of segments) {
    lines.push(`${formatTimestamp(seg.start)} --> ${formatTimestamp(seg.end)}`);
    lines.push(seg.text);
    lines.push('');
  }
  return lines.join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `cd "scripts/pipeline" && node --test __tests__/vtt.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit.**

```bash
git add scripts/pipeline/lib/vtt.mjs scripts/pipeline/__tests__/vtt.test.mjs
git commit -m "feat(pipeline): WebVTT builder for caption and description tracks"
```

---

## Task 8: `drive-pull.mjs` — stage 1 (gws adapter)

Pulls not-yet-seen files from the shared folder into the run's `incoming/`, seeding the manifest. gws auth already exists; this is an I/O adapter validated by a live run against the Task 2 folder, but the **dedup/seed logic is unit-tested** by injecting a fake lister.

**Files:**
- Create: `scripts/pipeline/drive-pull.mjs`
- Test: `scripts/pipeline/__tests__/drive-pull.test.mjs`

- [ ] **Step 1: Write the failing test** (tests the pure planning function, not gws).

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `cd "scripts/pipeline" && node --test __tests__/drive-pull.test.mjs`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Locate the gws JS entry, then write `scripts/pipeline/drive-pull.mjs`.**

First find the CLI's real JS entry point: `cat "/c/Users/phili/AppData/Roaming/npm/gws.cmd"` (Bash) and note the `node_modules` JS path the shim invokes. Write that absolute **Windows** path into `config/pipeline.config.json` as `gwsJs` (replacing `REPLACE_IN_TASK_8_STEP_3`). Why: the npm global `gws` shim is a `.cmd` file — `execFileSync` can't spawn it without `shell:true` (which would reintroduce shell parsing), and the Git-Bash `/c/...` path is invalid for Node (`ENOENT`). Invoking `node <gwsJs>` directly keeps the args-array discipline.

```javascript
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { itemId } from './lib/heuristics.mjs';
import { runPaths, loadConfig, eventIdFromDate } from './lib/config.mjs';
import {
  newManifest, addItem, saveManifest, loadManifest,
} from './lib/manifest.mjs';

function classify(mimeType, name) {
  const ext = path.extname(name).toLowerCase();
  if (mimeType.startsWith('image/') || ['.heic', '.jpg', '.jpeg', '.png'].includes(ext)) return 'photo';
  if (mimeType.startsWith('video/') || ['.mov', '.mp4', '.m4v'].includes(ext)) return 'video';
  return null;
}

// Pure: decide what to pull. remoteFiles: [{id,name,mimeType}], seenIds: Set.
export function planPulls(remoteFiles, seenIds, eventId) {
  const plan = [];
  for (const f of remoteFiles) {
    if (seenIds.has(f.id)) continue;
    const kind = classify(f.mimeType, f.name);
    if (!kind) continue;
    plan.push({ sourceId: f.id, sourceFile: f.name, kind, id: itemId(eventId, f.name) });
  }
  return plan;
}

// --- gws adapters (not unit-tested; validated by the live run) ---

function gws(args) {
  const cfg = loadConfig();
  const env = {
    ...process.env,
    GOOGLE_WORKSPACE_CLI_CONFIG_DIR: path.join(process.env.USERPROFILE, '.config', 'gws-accounts', cfg.gwsAccount),
  };
  // node <gws JS entry> — the .cmd shim isn't execFileSync-able (see Step 3 note).
  return execFileSync(process.execPath, [cfg.gwsJs, ...args], { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'inherit'] });
}

function listRemote(folderId) {
  const out = gws(['drive', 'files', 'list', '--params',
    JSON.stringify({ q: `'${folderId}' in parents and trashed = false`, fields: 'files(id,name,mimeType)', pageSize: 1000 })]);
  return JSON.parse(out).files ?? [];
}

function download(fileId, destPath) {
  gws(['drive', 'files', 'get', '--params', JSON.stringify({ fileId, alt: 'media' }), '--output', destPath]);
}

// Entry point: node drive-pull.mjs <event-iso-date>
export async function main(isoDate) {
  const cfg = loadConfig();
  const eventId = eventIdFromDate(isoDate);
  const paths = runPaths(eventId);
  mkdirSync(paths.incoming, { recursive: true });

  const manifest = existsSync(paths.manifest) ? loadManifest(paths.manifest) : newManifest(eventId);
  const seen = new Set(manifest.items.map(i => i.sourceId).filter(Boolean));

  const remote = listRemote(cfg.driveFolderId);
  const plan = planPulls(remote, seen, eventId);

  for (const p of plan) {
    // Prefix with the Drive file id so two volunteers' identical camera
    // filenames (IMG_1234.HEIC) can't overwrite each other in incoming/.
    const localName = `${p.sourceId.slice(0, 8)}-${p.sourceFile}`;
    download(p.sourceId, path.join(paths.incoming, localName));
    addItem(manifest, { id: p.id, kind: p.kind, sourceFile: localName, sourceId: p.sourceId, date: isoDate });
  }
  saveManifest(paths.manifest, manifest);
  console.log(`Pulled ${plan.length} new file(s) into ${paths.incoming}; manifest has ${manifest.items.length} item(s).`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const isoDate = process.argv[2];
  if (!isoDate) { console.error('usage: node drive-pull.mjs <YYYY-MM-DD>'); process.exit(1); }
  main(isoDate).catch(err => { console.error(err); process.exit(1); });
}
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `cd "scripts/pipeline" && node --test __tests__/drive-pull.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Add a local-file seeding path** for the June 13 run (files already on disk, no Drive). Create `scripts/pipeline/seed-local.mjs`:

```javascript
import { readdirSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { itemId } from './lib/heuristics.mjs';
import { runPaths, eventIdFromDate } from './lib/config.mjs';
import { newManifest, addItem, saveManifest, loadManifest } from './lib/manifest.mjs';

const PHOTO_EXT = new Set(['.heic', '.jpg', '.jpeg', '.png']);
const VIDEO_EXT = new Set(['.mov', '.mp4', '.m4v']);

// node seed-local.mjs <YYYY-MM-DD> "<source-dir>"
export function main(isoDate, srcDir) {
  const eventId = eventIdFromDate(isoDate);
  const paths = runPaths(eventId);
  mkdirSync(paths.incoming, { recursive: true });
  const manifest = existsSync(paths.manifest) ? loadManifest(paths.manifest) : newManifest(eventId);
  const seen = new Set(manifest.items.map(i => i.sourceFile));

  let added = 0;
  for (const name of readdirSync(srcDir)) {
    const ext = path.extname(name).toLowerCase();
    const kind = PHOTO_EXT.has(ext) ? 'photo' : VIDEO_EXT.has(ext) ? 'video' : null;
    if (!kind || seen.has(name)) continue;
    copyFileSync(path.join(srcDir, name), path.join(paths.incoming, name));
    addItem(manifest, { id: itemId(eventId, name), kind, sourceFile: name, date: isoDate });
    added++;
  }
  saveManifest(paths.manifest, manifest);
  console.log(`Seeded ${added} local file(s) into ${paths.incoming}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [isoDate, srcDir] = process.argv.slice(2);
  if (!isoDate || !srcDir) { console.error('usage: node seed-local.mjs <YYYY-MM-DD> "<source-dir>"'); process.exit(1); }
  main(isoDate, srcDir);
}
```

- [ ] **Step 6: Commit.**

```bash
git add scripts/pipeline/drive-pull.mjs scripts/pipeline/seed-local.mjs scripts/pipeline/__tests__/drive-pull.test.mjs
git commit -m "feat(pipeline): Drive pull + local seed with manifest dedup"
```

---

## Task 9: `convert.mjs` — stage 2 (HEIC/video/poster)

Converts every `pulled` item's source into web renditions, advances it to `converted`, records rendition paths, and holds (not fails silently) on conversion error per design.md Error Handling.

**Files:**
- Create: `scripts/pipeline/convert.mjs`
- Test: `scripts/pipeline/__tests__/convert.test.mjs`

- [ ] **Step 1: Write the failing test** (pure rendition-path planner).

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `cd "scripts/pipeline" && node --test __tests__/convert.test.mjs`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `scripts/pipeline/convert.mjs`.**

```javascript
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { runPaths, eventIdFromDate } from './lib/config.mjs';
import { loadManifest, saveManifest, setState, fail, listByState } from './lib/manifest.mjs';
import { run, photoArgs, videoArgs, posterArgs } from './lib/ffmpeg.mjs';

const PHOTO_WIDTH = 1600;
const VIDEO_WIDTH = 1280;

export function renditionTargets(item, renditionsDir) {
  if (item.kind === 'photo') {
    return { rendition: path.join(renditionsDir, `${item.id}.jpg`), poster: null };
  }
  return {
    rendition: path.join(renditionsDir, `${item.id}.mp4`),
    poster: path.join(renditionsDir, `${item.id}-poster.jpg`),
  };
}

export function main(isoDate) {
  const eventId = eventIdFromDate(isoDate);
  const paths = runPaths(eventId);
  mkdirSync(paths.renditions, { recursive: true });
  const manifest = loadManifest(paths.manifest);

  for (const item of listByState(manifest, 'pulled')) {
    const src = path.join(paths.incoming, item.sourceFile);
    const t = renditionTargets(item, paths.renditions);
    try {
      if (item.kind === 'photo') {
        run(photoArgs(src, t.rendition, PHOTO_WIDTH));
      } else {
        run(videoArgs(src, t.rendition, VIDEO_WIDTH));
        run(posterArgs(t.rendition, t.poster, 1));
      }
      item.rendition = path.relative(paths.root, t.rendition);
      if (t.poster) item.poster = path.relative(paths.root, t.poster);
      setState(manifest, item.id, 'converted');
    } catch (err) {
      fail(manifest, item.id, `convert: ${err.message}`);
    }
  }
  saveManifest(paths.manifest, manifest);
  const failed = listByState(manifest, 'failed').length;
  console.log(`Converted ${listByState(manifest, 'converted').length} item(s); ${failed} failed (held for review).`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const isoDate = process.argv[2];
  if (!isoDate) { console.error('usage: node convert.mjs <YYYY-MM-DD>'); process.exit(1); }
  main(isoDate);
}
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `cd "scripts/pipeline" && node --test __tests__/convert.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit.**

```bash
git add scripts/pipeline/convert.mjs scripts/pipeline/__tests__/convert.test.mjs
git commit -m "feat(pipeline): convert stage (HEIC/video/poster renditions)"
```

---

## Task 10: `tts.mjs` — stage 5 (Cloud TTS narration)

Renders each item's `adScript` (written by Claude during screening) into an MP3. Pure request-builder is TDD'd; the Cloud call is an adapter validated live. Photos get `adAudio` MP3; the reel's narration is rendered here too (per-segment MP3s the reel stage concatenates).

**Files:**
- Create: `scripts/pipeline/tts.mjs`
- Test: `scripts/pipeline/__tests__/tts.test.mjs`

- [ ] **Step 1: Write the failing test.**

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `cd "scripts/pipeline" && node --test __tests__/tts.test.mjs`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `scripts/pipeline/tts.mjs`.**

```javascript
import { writeFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { runPaths, eventIdFromDate, loadConfig } from './lib/config.mjs';
import { loadManifest, saveManifest, setState, fail, listByState } from './lib/manifest.mjs';

export function synthRequest(text, ttsCfg) {
  if (!text || !text.trim()) throw new Error('empty TTS text: refusing to render silence');
  return {
    input: { text },
    voice: { languageCode: ttsCfg.languageCode, name: ttsCfg.voiceName },
    audioConfig: { audioEncoding: ttsCfg.audioEncoding },
  };
}

// Adapter: lazily import the client so unit tests don't need credentials.
async function synthesize(text, ttsCfg, outFile) {
  const { TextToSpeechClient } = await import('@google-cloud/text-to-speech');
  const client = new TextToSpeechClient(); // ADC via GOOGLE_APPLICATION_CREDENTIALS
  const [res] = await client.synthesizeSpeech(synthRequest(text, ttsCfg));
  await writeFile(outFile, res.audioContent, 'binary');
}

// Render adAudio for every 'captioned' photo that has an adScript.
export async function main(isoDate) {
  const cfg = loadConfig();
  const eventId = eventIdFromDate(isoDate);
  const paths = runPaths(eventId);
  mkdirSync(paths.audio, { recursive: true });
  const manifest = loadManifest(paths.manifest);

  for (const item of listByState(manifest, 'captioned')) {
    if (item.kind !== 'photo') { setState(manifest, item.id, 'narrated'); continue; }
    if (!item.adScript) { fail(manifest, item.id, 'tts: no adScript written'); continue; }
    const out = path.join(paths.audio, `${item.id}-ad.mp3`);
    try {
      await synthesize(item.adScript, cfg.tts, out);
      item.adAudio = path.relative(paths.root, out);
      setState(manifest, item.id, 'narrated');
    } catch (err) {
      fail(manifest, item.id, `tts: ${err.message}`);
    }
  }
  saveManifest(paths.manifest, manifest);
  console.log(`Narrated ${listByState(manifest, 'narrated').length} item(s).`);
}

// Reusable helper for the reel stage: render one narration line to a file.
export async function renderNarrationLine(text, outFile) {
  await synthesize(text, loadConfig().tts, outFile);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const isoDate = process.argv[2];
  if (!isoDate) { console.error('usage: node tts.mjs <YYYY-MM-DD>'); process.exit(1); }
  main(isoDate).catch(err => { console.error(err); process.exit(1); });
}
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `cd "scripts/pipeline" && node --test __tests__/tts.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit.**

```bash
git add scripts/pipeline/tts.mjs scripts/pipeline/__tests__/tts.test.mjs
git commit -m "feat(pipeline): Cloud TTS narration stage"
```

---

## Task 11: `asr.mjs` — captions from Cloud Speech-to-Text

For spoken-word videos (Claude sets `hasSpeech: true` during screening), transcribe → transcript + timed caption VTT. The word-timings→cue grouping is TDD'd; the Cloud call is an adapter.

**Files:**
- Create: `scripts/pipeline/asr.mjs`
- Test: `scripts/pipeline/__tests__/asr.test.mjs`

- [ ] **Step 1: Write the failing test.**

```javascript
// scripts/pipeline/__tests__/asr.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wordsToCues, transcriptFromWords } from '../asr.mjs';

const words = [
  { word: 'We', start: 0.0, end: 0.3 },
  { word: 'cast', start: 0.3, end: 0.7 },
  { word: 'off', start: 0.7, end: 1.0 },
  { word: 'at', start: 3.0, end: 3.2 },
  { word: 'noon', start: 3.2, end: 3.6 },
];

test('wordsToCues groups words into cues, breaking on a long gap', () => {
  const cues = wordsToCues(words, { maxGap: 1.0, maxWords: 12 });
  assert.equal(cues.length, 2);
  assert.equal(cues[0].text, 'We cast off');
  assert.equal(cues[0].start, 0.0);
  assert.equal(cues[0].end, 1.0);
  assert.equal(cues[1].text, 'at noon');
});

test('wordsToCues caps cue length at maxWords', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ word: `w${i}`, start: i * 0.1, end: i * 0.1 + 0.05 }));
  const cues = wordsToCues(many, { maxGap: 5, maxWords: 8 });
  assert.ok(cues.every(c => c.text.split(' ').length <= 8));
});

test('transcriptFromWords joins into a single readable string', () => {
  assert.equal(transcriptFromWords(words), 'We cast off at noon');
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `cd "scripts/pipeline" && node --test __tests__/asr.test.mjs`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `scripts/pipeline/asr.mjs`.**

```javascript
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { runPaths, eventIdFromDate, loadConfig } from './lib/config.mjs';
import { loadManifest, saveManifest, hold, fail } from './lib/manifest.mjs';
import { buildVtt } from './lib/vtt.mjs';
import { run } from './lib/ffmpeg.mjs';

export function transcriptFromWords(words) {
  return words.map(w => w.word).join(' ');
}

// Group word-timings into caption cues. Break when a silence gap exceeds
// maxGap, or when a cue reaches maxWords.
export function wordsToCues(words, { maxGap = 1.2, maxWords = 12 } = {}) {
  const cues = [];
  let cur = null;
  for (const w of words) {
    if (cur && (w.start - cur.end > maxGap || cur.words.length >= maxWords)) {
      cues.push({ start: cur.start, end: cur.end, text: cur.words.join(' ') });
      cur = null;
    }
    if (!cur) cur = { start: w.start, end: w.end, words: [] };
    cur.words.push(w.word);
    cur.end = w.end;
  }
  if (cur) cues.push({ start: cur.start, end: cur.end, text: cur.words.join(' ') });
  return cues;
}

// Adapter: extract mono 16k WAV in <60s chunks — the *sync* recognize API
// rejects audio over ~1 minute, and debrief interviews exceed it. PCM WAV
// splits sample-exactly at the segment boundary, so timing offsets are exact.
// Upgrade path for very long interviews: GCS staging + longRunningRecognize.
const CHUNK_SECONDS = 55;

async function transcribe(videoFile, chunkDir, id, asrCfg) {
  const pattern = path.join(chunkDir, `${id}-chunk-%03d.wav`);
  run(['-y', '-i', videoFile, '-vn', '-ac', '1', '-ar', '16000',
    '-f', 'segment', '-segment_time', String(CHUNK_SECONDS), pattern]);
  const { readFileSync, readdirSync } = await import('node:fs');
  const chunks = readdirSync(chunkDir).filter(f => f.startsWith(`${id}-chunk-`)).sort();
  const speech = await import('@google-cloud/speech');
  const client = new speech.SpeechClient(); // ADC via GOOGLE_APPLICATION_CREDENTIALS
  const words = [];
  for (const [idx, chunk] of chunks.entries()) {
    const audioBytes = readFileSync(path.join(chunkDir, chunk)).toString('base64');
    const [response] = await client.recognize({
      audio: { content: audioBytes },
      config: {
        encoding: 'LINEAR16', sampleRateHertz: 16000,
        languageCode: asrCfg.languageCode, model: asrCfg.model,
        enableWordTimeOffsets: true, enableAutomaticPunctuation: true,
      },
    });
    const offset = idx * CHUNK_SECONDS;
    const toSec = (t) => Number(t?.seconds ?? 0) + Number(t?.nanos ?? 0) / 1e9;
    for (const result of response.results ?? []) {
      for (const w of result.alternatives?.[0]?.words ?? []) {
        words.push({ word: w.word, start: offset + toSec(w.startTime), end: offset + toSec(w.endTime) });
      }
    }
  }
  return words;
}

export async function main(isoDate) {
  const cfg = loadConfig();
  const eventId = eventIdFromDate(isoDate);
  const paths = runPaths(eventId);
  const manifest = loadManifest(paths.manifest);

  // Caption spoken videos that haven't been captioned yet. Pre-upload states
  // only — a re-run must never demote an already-uploaded/published item.
  for (const item of manifest.items.filter(i => i.kind === 'video' && i.hasSpeech && !i.captionVtt
    && ['captioned', 'narrated'].includes(i.state))) {
    try {
      const videoFile = path.join(paths.root, item.rendition);
      const words = await transcribe(videoFile, paths.renditions, item.id, cfg.asr);
      if (words.length === 0) {
        hold(manifest, item.id, 'asr: no speech recognized — confirm hasSpeech, then clearHold and re-run');
        continue;
      }
      const cues = wordsToCues(words);
      const vttPath = path.join(paths.renditions, `${item.id}.vtt`);
      writeFileSync(vttPath, buildVtt(cues));
      item.captionVtt = path.relative(paths.root, vttPath);
      item.transcript = transcriptFromWords(words);
    } catch (err) {
      fail(manifest, item.id, `asr: ${err.message}`);
    }
  }
  saveManifest(paths.manifest, manifest);
  console.log('Captioning pass complete.');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const isoDate = process.argv[2];
  if (!isoDate) { console.error('usage: node asr.mjs <YYYY-MM-DD>'); process.exit(1); }
  main(isoDate).catch(err => { console.error(err); process.exit(1); });
}
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `cd "scripts/pipeline" && node --test __tests__/asr.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit.**

```bash
git add scripts/pipeline/asr.mjs scripts/pipeline/__tests__/asr.test.mjs
git commit -m "feat(pipeline): Speech-to-Text captioning for spoken videos"
```

---

## Task 12: `reel.mjs` — stage 6 (shot list → ffmpeg reel)

Claude writes `shotlist.json` (clip order, per-photo duration, per-segment narration line, title). This stage renders each segment to a normalized intermediate, concatenates with crossfades, lays the concatenated narration audio over it, and emits the reel MP4 + a captions VTT built from the narration timings. The **arg builders and timing math are TDD'd**; ffmpeg exec is the adapter.

**Files:**
- Create: `scripts/pipeline/reel.mjs`
- Test: `scripts/pipeline/__tests__/reel.test.mjs`

Shot list schema (written by Claude, validated here):
```json
{
  "title": "June 13, 2026 — A Day on the Bay",
  "segments": [
    { "kind": "photo", "id": "june-13-2026-img-1234", "seconds": 4, "narration": "We meet at the Oakland Yacht Club docks." },
    { "kind": "video", "id": "june-13-2026-dsc-0007", "in": 2.0, "out": 7.0, "narration": "A sailor takes the helm and steers us out." }
  ]
}
```

Planned durations are **minimums**: the stage measures each rendered narration line (ffprobe) and extends any segment whose narration runs longer — photos hold longer, videos freeze their last frame (`tpad`). A cut-off audio description is the project's highest-severity defect class, so narration is never truncated to fit the visuals.

- [ ] **Step 1: Write the failing test.**

```javascript
// scripts/pipeline/__tests__/reel.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateShotlist, segmentDuration, effectiveDurations, narrationCues, photoSegmentArgs, videoSegmentArgs } from '../reel.mjs';

const cfg = { width: 1280, height: 720, fps: 30, photoSeconds: 4, crossfadeSeconds: 0.5 };

test('validateShotlist rejects a shotlist with no segments', () => {
  assert.throws(() => validateShotlist({ title: 't', segments: [] }), /no segments/i);
});

test('segmentDuration uses seconds for photos and out-in for videos', () => {
  assert.equal(segmentDuration({ kind: 'photo', seconds: 4 }), 4);
  assert.equal(segmentDuration({ kind: 'video', in: 2, out: 7 }), 5);
});

test('effectiveDurations extends a segment to fit its narration plus margin', () => {
  const segs = [{ kind: 'photo', seconds: 4 }, { kind: 'video', in: 0, out: 6 }];
  const eff = effectiveDurations(segs, [6.2, 3.0], 0.3);
  assert.equal(eff[0], 6.5); // narration longer than the 4s photo -> extended
  assert.equal(eff[1], 6);   // narration fits -> planned duration kept
});

test('narrationCues lays narration end-to-end across effective durations', () => {
  const segs = [
    { kind: 'photo', seconds: 4, narration: 'A.' },
    { kind: 'video', in: 0, out: 6, narration: 'B.' },
  ];
  const cues = narrationCues(segs, [4, 6]);
  assert.deepEqual(cues, [
    { start: 0, end: 4, text: 'A.' },
    { start: 4, end: 10, text: 'B.' },
  ]);
});

test('photoSegmentArgs pads to aspect then Ken Burns zooms at target size/fps', () => {
  const args = photoSegmentArgs('in.jpg', 'seg.mp4', 4, cfg);
  const vf = args[args.indexOf('-vf') + 1];
  assert.ok(vf.includes('force_original_aspect_ratio=decrease')); // portrait photos must not stretch
  assert.ok(vf.includes('zoompan'));
  assert.equal(args[args.length - 1], 'seg.mp4');
});

test('videoSegmentArgs trims with -ss/-to and freezes the last frame when narration runs long', () => {
  const exact = videoSegmentArgs('in.mp4', 'seg.mp4', 2, 7, 5, cfg);
  assert.ok(exact.includes('-ss') && exact.includes('-to'));
  assert.ok(!exact[exact.indexOf('-vf') + 1].includes('tpad'));
  const extended = videoSegmentArgs('in.mp4', 'seg.mp4', 2, 7, 6.5, cfg);
  assert.ok(extended[extended.indexOf('-vf') + 1].includes('tpad=stop_mode=clone:stop_duration=1.5'));
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `cd "scripts/pipeline" && node --test __tests__/reel.test.mjs`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `scripts/pipeline/reel.mjs`.**

```javascript
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { runPaths, eventIdFromDate, loadConfig } from './lib/config.mjs';
import { loadManifest } from './lib/manifest.mjs';
import { run, ffprobeDuration } from './lib/ffmpeg.mjs';
import { buildVtt } from './lib/vtt.mjs';
import { renderNarrationLine } from './tts.mjs';

export function validateShotlist(shotlist) {
  if (!shotlist || !Array.isArray(shotlist.segments) || shotlist.segments.length === 0) {
    throw new Error('reel: shotlist has no segments');
  }
  if (!shotlist.title) throw new Error('reel: shotlist has no title');
  return shotlist;
}

export function segmentDuration(seg) {
  return seg.kind === 'photo' ? seg.seconds : (seg.out - seg.in);
}

// Effective duration per segment: never truncate narration (cut-off audio
// description is the project's highest-severity defect) — extend the visual
// to fit the narration plus a breathing margin instead.
export function effectiveDurations(segments, narrationSeconds, margin = 0.3) {
  return segments.map((seg, i) => {
    const planned = segmentDuration(seg);
    const narr = narrationSeconds[i] ?? 0;
    return narr > 0 ? Math.max(planned, Math.round((narr + margin) * 10) / 10) : planned;
  });
}

export function narrationCues(segments, effDurs) {
  const cues = [];
  let t = 0;
  segments.forEach((seg, i) => {
    const dur = effDurs[i];
    if (seg.narration) cues.push({ start: t, end: t + dur, text: seg.narration });
    t += dur;
  });
  return cues;
}

// Ken Burns still: aspect-preserving scale + pad at 2x target (zoom quality),
// then a linear zoom to 1.15 across the segment. A single still-image input
// with zoompan d=frames yields exactly `frames` output frames at `fps`.
export function photoSegmentArgs(src, out, seconds, cfg) {
  const frames = Math.round(seconds * cfg.fps);
  const w2 = cfg.width * 2;
  const h2 = cfg.height * 2;
  const vf = [
    `scale=${w2}:${h2}:force_original_aspect_ratio=decrease`,
    `pad=${w2}:${h2}:(ow-iw)/2:(oh-ih)/2`,
    `zoompan=z='1+0.15*on/${frames}':d=${frames}:s=${cfg.width}x${cfg.height}:fps=${cfg.fps}`,
    `setsar=1`,
  ].join(',');
  return ['-y', '-i', src, '-vf', vf,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', out];
}

// Video trim normalized to the same size/fps/SAR, silent (narration is added
// later). If the narration needs more time than the trim, freeze the last
// frame (tpad clone) rather than cutting the narration.
export function videoSegmentArgs(src, out, inS, outS, effDur, cfg) {
  const trimmed = outS - inS;
  let vf = `scale=${cfg.width}:${cfg.height}:force_original_aspect_ratio=decrease,` +
    `pad=${cfg.width}:${cfg.height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${cfg.fps}`;
  if (effDur > trimmed + 0.01) {
    vf += `,tpad=stop_mode=clone:stop_duration=${Math.round((effDur - trimmed) * 10) / 10}`;
  }
  return ['-y', '-ss', String(inS), '-to', String(outS), '-i', src, '-vf', vf,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', out];
}

// Adapter entry point.
export async function main(isoDate) {
  const cfg = loadConfig();
  const reelCfg = cfg.reel;
  const eventId = eventIdFromDate(isoDate);
  const paths = runPaths(eventId);
  mkdirSync(paths.reel, { recursive: true });
  const manifest = loadManifest(paths.manifest);
  const shotlist = validateShotlist(JSON.parse(readFileSync(paths.shotlist, 'utf8')));
  const byId = new Map(manifest.items.map(i => [i.id, i]));

  // 1) Narration FIRST: render each line, measure its real duration so the
  //    visuals can be sized to fit it.
  const narrFiles = [];
  const narrDurs = [];
  for (let idx = 0; idx < shotlist.segments.length; idx++) {
    const seg = shotlist.segments[idx];
    if (!seg.narration) { narrFiles.push(null); narrDurs.push(0); continue; }
    const nOut = path.join(paths.reel, `narr-${String(idx).padStart(3, '0')}.mp3`);
    await renderNarrationLine(seg.narration, nOut);
    narrFiles.push(nOut);
    narrDurs.push(ffprobeDuration(nOut));
  }
  const effDurs = effectiveDurations(shotlist.segments, narrDurs);

  // 2) Visual segments at their effective durations — all normalized to
  //    identical codec/size/fps/SAR so the concat demuxer can stream-copy.
  const segFiles = [];
  shotlist.segments.forEach((seg, idx) => {
    const item = byId.get(seg.id);
    if (!item) throw new Error(`reel: shotlist references unknown item ${seg.id}`);
    const src = path.join(paths.root, item.rendition);
    const segOut = path.join(paths.reel, `seg-${String(idx).padStart(3, '0')}.mp4`);
    if (seg.kind === 'photo') run(photoSegmentArgs(src, segOut, effDurs[idx], reelCfg));
    else run(videoSegmentArgs(src, segOut, seg.in, seg.out, effDurs[idx], reelCfg));
    segFiles.push(segOut);
  });

  // 3) Concat visuals (identically-encoded segments; Task 18 ffprobe-verifies
  //    the join on the first live run).
  const listFile = path.join(paths.reel, 'segments.txt');
  writeFileSync(listFile, segFiles.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
  const silentReel = path.join(paths.reel, 'reel-silent.mp4');
  run(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', silentReel]);

  // 4) Narration track: pad every slot to its effective duration in ONE
  //    uniform format (24kHz mono — Neural2's MP3 output rate) so the concat
  //    can't splice mismatched sample rates/channels, then concat with
  //    re-encode. No truncation: effDur >= narration duration by construction.
  const padded = [];
  shotlist.segments.forEach((seg, idx) => {
    const dur = effDurs[idx];
    const padOut = path.join(paths.reel, `narrpad-${String(idx).padStart(3, '0')}.mp3`);
    if (narrFiles[idx]) {
      run(['-y', '-i', narrFiles[idx], '-af', `apad=whole_dur=${dur}`, '-t', String(dur),
        '-ar', '24000', '-ac', '1', '-b:a', '48k', padOut]);
    } else {
      run(['-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', String(dur),
        '-b:a', '48k', padOut]);
    }
    padded.push(padOut);
  });
  const narrConcatList = path.join(paths.reel, 'narration.txt');
  writeFileSync(narrConcatList, padded.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
  const narrTrack = path.join(paths.reel, 'narration.mp3');
  run(['-y', '-f', 'concat', '-safe', '0', '-i', narrConcatList,
    '-ar', '24000', '-ac', '1', '-b:a', '48k', narrTrack]);

  // 5) Mux. Audio and video are the same length by construction, so no
  //    -shortest (which risked truncating the final narration line).
  const finalReel = path.join(paths.reel, `${eventId}-reel.mp4`);
  run(['-y', '-i', silentReel, '-i', narrTrack, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
    '-map', '0:v:0', '-map', '1:a:0', '-movflags', '+faststart', finalReel]);

  // 6) Captions VTT from narration cues at the effective timings.
  const cues = narrationCues(shotlist.segments, effDurs);
  const vttPath = path.join(paths.reel, `${eventId}-reel.vtt`);
  writeFileSync(vttPath, buildVtt(cues));

  console.log(`Reel assembled: ${finalReel}`);
  console.log(`Reel captions:  ${vttPath}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const isoDate = process.argv[2];
  if (!isoDate) { console.error('usage: node reel.mjs <YYYY-MM-DD>'); process.exit(1); }
  main(isoDate).catch(err => { console.error(err); process.exit(1); });
}
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `cd "scripts/pipeline" && node --test __tests__/reel.test.mjs`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit.**

```bash
git add scripts/pipeline/reel.mjs scripts/pipeline/__tests__/reel.test.mjs
git commit -m "feat(pipeline): highlight reel assembly from shot list"
```

---

## Task 13: `youtube-auth.mjs` — one-time OAuth consent

Standalone, human-run once. Opens a local-server consent flow, stores a refresh token in gitignored `secrets/youtube-token.json`. No unit test (interactive browser flow); success = a token file with a `refresh_token`.

**Files:**
- Create: `scripts/pipeline/youtube-auth.mjs`

- [ ] **Step 1: Write `scripts/pipeline/youtube-auth.mjs`.**

```javascript
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { google } from 'googleapis';
import { REPO_ROOT } from './lib/config.mjs';

const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];
const CLIENT_FILE = path.join(REPO_ROOT, 'secrets', 'youtube-oauth-client.json');
const TOKEN_FILE = path.join(REPO_ROOT, 'secrets', 'youtube-token.json');
const REDIRECT = 'http://localhost:5544/oauth2callback';

function loadClient() {
  const raw = JSON.parse(readFileSync(CLIENT_FILE, 'utf8'));
  const c = raw.installed || raw.web;
  return new google.auth.OAuth2(c.client_id, c.client_secret, REDIRECT);
}

async function main() {
  const oauth2 = loadClient();
  const url = oauth2.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES });
  console.log('\nOpen this URL in a browser signed in as philipk303@gmail.com:\n');
  console.log(url + '\n');

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, REDIRECT);
      if (u.pathname !== '/oauth2callback') { res.end(); return; }
      const c = u.searchParams.get('code');
      res.end('Authorization received. You can close this tab and return to the terminal.');
      server.close();
      c ? resolve(c) : reject(new Error('no code in callback'));
    }).listen(5544);
  });

  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error('No refresh_token returned. Revoke the app at myaccount.google.com/permissions and re-run (prompt=consent).');
  }
  writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
  console.log(`Saved refresh token to ${TOKEN_FILE}`);
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Manual smoke test** (after Task 15's GCP setup provides `secrets/youtube-oauth-client.json`).

Run: `cd "scripts/pipeline" && node youtube-auth.mjs`
Expected: prints a consent URL; after browser consent as philipk303, writes `secrets/youtube-token.json` containing a `refresh_token`. If it reports "No refresh_token", follow the printed instruction and re-run.

- [ ] **Step 3: Commit** (code only — the token file is gitignored).

```bash
git add scripts/pipeline/youtube-auth.mjs
git commit -m "feat(pipeline): one-time YouTube OAuth consent flow"
```

---

## Task 14: `youtube-upload.mjs` — stage 7a (upload unlisted)

Uploads each `narrated` video + the reel to YouTube unlisted, records `youtubeId`, advances to `uploaded`. Metadata builder is TDD'd; the `videos.insert` call is an adapter.

**Files:**
- Create: `scripts/pipeline/youtube-upload.mjs`
- Test: `scripts/pipeline/__tests__/youtube-upload.test.mjs`

- [ ] **Step 1: Write the failing test.**

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `cd "scripts/pipeline" && node --test __tests__/youtube-upload.test.mjs`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `scripts/pipeline/youtube-upload.mjs`.**

```javascript
import { createReadStream, readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { google } from 'googleapis';
import { runPaths, eventIdFromDate, loadConfig, REPO_ROOT } from './lib/config.mjs';
import { loadManifest, saveManifest, setState, fail, listByState } from './lib/manifest.mjs';

export function uploadMetadata(video, ytCfg) {
  return {
    snippet: {
      title: (video.title || 'BlindSail SF Bay').slice(0, 100),
      description: video.description || '',
      tags: video.tags || ['BlindSail', 'sailing', 'accessibility'],
      categoryId: ytCfg.categoryId,
    },
    status: { privacyStatus: ytCfg.privacyStatus, selfDeclaredMadeForKids: false },
  };
}

function youtubeClient() {
  const clientRaw = JSON.parse(readFileSync(path.join(REPO_ROOT, 'secrets', 'youtube-oauth-client.json'), 'utf8'));
  const c = clientRaw.installed || clientRaw.web;
  const oauth2 = new google.auth.OAuth2(c.client_id, c.client_secret, 'http://localhost:5544/oauth2callback');
  const tokens = JSON.parse(readFileSync(path.join(REPO_ROOT, 'secrets', 'youtube-token.json'), 'utf8'));
  oauth2.setCredentials(tokens);
  return google.youtube({ version: 'v3', auth: oauth2 });
}

async function insertVideo(youtube, filePath, meta) {
  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: meta,
    media: { body: createReadStream(filePath) },
  });
  return res.data.id;
}

export async function main(isoDate) {
  const cfg = loadConfig();
  const eventId = eventIdFromDate(isoDate);
  const paths = runPaths(eventId);
  const manifest = loadManifest(paths.manifest);
  const youtube = youtubeClient();

  // Reel FIRST — it's the event's lead item, and quota is scarce:
  // videos.insert costs 1600 units of the 10,000/day default (~6 uploads/day).
  // The manifest saves after every upload, and a quota error leaves the
  // remaining items in their pre-upload state, so the next day's run resumes.
  const reelFile = path.join(paths.reel, `${eventId}-reel.mp4`);
  if (!manifest.reel) manifest.reel = {};
  if (!manifest.reel.youtubeId && existsSync(reelFile)) {
    try {
      const meta = uploadMetadata(
        { title: manifest.reel.title || `BlindSail — ${eventId}`, description: manifest.reel.narrationText || '', tags: ['BlindSail', 'highlight reel'] },
        cfg.youtube,
      );
      manifest.reel.youtubeId = await insertVideo(youtube, reelFile, meta);
    } catch (err) {
      if (/quota/i.test(err.message)) {
        console.error('quota exhausted — re-run tomorrow to resume uploads');
        saveManifest(paths.manifest, manifest);
        return;
      }
      manifest.reel.failReason = `youtube: ${err.message}`;
    }
    saveManifest(paths.manifest, manifest);
  }

  // Individual videos.
  for (const item of listByState(manifest, 'narrated').filter(i => i.kind === 'video')) {
    try {
      const meta = uploadMetadata(
        { title: item.caption, description: item.transcript || '', tags: ['BlindSail', 'sailing'] },
        cfg.youtube,
      );
      item.youtubeId = await insertVideo(youtube, path.join(paths.root, item.rendition), meta);
      setState(manifest, item.id, 'uploaded');
    } catch (err) {
      if (/quota/i.test(err.message)) {
        // Leave the item 'narrated' (NOT failed) so tomorrow's run picks it up.
        console.error(`quota exhausted — ${item.id} stays queued; re-run tomorrow`);
        break;
      }
      fail(manifest, item.id, `youtube: ${err.message}`);
    }
    saveManifest(paths.manifest, manifest); // save after each upload (resumable)
  }
  console.log('YouTube upload pass complete.');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const isoDate = process.argv[2];
  if (!isoDate) { console.error('usage: node youtube-upload.mjs <YYYY-MM-DD>'); process.exit(1); }
  main(isoDate).catch(err => { console.error(err); process.exit(1); });
}
```

- [ ] **Step 4: Sanity-check ordering and resumability** — the reel uploads before individual videos; the manifest saves after every upload; a quota error (1600 units/upload, 10k/day default → ~6/day) leaves un-uploaded items in `narrated` (never `failed`) so the next day's run resumes them.

- [ ] **Step 5: Run test to verify it passes.**

Run: `cd "scripts/pipeline" && node --test __tests__/youtube-upload.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit.**

```bash
git add scripts/pipeline/youtube-upload.mjs scripts/pipeline/__tests__/youtube-upload.test.mjs
git commit -m "feat(pipeline): unlisted YouTube upload stage"
```

---

## Task 15: `publish.mjs` — stage 7b (copy renditions, merge media.json)

Copies approved items' renditions into committed `media/<event>/`, converts manifest items to the `media.json` schema the loader expects, appends the reel as the lead video, and writes `media.json`. TDD the schema mapping + merge; the file copy is a thin wrapper.

**Files:**
- Create: `scripts/pipeline/publish.mjs`
- Test: `scripts/pipeline/__tests__/publish.test.mjs`

Target `media.json` schema (from the real file + loader):
- photo: `{ id, type:'photo', src, alt, caption, adAudio, chapter, event, date }`
- video: `{ id, type:'video', youtubeId, poster, caption, vtt, adTrack, transcript, person, chapter, event, date }`

- [ ] **Step 1: Write the failing test.**

```javascript
// scripts/pipeline/__tests__/publish.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMediaItem, mergeItems, publishBlockers } from '../publish.mjs';

test('toMediaItem maps a published photo to the loader schema', () => {
  const item = {
    id: 'e-img-1', kind: 'photo', event: 'june-13-2026', date: '2026-06-13',
    alt: 'A sailor grips the tiller, smiling.', caption: 'At the helm.',
    chapter: 'at-helm', person: null, adAudio: 'audio/e-img-1-ad.mp3',
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
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `cd "scripts/pipeline" && node --test __tests__/publish.test.mjs`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `scripts/pipeline/publish.mjs`.**

```javascript
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { runPaths, publishedDir, eventIdFromDate, REPO_ROOT } from './lib/config.mjs';
import { loadManifest, saveManifest, setState, hold, listByState } from './lib/manifest.mjs';
import { run as ffmpegRun, posterArgs } from './lib/ffmpeg.mjs';

const mediaPath = (eventId, file) => `media/${eventId}/${file}`;

// Accessibility gate: nothing publishes with missing or filename-derived text.
// (design.md: "Filename-derived captions never publish"; alt + AD are the
// project's core promise to its audience.)
const FILENAMEY = /^(img|dsc|mvi|pxl|dji|gopro?)[\s_-]*\d+$/i;
const texty = (s) => typeof s === 'string' && s.trim().length > 0;

export function publishBlockers(item) {
  const blockers = [];
  if (!texty(item.caption) || FILENAMEY.test(item.caption.trim())) blockers.push('caption missing or filename-derived');
  if (item.kind === 'photo') {
    if (!texty(item.alt) || FILENAMEY.test(item.alt.trim())) blockers.push('alt text missing or filename-derived');
    if (!item.adAudio) blockers.push('no AD audio rendered');
  } else {
    if (!item.youtubeId) blockers.push('no youtubeId');
    if (item.hasSpeech && !item.captionVtt) blockers.push('spoken video without captions');
    if (!item.adVtt && !texty(item.adDecision)) blockers.push('no AD track and no recorded adDecision');
  }
  return blockers;
}

export function toMediaItem(item, eventId) {
  if (item.kind === 'photo') {
    return {
      id: item.id, type: 'photo',
      src: mediaPath(eventId, `${item.id}.jpg`),
      alt: item.alt, caption: item.caption,
      adAudio: item.adAudio ? mediaPath(eventId, `${item.id}-ad.mp3`) : null,
      chapter: item.chapter, event: item.event, date: item.date,
    };
  }
  return {
    id: item.id, type: 'video',
    youtubeId: item.youtubeId,
    poster: mediaPath(eventId, `${item.id}-poster.jpg`),
    caption: item.caption,
    vtt: item.captionVtt ? mediaPath(eventId, `${item.id}.vtt`) : null,
    adTrack: item.adVtt ? mediaPath(eventId, `${item.id}-ad.vtt`) : null,
    transcript: item.transcript, person: item.person,
    chapter: item.chapter, event: item.event, date: item.date,
  };
}

export function mergeItems(mediaJson, newItems) {
  const items = [...mediaJson.items];
  for (const nu of newItems) {
    const idx = items.findIndex(i => i.id === nu.id);
    if (idx >= 0) items[idx] = nu; else items.push(nu);
  }
  return { ...mediaJson, items };
}

// Copy a run-relative artifact into the committed media/<event>/ dir.
function publishArtifact(paths, outDir, relFromRun, destName) {
  if (!relFromRun) return;
  const srcAbs = path.join(paths.root, relFromRun);
  if (!existsSync(srcAbs)) return;
  copyFileSync(srcAbs, path.join(outDir, destName));
}

export function main(isoDate) {
  const eventId = eventIdFromDate(isoDate);
  const paths = runPaths(eventId);
  const outDir = publishedDir(eventId);
  mkdirSync(outDir, { recursive: true });
  const manifest = loadManifest(paths.manifest);

  // Only items that reached 'uploaded' (videos) or 'narrated' (photos) and are not held/failed publish.
  const ready = manifest.items.filter(i =>
    !i.held && i.state !== 'failed' &&
    ((i.kind === 'photo' && ['narrated', 'published'].includes(i.state)) ||
     (i.kind === 'video' && ['uploaded', 'published'].includes(i.state))));

  const newMedia = [];
  for (const item of ready) {
    const blockers = publishBlockers(item);
    if (blockers.length > 0) {
      // Never a silent drop (design.md Error Handling) — hold with reasons.
      hold(manifest, item.id, `publish blocked: ${blockers.join('; ')}`);
      continue;
    }
    if (item.kind === 'photo') {
      publishArtifact(paths, outDir, item.rendition, `${item.id}.jpg`);
      publishArtifact(paths, outDir, item.adAudio, `${item.id}-ad.mp3`);
    } else {
      publishArtifact(paths, outDir, item.poster, `${item.id}-poster.jpg`);
      publishArtifact(paths, outDir, item.captionVtt, `${item.id}.vtt`);
      publishArtifact(paths, outDir, item.adVtt, `${item.id}-ad.vtt`);
    }
    newMedia.push(toMediaItem(item, eventId));
    setState(manifest, item.id, 'published');
  }

  // Reel as the lead video of the event (design.md: Logbook entry led by its reel).
  if (manifest.reel && manifest.reel.youtubeId) {
    const reelPoster = path.join(paths.reel, `${eventId}-reel-poster.jpg`);
    // grab a poster from the reel if not already present
    if (!existsSync(reelPoster)) {
      try { ffmpegRun(posterArgs(path.join(paths.reel, `${eventId}-reel.mp4`), reelPoster, 1)); } catch { /* poster is best-effort */ }
    }
    publishArtifact(paths, outDir, path.relative(paths.root, reelPoster), `${eventId}-reel-poster.jpg`);
    publishArtifact(paths, outDir, path.relative(paths.root, path.join(paths.reel, `${eventId}-reel.vtt`)), `${eventId}-reel.vtt`);
    newMedia.unshift({
      id: `${eventId}-reel`, type: 'video', youtubeId: manifest.reel.youtubeId,
      poster: mediaPath(eventId, `${eventId}-reel-poster.jpg`),
      caption: manifest.reel.title || `BlindSail — ${eventId}`,
      vtt: mediaPath(eventId, `${eventId}-reel.vtt`),
      adTrack: null, transcript: manifest.reel.narrationText || null,
      person: null, chapter: null, event: eventId, date: isoDate, isReel: true,
    });
  }

  const mediaJsonFile = path.join(REPO_ROOT, 'media.json');
  const mediaJson = JSON.parse(readFileSync(mediaJsonFile, 'utf8'));
  const merged = mergeItems(mediaJson, newMedia);
  writeFileSync(mediaJsonFile, JSON.stringify(merged, null, 2) + '\n');
  saveManifest(paths.manifest, manifest);

  console.log(`Published ${newMedia.length} item(s) into media.json and media/${eventId}/.`);
  const held = listByState(manifest, 'held').length;
  const failed = listByState(manifest, 'failed').length;
  if (held || failed) console.log(`Held: ${held}, Failed: ${failed} — review before the next run.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const isoDate = process.argv[2];
  if (!isoDate) { console.error('usage: node publish.mjs <YYYY-MM-DD>'); process.exit(1); }
  main(isoDate);
}
```

- [ ] **Step 4: Re-check the guard path** — held/failed items and items with `publishBlockers` must never reach `media.json`; blockers hold with a logged reason (design.md Error Handling: no silent drops, no degraded auto-publish).

- [ ] **Step 5: Run test to verify it passes.**

Run: `cd "scripts/pipeline" && node --test __tests__/publish.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 6: Run the whole pipeline test suite** to confirm nothing regressed.

Run: `cd "scripts/pipeline" && npm test`
Expected: all tests across all `__tests__/*.test.mjs` PASS.

- [ ] **Step 7: Commit.**

```bash
git add scripts/pipeline/publish.mjs scripts/pipeline/__tests__/publish.test.mjs
git commit -m "feat(pipeline): publish stage (media.json merge + rendition copy)"
```

---

## Task 16: GCP project + credentials setup (documented, human-run)

Not code — a documented prerequisites checklist the SKILL.md and README reference. Produces the three credential artifacts the Cloud/YouTube stages need, all in gitignored `secrets/`.

**Files:**
- Create: `docs/pipeline-setup.md`

- [ ] **Step 1: Write `docs/pipeline-setup.md`** documenting the one-time setup:

```markdown
# Publishing pipeline — one-time setup

All credentials live in the gitignored `secrets/` folder. Never commit them.

## 1. Create the GCP project
- console.cloud.google.com → new project "BlindSail Media Pipeline". Note the **Project ID**; put it in `config/pipeline.config.json` as `gcpProjectId`.
- Enable billing on the project (required even though usage stays in the free tier).

## 2. Enable APIs (same project)
- Cloud Text-to-Speech API
- Cloud Speech-to-Text API
- YouTube Data API v3

## 3. Service account (Cloud TTS + Speech-to-Text)
- IAM & Admin → Service Accounts → create `blindsail-pipeline`.
- Create a JSON key; save it as `secrets/service-account.json`.
- Set the env var when running the skill (Bash): `export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/secrets/service-account.json"`

## 4. OAuth client (YouTube upload)
- APIs & Services → OAuth consent screen → External; add philipk303@gmail.com as a test user; add scope `.../auth/youtube.upload`.
- Credentials → Create OAuth client ID → **Desktop app**. Download JSON to `secrets/youtube-oauth-client.json`.
- Run `cd scripts/pipeline && node youtube-auth.mjs`, consent as philipk303, which writes `secrets/youtube-token.json`.

## 5. Verify
- `node -e "import('@google-cloud/text-to-speech').then(m=>new m.TextToSpeechClient())"` with `GOOGLE_APPLICATION_CREDENTIALS` set — no auth error.
- `secrets/` now holds: `service-account.json`, `youtube-oauth-client.json`, `youtube-token.json`.

## 6. Spike — confirm unlisted API uploads aren't locked private (GATE)
YouTube locks videos uploaded through unverified/unaudited API projects to
private ("Video unavailable" when embedded) — a brand-new external/testing
consent screen is exactly that case. Upload one throwaway 2-second clip via
the API and check YouTube Studio: its visibility must read **Unlisted**, not
"Private (locked)". If locked, request the YouTube API audit for the project
and re-test before the first real publish run.
```

- [ ] **Step 2: Perform the setup** following the doc; confirm the three files exist in `secrets/`.

Run: `ls secrets/`
Expected: `service-account.json  youtube-oauth-client.json  youtube-token.json  .gitkeep`

- [ ] **Step 3: Spike — verify unlisted uploads (GATE for Task 18).** After Tasks 13–14 are built and the setup above is done: make a 2s test clip (`ffmpeg -y -f lavfi -i color=c=navy:s=320x240:d=2 pipeline/spike.mp4`), upload it through the same `videos.insert` path (a throwaway script reusing `youtube-upload.mjs`'s client + `uploadMetadata`), and confirm in YouTube Studio it shows **Unlisted**, not "Private (locked)". Delete the test video afterward. If locked → resolve the project's API audit before any real upload; this risk could otherwise invalidate the whole unlisted-hosting approach.

- [ ] **Step 4: Commit** (doc only; secrets are gitignored).

```bash
git add docs/pipeline-setup.md
git commit -m "docs: pipeline GCP/credentials setup guide"
```

---

## Task 17: `SKILL.md` — the orchestration workflow

The document Claude follows to run a publish. It sequences the scripts and specifies the inline judgment steps (screening, caption/alt/AD writing, shot-list drafting, hold review). This is where the "Claude in-session" work is defined.

**Files:**
- Create: `.claude/skills/blindsail-publish/SKILL.md`

- [ ] **Step 1: Write `.claude/skills/blindsail-publish/SKILL.md`** with frontmatter and the full run procedure:

```markdown
---
name: blindsail-publish
description: Publish a BlindSail sailing event's volunteer media to the gallery — pull/convert, screen for safety and mission fit, write captions/alt-text/audio-description, narrate (TTS), caption spoken video (ASR), assemble a highlight reel, upload unlisted to YouTube, and write media.json. Use when the user says "publish the <date> sail", "run the publishing pipeline", or points at a folder of sailing media.
---

# BlindSail publishing pipeline

Run once per sailing event, gated on the owner. Prerequisites: `docs/pipeline-setup.md` complete (`secrets/` populated), `GOOGLE_APPLICATION_CREDENTIALS` exported to `secrets/service-account.json`, ffmpeg on PATH. All scripts live in `scripts/pipeline/`. State lives in `pipeline/runs/<event>/manifest.json` — every stage is resumable; re-running a stage skips already-advanced items.

**Output discipline:** never echo media descriptions/captions or file contents into chat beyond a one-line status. Offer Notepad for review of held items and the shot list.

Use the ISO event date as the single argument to every script, e.g. `2026-06-13`.

## Stage 1 — Ingest
- Volunteer Drive folder: `node scripts/pipeline/drive-pull.mjs 2026-06-13`
- Local files instead (e.g. the June 13 test set): `node scripts/pipeline/seed-local.mjs 2026-06-13 "6-13 Sailing -pk"`

## Stage 2 — Convert
`node scripts/pipeline/convert.mjs 2026-06-13`
Any conversion failure holds that item (logged reason) — it does not stop the run.

## Stage 3 — Screen (Claude, inline — the judgment gate)
Read the manifest. For each `converted` item, open its rendition (`pipeline/runs/<event>/renditions/...`) and look at it. Decide:
- **On-mission?** Sailing/students/community at OYC/Treasure Island/SF Bay. Off-mission → `hold` with reason.
- **Appropriate & safe?** No identifiable non-participant bystanders or minors in focus; nothing embarrassing or unsafe. Suspicious → `hold` with reason (flag possible bystanders/minors explicitly).
- **Quality above floor?** Not blurred/black/accidental. Below floor → `hold`.
- For videos, decide `hasSpeech` (does anyone talk?) and, if it's a named debrief, set `person`.
Set state to `screened` for clean items; use `hold(manifest, id, reason)` for the rest. Filename-derived text NEVER becomes a caption. Save the manifest.

## Stage 4 — Write captions / alt / AD (Claude, inline)
For each `screened` item, looking at the image/video, write into the manifest:
- `alt` — concise screen-reader alt text (what's in frame, who's doing what).
- `caption` — the visible warm, first-person, action-forward caption (design.md Voice).
- `chapter` — one of `welcome-aboard | cast-off | at-helm | back-at-dock`, or null if it doesn't fit the home narrative.
- `adScript` (photos) — a narrator-style audio-description script (2–4 sentences) for the AD play button.
- `adVtt` (videos) — write a `kind="descriptions"` VTT to `renditions/<id>-ad.vtt` (vtt.mjs builder pattern) and set `adVtt` to its run-relative path. If the video genuinely needs no AD (its audio already conveys everything visual), record `adDecision: "not-needed — <reason>"` in the manifest instead — publish blocks videos with neither (design.md line 57 makes the AD track part of the video spec).
Set state to `captioned`. Save.

## Stage 5 — Narrate (TTS)
`node scripts/pipeline/tts.mjs 2026-06-13` — renders each photo's `adScript` to `<id>-ad.mp3`, advances photos+videos to `narrated`.

## Stage 6 — Caption spoken video (ASR)
`node scripts/pipeline/asr.mjs 2026-06-13` — transcribes `hasSpeech` videos to a caption VTT + transcript.

## Stage 7 — Highlight reel (Claude drafts, ffmpeg assembles)
Review the event's `narrated` items (posters, captions, transcripts). Write `pipeline/runs/<event>/shotlist.json` per the schema in `scripts/pipeline/reel.mjs` (clip order, per-photo `seconds`, per-video `in`/`out`, one `narration` line per segment, a `title`). Keep it 60–120s. Then:
`node scripts/pipeline/reel.mjs 2026-06-13`
Set `manifest.reel = { title, narrationText }` (full narration joined) before upload. If assembly fails, publish the burst without a reel and flag it (design.md Error Handling).

## Stage 8 — Upload (YouTube, unlisted)
`node scripts/pipeline/youtube-upload.mjs 2026-06-13` — uploads the reel first, then videos; records `youtubeId`s. Resumable (saves after each upload; quota errors leave items queued, not failed). Quota: `videos.insert` costs 1600 of the 10,000/day default (~6 uploads/day) — a big event may need a second day's run to finish.

## Stage 9 — Publish
`node scripts/pipeline/publish.mjs 2026-06-13` — copies approved renditions into `media/<event>/`, merges `media.json`, adds the reel as the event's lead video. Items missing alt/caption/AD are automatically held (`publish blocked: ...`), never silently dropped. **First real publish only:** delete the four sample placeholder items (`logbook-01-welcome`, `voices-david-cook`, `voices-priscilla-aguiar`, `logbook-01-photo`) from `media.json` before committing.

## Stage 10 — Review holds, then ship
- Present held/failed items (count + reasons) to the owner. For any they approve, use `clearHold(manifest, id, 'screened')` from `lib/manifest.mjs` — it resets `held`/`holdReason` and the state together (hand-editing only `state` leaves `held: true`, and the item would be silently skipped at publish). Then resume from Stage 4 for those items.
- Show the owner the changed `media.json` and `media/<event>/` (offer Notepad). On approval:
  `git add media.json media/<event> && git commit -m "content: publish <event> sail" && git push`
- Cloudflare Pages deploys on push. Confirm the deploy is green before calling it done.

## Takedown
Remove the item(s) from `media.json`, `git push`. For a video also set it private on YouTube. (README documents the one-liner.)
```

- [ ] **Step 2: Ensure `.claude/skills/` is committable** (not caught by the `.claude/worktrees/` ignore from Task 1). Verify:

Run: `git check-ignore .claude/skills/blindsail-publish/SKILL.md; echo "exit=$?"`
Expected: `exit=1` (not ignored). If it prints the path (exit=0), fix `.gitignore` so only `.claude/worktrees/` is ignored.

- [ ] **Step 3: Commit.**

```bash
git add .claude/skills/blindsail-publish/SKILL.md
git commit -m "feat(pipeline): blindsail-publish orchestration skill"
```

---

## Task 18: End-to-end dry run against the June 13 set

Validate the full chain against `6-13 Sailing -pk/` (local seed path). This exercises the real ffmpeg/TTS/ASR/YouTube adapters the unit tests intentionally don't.

**Files:** modify `js/media-loader.js` (Step 0); otherwise gitignored run artifacts + a real unlisted YouTube upload + a `media/june-13-2026/` dir + `media.json` changes.

- [ ] **Step 0: Fix Logbook event ordering (phase-1 site bug surfaced by real event ids).** `js/media-loader.js` `renderLogbook` sorts event groups by key string (`.sort().reverse()`), which is not chronological across months (`july-…` sorts before `june-…` alphabetically). Change it to sort groups by their newest item `date` (ISO strings compare correctly), newest first. Run `cd tests && npx playwright test` — 9/9 must still pass. Commit: `git commit -m "fix: Logbook orders events by date, not event-name string"`.

- [ ] **Step 1: Seed + convert.**

```bash
export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/secrets/service-account.json"
node scripts/pipeline/seed-local.mjs 2026-06-13 "6-13 Sailing -pk"
node scripts/pipeline/convert.mjs 2026-06-13
```
Expected: `pipeline/runs/june-13-2026/renditions/` holds ~10 jpgs + ~6 mp4s + posters; manifest items are `converted` (or `failed` with a reason — investigate any failures per systematic-debugging).

- [ ] **Step 2: Screen + write captions/alt/AD inline** (Stages 3–4 of SKILL.md), planting one deliberately off-mission or bystander item to confirm it gets **held** (success criterion from design.md).

- [ ] **Step 3: Narrate + caption.**

```bash
node scripts/pipeline/tts.mjs 2026-06-13
node scripts/pipeline/asr.mjs 2026-06-13
```
Expected: `<id>-ad.mp3` files exist; spoken videos have `.vtt` + transcript. Listen to one AD mp3 to confirm the Neural2 voice is acceptable (design.md's "chosen by listening test"); adjust `voiceName` in config if not.

- [ ] **Step 4: Draft shot list + assemble reel.**

```bash
node scripts/pipeline/reel.mjs 2026-06-13
```
Expected: `pipeline/runs/june-13-2026/reel/june-13-2026-reel.mp4` plays with Ken Burns stills, trimmed clips, and narration; `.vtt` captions match. Watch it end-to-end once. Verify the concat was clean with `ffprobe` (duration = sum of effective durations; exactly one video + one audio stream) and confirm narration lands on its intended segments — this is the first live validation of the stream-copy join. **No cut-off narration line anywhere — that's a release blocker.**

- [ ] **Step 5: Upload + publish.**

```bash
node scripts/pipeline/youtube-upload.mjs 2026-06-13
node scripts/pipeline/publish.mjs 2026-06-13
```
Expected: 6 videos + 1 reel = 7 × 1600 quota units > the 10,000/day default — expect the final upload(s) to hit quota and stay queued; re-run the next day to finish (the stage resumes; reel went first). Verify each upload's visibility is **Unlisted**, not "Private (locked)" (the Task 16 spike should have de-risked this). Then: `media/june-13-2026/` populated; `media.json` has the new event led by the reel.

- [ ] **Step 6: Verify the site renders the real event** (Playwright + manual). Because `media.local.json` is preferred by the loader, temporarily confirm against `media.json` by serving without a local file, or point a check at the merged data.

Run: `cd tests && npx playwright test`
Expected: 9/9 still pass (axe WCAG AA included). Open `logbook.html` via a static server and confirm the June 13 entry shows the reel first, photos with AD buttons, videos with transcript/captions.

- [ ] **Step 7: Commit the published content** (only after the owner approves the review). First delete the four sample placeholder items from `media.json` (ids: `logbook-01-welcome`, `voices-david-cook`, `voices-priscilla-aguiar`, `logbook-01-photo`) so the sample event no longer outranks the real one; Voices then shows the real June 13 debriefs. Then:

```bash
git add media.json media/june-13-2026 js/media-loader.js
git commit -m "content: publish June 13 2026 sail (first pipeline run)"
```

- [ ] **Step 8: Push and confirm deploy** (only on owner approval).

```bash
git push origin main
```
Expected: Cloudflare Pages builds green (check the dashboard). If the Cloudflare deploy is still unresolved from phase 1, that block is separate — note it, don't let it fail the pipeline validation.

---

## Task 19: README handover + takedown docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a "Publishing pipeline" section to `README.md`** covering: running the skill (`/blindsail-publish` or "publish the <date> sail"), the prerequisites pointer to `docs/pipeline-setup.md`, approving held items, the takedown one-liner (remove from `media.json` + push; set YouTube video private), and successor handover (GitHub access, Claude Code, gws auth, GCP project owner transfer, YouTube channel = philipk303).

```markdown
## Publishing pipeline (phase 2)

Turns a sailing event's volunteer media into a published Logbook entry with a narrated highlight reel. Runs locally as the `blindsail-publish` Claude Code skill — nothing publishes unattended.

**First-time setup:** follow `docs/pipeline-setup.md` (GCP project, `secrets/`).

**Run:** in Claude Code, say "publish the 2026-06-13 sail" (or invoke `/blindsail-publish`). The skill pulls/convert/screens/captions/narrates/reels/uploads/publishes, holding anything off-mission or unsafe for your approval, then commits and pushes on your OK.

**Approve held items:** the skill lists held items with reasons; approve the ones you want and it resumes them.

**Takedown:** remove the item's object from `media.json`, `git push`. For a video, also set it Private on YouTube (studio.youtube.com).

**Successor handover:** repo `philipk303/blindsail-media-gallery`; hosting Cloudflare Pages; video on philipk303's YouTube (unlisted); Google auth via gws (Drive) + the BlindSail GCP project (TTS/Speech/YouTube). Transfer GCP project ownership and grant repo access to hand off.
```

- [ ] **Step 2: Commit.**

```bash
git add README.md
git commit -m "docs: publishing pipeline usage, takedown, and handover"
```

---

## Self-Review (completed against design.md)

**Spec coverage — design.md "Media Pipeline" 7 steps:**
1. Drive pull → Task 8 (`drive-pull.mjs`) + Task 2 (folder). ✓
2. HEIC/video convert + posters → Task 9 (`convert.mjs`). ✓
3. Screen (auto-publish clean / hold suspicious / flag bystanders-minors) → Task 17 SKILL.md Stage 3 + manifest `hold`. ✓
4. Caption/alt/AD script → SKILL.md Stage 4. ✓
5. AD narration TTS → Task 10 (`tts.mjs`). ✓
6. Reel shot-list + FFmpeg assembly → Task 12 (`reel.mjs`) + SKILL.md Stage 7. ✓
7. YouTube upload + media.json write + commit/push → Tasks 14, 15 + SKILL.md Stages 8–10. ✓

**Other design.md sections:** Error Handling (hold-with-reason, resumable, reel-fail-still-publishes) → manifest `hold`/`fail`, save-after-each-upload, SKILL.md Stage 7 note. ✓ Captions AA floor → Task 11 ASR. ✓ Accessibility schema (adAudio photos, vtt+adTrack videos, transcript) → Task 15 `toMediaItem` matches the real loader/media.json. ✓ Unlisted YouTube → Task 14 `uploadMetadata`. ✓ Sustainability/handover → Tasks 16, 19. ✓ Abuse posture/takedown → Task 2 note + Task 19. ✓

**Placeholder scan:** no "TODO/TBD/handle edge cases" placeholders remain; the three config placeholders (`driveFolderId`, `gcpProjectId`, `gwsJs`) each have a dedicated fill-in step (Tasks 2, 16, 8).

**Type/name consistency:** manifest item fields (`rendition`, `poster`, `adAudio`, `captionVtt`, `adVtt`, `transcript`, `youtubeId`, `hasSpeech`, `person`, `chapter`) are defined once in Task 4 `addItem` and consumed with those exact names in Tasks 9–15. `media.json` output schema in Task 15 matches the real `media.json` + `js/media-loader.js` (`src/alt/caption/adAudio` for photos; `youtubeId/poster/caption/vtt/adTrack/transcript/person` for videos). Script CLI contract is uniform: every stage takes the ISO date and derives the event id via `eventIdFromDate`. `run`/`photoArgs`/`videoArgs`/`posterArgs` names are stable across Tasks 6, 9, 12, 15.

**Known deferrals (not gaps):** per-video AD VTT is authored by Claude rather than auto-generated, but publish now requires either an `adVtt` or an explicitly recorded `adDecision` per video. The reel uses hard cuts via concat-demuxer joins (segments normalized identically) rather than xfade crossfades — `reel.crossfadeSeconds` in config is reserved for that upgrade and currently unused. ASR uses chunked sync `recognize` (55s PCM chunks); GCS staging + `longRunningRecognize` is the upgrade path for very long interviews.

**Adversarial review (Fable 5, 2026-07-02) — all findings applied:** (1) Windows entry-point guard fixed via `pathToFileURL` (the literal `file://${argv[1]}` compare never matches with the repo path's spaces/backslashes — every stage would have been a silent no-op). (2) ASR chunked to <60s segments (sync `recognize` limit; debriefs exceed it). (3) gws invoked as `node <gwsJs>` — the npm `.cmd` shim isn't `execFileSync`-able and the Git-Bash path is invalid for Node. (4) Narration pads forced to uniform 24kHz mono + re-encoded concat (was splicing mismatched MP3 params → drifting AD). (5) Narration never truncated — segment durations extend to fit (ffprobe-measured), videos freeze the last frame via `tpad`, `-shortest` dropped. (6) `publishBlockers` accessibility gate: null/filename-derived alt/caption, missing AD audio, spoken-video-without-captions, and videos with neither `adVtt` nor `adDecision` are held, never published. (7) `.gitignore` uses `secrets/*` + negation (bare `secrets/` kills the `!.gitkeep`); node_modules explicitly ignored. (8) Reel uploads first; quota documented (1600 units/upload, ~6/day); quota errors leave items queued (`narrated`), not `failed`, so runs actually resume. (9) Unlisted-lock spike added as a Task 16 gate — unverified API projects can have uploads locked private, which would invalidate the hosting approach. (10) Drive `anyone`+`writer` folder-permission caveat + fallback documented in Task 2. (11) ASR touches only pre-upload states and holds (not fails) on zero words; `clearHold` added so approved holds can't be half-cleared into a silent skip. (12) Photo segments aspect-pad before zoompan (no stretched portraits); zoom ramps linearly to 1.15. (13) `addItem` suffixes colliding ids; Drive downloads are prefixed with the file id so identical camera filenames can't overwrite. (14) Sample placeholders deleted on first real publish; Logbook re-sorted by date not event-name string (Task 18 Step 0). (15) Video AD track required unless an explicit `adDecision` is recorded (design.md line 57).
```
