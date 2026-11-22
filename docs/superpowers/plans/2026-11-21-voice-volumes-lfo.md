# Voice Volumes + Filter LFO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add independent volume control for each of the 4 Spiegel voices (X/Y/M/T) and a filter LFO with auto (sine wave) and axis (head X→cutoff, head Y→resonance) modes.

**Architecture:** SynthEngine gains a `voiceVolumes[4]` array used at trigger time. App stores `this.normHead` on each music tick and runs LFO updates every animation frame; `tickMusicClock` delegates filter control to the LFO when it is active. UI adds two new sections to the existing settings panel.

**Tech Stack:** Vanilla JS (ES modules), Web Audio API, HTML/CSS — no new dependencies.

**Spec:** Brainstorming conversation 2026-11-21 (snakesynth session).

## Global Constraints

- Do NOT modify `js/music.js` — scales, voice mapping, Spiegel logic are frozen.
- Do NOT change how X→Soprano and Y→Alto voices are derived.
- Voice labels in UI: `X` `Y` `M` `T` (not Soprano/Alto/Tenor/Bajo).
- LFO auto mode must incorporate existing length→cutoff modulation (not fight it).
- All new UI goes inside `#settingsPanel .settings-body`, matching existing `set-row` class structure.
- Default voice volumes: 0.8 for all four voices.

## Review Focus

- LFO auto mode and `tickMusicClock` length-ratio modulation both call `setFilterCutoff` — if delegation is incomplete they fight each other and the filter stutters at BPM rate. Test: enable auto LFO, watch filter with devtools AudioParam inspector or listen for BPM-sync artifacts.
- Axis mode: `normHead` is updated at BPM rate inside `tickMusicClock`, but LFO reads it at 60fps — the value is always the last tick's head position, not truly 60fps. This is acceptable but verify no stale-value crash on first frame before any tick.
- Voice volume 0 on all four voices should produce silence, not an error or divide-by-zero in gain computation. Test: drag all sliders to 0, confirm silence; drag back up, confirm sound returns.
- Rate/depth sliders must be hidden in axis mode and shown in auto mode — test toggling mode twice to ensure no residual `display` state.
- Preset load (`applyPreset`) does not reset voice volumes or LFO state — this is intentional (volumes/LFO are performance controls, not preset parameters). Verify preset switching does not reset voice sliders.

---

### Task 1: Per-voice volumes in SynthEngine

**Files:**
- Modify: `js/audio.js`

**Interfaces:**
- Produces: `synth.voiceVolumes: number[4]`, `synth.setVoiceVolume(idx: number, val: number): void`

- [ ] **Step 1: Add `voiceVolumes` array to `SynthEngine` constructor**

  In `js/audio.js` constructor, after `this.activeVoices`, add:
  ```js
  this.voiceVolumes = [0.8, 0.8, 0.8, 0.8];
  ```

- [ ] **Step 2: Add `setVoiceVolume` method**

  ```js
  setVoiceVolume(idx, val) {
    this.voiceVolumes[idx] = Math.max(0, Math.min(1, val));
  }
  ```

- [ ] **Step 3: Apply voice volume in `triggerVoiceNote`**

  In `triggerVoiceNote` (`js/audio.js:245`), change:
  ```js
  const peakGain = (velocity * 0.22);
  ```
  to:
  ```js
  const peakGain = (velocity * 0.22) * (this.voiceVolumes[voiceIndex % 4] ?? 1.0);
  ```

- [ ] **Step 4: Verify in browser**

  Open `http://localhost:8080`, start the synth. In devtools console run:
  ```js
  snakeSynth.synth.setVoiceVolume(0, 0); // silence voice X
  ```
  Expected: Voice X (Soprano, pan left) goes silent; other 3 voices audible.
  Then `snakeSynth.synth.setVoiceVolume(0, 0.8)` — voice X returns.

- [ ] **Step 5: Commit**

  ```bash
  git add js/audio.js
  git commit -m "feat: add per-voice volume control to SynthEngine"
  ```

