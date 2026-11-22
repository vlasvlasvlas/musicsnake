# Camino 1: Spiegel-First Sound Deepening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deepen MusicSnake's sonic layer with nine Spiegel-inspired features (growth-gated voicing, monochrome voice highlights on the Nokia grid, muda-de-piel, Music Mouse's 10 patterns, dual tempo, articulation, group behavior, extended timbral modulation by snake length, and snake freeze) without altering the Nokia LCD visual language.

**Architecture:** All features are additive to the existing files (`js/music.js`, `js/audio.js`, `js/app.js`, `js/renderer.js`, `js/snake.js`, `index.html`, `css/style.css`). No new modules. The tick pipeline in `tickMusicClock()` gains new ordered steps per Section 6 of the spec. `music.js` gains an `MM_PATTERNS` export and an `applyPattern()` method. `audio.js` refactors to track per-voice active oscillators for full-legato retriggering. A new `/tests` directory holds Node-based assertion tests for the three pure-logic features (A, D, H); the other six features use manual browser verification per the spec.

**Tech Stack:** Vanilla JavaScript (ES modules), Web Audio API, Canvas 2D. Node 18+ (built-in test runner via `node --test`) for the logic tests. No frameworks, no build step, no new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-11-22-spiegel-first-sound-deepening-design.md`

## Global Constraints

- No new runtime dependencies, no build step, vanilla JS only.
- Nokia LCD aesthetic preserved: all canvas colors stay in the hue family of `#aacc66` (board) and `rgba(0,0,0,0.75)` (ink). No colored voice lines, no piano-keyboard rulers, no non-green overlays.
- `MusicTheory.getVoices` existing 5 treatments (contrary/parallel/mirror/cluster/canonDelay) semantics must not change; only the `activeVoiceCount` truncation is added.
- Existing hotkey map (Q/W/E/R/T/Y, 1-8, Space, Tab, M, arrows, WASD) must not change.
- Every MIDI Note On must eventually get a Note Off — no hanging MIDI notes under full-legato.
- Existing 5 presets in `PRESETS` must still load after gaining the new fields (missing fields fall back to defaults, never undefined).
- Branch `camino-1-spiegel`. Main is not touched until all tasks pass review.
- One commit per task. Commit messages prefixed `feat(camino-1):` for features, `test(camino-1):` for test infra, `refactor(camino-1):` for F.
- Every commit must end with the attribution footer:
  ```
  Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
  ```

## Review Focus

Input classes/failure modes the spec implies but no single feature's happy-path exercises. Each is pinned to the task whose code owns it.

1. **Grid-size change mid-performance.** User changes `selGrid` while the snake is live: `snake.reset()` runs, but `patternStep`, `previousVoicePitches`, `activeVoiceNodes`, and the freeze flag may retain stale state. Expected: all per-tick accumulators reset together with the snake. — Pinned to Task 1 (owns the pipeline entry).
2. **Scale or root change with active full-legato voices.** Full-legato oscillators keep ringing at their last frequency; a scale change doesn't retrigger them. Expected: scale/root change issues a soft release on all active full-legato voices so the next tick restarts them clean. — Pinned to Task 6 (owns legato lifecycle).
3. **MIDI Note Off never sent under full-legato.** Current `sendMidiNote` uses `setTimeout(noteOff, duration)`; full-legato has no finite duration. Expected: full-legato sends Note Off when the voice retriggers or when the voice goes silent (shrink, mute, scale change). — Pinned to Task 6.
4. **Preset change mid-performance.** The five existing presets lack the new fields (`pattern`, `symmetry`, `articulation`, `group`, `bpm2`). Expected: `applyPreset` falls back to the current value (not `undefined`) when a field is missing on a preset object. — Pinned to Task 3 (two-tempo task, which is the first to add a preset field).
5. **Freeze colliding with muda.** User double-click-freezes on the exact tick that would collide. Expected: freeze wins — the tick is skipped entirely, muda is not evaluated, and no sound is emitted until unfreeze. — Pinned to Task 9 (owns freeze gate at step 0 of the tick order).

