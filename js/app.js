/**
 * Main Application Orchestrator
 * Connects Synth Engine, Music Systems, Snake Automata, Canvas Renderer and UI.
 */

import { MusicTheory, SCALES, TREATMENTS, NOTES } from './music.js';
import { SynthEngine } from './audio.js';
import { Snake } from './snake.js';
import { FoodManager } from './foods.js';
import { Renderer } from './renderer.js';

export const PRESETS = {
  spiegel1986: {
    name: 'Music Mouse (default)',
    scale: 'pentatonicMajor',
    root: 0, // C
    treatment: 'contrary',
    waveform: 'triangle',
    bpm: 110,
    cutoff: 2400,
    resonance: 3.5,
    delayMix: 0.35,
    reverbMix: 0.4,
    arpPattern: 'chord',
    autoBehavior: 'harmonicSeeker'
  },
  ambientLydian: {
    name: 'Lydian Dreamscape',
    scale: 'lydian',
    root: 5, // F
    treatment: 'canonDelay',
    waveform: 'sine',
    bpm: 85,
    cutoff: 1600,
    resonance: 2.0,
    delayMix: 0.48,
    reverbMix: 0.65,
    arpPattern: 'drone',
    autoBehavior: 'lissajous'
  },
  berlinArp: {
    name: 'Berlin School Arp',
    scale: 'dorian',
    root: 9, // A
    treatment: 'parallel',
    waveform: 'sawtooth',
    bpm: 132,
    cutoff: 2800,
    resonance: 5.5,
    delayMix: 0.42,
    reverbMix: 0.3,
    arpPattern: 'upDown',
    autoBehavior: 'harmonicSeeker'
  },
  kotoZen: {
    name: 'Hirajōshi Zen Garden',
    scale: 'hirajoshi',
    root: 2, // D
    treatment: 'mirror',
    waveform: 'triangle',
    bpm: 96,
    cutoff: 3200,
    resonance: 3.0,
    delayMix: 0.38,
    reverbMix: 0.5,
    arpPattern: 'cycle',
    autoBehavior: 'brownian'
  },
  acidSlither: {
    name: 'Acid Slither',
    scale: 'wholeTone',
    root: 0, // C
    treatment: 'cluster',
    waveform: 'square',
    bpm: 140,
    cutoff: 3800,
    resonance: 7.0,
    delayMix: 0.35,
    reverbMix: 0.25,
    arpPattern: 'random',
    autoBehavior: 'lissajous'
  }
};