---

### Task 2: LFO state + filter delegation in app.js

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `synth.setFilterCutoff(hz)`, `synth.mainFilter.Q`, `snake.getNormalizedHead()` (already used in `tickMusicClock`)
- Produces: `app.lfoEnabled: bool`, `app.lfoMode: 'auto'|'axis'`, `app.lfoRate: number`, `app.lfoDepth: number`, `app.lfoPhase: number`, `app.normHead: {x,y}`, `app.currentBaseCutoff: number`

- [ ] **Step 1: Add LFO state to constructor**

  In `SnakeSynthApp` constructor, after `this.voiceStep = 0`, add:
  ```js
  this.lfoEnabled = false;
  this.lfoMode = 'auto';   // 'auto' | 'axis'
  this.lfoRate = 0.5;      // Hz
  this.lfoDepth = 0.5;     // 0–1
  this.lfoPhase = 0;
  this.lastLfoTime = 0;
  this.normHead = { x: 0.5, y: 0.5 };
  this.currentBaseCutoff = 2400;
  ```

- [ ] **Step 2: Store `normHead` and `currentBaseCutoff` in `tickMusicClock`**

  In `tickMusicClock`, the line `const normHead = this.snake.getNormalizedHead()` already exists (`app.js:629`). After it, add:
  ```js
  this.normHead = normHead;
  ```

  Then find the existing length-ratio block (lines 623–625):
  ```js
  const baseCutoff = parseInt(this.ui.sliderCutoff.value, 10);
  const lengthRatio = Math.min(2.0, 1 + (this.snake.segments.length - 4) * 0.035);
  this.synth.setFilterCutoff(Math.min(9500, baseCutoff * lengthRatio));
  ```
  Replace with:
  ```js
  const baseCutoff = parseInt(this.ui.sliderCutoff.value, 10);
  const lengthRatio = Math.min(2.0, 1 + (this.snake.segments.length - 4) * 0.035);
  this.currentBaseCutoff = Math.min(9500, baseCutoff * lengthRatio);
  if (!this.lfoEnabled) {
    this.synth.setFilterCutoff(this.currentBaseCutoff);
  }
  ```

- [ ] **Step 3: Add LFO update to the rAF loop**

  In the `loop` callback in `start()`, after `if (this.isPlaying) { ... }` block and before `this.renderer.render(...)`, add:
  ```js
  // LFO filter modulation (runs at 60fps)
  if (this.lfoEnabled && this.synth.ctx) {
    if (this.lfoMode === 'auto') {
      const dt = (timestamp - this.lastLfoTime) / 1000;
      this.lastLfoTime = timestamp;
      this.lfoPhase += this.lfoRate * dt * Math.PI * 2;
      const lfoVal = Math.sin(this.lfoPhase); // –1 to 1
      const base = this.currentBaseCutoff;
      const swing = base * this.lfoDepth * 0.6;
      this.synth.setFilterCutoff(Math.max(80, Math.min(12000, base + lfoVal * swing)));
    } else {
      // axis mode: X → cutoff, Y → resonance
      const newCutoff = 200 + this.normHead.x * 7800;
      const newRes = 0.5 + this.normHead.y * 11.5;
      this.synth.setFilterCutoff(newCutoff);
      if (this.synth.mainFilter) {
        this.synth.mainFilter.Q.setTargetAtTime(newRes, this.synth.ctx.currentTime, 0.04);
      }
    }
  }
  ```

- [ ] **Step 4: Verify in browser — auto LFO**

  In devtools console:
  ```js
  snakeSynth.lfoEnabled = true;
  snakeSynth.lfoMode = 'auto';
  snakeSynth.lfoRate = 1.0;
  snakeSynth.lfoDepth = 0.8;
  ```
  Expected: filter sweeps smoothly at ~1Hz. No BPM-sync stutter.

- [ ] **Step 5: Verify in browser — axis LFO**

  ```js
  snakeSynth.lfoMode = 'axis';
  ```
  Expected: filter cutoff and resonance follow snake head in real time. Move mouse over canvas to steer snake (auto mode) and observe filter tracking movement.