---

## Task 1: Growth-gated voicing (Feature A) + test infrastructure

**Files:**
- Create: `package.json`
- Create: `tests/music.test.mjs`
- Create: `.gitignore` (adds `node_modules/`)
- Modify: `js/music.js` (line 168, `getVoices` signature)
- Modify: `js/app.js` (lines 595-645, `tickMusicClock`)

**Interfaces:**
- Produces: `MusicTheory.getVoices(pos, history, treatment, activeVoiceCount = 4)` returns an array of length `activeVoiceCount` (1..4). Pure extension — calling without the arg returns 4 voices as today.
- Produces: `voiceCountForLength(segmentCount: number) -> 1|2|3|4` as a named export from a new `js/growth.js` module.

- [ ] **Step 1.1: Write failing tests**

Create `package.json` (type: module, test script `node --test tests/*.test.mjs`).

Create `tests/music.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MusicTheory } from '../js/music.js';
import { voiceCountForLength } from '../js/growth.js';

test('voiceCountForLength: 1→1, 2→2, 3→2, 4→3, 7→3, 8→4, 20→4', () => { /* assertions */ });
test('getVoices default returns 4 voices (back-compat)', () => { /* ... */ });
test('getVoices with activeVoiceCount=1 returns 1 soprano voice', () => { /* ... */ });
test('getVoices with activeVoiceCount=3 returns soprano/alto/tenor and no bass', () => { /* ... */ });
test('Review Focus #1: voiceCountForLength is pure (same input → same output)', () => { /* ... */ });
```

- [ ] **Step 1.2: Run tests, expect FAIL**

Run: `npm test`
Expected: FAIL with "cannot find module growth.js" or similar.

- [ ] **Step 1.3: Implement `voiceCountForLength` in new `js/growth.js`**

Thresholds from spec §5.1 table: `n <= 1 ? 1 : n <= 3 ? 2 : n <= 7 ? 3 : 4`.

- [ ] **Step 1.4: Extend `MusicTheory.getVoices` in `js/music.js`**

New signature: `getVoices(pos, history, treatment, activeVoiceCount = 4)`. Keep the existing 4-voice computation as-is (do not short-circuit mid-way to preserve treatment math); return `result.slice(0, activeVoiceCount)` at the end.

- [ ] **Step 1.5: Wire into `tickMusicClock` in `js/app.js`**

Import `voiceCountForLength` from `./growth.js`. Between the food-consumed check and `getVoices` call, compute `const activeVoiceCount = voiceCountForLength(this.snake.segments.length);` and pass it as the 4th arg.

In `triggerVoiceArpeggio(voices)`, for `upDown` pattern, replace the fixed `order = [0, 1, 2, 3, 2, 1]` with `order = [0, 1, 2, 3, 2, 1].filter(i => i < voices.length)`. For `cycle`/`random`, the existing `voices.length` modulo is already correct.

