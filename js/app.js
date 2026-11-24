/**
 * Main Application Orchestrator
 * Connects Synth Engine, Music Systems, Snake Automata, Canvas Renderer and UI.
 */

import { MusicTheory, SCALES, TREATMENTS, NOTES, MM_PATTERNS } from './music.js';
import { SynthEngine } from './audio.js';
import { Snake } from './snake.js';
import { FoodManager } from './foods.js';
import { Renderer } from './renderer.js';
import { voiceCountForLength, computeTimbreByLength } from './growth.js';

export const PRESETS = {
  spiegel1986: {
    name: 'Music Mouse (default)',
    scale: 'pentatonicMajor',
    root: 0, // C
    treatment: 'contrary',
    waveform: 'triangle',
    bpm: 110,
    bpm2: 165,
    cutoff: 2400,
    resonance: 3.5,
    delayMix: 0.35,
    reverbMix: 0.4,
    arpPattern: 'chord',
    autoBehavior: 'harmonicSeeker',
    pattern: 'p2',
    symmetry: 'contrary',
    articulation: 'halfLegato',
    group: false
  },
  ambientLydian: {
    name: 'Lydian Dreamscape',
    scale: 'lydian',
    root: 5, // F
    treatment: 'canonDelay',
    waveform: 'sine',
    bpm: 85,
    bpm2: 42,
    cutoff: 1600,
    resonance: 2.0,
    delayMix: 0.48,
    reverbMix: 0.65,
    arpPattern: 'drone',
    autoBehavior: 'lissajous',
    pattern: 'p4',
    symmetry: 'parallel',
    articulation: 'fullLegato',
    group: true
  },
  berlinArp: {
    name: 'Berlin School Arp',
    scale: 'dorian',
    root: 9, // A
    treatment: 'parallel',
    waveform: 'sawtooth',
    bpm: 132,
    bpm2: 264,
    cutoff: 2800,
    resonance: 5.5,
    delayMix: 0.42,
    reverbMix: 0.3,
    arpPattern: 'upDown',
    autoBehavior: 'harmonicSeeker',
    pattern: 'p1',
    symmetry: 'parallel',
    articulation: 'staccato',
    group: false
  },
  kotoZen: {
    name: 'Hirajōshi Zen Garden',
    scale: 'hirajoshi',
    root: 2, // D
    treatment: 'mirror',
    waveform: 'triangle',
    bpm: 96,
    bpm2: 48,
    cutoff: 3200,
    resonance: 3.0,
    delayMix: 0.38,
    reverbMix: 0.5,
    arpPattern: 'cycle',
    autoBehavior: 'brownian',
    pattern: 'off',
    symmetry: 'parallel',
    articulation: 'fullLegato',
    group: true
  },
  acidSlither: {
    name: 'Acid Slither',
    scale: 'wholeTone',
    root: 0, // C
    treatment: 'cluster',
    waveform: 'square',
    bpm: 140,
    bpm2: 280,
    cutoff: 3800,
    resonance: 7.0,
    delayMix: 0.35,
    reverbMix: 0.25,
    arpPattern: 'random',
    autoBehavior: 'lissajous',
    pattern: 'p8',
    symmetry: 'contrary',
    articulation: 'staccato',
    group: false
  }
};

class SnakeSynthApp {
  get bpm() {
    return this.activeTempo === 1 ? this.bpm1 : this.bpm2;
  }

  constructor() {
    this.gridSize = 28;
    this.mode = 'auto'; // 'game' or 'auto'
    this.isPlaying = false;
    this.currentTreatment = 'contrary';

    // Dual tempo (Feature E — spec §5.5). Music Mouse had two tempos
    // alternable with `\`. Only one is active at a time (no polyrhythm —
    // that would belong to Camino 2/3).
    this.bpm1 = 90;
    this.bpm2Ratio = 1.5;
    this.bpm2 = Math.round(this.bpm1 * this.bpm2Ratio);
    this.activeTempo = 1;

    // MM patterns (Feature D — spec §5.4)
    this.currentPattern = 'off';
    this.currentSymmetry = 'parallel';
    this.patternStep = 0;

    // Articulation (Feature F — spec §5.6)
    this.articulation = 'halfLegato';

    // Group behavior (Feature G — spec §5.7). Pre-pattern pitch diff
    // against previousVoicePitches decides whether to retrigger.
    this.groupMode = false;
    this.previousVoicePitches = [null, null, null, null];
    this.lastPlayingVoiceIdxs = []; // consumed by Task 8's highlight renderer

    // Snake freeze / sustain (Feature I — spec §5.9). Mouse-hold for a
    // momentary freeze (like a sustain pedal), double-click for a latch.
    // Honors Spiegel's "the way to keep it silent is to just not play it."
    this.isFrozen = false;
    this.isFrozenByHold = false;

    // Transient boost multipliers applied by food powerups on top of the
    // length-driven timbre modulation (reviewer A3). Default 1 = no boost.
    this.foodBoost = { cutoff: 1, reverb: 1 };
    this.lfoActive = false;

    // Components
    this.music = new MusicTheory(0, 'pentatonicMajor', 2, 4);
    this.synth = new SynthEngine();
    this.snake = new Snake(this.gridSize, this.gridSize);
    this.foodManager = new FoodManager(this.gridSize, this.gridSize);

    this.mutateOnEat = false;
    this.isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (this.isMobile) document.body.classList.add('mobile');

    this.canvas = document.getElementById('musicCanvas');
    this.renderer = new Renderer(this.canvas);

    // Timing
    this.lastStepTime = 0;
    this.currentVoices = [];
    this.voiceStep = 0;

    // UI elements
    this.initDOMElements();
    this.bindEvents();
    this.applyPreset('spiegel1986');
  }