- [ ] **Step 6: Commit**

  ```bash
  git add js/app.js
  git commit -m "feat: add LFO engine with auto and axis modes to app"
  ```

---

### Task 3: UI — Voice volume sliders (X/Y/M/T)

**Files:**
- Modify: `index.html`, `js/app.js`

**Interfaces:**
- Consumes: `synth.setVoiceVolume(idx, val)` from Task 1

- [ ] **Step 1: Add voice sliders HTML**

  In `index.html`, after the `<div class="set-row">` block containing `sliderReverb` (line ~155), add:
  ```html
  <div class="set-row set-section-label">VOCES</div>

  <div class="set-row">
    <label>X <span id="valVolX" class="val">80%</span></label>
    <input type="range" id="sliderVolX" min="0" max="1" step="0.05" value="0.8">
  </div>
  <div class="set-row">
    <label>Y <span id="valVolY" class="val">80%</span></label>
    <input type="range" id="sliderVolY" min="0" max="1" step="0.05" value="0.8">
  </div>
  <div class="set-row">
    <label>M <span id="valVolM" class="val">80%</span></label>
    <input type="range" id="sliderVolM" min="0" max="1" step="0.05" value="0.8">
  </div>
  <div class="set-row">
    <label>T <span id="valVolT" class="val">80%</span></label>
    <input type="range" id="sliderVolT" min="0" max="1" step="0.05" value="0.8">
  </div>
  ```

- [ ] **Step 2: Wire sliders in `initDOMElements` and `bindEvents`**

  In `initDOMElements` (`app.js`), add to the `this.ui` object:
  ```js
  sliderVolX: document.getElementById('sliderVolX'),
  valVolX: document.getElementById('valVolX'),
  sliderVolY: document.getElementById('sliderVolY'),
  valVolY: document.getElementById('valVolY'),
  sliderVolM: document.getElementById('sliderVolM'),
  valVolM: document.getElementById('valVolM'),
  sliderVolT: document.getElementById('sliderVolT'),
  valVolT: document.getElementById('valVolT'),
  ```

  In `bindEvents`, add after the reverb slider handler:
  ```js
  [
    ['sliderVolX', 'valVolX', 0],
    ['sliderVolY', 'valVolY', 1],
    ['sliderVolM', 'valVolM', 2],
    ['sliderVolT', 'valVolT', 3],
  ].forEach(([sliderId, valId, idx]) => {
    this.ui[sliderId].addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.synth.setVoiceVolume(idx, val);
      this.ui[valId].textContent = `${Math.round(val * 100)}%`;
    });
  });
  ```

- [ ] **Step 3: Verify in browser**

  Open settings panel. Confirm 4 new sliders appear labeled X / Y / M / T. Drag X to 0 — left-panned voice silences. Drag back to 100% — returns.

- [ ] **Step 4: Commit**

  ```bash
  git add index.html js/app.js
  git commit -m "feat: add per-voice volume sliders (X/Y/M/T) to settings panel"
  ```

---

### Task 4: UI — Filter LFO controls

**Files:**
- Modify: `index.html`, `js/app.js`, `css/style.css`

**Interfaces:**
- Consumes: `app.lfoEnabled`, `app.lfoMode`, `app.lfoRate`, `app.lfoDepth` from Task 2

- [ ] **Step 1: Add LFO section HTML**

  In `index.html`, after the voice sliders block from Task 3, add:
  ```html
  <div class="set-row set-section-label">FILTER LFO</div>

  <div class="set-row">
    <label class="toggle-row">
      <input type="checkbox" id="chkLfo">
      Activar LFO
    </label>
  </div>

  <div id="lfoControls" class="hidden">
    <div class="set-row">
      <div class="btn-pair">
        <button id="btnLfoAuto" class="set-btn active">AUTO</button>
        <button id="btnLfoAxis" class="set-btn">EJE X/Y</button>
      </div>
    </div>

    <div id="lfoAutoParams">
      <div class="set-row">
        <label>Rate <span id="valLfoRate" class="val">0.5 Hz</span></label>
        <input type="range" id="sliderLfoRate" min="0.1" max="4" step="0.1" value="0.5">
      </div>
      <div class="set-row">
        <label>Depth <span id="valLfoDepth" class="val">50%</span></label>
        <input type="range" id="sliderLfoDepth" min="0" max="1" step="0.05" value="0.5">
      </div>
    </div>
  </div>
  ```