In the `selGrid` change handler (line ~264), after `snake.reset()`, also reset `this.voiceStep = 0;` and (forward-declaration) `this.patternStep = 0; this.previousVoicePitches = [null, null, null, null];` so no stale state leaks across grid changes (Review Focus #1).

- [ ] **Step 1.6: Run tests, expect PASS**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 1.7: Manual browser verification**

Open `index.html` in Chrome, click INICIAR. Reset. Confirm a 4-segment snake sounds 3 voices (soprano+alto+tenor). Eat food until 8+ segments. Confirm the 4th voice (bass) enters audibly.

**Review Focus #1 check (grid resize):** Grow snake to 12 segments. Change `selGrid` from 28 to 48. Verify in the browser dev console: `window.snakeSynth.voiceStep === 0`, snake is reset to 4 segments, and the next audible voice count matches the new 4-segment length (3 voices), not stale state.

- [ ] **Step 1.8: Commit**

```bash
git add package.json .gitignore tests/ js/music.js js/app.js js/growth.js
git commit -m "feat(camino-1): growth-gated voicing (A) + test infra"
```

---

## Task 2: Extended timbral modulation by length (Feature H)

**Files:**
- Create: `tests/growth.test.mjs`
- Modify: `js/app.js` (lines 622-625, extend the length-timbre block)

**Interfaces:**
- Consumes: nothing from prior tasks (operates on `snake.segments.length` directly). Co-locates its export with Task 1's `voiceCountForLength` in `js/growth.js` for cohesion.
- Produces: `computeTimbreByLength(length, baseCutoff, baseReverb, baseDelay) -> { cutoff, reverb, delay }` as a named export from `js/growth.js`.

- [ ] **Step 2.1: Write failing tests**

Add to `tests/growth.test.mjs` tests for the three curves per spec §5.8 table (filterCutoff `sqrt(len/8)`, reverb lineal, delay lineal, with the stated caps 9500 Hz / 0.9 / 0.75).

- [ ] **Step 2.2: Run, expect FAIL** → `npm test`

- [ ] **Step 2.3: Implement `computeTimbreByLength` in `js/growth.js`**

- [ ] **Step 2.4: Replace the length-modulation block in `app.js` tickMusicClock**

Replace lines 622-625 with a call to `computeTimbreByLength` using the three slider base values (`sliderCutoff`, `sliderReverb`, `sliderDelay`) and apply the three setters (`setFilterCutoff`, `setReverbMix`, `setDelayParams` — delay time stays at 0.35, only feedback modulates).

- [ ] **Step 2.5: Run tests, expect PASS** → `npm test`

- [ ] **Step 2.6: Manual browser verification**

Set BPM to 60 for slow observation. Eat orbs until length = 32. Confirm audibly: cutoff opens (brighter), reverb grows (more spacious), delay feedback increases (longer echo tails).

- [ ] **Step 2.7: Commit**

```bash
git add tests/growth.test.mjs js/growth.js js/app.js
git commit -m "feat(camino-1): extended timbral modulation by length (H)"
```

---

## Task 3: Two tempos alternable (Feature E)

**Files:**
- Modify: `js/app.js` (state, `applyPreset`, `start`, `handleKeyDown`, `bindEvents` for new slider)
- Modify: `index.html` (add second BPM slider + toggle button in settings panel)
- Modify: `css/style.css` (if needed for the new row layout)

**Interfaces:**
- Consumes: nothing from prior tasks.
- Produces: `this.bpm1`, `this.bpm2`, `this.activeTempo`, and a getter `get bpm()` on the `SnakeSynthApp` class that returns the active one.

- [ ] **Step 3.1: Replace `this.bpm` with dual state in `app.js`**

Constructor: `this.bpm1 = 110; this.bpm2 = 165; this.activeTempo = 1;`. Add `get bpm()` returning `this.activeTempo === 1 ? this.bpm1 : this.bpm2`. Remove `this.bpm = 110;`.

- [ ] **Step 3.2: Rename existing slider to `sliderBpm1`, add `sliderBpm2`**

In `index.html`, change the existing BPM slider's id to `sliderBpm1` (update label to "BPM 1"). Add a second row below it with id `sliderBpm2` (default value 165, label "BPM 2"). Add a toggle button with id `btnTempoActive` showing "T1" or "T2".

- [ ] **Step 3.3: Wire bindings in `app.js`**

Rename existing `sliderBpm` handler to use `bpm1`. Add handler for `sliderBpm2` → `bpm2`. Add handler for `btnTempoActive` click → toggle `activeTempo` between 1 and 2, update button text. Add keybinding `\` in `handleKeyDown` to click `btnTempoActive`.

- [ ] **Step 3.4: Update `applyPreset` with safe-fallback semantics (Review Focus #4)**

In `applyPreset(presetKey)`, for every new preset field, use `p.bpm2 ?? this.bpm2`, `p.pattern ?? 'off'` (forward-looking placeholder — will be referenced by Task 5), etc. Explicitly test by adding one preset without `bpm2` and loading it: `this.bpm2` must retain its prior value, not become `undefined`.

- [ ] **Step 3.5: Add `bpm2` to all 5 existing presets** per spec §8 table.

- [ ] **Step 3.6: Manual browser verification**

Start app, load each preset, confirm the active BPM slider matches. Click T1/T2 button and confirm tempo changes audibly. Load a modified preset that omits `bpm2` (temporarily, for testing) and confirm no console error.

- [ ] **Step 3.7: Commit**

```bash
git add index.html css/style.css js/app.js
git commit -m "feat(camino-1): dual tempo system (E)"
```

---

## Task 4: Muda de piel — repliega voces (Feature C)

**Files:**
- Modify: `js/app.js` (`tickMusicClock`, specifically the post-step collision branch and the wall-boundary branch)

**Interfaces:**
- Consumes: Task 1's growth model (shrinking to 1 segment → activeVoiceCount becomes 1 automatically on next tick).
- Produces: nothing new.

- [ ] **Step 4.1: Modify self-collision branch in `tickMusicClock`**

Replace the existing `this.snake.segments = this.snake.segments.slice(0, 4)` with `.slice(0, 1)`. Also set `this.snake.growthQueue = 0`.

- [ ] **Step 4.2: Add wall-classic-collision muda branch**

Classic wallMode currently sets `isDead = true` in `snake.step()` and early-returns from `step()` without appending a new head segment. In `tickMusicClock`, after the `step()` call, detect `this.snake.isDead && this.snake.wallMode === 'classic'`: trigger `triggerImpactSound`, slice to `[0, 1]`, set `isDead = false`, `growthQueue = 0`.

- [ ] **Step 4.3: Manual browser verification**

Set wall mode to Classic, mode Juego. Steer into a wall. Confirm the snake does not die; it reduces to 1 segment at the last valid position; audio does not pause; impact sound plays; after 1 segment, only soprano is sounding (verified by ear).

Steer into own tail (after growing). Confirm same behavior.

- [ ] **Step 4.4: Commit**

```bash
git add js/app.js
git commit -m "feat(camino-1): muda de piel — collision replega voces (C)"
```

---

## Task 5: Music Mouse patterns (Feature D)

**Files:**
- Create: `tests/patterns.test.mjs`
- Modify: `js/music.js` (export `MM_PATTERNS`, add `applyPattern` method on `MusicTheory`)
- Modify: `js/app.js` (new state, tickMusicClock, UI handlers)
- Modify: `index.html` (add Pattern select + Symmetry select to settings panel)

**Interfaces:**
- Consumes: `MusicTheory.getVoices` from Task 1 (operates on its output).
- Produces: `MusicTheory.applyPattern(voices, patternKey, patternStep, symmetry) -> voices[]` returns new voice objects with pitch adjusted; `MM_PATTERNS` object with 11 entries (`off` + `p1`..`p10`) per spec §5.4.

- [ ] **Step 5.1: Write failing tests**

In `tests/patterns.test.mjs`:
- `test('MM_PATTERNS.off has deltas=[0]')`
- `test('MM_PATTERNS.p1 deltas = [0,4,5,0,4,3,4,5,0,4]')` (and the other 9)
- `test('applyPattern with off returns identical voices (pitch unchanged)')`
- `test('applyPattern parallel: all voices receive same delta')`
- `test('applyPattern contrary: voices 1,3 receive +delta, voices 2,4 receive -delta')`
- `test('applyPattern index wraps modulo gridNotes.length (large delta like 11)')`
- `test('applyPattern index wraps correctly for negative deltas under contrary')`

- [ ] **Step 5.2: Run, expect FAIL** → `npm test`

- [ ] **Step 5.3: Implement `MM_PATTERNS` and `applyPattern` in `js/music.js`**

Export `MM_PATTERNS` with the 11 deltas exactly as spec §5.4.
`applyPattern(voices, patternKey, patternStep, symmetry)`:
- If `patternKey === 'off'`, return voices unchanged.
- Read `delta = MM_PATTERNS[patternKey].deltas[patternStep % deltas.length]`.
- For each voice index `i`, compute `signedDelta = symmetry === 'contrary' && (i === 1 || i === 3) ? -delta : delta`.
- Find voice's note in `this.gridNotes` (by `midi` match), get its index, compute `newIdx = (idx + signedDelta + len) % len`, return a new voice object with that note.

- [ ] **Step 5.4: Add UI controls and state in `app.js`**

State: `this.currentPattern = 'off'; this.currentSymmetry = 'parallel'; this.patternStep = 0;`.
In `tickMusicClock`, after `getVoices`, call `this.currentVoices = this.music.applyPattern(this.currentVoices, this.currentPattern, this.patternStep, this.currentSymmetry);`.
At the end of `tickMusicClock`, `this.patternStep++;`.

In `index.html`, add two new `set-row` entries: `selPattern` (populated from `MM_PATTERNS` keys) and `selSymmetry` (parallel/contrary).

Bind handlers in `bindEvents`. Reset `patternStep = 0` on `selPattern` change.

- [ ] **Step 5.5: Add `pattern` and `symmetry` fields to all 5 presets** per spec §8.

- [ ] **Step 5.6: Run tests, expect PASS** → `npm test`

- [ ] **Step 5.7: Manual browser verification**

Load `spiegel1986` preset (pattern `p2`, symmetry `contrary`). Listen for the 6-note triadic arpeggio pattern layered on the snake's movement. Switch pattern to `off`; confirm output matches the baseline (what the app sounded like before this task).

- [ ] **Step 5.8: Commit**

```bash
git add tests/patterns.test.mjs js/music.js js/app.js index.html
git commit -m "feat(camino-1): Music Mouse 10 patterns + symmetry (D)"
```

---

## Task 6: Articulation + full-legato lifecycle (Feature F)

**Files:**
- Modify: `js/audio.js` (`SynthEngine` state, `triggerVoiceNote` refactor, new `releaseVoice` and `releaseAllVoices` methods, MIDI lifecycle rework)
- Modify: `js/app.js` (state, UI wiring, scale/root change hooks)
- Modify: `index.html` (Articulation select)

**Interfaces:**
- Consumes: Task 5's voice pitch stream.
- Produces: `SynthEngine.triggerVoiceNote(freq, voiceIdx, durationOrNull, velocity, articulation)` accepts `articulation ∈ {'staccato','halfLegato','fullLegato'}`; `SynthEngine.releaseVoice(voiceIdx, releaseSeconds=0.15)`; `SynthEngine.releaseAllVoices()`.

- [ ] **Step 6.1: Add per-voice tracking state in `audio.js`**

In `SynthEngine` constructor: `this.activeVoiceNodes = [null, null, null, null];` where each slot stores `{ osc, subOsc, voiceGain, midiNote } | null`.

- [ ] **Step 6.2: Refactor `triggerVoiceNote`**

Accept new `articulation` parameter. If `articulation === 'fullLegato'`:
1. If `this.activeVoiceNodes[voiceIdx]` exists, call `releaseVoice(voiceIdx, 0.08)` first.
2. Compute duration map: staccato = 60/bpm * 0.25, halfLegato = 60/bpm * 0.5, fullLegato = effectively infinite (schedule stop at `now + 60` and expect a retrigger).
3. Build osc + subOsc + voiceGain as today, but do NOT connect a fixed stop time for fullLegato; instead save references in `activeVoiceNodes[voiceIdx]`.
4. For non-legato modes, use existing stop-scheduling but still save references in `activeVoiceNodes[voiceIdx]` and null them in a `setTimeout` after stop.

- [ ] **Step 6.3: Implement `releaseVoice(voiceIdx, releaseSec)`**

If slot is null, no-op. Otherwise: ramp voiceGain to 0.0001 over `releaseSec`, schedule osc.stop at `now + releaseSec + 0.02`, send MIDI Note Off for `midiNote` immediately (Review Focus #3), null the slot.

- [ ] **Step 6.4: Implement `releaseAllVoices()`**

Loop `releaseVoice(i, 0.15)` for all 4 slots.

- [ ] **Step 6.5: Fix MIDI lifecycle for fullLegato (Review Focus #3)**

In `triggerVoiceNote`, when fullLegato, do NOT call the existing `sendMidiNote` (which uses setTimeout). Instead, send Note On immediately and rely on the next retrigger's `releaseVoice` to send Note Off.

- [ ] **Step 6.6: App-level articulation state + UI**

In `app.js`: `this.articulation = 'halfLegato';`. Add `selArticulation` to `index.html`, bind in `bindEvents`. Pass to `triggerVoiceNote` from `triggerVoiceArpeggio`.

- [ ] **Step 6.7: Scale/root change hook (Review Focus #2)**

In the `selScale` and `selRoot` change handlers (and in `setScaleByKey`), call `this.synth.releaseAllVoices()` before applying the change. This re-triggers cleanly on the next tick.

- [ ] **Step 6.8: Muda releases higher voices (per spec §5.3 updated)**

In `tickMusicClock`'s muda branch (Task 4's code), after slicing segments to `[0, 1]`, call `this.synth.releaseVoice(1); this.synth.releaseVoice(2); this.synth.releaseVoice(3);` to clear any hanging legato oscillators on voices 2/3/4.

- [ ] **Step 6.9: Add `articulation` field to all 5 presets** per spec §8.

- [ ] **Step 6.10: Manual browser verification**

Switch articulation to Full Legato, play auto mode. Listen: notes should sustain, not stacatto. Change scale mid-play — old notes should fade (0.15s release) and new ones enter. Switch to Staccato — notes become short clicks.

Connect a MIDI monitor (e.g. MIDI Monitor app) and verify: under full-legato, Note Off is sent on retrigger (not after a fixed timeout).

- [ ] **Step 6.11: Commit**

```bash
git add js/audio.js js/app.js index.html
git commit -m "refactor(camino-1): articulation modes + full-legato lifecycle (F)"
```

---

## Task 7: Group behavior (Feature G)

**Files:**
- Modify: `js/app.js` (new state, `tickMusicClock` reorg, `triggerVoiceArpeggio` logic)
- Modify: `index.html` (Group checkbox)

**Interfaces:**
- Consumes: Tasks 1, 5, 6.
- Produces: nothing externally new.

- [ ] **Step 7.1: Add state in `app.js`**

Constructor: `this.groupMode = false; this.previousVoicePitches = [null, null, null, null];`.

- [ ] **Step 7.2: Add Group checkbox to `index.html` and bind**

New `set-row` with `chkGroup` checkbox. Handler updates `this.groupMode`.

- [ ] **Step 7.3: Rewrite tick order in `tickMusicClock`**

After `getVoices` returns `rawVoices` (pre-pattern), compute `const rawPitches = rawVoices.map(v => v.note?.midi ?? null);` and compare to `this.previousVoicePitches` to get `changedMask` (Review Focus semantics — diff is pre-pattern per spec §5.7).

Then apply pattern as in Task 5 to get `this.currentVoices`.

In `triggerVoiceArpeggio(voices)`, accept `changedMask` as a 2nd arg:
- If `this.groupMode === true`:
  - If any entry in `changedMask` is true → trigger all active voices (as chord).
  - Else → emit nothing.
- If `this.groupMode === false`:
  - If `arpPattern === 'chord' || arpPattern === 'drone'`: apply the pitch-change gate (each voice triggers only if its own `changedMask[i]` is true).
  - Else (`cycle`/`upDown`/`random`): existing behavior (gate does not apply).

At end of tick, `this.previousVoicePitches = rawPitches;`.

- [ ] **Step 7.4: Add `group` field to all 5 presets** per spec §8.

- [ ] **Step 7.5: Manual browser verification**

Enable Group, select arpPattern `chord`. Pause the snake with click-hold (preview — Task 9 will formalize). While frozen manually (don't step), confirm no retriggers occur. When you release, if any voice pitch changes, confirm all 4 fire as a block.

With Group off and arpPattern `cycle`, confirm current behavior is preserved (every tick fires one voice in sequence).

- [ ] **Step 7.6: Commit**

```bash
git add js/app.js index.html
git commit -m "feat(camino-1): group behavior with pre-pattern diff (G)"
```

---

## Task 8: Monochrome voice highlights on grid (Feature B)

**Files:**
- Modify: `js/renderer.js` (add `drawVoiceHighlights` method, extend `render` signature)
- Modify: `js/app.js` (pass `playingVoiceIdxs` to `renderer.render`)
- Modify: `css/style.css` (likely not needed; pure canvas)

**Interfaces:**
- Consumes: Tasks 1 (activeVoiceCount), 7 (which voices triggered this tick).
- Produces: nothing externally new.

- [ ] **Step 8.1: Capture playingVoiceIdxs each tick in `app.js`**

In `triggerVoiceArpeggio`, mutate a closure-side array `this.lastPlayingVoiceIdxs = [...]` reflecting the indices that actually triggered this tick (whether by chord, cycle, random, upDown, or group).

Pass `this.lastPlayingVoiceIdxs` to `renderer.render` as a new 5th arg (the signature already has a `voices` arg at 4).

- [ ] **Step 8.2: Add `drawVoiceHighlights` to `renderer.js`**

Signature: `drawVoiceHighlights(ctx, snake, activeVoices, playingVoiceIdxs, cw, ch)`.

Compute positions per spec §5.2 table:
- Voice 0 (soprano): column of `snake.segments[0].x`
- Voice 1 (alto): row of `snake.segments[0].y`
- Voice 2 (tenor): column + row of `snake.segments[mid]` where `mid = Math.floor(segments.length / 2)`
- Voice 3 (bass): column + row of `snake.segments[segments.length - 1]`

For each active voice i, alpha = `playingVoiceIdxs.includes(i) ? 0.35 : 0.08`.
Collect unique cells (dedup by (col,row) key) before filling to implement the "cap per cell" rule from spec §10 — keep the highest alpha value per cell.

Fill color: `rgba(184, 212, 117, alpha)` (a lighter green in the LCD hue family).

- [ ] **Step 8.3: Call `drawVoiceHighlights` from `renderer.render`**

Called AFTER `fillRect` background and BEFORE `drawFoods` + `drawSnake` so the snake and food stay on top.

- [ ] **Step 8.4: Manual browser verification**

Reset snake. Let autonomous mode run until length 12. Confirm 4 columns/rows are faintly glowing on the grid, mapping to head position (col+row), midpoint (col+row), tail (col+row). Confirm the glow brightens when that voice is actively sounding (easier to see with arpPattern `cycle` at slow BPM 60).

Confirm with length 1: no highlight, since only soprano is active and the head position moves each tick (highlight does render for voice 0, but it's a single column tied to head x).

Confirm overlapping highlights (when head col + midpoint col land on same column) do not stack into brighter-than-expected cells.

- [ ] **Step 8.5: Commit**

```bash
git add js/renderer.js js/app.js
git commit -m "feat(camino-1): monochrome voice highlights on grid (B)"
```

---

## Task 9: Snake freeze / sustain (Feature I)

**Files:**
- Modify: `js/app.js` (new state, tick gate, event handlers)

**Interfaces:**
- Consumes: Tasks 1-8 (freeze gate wraps the full tick pipeline).
- Produces: `this.isFrozen` boolean, mouse/touch event handlers.

- [ ] **Step 9.1: Add state in `app.js`**

Constructor: `this.isFrozen = false;`.

- [ ] **Step 9.2: Gate `tickMusicClock`**

As the first thing inside `tickMusicClock`, `if (this.isFrozen) return;`. This skips every subsequent step. The outer rAF loop still runs so `renderer.render` is called every frame.

- [ ] **Step 9.3: Add mouse-hold and double-click handlers in `bindCanvasInteraction`**

- `mousedown` on canvas: `this.isFrozen = true;`
- `mouseup` (anywhere in window, not just canvas): `this.isFrozen = false;` — BUT only if it was the mouse-hold freeze, not the double-click toggle. Track with a separate flag `this.isFrozenByHold`.
- `dblclick` on canvas: `this.isFrozen = !this.isFrozen; this.isFrozenByHold = false;` (toggle latch).
- When `mousedown` fires: `this.isFrozen = true; this.isFrozenByHold = true;` ONLY if not already in latch mode.
- When `mouseup` fires and `isFrozenByHold`: `this.isFrozen = false;`.

- [ ] **Step 9.4: Add touch handlers for mobile**

- Long-press (`touchstart` with timer > 200ms, cancelled by `touchmove` beyond threshold): freeze while touch held.
- Double-tap (two `touchstart` events within 300ms, no significant touchmove between): toggle freeze.

- [ ] **Step 9.5: Freeze precedes muda (Review Focus #5)**

Since the freeze gate is the very first line in `tickMusicClock`, no steps run while frozen — muda cannot evaluate. Verify by manual test: enter a Classic-wall-mode run, double-tap freeze right before hitting a wall, confirm no impact sound and no muda. Unfreeze, confirm muda then fires on the first unfrozen tick that collides.

- [ ] **Step 9.6: Guard against click-hold hijacking `mouseFollow` steering**

In the `mousemove` handler, if `this.isFrozen`, do not update `this.snake.mouseTarget`. Prevents the mouse-target from drifting during a sustain hold.

- [ ] **Step 9.7: Manual browser verification**

- Click-hold on the canvas while music is playing (full-legato preset recommended, e.g. `ambientLydian`): snake stops stepping, chord sustains. Release: motion resumes.
- Double-click the canvas: snake stops indefinitely, chord sustains. Double-click again: resumes.
- Switch to game mode. Freeze, press an arrow key, release freeze: snake moves in the new direction on first unfrozen tick.
- On a mobile browser (or Chrome DevTools device toolbar), long-press and double-tap work equivalently.

- [ ] **Step 9.8: Commit**

```bash
git add js/app.js
git commit -m "feat(camino-1): snake freeze / sustain (I)"
```

---

## Final verification

- [ ] **Run full test suite:** `npm test` — all tests from Tasks 1, 2, 5 must pass.
- [ ] **Load each of the 5 presets** and verify the new fields apply correctly: `spiegel1986` (p2/contrary/halfLegato/group off/bpm2 165), `ambientLydian` (p4/parallel/fullLegato/group on/bpm2 42), `berlinArp` (p1/parallel/staccato/group off/bpm2 264), `kotoZen` (off/parallel/fullLegato/group on/bpm2 48), `acidSlither` (p8/contrary/staccato/group off/bpm2 280).
- [ ] **End-to-end flow:** reset snake, play 2 minutes auto, eat 10+ orbs, confirm growth-gated voicing + highlights + timbral modulation all cohere. Then freeze mid-play, confirm sustain. Unfreeze, continue.
- [ ] **README update:** add two paragraphs mentioning the new concepts (growth-gated voicing, MM patterns, freeze interaction). One commit: `docs(camino-1): update README with Camino 1 features`.
- [ ] **Capture mínimo:** a short screen capture (15s) or 3 screenshots showing a 1-segment snake vs 12-segment snake, with the highlights visible in the 12-seg shot. Saved to `docs/captures/2026-11-22-camino-1.{mp4|png}`. One commit: `docs(camino-1): capture of growth-gated voicing demo`.

## Merge to main

When all tasks pass:
```bash
git checkout main
git merge --no-ff camino-1-spiegel -m "Camino 1: Spiegel-first sound deepening

Merges the 9-feature Camino 1 branch:
A. Growth-gated voicing   D. MM patterns (10)      G. Group behavior
B. Voice highlights        E. Dual tempo            H. Timbral by length
C. Muda de piel            F. Articulation modes    I. Freeze / sustain

See docs/superpowers/specs/2026-11-22-spiegel-first-sound-deepening-design.md
for the design doc and docs/superpowers/plans/2026-11-22-camino-1-spiegel-first-sound-deepening.md
for the implementation plan."
git tag -a v2.0-spiegel -m "MusicSnake v2.0 — Spiegel-first sound deepening (Camino 1)"
```

Do NOT push to origin automatically. The user decides when to deploy.