  initDOMElements() {
    this.ui = {
      startOverlay: document.getElementById('startOverlay'),
      btnStart: document.getElementById('btnStart'),
      btnPlayPause: document.getElementById('btnPlayPause'),
      btnReset: document.getElementById('btnReset'),
      btnModeToggle: document.getElementById('btnModeToggle'),
      btnMute: document.getElementById('btnMute'),
      btnAbout: document.getElementById('btnAbout'),
      aboutOverlay: document.getElementById('aboutOverlay'),
      btnCloseAbout: document.getElementById('btnCloseAbout'),
      btnSettings: document.getElementById('btnSettings'),
      btnCloseSettings: document.getElementById('btnCloseSettings'),
      settingsPanel: document.getElementById('settingsPanel'),

      selGrid: document.getElementById('selGrid'),
      selScale: document.getElementById('selScale'),
      selRoot: document.getElementById('selRoot'),
      selTreatment: document.getElementById('selTreatment'),
      selPattern: document.getElementById('selPattern'),
      selSymmetry: document.getElementById('selSymmetry'),
      selArticulation: document.getElementById('selArticulation'),
      chkGroup: document.getElementById('chkGroup'),
      selFoodBank: document.getElementById('selFoodBank'),
      sliderFoodVol: document.getElementById('sliderFoodVol'),
      valFoodVol: document.getElementById('valFoodVol'),
      selWaveform: document.getElementById('selWaveform'),
      selArpPattern: document.getElementById('selArpPattern'),
      selAutoBehavior: document.getElementById('selAutoBehavior'),
      selWallMode: document.getElementById('selWallMode'),
      selPreset: document.getElementById('selPreset'),

      sliderBpm1: document.getElementById('sliderBpm1'),
      valBpm1: document.getElementById('valBpm1'),
      sliderBpm2: document.getElementById('sliderBpm2'),
      valBpm2: document.getElementById('valBpm2'),
      btnTempoToggle: document.getElementById('btnTempoToggle'),
      sliderCutoff: document.getElementById('sliderCutoff'),
      valCutoff: document.getElementById('valCutoff'),
      sliderRes: document.getElementById('sliderRes'),
      valRes: document.getElementById('valRes'),
      btnLFO: document.getElementById('btnLFO'),
      sliderDelay: document.getElementById('sliderDelay'),
      valDelay: document.getElementById('valDelay'),
      sliderReverb: document.getElementById('sliderReverb'),
      valReverb: document.getElementById('valReverb'),

      readoutMode: document.getElementById('readoutMode'),
      readoutTreatment: document.getElementById('readoutTreatment'),
      readoutScale: document.getElementById('readoutScale'),
      readoutScore: document.getElementById('readoutScore'),
      readoutLength: document.getElementById('readoutLength'),
      chkMutate: document.getElementById('chkMutate'),
      midiStatus: document.getElementById('midiStatus')
    };

    // Populate Scale Options
    this.ui.selScale.innerHTML = Object.entries(SCALES)
      .map(([k, s]) => `<option value="${k}">${s.name}</option>`)
      .join('');

    // Populate Root Notes
    this.ui.selRoot.innerHTML = NOTES.map((n, i) => `<option value="${i}">${n}</option>`).join('');

    // Populate Treatments
    this.ui.selTreatment.innerHTML = Object.entries(TREATMENTS)
      .map(([k, t]) => `<option value="${k}">${t.name}</option>`)
      .join('');

    // Populate MM Patterns (Feature D)
    this.ui.selPattern.innerHTML = Object.entries(MM_PATTERNS)
      .map(([k, p]) => `<option value="${k}">${p.label}</option>`)
      .join('');

    // Populate Presets
    this.ui.selPreset.innerHTML = Object.entries(PRESETS)
      .map(([k, p]) => `<option value="${k}">${p.name}</option>`)
      .join('');
  }