- [ ] **Step 2: Add CSS for `set-section-label`**

  In `css/style.css`, add:
  ```css
  .set-section-label {
    font-size: 0.65rem;
    letter-spacing: 0.12em;
    opacity: 0.5;
    padding-top: 0.6rem;
    pointer-events: none;
  }
  ```

- [ ] **Step 3: Wire LFO controls in `initDOMElements`**

  Add to `this.ui`:
  ```js
  chkLfo: document.getElementById('chkLfo'),
  lfoControls: document.getElementById('lfoControls'),
  btnLfoAuto: document.getElementById('btnLfoAuto'),
  btnLfoAxis: document.getElementById('btnLfoAxis'),
  lfoAutoParams: document.getElementById('lfoAutoParams'),
  sliderLfoRate: document.getElementById('sliderLfoRate'),
  valLfoRate: document.getElementById('valLfoRate'),
  sliderLfoDepth: document.getElementById('sliderLfoDepth'),
  valLfoDepth: document.getElementById('valLfoDepth'),
  ```

- [ ] **Step 4: Wire LFO events in `bindEvents`**

  ```js
  this.ui.chkLfo.addEventListener('change', (e) => {
    this.lfoEnabled = e.target.checked;
    this.ui.lfoControls.classList.toggle('hidden', !this.lfoEnabled);
    if (!this.lfoEnabled) {
      // restore manual filter control
      this.synth.setFilterCutoff(this.currentBaseCutoff);
    }
  });

  this.ui.btnLfoAuto.addEventListener('click', () => {
    this.lfoMode = 'auto';
    this.ui.btnLfoAuto.classList.add('active');
    this.ui.btnLfoAxis.classList.remove('active');
    this.ui.lfoAutoParams.classList.remove('hidden');
  });

  this.ui.btnLfoAxis.addEventListener('click', () => {
    this.lfoMode = 'axis';
    this.ui.btnLfoAxis.classList.add('active');
    this.ui.btnLfoAuto.classList.remove('active');
    this.ui.lfoAutoParams.classList.add('hidden');
  });

  this.ui.sliderLfoRate.addEventListener('input', (e) => {
    this.lfoRate = parseFloat(e.target.value);
    this.ui.valLfoRate.textContent = `${this.lfoRate.toFixed(1)} Hz`;
  });

  this.ui.sliderLfoDepth.addEventListener('input', (e) => {
    this.lfoDepth = parseFloat(e.target.value);
    this.ui.valLfoDepth.textContent = `${Math.round(this.lfoDepth * 100)}%`;
  });
  ```

- [ ] **Step 5: Verify — auto LFO UI**

  Open settings. Check "Activar LFO" → LFO controls appear. Mode defaults to AUTO, Rate and Depth sliders visible. Drag Rate to 2 Hz → filter sweeps faster. Uncheck → filter returns to static.

- [ ] **Step 6: Verify — axis LFO UI**

  Click EJE X/Y → Rate and Depth sliders hide. Move mouse across canvas in AUTO snake mode → filter cutoff tracks horizontal movement, resonance tracks vertical. No stutter.

- [ ] **Step 7: Verify — all 4 voice volumes + LFO together**

  Set X=0, Y=100%, LFO auto on at 1Hz. Confirm: left channel silent (X muted), right channel (Y) with filter sweep audible.

- [ ] **Step 8: Commit**

  ```bash
  git add index.html js/app.js css/style.css
  git commit -m "feat: add filter LFO controls (auto/axis) to settings panel"
  ```
