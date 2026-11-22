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
    this.bpm1 = 110;
    this.bpm2 = 165;
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
      btnModeGame: document.getElementById('btnModeGame'),
      btnModeAuto: document.getElementById('btnModeAuto'),
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
      selWaveform: document.getElementById('selWaveform'),
      selArpPattern: document.getElementById('selArpPattern'),
      selAutoBehavior: document.getElementById('selAutoBehavior'),
      selWallMode: document.getElementById('selWallMode'),
      selPreset: document.getElementById('selPreset'),

      sliderBpm1: document.getElementById('sliderBpm1'),
      valBpm1: document.getElementById('valBpm1'),
      sliderBpm2: document.getElementById('sliderBpm2'),
      valBpm2: document.getElementById('valBpm2'),
      btnTempo1: document.getElementById('btnTempo1'),
      btnTempo2: document.getElementById('btnTempo2'),
      sliderCutoff: document.getElementById('sliderCutoff'),
      valCutoff: document.getElementById('valCutoff'),
      sliderRes: document.getElementById('sliderRes'),
      valRes: document.getElementById('valRes'),
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
        this.isPlaying = !this.isPlaying;
        this.ui.btnPlayPause.textContent = this.isPlaying ? '⏸ PAUSE' : '▶ PLAY';
        this.ui.btnPlayPause.classList.toggle('active', this.isPlaying);
      });
    }

    // Reset Snake
    this.ui.btnReset.addEventListener('click', () => {
      this.snake.reset();
      this.foodManager.spawnInitialFoods();
      this.notify('Snake and Harmonic Matrix Reset');
    });

    // Mode Toggle
    this.ui.btnModeGame.addEventListener('click', () => this.setAppMode('game'));
    this.ui.btnModeAuto.addEventListener('click', () => this.setAppMode('auto'));

    // Mute
    this.ui.btnMute.addEventListener('click', () => {
      const isMuted = !this.synth.isMuted;
      this.synth.setMute(isMuted);
      this.ui.btnMute.textContent = isMuted ? '🔇' : '♪';
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
        this.foodManager.spawnInitialFoods();
        // Review Focus #1: reset per-tick accumulators so no stale state
        // leaks across grid changes. Forward-declared slots (patternStep,
        // previousVoicePitches) are set by Tasks 5 and 7; nulling them
        // here keeps the reset complete once they exist.
        this.voiceStep = 0;
        this.patternStep = 0;
        this.previousVoicePitches = [null, null, null, null];
      });
    }

    // Preset Selection
    this.ui.selPreset.addEventListener('change', (e) => {
      this.applyPreset(e.target.value);
    });

    // Musical Selectors
    this.ui.selScale.addEventListener('change', (e) => {
      // Review Focus #2: release any live full-legato oscillators so they
      // do not keep ringing at the old scale's pitches.
      this.synth.releaseAllVoices(0.15);
      this.music.setScale(e.target.value);
      this.updateStatusReadouts();
      this.notify(`Scale changed to ${SCALES[e.target.value].name}`);
    });

    this.ui.selRoot.addEventListener('change', (e) => {
      this.synth.releaseAllVoices(0.15);
      this.music.setRoot(parseInt(e.target.value, 10));
      this.updateStatusReadouts();
      this.notify(`Root set to ${NOTES[e.target.value]}`);
    });

    this.ui.selTreatment.addEventListener('change', (e) => {
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
    });

    this.ui.sliderBpm2.addEventListener('input', (e) => {
      this.bpm2 = parseInt(e.target.value, 10);
      this.ui.valBpm2.textContent = `${this.bpm2} BPM`;
    });

    this.ui.btnTempo1.addEventListener('click', () => this.setActiveTempo(1));
    this.ui.btnTempo2.addEventListener('click', () => this.setActiveTempo(2));

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

    // Touch (mobile) — swipe angle → dirección cardinal
    let touchStart = null;

    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (!touchStart || e.touches.length === 0) return;
      const dx = e.touches[0].clientX - touchStart.x;
      const dy = e.touches[0].clientY - touchStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
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

    this.canvas.addEventListener('touchend', () => { touchStart = null; });
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

      // Mode Switch
      case 'Tab':
        e.preventDefault();
        this.setAppMode(this.mode === 'auto' ? 'game' : 'auto');
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

      // Tempo toggle (\ — matches Music Mouse's Tempo Select key, PDF pág 7)
      case '\\':
        e.preventDefault();
        this.setActiveTempo(this.activeTempo === 1 ? 2 : 1);
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

  setActiveTempo(which) {
    if (which !== 1 && which !== 2) return;
    this.activeTempo = which;
    if (this.ui.btnTempo1) this.ui.btnTempo1.classList.toggle('active', which === 1);
    if (this.ui.btnTempo2) this.ui.btnTempo2.classList.toggle('active', which === 2);
  }

  setAppMode(newMode) {
    this.mode = newMode;
    if (this.ui.btnModeGame) this.ui.btnModeGame.classList.toggle('active', this.mode === 'game');
    if (this.ui.btnModeAuto) this.ui.btnModeAuto.classList.toggle('active', this.mode === 'auto');

    if (this.mode === 'game') {
      this.snake.reset();
      this.foodManager.spawnInitialFoods();
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

    this.music.setScale(p.scale);
    this.music.setRoot(p.root);
    this.currentTreatment = p.treatment;
    this.synth.setWaveform(p.waveform);
    this.synth.arpPattern = p.arpPattern;
    // Review Focus #4: ?? fallback — a preset without bpm (legacy) or bpm2
    // (not yet migrated) keeps the current value rather than becoming undefined.
    this.bpm1 = p.bpm ?? p.bpm1 ?? this.bpm1;
    this.bpm2 = p.bpm2 ?? this.bpm2;
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
    this.ui.sliderBpm2.value = this.bpm2;
    this.ui.valBpm2.textContent = `${this.bpm2} BPM`;
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
      this.snake.segments = this.snake.segments.slice(0, 1);
      this.snake.growthQueue = 0;
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

    // 3. Timbral modulation by length (Feature H — spec §5.8)
    const baseCutoff = parseInt(this.ui.sliderCutoff.value, 10);
    const baseReverb = parseFloat(this.ui.sliderReverb.value);
    const baseDelayFb = parseFloat(this.ui.sliderDelay.value);
    const timbre = computeTimbreByLength(this.snake.segments.length, baseCutoff, baseReverb, baseDelayFb);
    this.synth.setFilterCutoff(timbre.cutoff);
    this.synth.setReverbMix(timbre.reverb);
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
        const originalCutoff = this.synth.filterCutoff;
        this.synth.setFilterCutoff(Math.min(10000, originalCutoff * 2.2));
        setTimeout(() => this.synth.setFilterCutoff(originalCutoff), 700);
        break;
      }
      case 'echo': {
        this.synth.setReverbMix(0.75);
        setTimeout(() => this.synth.setReverbMix(0.4), 1800);
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