class SnakeSynthApp {
  constructor() {
    this.gridSize = 28;
    this.mode = 'auto'; // 'game' or 'auto'
    this.isPlaying = false;
    this.currentTreatment = 'contrary';
    this.bpm = 110;

    // Components
    this.music = new MusicTheory(0, 'pentatonicMajor', 2, 4);
    this.synth = new SynthEngine();
    this.snake = new Snake(this.gridSize, this.gridSize);
    this.foodManager = new FoodManager(this.gridSize, this.gridSize);

    this.mutateOnEat = false; // default: no parameter mutations

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
      selWaveform: document.getElementById('selWaveform'),
      selArpPattern: document.getElementById('selArpPattern'),
      selAutoBehavior: document.getElementById('selAutoBehavior'),
      selWallMode: document.getElementById('selWallMode'),
      selPreset: document.getElementById('selPreset'),

      sliderBpm: document.getElementById('sliderBpm'),
      valBpm: document.getElementById('valBpm'),
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
      });
    }

    // Preset Selection
    this.ui.selPreset.addEventListener('change', (e) => {
      this.applyPreset(e.target.value);
    });

    // Musical Selectors
    this.ui.selScale.addEventListener('change', (e) => {
      this.music.setScale(e.target.value);
      this.updateStatusReadouts();
      this.notify(`Scale changed to ${SCALES[e.target.value].name}`);
    });

    this.ui.selRoot.addEventListener('change', (e) => {
      this.music.setRoot(parseInt(e.target.value, 10));
      this.updateStatusReadouts();
      this.notify(`Root set to ${NOTES[e.target.value]}`);
    });

    this.ui.selTreatment.addEventListener('change', (e) => {
      this.currentTreatment = e.target.value;
      this.updateStatusReadouts();
      this.notify(`Treatment: ${TREATMENTS[e.target.value].name}`);
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
    this.ui.sliderBpm.addEventListener('input', (e) => {
      this.bpm = parseInt(e.target.value, 10);
      this.ui.valBpm.textContent = `${this.bpm} BPM`;
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
    const handleCoord = (clientX, clientY) => {
      const rect = this.canvas.getBoundingClientRect();
      const nx = Math.max(0, Math.min(0.999, (clientX - rect.left) / rect.width));
      const ny = Math.max(0, Math.min(0.999, (clientY - rect.top) / rect.height));
      const targetGridX = Math.floor(nx * this.gridSize);
      const targetGridY = Math.floor(ny * this.gridSize);

      if (this.mode === 'auto') {
        this.snake.mouseTarget = { x: targetGridX, y: targetGridY };
      } else {
        // Direct steering towards mouse in Game mode
        this.snake.steerTowards(this.snake.getHead(), { x: targetGridX, y: targetGridY });
      }
    };

    this.canvas.addEventListener('mousemove', (e) => {
      handleCoord(e.clientX, e.clientY);
    });

    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        handleCoord(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    this.canvas.addEventListener('mouseleave', () => {
      this.snake.mouseTarget = null;
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
    this.bpm = p.bpm;
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
    this.ui.selWaveform.value = p.waveform;
    this.ui.selArpPattern.value = p.arpPattern;
    this.ui.selAutoBehavior.value = p.autoBehavior;

    this.ui.sliderBpm.value = p.bpm;
    this.ui.valBpm.textContent = `${p.bpm} BPM`;
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

    if (hitSelf && this.snake.isDead) {
      this.synth.triggerImpactSound();
      // Musical reset: "Muda de piel" without stopping audio flow
      this.snake.segments = this.snake.segments.slice(0, 4);
      this.snake.isDead = false;
      this.notify('✦ MUDA DE PIEL: Acorde de choque & reducción armónica ✦');
    }

    if (hitBoundary) {
      this.synth.triggerImpactSound();
    }

    // 2. Check Food Consumption
    const head = this.snake.getHead();
    const consumed = this.foodManager.consumeAt(head.x, head.y, this.snake.segments);
    if (consumed) {
      this.handleFoodConsumed(consumed);
    }

    // 3. Option D Timbral Modulation: Snake length opens filter & space
    const baseCutoff = parseInt(this.ui.sliderCutoff.value, 10);
    const lengthRatio = Math.min(2.0, 1 + (this.snake.segments.length - 4) * 0.035);
    this.synth.setFilterCutoff(Math.min(9500, baseCutoff * lengthRatio));

    // 4. Derive 4 Laurie Spiegel Voices from Snake Geometry
    const normHead = this.snake.getNormalizedHead();
    const normHistory = this.snake.getNormalizedSegments();
    this.currentVoices = this.music.getVoices(normHead, normHistory, this.currentTreatment);

    // 4. Trigger Synth Note(s) based on Arpeggio Pattern
    this.triggerVoiceArpeggio(this.currentVoices);

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

  triggerVoiceArpeggio(voices) {
    if (!voices || voices.length === 0) return;

    const pattern = this.synth.arpPattern;
    const dur = 60 / this.bpm * 0.8;

    if (pattern === 'chord' || pattern === 'drone') {
      // Play all 4 voices simultaneously!
      voices.forEach((v, idx) => {
        if (v.note) {
          this.synth.triggerVoiceNote(v.note.freq, idx, dur * 1.5, 0.7);
        }
      });
    } else if (pattern === 'upDown') {
      // Voices cycle 0, 1, 2, 3, 2, 1...
      const order = [0, 1, 2, 3, 2, 1];
      const idx = order[this.voiceStep % order.length];
      const v = voices[idx];
      if (v && v.note) {
        this.synth.triggerVoiceNote(v.note.freq, idx, dur, 0.85);
      }
      this.voiceStep++;
    } else if (pattern === 'random') {
      const idx = Math.floor(Math.random() * voices.length);
      const v = voices[idx];
      if (v && v.note) {
        this.synth.triggerVoiceNote(v.note.freq, idx, dur, 0.85);
      }
    } else {
      // 'cycle' (0 -> 1 -> 2 -> 3)
      const idx = this.voiceStep % voices.length;
      const v = voices[idx];
      if (v && v.note) {
        this.synth.triggerVoiceNote(v.note.freq, idx, dur, 0.85);
      }
      this.voiceStep++;
    }
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
        this.mode === 'auto'
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