  bindEvents() {
    // Window Resize
    window.addEventListener('resize', () => {
      this.renderer.resize();
    });

    // Start Overlay
    this.ui.btnStart.addEventListener('click', async () => {
      await this.synth.init();
      this.ui.startOverlay.classList.add('hidden');
      this.isPlaying = true;
      if (this.ui.btnPlayPause) {
        this.ui.btnPlayPause.textContent = '⏸ PAUSE';
        this.ui.btnPlayPause.classList.add('active');
      }
      this.notify('SnakeSynth Initialized. Laurie Spiegel Mode Active.');
      this.checkMidiUI();
    });

    // Play / Pause
    if (this.ui.btnPlayPause) {
      this.ui.btnPlayPause.addEventListener('click', async () => {
        await this.synth.init();
        const wasPlaying = this.isPlaying;
        this.isPlaying = !this.isPlaying;
        this.ui.btnPlayPause.textContent = this.isPlaying ? '⏸ PAUSE' : '▶ PLAY';
        this.ui.btnPlayPause.classList.toggle('active', this.isPlaying);
        // I3 fix: stopping playback must release live fullLegato voices,
        // otherwise their oscillators keep running silenced (up to the
        // 60 s safety stop) and any external MIDI Note Off never fires
        // because no tick comes to retrigger the slot.
        if (wasPlaying && !this.isPlaying) {
          this.synth.releaseAllVoices(0.12);
        }
      });
    }

    // Reset Snake
    this.ui.btnReset.addEventListener('click', () => {
      this.snake.reset();
      this._flushTransient({ clearFreeze: true });
      this.foodManager.spawnInitialFoods(this.snake.segments);
      this.notify('Snake and Harmonic Matrix Reset');
    });

    // Mode Toggle
    this.ui.btnModeToggle.addEventListener('click', () => {
      this.setAppMode(this.mode === 'auto' ? 'game' : 'auto');
    });

    // Mute
    this.ui.btnMute.addEventListener('click', () => {
      const isMuted = !this.synth.isMuted;
      this.synth.setMute(isMuted);
      this.ui.btnMute.classList.toggle('muted', isMuted);
    });

    // About modal
    if (this.ui.btnAbout) {
      this.ui.btnAbout.addEventListener('click', () => {
        this.ui.aboutOverlay.classList.remove('hidden');
      });
    }
    if (this.ui.btnCloseAbout) {
      this.ui.btnCloseAbout.addEventListener('click', () => {
        this.ui.aboutOverlay.classList.add('hidden');
      });
    }

    // Settings panel toggle — shift canvas so it doesn't overlap
    if (this.ui.btnSettings) {
      this.ui.btnSettings.addEventListener('click', () => {
        const isHidden = this.ui.settingsPanel.classList.toggle('hidden');
        document.body.classList.toggle('settings-open', !isHidden);
      });
    }
    if (this.ui.btnCloseSettings) {
      this.ui.btnCloseSettings.addEventListener('click', () => {
        this.ui.settingsPanel.classList.add('hidden');
        document.body.classList.remove('settings-open');
      });
    }

    // Mutate toggle
    if (this.ui.chkMutate) {
      this.ui.chkMutate.checked = this.mutateOnEat;
      this.ui.chkMutate.addEventListener('change', (e) => {
        this.mutateOnEat = e.target.checked;
      });
    }

    // Grid size
    if (this.ui.selGrid) {
      this.ui.selGrid.addEventListener('change', (e) => {
        const n = parseInt(e.target.value, 10);
        this.gridSize = n;
        this.snake.setGridSize(n, n);
        this.snake.reset();
        this.foodManager.setGridSize(n, n);
        this._flushTransient({ clearFreeze: true });
        this.foodManager.spawnInitialFoods(this.snake.segments);
      });
    }

    // Preset Selection
    this.ui.selPreset.addEventListener('change', (e) => {
      this.applyPreset(e.target.value);
    });

    // Musical Selectors
    this.ui.selScale.addEventListener('change', (e) => {
      // Flush voices + previousVoicePitches so group mode retriggers on
      // the first post-swap tick (reviewer A5) and legato voices don't
      // keep ringing at the old scale (Review Focus #2).
      this._flushTransient();
      this.music.setScale(e.target.value);
      this.updateStatusReadouts();
      this.notify(`Scale changed to ${SCALES[e.target.value].name}`);
    });

    this.ui.selRoot.addEventListener('change', (e) => {
      this._flushTransient();
      this.music.setRoot(parseInt(e.target.value, 10));
      this.updateStatusReadouts();
      this.notify(`Root set to ${NOTES[e.target.value]}`);
    });

    this.ui.selTreatment.addEventListener('change', (e) => {
      // Treatment change previously left legato voices and the voice-diff
      // state behind (reviewer A5).
      this._flushTransient();
      this.currentTreatment = e.target.value;
      this.updateStatusReadouts();
      this.notify(`Treatment: ${TREATMENTS[e.target.value].name}`);
    });

    this.ui.selPattern.addEventListener('change', (e) => {
      this.currentPattern = e.target.value;
      this.patternStep = 0; // restart cycle so a new pattern is heard from its first delta
      this.notify(`Pattern: ${MM_PATTERNS[e.target.value]?.label ?? e.target.value}`);
    });

    this.ui.selSymmetry.addEventListener('change', (e) => {
      this.currentSymmetry = e.target.value;
    });

    this.ui.selArticulation.addEventListener('change', (e) => {
      this.articulation = e.target.value;
      // Switching away from fullLegato lets lingering oscillators fade out
      // instead of hanging indefinitely.
      if (this.articulation !== 'fullLegato') {
        this.synth.releaseAllVoices(0.12);
      }
    });

    this.ui.chkGroup.addEventListener('change', (e) => {
      this.groupMode = e.target.checked;
    });

    this.ui.selFoodBank.addEventListener('change', (e) => {
      this.synth.setFoodBank(e.target.value);
    });

    this.ui.sliderFoodVol.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      this.synth.setFoodVolume(v);
      this.ui.valFoodVol.textContent = `${Math.round(v * 100)}%`;
    });

    this.ui.selWaveform.addEventListener('change', (e) => {
      this.synth.setWaveform(e.target.value);
    });

    this.ui.selArpPattern.addEventListener('change', (e) => {
      this.synth.arpPattern = e.target.value;
    });

    this.ui.selAutoBehavior.addEventListener('change', (e) => {
      this.snake.autoBehavior = e.target.value;
    });

    this.ui.selWallMode.addEventListener('change', (e) => {
      this.snake.wallMode = e.target.value;
      this.notify(`Wall Mode: ${e.target.value.toUpperCase()}`);
    });

    // Slider Controls
    this.ui.sliderBpm1.addEventListener('input', (e) => {
      this.bpm1 = parseInt(e.target.value, 10);
      this.ui.valBpm1.textContent = `${this.bpm1} BPM`;
      this.bpm2 = Math.round(this.bpm1 * this.bpm2Ratio);
      this.synth.setLFOFreq(this.bpm);
    });

    this.ui.sliderBpm2.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      this.bpm2Ratio = Math.pow(2, v * 2);
      this.bpm2 = Math.round(this.bpm1 * this.bpm2Ratio);
      this.ui.valBpm2.textContent = this.bpm2Ratio >= 1
        ? `×${this.bpm2Ratio.toFixed(2).replace(/\.?0+$/, '')}`
        : `÷${(1 / this.bpm2Ratio).toFixed(2).replace(/\.?0+$/, '')}`;
      this.synth.setLFOFreq(this.bpm);
    });

    this.ui.btnTempoToggle.addEventListener('click', () => {
      this.setActiveTempo(this.activeTempo === 1 ? 2 : 1);
    });

    this.ui.btnLFO.addEventListener('click', () => {
      this.lfoActive = !this.lfoActive;
      this.ui.btnLFO.classList.toggle('active', this.lfoActive);
      const baseCutoff = parseInt(this.ui.sliderCutoff.value, 10);
      this.synth.setLFOActive(this.lfoActive, this.bpm, baseCutoff);
      if (!this.lfoActive) {
        const res = parseFloat(this.ui.sliderRes.value);
        this.synth.mainFilter.Q.setTargetAtTime(res, this.synth.ctx.currentTime, 0.3);
      }
    });

    this.ui.sliderCutoff.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.synth.setFilterCutoff(val);
      this.ui.valCutoff.textContent = `${val} Hz`;
    });

    this.ui.sliderRes.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.synth.filterResonance = val;
      if (this.synth.mainFilter) {
        this.synth.mainFilter.Q.setTargetAtTime(val, this.synth.ctx.currentTime, 0.05);
      }
      this.ui.valRes.textContent = val.toFixed(1);
    });

    this.ui.sliderDelay.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.synth.setDelayParams(0.35, val, val * 0.7);
      this.ui.valDelay.textContent = `${Math.round(val * 100)}%`;
    });

    this.ui.sliderReverb.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.synth.setReverbMix(val);
      this.ui.valReverb.textContent = `${Math.round(val * 100)}%`;
    });

    // Keyboard Shortcuts (Inspired by Laurie Spiegel's original keyboard control system)
    window.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });

    // Canvas Mouse & Touch controls
    this.bindCanvasInteraction();
  }

  bindCanvasInteraction() {
    // Mouse (desktop)
    const handleMouseCoord = (clientX, clientY) => {
      // Feature I: during freeze, stop updating mouseTarget so a held
      // sustain does not drift the snake in auto mode on next unfreeze.
      if (this.isFrozen) return;
      const rect = this.canvas.getBoundingClientRect();
      const nx = Math.max(0, Math.min(0.999, (clientX - rect.left) / rect.width));
      const ny = Math.max(0, Math.min(0.999, (clientY - rect.top) / rect.height));
      const targetGridX = Math.floor(nx * this.gridSize);
      const targetGridY = Math.floor(ny * this.gridSize);
      if (this.mode === 'auto') {
        this.snake.mouseTarget = { x: targetGridX, y: targetGridY };
      } else {
        this.snake.steerTowards(this.snake.getHead(), { x: targetGridX, y: targetGridY });
      }
    };

    this.canvas.addEventListener('mousemove', (e) => handleMouseCoord(e.clientX, e.clientY));
    this.canvas.addEventListener('mouseleave', () => { this.snake.mouseTarget = null; });

    // Feature I: mouse-hold = momentary freeze (sustain pedal).
    // Only engages if not already frozen (latch mode via dblclick wins).
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // left click only
      if (!this.isFrozen) {
        this.isFrozen = true;
        this.isFrozenByHold = true;
      }
    });

    // Release on mouseup ANYWHERE (not just canvas) so the user can drag
    // off the canvas without getting stuck frozen.
    window.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return;
      if (this.isFrozenByHold) {
        this.isFrozen = false;
        this.isFrozenByHold = false;
      }
    });

    // Reviewer G6: if the browser swallows the mouseup (window blur, tab
    // switch, alt-tab), release the hold-freeze so the snake doesn't end
    // up silently stuck. Latch-freeze (double-click) survives, as intended.
    window.addEventListener('blur', () => {
      if (this.isFrozenByHold) {
        this.isFrozen = false;
        this.isFrozenByHold = false;
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.isFrozenByHold) {
        this.isFrozen = false;
        this.isFrozenByHold = false;
      }
    });

    // Feature I: double-click = toggle latch freeze.
    this.canvas.addEventListener('dblclick', (e) => {
      e.preventDefault();
      this.isFrozen = !this.isFrozen;
      this.isFrozenByHold = false;
    });

    // Touch (mobile) — swipe angle → dirección cardinal
    let touchStart = null;
    // Freeze-via-touch state
    let longPressTimer = null;
    let lastTapTs = 0;
    let freezeByTouchHold = false;
    const LONG_PRESS_MS = 220;
    const DOUBLE_TAP_MS = 320;
    const TOUCH_MOVE_THRESHOLD = 14;

    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }

      // Feature I: double-tap = toggle latch freeze.
      const now = Date.now();
      if (now - lastTapTs < DOUBLE_TAP_MS) {
        this.isFrozen = !this.isFrozen;
        this.isFrozenByHold = false;
        lastTapTs = 0;
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
        return;
      }
      lastTapTs = now;

      // Feature I: long-press = freeze while held.
      if (longPressTimer) clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        if (!this.isFrozen) {
          this.isFrozen = true;
          this.isFrozenByHold = true;
          freezeByTouchHold = true;
        }
        longPressTimer = null;
      }, LONG_PRESS_MS);
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (!touchStart || e.touches.length === 0) return;
      const dx = e.touches[0].clientX - touchStart.x;
      const dy = e.touches[0].clientY - touchStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Significant finger movement cancels the pending long-press
      // (Feature I) so a swipe does not accidentally freeze.
      if (dist > TOUCH_MOVE_THRESHOLD && longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      // Reviewer G3: while frozen the finger drag must NOT retarget the
      // snake, otherwise the sustain-pedal pre-aims the víbora in mobile.
      if (this.isFrozen) return;
      if (dist < 18) return; // umbral mínimo de swipe

      if (this.mode === 'auto') {
        // en auto: guía con posición del dedo
        const rect = this.canvas.getBoundingClientRect();
        const nx = Math.max(0, Math.min(0.999, (e.touches[0].clientX - rect.left) / rect.width));
        const ny = Math.max(0, Math.min(0.999, (e.touches[0].clientY - rect.top) / rect.height));
        this.snake.mouseTarget = {
          x: Math.floor(nx * this.gridSize),
          y: Math.floor(ny * this.gridSize)
        };
      } else {
        // en juego: swipe → dirección cardinal
        const angle = (Math.atan2(dy, dx) / Math.PI * 180 + 360) % 360;
        if (angle >= 45 && angle < 135)       this.snake.setDirection(0,  1);  // abajo
        else if (angle >= 135 && angle < 225) this.snake.setDirection(-1, 0);  // izquierda
        else if (angle >= 225 && angle < 315) this.snake.setDirection(0, -1);  // arriba
        else                                   this.snake.setDirection(1,  0);  // derecha
        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }, { passive: true });

    this.canvas.addEventListener('touchend', () => {
      touchStart = null;
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      // Release the long-press freeze on finger lift.
      if (freezeByTouchHold) {
        this.isFrozen = false;
        this.isFrozenByHold = false;
        freezeByTouchHold = false;
      }
    });
  }

  handleKeyDown(e) {
    // Ignore input if user is focusing a select or slider
    if (['INPUT', 'SELECT'].includes(document.activeElement.tagName)) return;

    switch (e.key) {
      // Snake Direction Controls
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        this.snake.setDirection(0, -1);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        this.snake.setDirection(0, 1);
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        this.snake.setDirection(-1, 0);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        this.snake.setDirection(1, 0);
        break;

      // Play / Pause
      case ' ':
        e.preventDefault();
        this.ui.btnPlayPause.click();
        break;

      // Tempo toggle — Tab swaps between BPM 1 and BPM 2 live.
      case 'Tab':
        e.preventDefault();
        this.setActiveTempo(this.activeTempo === 1 ? 2 : 1);
        break;

      // Mute Toggle
      case 'm':
      case 'M':
        this.ui.btnMute.click();
        break;

      // Spiegel Treatment Hotkeys (Q, W, E, R, T)
      case 'q':
      case 'Q':
        this.setTreatment('contrary');
        break;
      case 'e':
      case 'E':
        this.setTreatment('parallel');
        break;
      case 'r':
      case 'R':
        this.setTreatment('mirror');
        break;
      case 't':
      case 'T':
        this.setTreatment('cluster');
        break;
      case 'y':
      case 'Y':
        this.setTreatment('canonDelay');
        break;

      // Scale Hotkeys (1-8)
      case '1': this.setScaleByKey('pentatonicMajor'); break;
      case '2': this.setScaleByKey('pentatonicMinor'); break;
      case '3': this.setScaleByKey('dorian'); break;
      case '4': this.setScaleByKey('lydian'); break;
      case '5': this.setScaleByKey('mixolydian'); break;
      case '6': this.setScaleByKey('hirajoshi'); break;
      case '7': this.setScaleByKey('wholeTone'); break;
      case '8': this.setScaleByKey('blues'); break;
    }
  }

  /**
   * Flush per-tick accumulators and release stuck audio on any transition
   * that invalidates the current musical state (Reset, mode switch, grid
   * resize, preset load, scale/root/treatment change). Centralizes the
   * hygiene both reviewers flagged.
   */
  _flushTransient({ clearFreeze = false } = {}) {
    this.synth.releaseAllVoices(0.12);
    this.voiceStep = 0;
    this.patternStep = 0;
    this.previousVoicePitches = [null, null, null, null];
    this.lastPlayingVoiceIdxs = [];
    if (clearFreeze) {
      this.isFrozen = false;
      this.isFrozenByHold = false;
    }
  }

  setActiveTempo(which) {
    if (which !== 1 && which !== 2) return;
    this.activeTempo = which;
    if (this.ui.btnTempoToggle) {
      this.ui.btnTempoToggle.textContent = `Tempo ${which} (Tab)`;
    }
    this.synth.setLFOFreq(this.bpm);
  }

  setAppMode(newMode) {
    this.mode = newMode;
    if (this.ui.btnModeToggle) {
      this.ui.btnModeToggle.textContent = this.mode === 'auto' ? 'AUTO' : 'JUEGO';
    }

    // Game mode: the víbora cannot pass through its own body. Auto mode:
    // free to coil over itself unless wallMode happens to be classic.
    this.snake.killOnSelf = (this.mode === 'game');

    // Reviewer G2: any mode switch needs the same hygiene as Reset so a
    // latch-frozen user doesn't end up silent on the fresh snake and no
    // fullLegato voice drones across the transition.
    this._flushTransient({ clearFreeze: true });

    if (this.mode === 'game') {
      this.snake.reset();
      this.foodManager.spawnInitialFoods(this.snake.segments);
      this.notify('MODO JUEGO — Flechas / WASD');
    } else {
      this.notify('MODO AUTO');
    }
    this.updateStatusReadouts();
  }

  setTreatment(treatmentKey) {
    if (TREATMENTS[treatmentKey]) {
      this.currentTreatment = treatmentKey;
      this.ui.selTreatment.value = treatmentKey;
      this.updateStatusReadouts();
      this.notify(`Voicing: ${TREATMENTS[treatmentKey].name}`);
    }
  }

  setScaleByKey(scaleKey) {
    if (SCALES[scaleKey]) {
      this.synth.releaseAllVoices(0.15); // Review Focus #2
      this.music.setScale(scaleKey);
      this.ui.selScale.value = scaleKey;
      this.updateStatusReadouts();
      this.notify(`Scale: ${SCALES[scaleKey].name}`);
    }
  }

  applyPreset(presetKey) {
    const p = PRESETS[presetKey];
    if (!p) return;

    // Reviewer G5: release stuck voices + reset accumulators before the
    // new scale/root/waveform take effect, so legato tails don't bleed
    // across preset swaps and the first post-preset tick retriggers cleanly.
    this._flushTransient();

    this.music.setScale(p.scale);
    this.music.setRoot(p.root);
    this.currentTreatment = p.treatment;
    this.synth.setWaveform(p.waveform);
    this.synth.arpPattern = p.arpPattern;
    // Review Focus #4: ?? fallback — a preset without bpm (legacy) or bpm2
    // (not yet migrated) keeps the current value rather than becoming undefined.
    this.bpm1 = p.bpm ?? p.bpm1 ?? this.bpm1;
    if (p.bpm2 != null) {
      this.bpm2Ratio = p.bpm2 / this.bpm1;
      this.bpm2 = p.bpm2;
    }
    this.currentPattern = p.pattern ?? this.currentPattern;
    this.currentSymmetry = p.symmetry ?? this.currentSymmetry;
    this.patternStep = 0;
    this.articulation = p.articulation ?? this.articulation;
    this.groupMode = p.group ?? this.groupMode;
    this.previousVoicePitches = [null, null, null, null];
    this.snake.autoBehavior = p.autoBehavior;

    // Sliders
    this.synth.setFilterCutoff(p.cutoff);
    this.synth.filterResonance = p.resonance;
    this.synth.setDelayParams(0.35, p.delayMix, p.delayMix * 0.7);
    this.synth.setReverbMix(p.reverbMix);

    // Sync UI
    this.ui.selPreset.value = presetKey;
    this.ui.selScale.value = p.scale;
    this.ui.selRoot.value = p.root;
    this.ui.selTreatment.value = p.treatment;
    this.ui.selPattern.value = this.currentPattern;
    this.ui.selSymmetry.value = this.currentSymmetry;
    this.ui.selArticulation.value = this.articulation;
    this.ui.chkGroup.checked = this.groupMode;
    this.ui.selWaveform.value = p.waveform;
    this.ui.selArpPattern.value = p.arpPattern;
    this.ui.selAutoBehavior.value = p.autoBehavior;

    this.ui.sliderBpm1.value = this.bpm1;
    this.ui.valBpm1.textContent = `${this.bpm1} BPM`;
    this.ui.sliderBpm2.value = Math.log2(this.bpm2Ratio) / 2;
    this.ui.valBpm2.textContent = this.bpm2Ratio >= 1
      ? `×${this.bpm2Ratio.toFixed(2).replace(/\.?0+$/, '')}`
      : `÷${(1 / this.bpm2Ratio).toFixed(2).replace(/\.?0+$/, '')}`;
    this.ui.sliderCutoff.value = p.cutoff;
    this.ui.valCutoff.textContent = `${p.cutoff} Hz`;
    this.ui.sliderRes.value = p.resonance;
    this.ui.valRes.textContent = p.resonance.toFixed(1);
    this.ui.sliderDelay.value = p.delayMix;
    this.ui.valDelay.textContent = `${Math.round(p.delayMix * 100)}%`;
    this.ui.sliderReverb.value = p.reverbMix;
    this.ui.valReverb.textContent = `${Math.round(p.reverbMix * 100)}%`;

    this.updateStatusReadouts();
    this.notify(`Preset Loaded: ${p.name}`);
  }

  checkMidiUI() {
    if (this.synth.midiEnabled && this.synth.midiOutput) {
      this.ui.midiStatus.textContent = `MIDI OUT: ${this.synth.midiOutput.name}`;
      this.ui.midiStatus.classList.add('online');
    }
  }

  updateStatusReadouts() {
    if (this.ui.readoutMode) this.ui.readoutMode.textContent = this.mode.toUpperCase();
    if (this.ui.readoutTreatment) this.ui.readoutTreatment.textContent = TREATMENTS[this.currentTreatment]?.name || this.currentTreatment;
    if (this.ui.readoutScale) this.ui.readoutScale.textContent = `${NOTES[this.music.rootNote]} ${SCALES[this.music.scaleKey]?.name}`;
    if (this.ui.readoutScore) this.ui.readoutScore.textContent = String(this.snake.score).padStart(4, '0');
    if (this.ui.readoutLength) this.ui.readoutLength.textContent = `L:${this.snake.segments.length}`;
  }

  notify(msg) {
    // silenced
  }

  /**
   * Called on every music tick (tempo-based clock)
   */
  tickMusicClock() {
    // Feature I: freeze gate. While frozen, every tick step is skipped —
    // no snake advance, no voice derivation, no retriggers, no muda
    // evaluation (Review Focus #5). Full-legato oscillators sustain
    // naturally; non-legato notes decay silent on their own schedules.
    // The outer rAF loop still runs so renderer.render keeps updating.
    if (this.isFrozen) return;

    // 1. Advance Snake in Auto Mode or Game Mode
    if (this.mode === 'auto') {
      this.snake.updateAutonomousSteering(this.foodManager.foods);
    }

    const { hitBoundary, hitSelf } = this.snake.step();

    // Muda de piel (Feature C — spec §5.3):
    // En modo classic, cualquier colisión (pared o propia cola) replega
    // la víbora a 1 segmento sin pausar el audio. La víbora vuelve al
    // punto de arranque — una sola voz humana (soprano) — como el
    // "silencio restaurado" que Spiegel describía en 1986 ("the way to
    // keep it silent is to just not play it"). La música sigue, la
    // víbora re-crece.
    if (this.snake.isDead) {
      this.synth.triggerImpactSound();
      if (this.mode === 'game') {
        // Game mode: full restart (Snake-style Game Over). Víbora vuelve
        // al centro con 1 segmento, score a 0, dirección reinicializada.
        const cx = Math.floor(this.snake.gridCols / 2);
        const cy = Math.floor(this.snake.gridRows / 2);
        this.snake.segments = [{ x: cx, y: cy }];
        this.snake.direction = { x: 1, y: 0 };
        this.snake.nextDirection = { x: 1, y: 0 };
        this.snake.score = 0;
        this.snake.growthQueue = 0;
        // Reviewer G4: pass snake segments so food never spawns on the
        // reset position, which would otherwise cause an instant invisible
        // consume on the next tick.
        this.foodManager.spawnInitialFoods(this.snake.segments);
      } else {
        // Auto mode: muda de piel — shed to 1 segment at the last valid
        // position without resetting score or respawning orbs.
        this.snake.segments = this.snake.segments.slice(0, 1);
        this.snake.growthQueue = 0;
      }
      this.snake.isDead = false;
      // Feature F: release hanging full-legato oscillators on voices
      // 2/3/4 so they do not drone through the repli­egue.
      this.synth.releaseVoice(1, 0.2);
      this.synth.releaseVoice(2, 0.2);
      this.synth.releaseVoice(3, 0.2);
    } else if (hitBoundary) {
      // Rebote o wrap — impacto sonoro pero sin muda.
      this.synth.triggerImpactSound();
    }

    // 2. Check Food Consumption
    const head = this.snake.getHead();
    const consumed = this.foodManager.consumeAt(head.x, head.y, this.snake.segments);
    if (consumed) {
      this.handleFoodConsumed(consumed);
    }

    // 3. Timbral modulation by length (Feature H — spec §5.8).
    // Food powerup multipliers layer on top so filter/echo orbs actually
    // produce an audible boost without being clobbered by the next tick
    // (reviewer A3).
    const baseCutoff = parseInt(this.ui.sliderCutoff.value, 10);
    const baseReverb = parseFloat(this.ui.sliderReverb.value);
    const baseDelayFb = parseFloat(this.ui.sliderDelay.value);
    const timbre = computeTimbreByLength(this.snake.segments.length, baseCutoff, baseReverb, baseDelayFb);
    if (!this.lfoActive) {
      this.synth.setFilterCutoff(Math.min(9500, timbre.cutoff * this.foodBoost.cutoff));
    }
    this.synth.setReverbMix(Math.min(0.95, timbre.reverb * this.foodBoost.reverb));
    // delay time stays at user-set 0.35 (per spec §5.8 — only feedback modulates by length)
    this.synth.setDelayParams(0.35, timbre.delay, timbre.delay * 0.7);

    // 4. Derive Laurie Spiegel Voices from Snake Geometry (growth-gated — Feature A)
    const normHead = this.snake.getNormalizedHead();
    const normHistory = this.snake.getNormalizedSegments();
    const activeVoiceCount = voiceCountForLength(this.snake.segments.length);
    const rawVoices = this.music.getVoices(normHead, normHistory, this.currentTreatment, activeVoiceCount);

    // 4b. Compute pre-pattern pitch diff (Feature G — spec §5.7).
    // Group semantics key off whether the snake's geometry moved, not
    // whether the pattern's rotating delta cycled, so the diff must
    // compare the pre-pattern pitches.
    const rawPitches = rawVoices.map(v => v?.note?.midi ?? null);
    const changedMask = rawPitches.map((p, i) => p !== (this.previousVoicePitches[i] ?? null));

    // 4c. Apply Music Mouse pattern as scale-degree delta (Feature D — spec §5.4)
    this.currentVoices = this.music.applyPattern(
      rawVoices,
      this.currentPattern,
      this.patternStep,
      this.currentSymmetry
    );

    // 4d. Advance pattern step for next tick
    this.patternStep++;

    // 4e. Trigger Synth Note(s) based on Group + Arpeggio Pattern + changedMask
    this.triggerVoiceArpeggio(this.currentVoices, changedMask);

    // 4f. Save pre-pattern pitches for next tick's diff.
    this.previousVoicePitches = rawPitches;

    // 5. Add visual sound ripple at head position
    const cellW = this.canvas.width / (this.gridSize * (window.devicePixelRatio || 1));
    const cellH = this.canvas.height / (this.gridSize * (window.devicePixelRatio || 1));
    this.renderer.addRipple(
      (head.x + 0.5) * cellW,
      (head.y + 0.5) * cellH,
      consumed ? consumed.color : '#00ffcc'
    );

    this.updateStatusReadouts();
  }

  handleFoodConsumed(food) {
    this.snake.grow(1);
    this.synth.triggerFoodSound(food.type);

    if (!this.mutateOnEat) return; // no parameter changes

    switch (food.type) {
      case 'scale': {
        const keys = Object.keys(SCALES);
        const nextScale = keys[(keys.indexOf(this.music.scaleKey) + 1) % keys.length];
        this.setScaleByKey(nextScale);
        break;
      }
      case 'chord': {
        const treats = Object.keys(TREATMENTS);
        const nextTreat = treats[(treats.indexOf(this.currentTreatment) + 1) % treats.length];
        this.setTreatment(nextTreat);
        break;
      }
      case 'filter': {
        // Multiplicative boost so tickMusicClock's length modulation
        // doesn't clobber it (reviewer A3).
        this.foodBoost.cutoff = 2.2;
        setTimeout(() => { this.foodBoost.cutoff = 1; }, 700);
        break;
      }
      case 'echo': {
        this.foodBoost.reverb = 1.8;
        setTimeout(() => { this.foodBoost.reverb = 1; }, 1800);
        break;
      }
    }
  }

  triggerVoiceArpeggio(voices, changedMask = []) {
    if (!voices || voices.length === 0) {
      this.lastPlayingVoiceIdxs = [];
      return;
    }

    const pattern = this.synth.arpPattern;
    const dur = 60 / this.bpm * 0.8;
    const played = [];

    // Feature G: Group mode retriggers ALL active voices on any change,
    // emits silence otherwise. Spiegel's "Group" from MM (PDF pág 6).
    if (this.groupMode) {
      const anyChanged = changedMask.some(Boolean);
      if (!anyChanged) {
        this.lastPlayingVoiceIdxs = [];
        return;
      }
      voices.forEach((v, idx) => {
        if (!v.note) return;
        this.synth.triggerVoiceNote(v.note.freq, idx, dur * 1.5, 0.7, this.articulation);
        played.push(idx);
      });
      this.lastPlayingVoiceIdxs = played;
      return;
    }

    if (pattern === 'chord' || pattern === 'drone') {
      // Pitch-change gate (spec §5.7): in group-OFF + chord/drone, each
      // voice retriggers only when its own pitch moves.
      voices.forEach((v, idx) => {
        if (!v.note || !changedMask[idx]) return;
        this.synth.triggerVoiceNote(v.note.freq, idx, dur * 1.5, 0.7, this.articulation);
        played.push(idx);
      });
    } else if (pattern === 'upDown') {
      // Voices cycle up and back, truncated to active voice count.
      // cycle/upDown/random ignore the pitch-change gate — they drive the
      // rhythm themselves, not the snake's movement.
      const fullOrder = [0, 1, 2, 3, 2, 1];
      const order = fullOrder.filter(i => i < voices.length);
      if (order.length > 0) {
        const idx = order[this.voiceStep % order.length];
        const v = voices[idx];
        if (v && v.note) {
          this.synth.triggerVoiceNote(v.note.freq, idx, dur, 0.85, this.articulation);
          played.push(idx);
        }
        this.voiceStep++;
      }
    } else if (pattern === 'random') {
      const idx = Math.floor(Math.random() * voices.length);
      const v = voices[idx];
      if (v && v.note) {
        this.synth.triggerVoiceNote(v.note.freq, idx, dur, 0.85, this.articulation);
        played.push(idx);
      }
    } else {
      // 'cycle' (0 -> 1 -> 2 -> 3)
      const idx = this.voiceStep % voices.length;
      const v = voices[idx];
      if (v && v.note) {
        this.synth.triggerVoiceNote(v.note.freq, idx, dur, 0.85, this.articulation);
        played.push(idx);
      }
      this.voiceStep++;
    }

    this.lastPlayingVoiceIdxs = played;
  }

  start() {
    this.renderer.resize();

    // Main animation frame loop (Visual rendering + step timing)
    const loop = (timestamp) => {
      // Calculate step duration based on BPM (16th notes / 8th notes)
      const stepIntervalMs = (60 / this.bpm) * 500; // 8th note clock rate

      if (this.isPlaying) {
        if (timestamp - this.lastStepTime >= stepIntervalMs) {
          this.tickMusicClock();
          this.lastStepTime = timestamp;
        }
      }

      // Visual render at full 60fps
      this.renderer.render(
        this.snake,
        this.foodManager.foods,
        this.music,
        this.currentVoices,
        this.lastPlayingVoiceIdxs
      );

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}

// Boot application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  const app = new SnakeSynthApp();
  app.start();
  window.snakeSynth = app; // For debugging or console exploration
});
