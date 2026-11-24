/**
 * SnakeSynth Web Audio Engine
 * 4-Voice Polyphonic Synthesizer with Spiegel Arpeggiator, Stereo Delay, Reverb,
 * and optional Web MIDI Output support.
 */

export class SynthEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.masterVolume = 0.7;
    this.polyphony = 4;
    this.waveform = 'triangle'; // sine, triangle, sawtooth, square
    
    // Envelope
    this.envelope = {
      attack: 0.04,
      decay: 0.25,
      sustain: 0.6,
      release: 0.5
    };

    // Filter
    this.filterCutoff = 2200;
    this.filterResonance = 4.0;

    // Delay FX
    this.delayTime = 0.35;
    this.delayFeedback = 0.45;
    this.delayMix = 0.35;

    // Reverb FX
    this.reverbMix = 0.4;
    this.reverbDecay = 3.0;

    // Arpeggiator / Clock
    this.arpPattern = 'cycle'; // cycle, upDown, random, chord, drone
    this.arpSpeedBpm = 120;
    this.activeVoices = [true, true, true, true]; // Voices 1, 2, 3, 4
    this.arpStep = 0;

    // MIDI Output
    this.midiOutput = null;
    this.midiEnabled = false;

    // Active continuous voices for Drone mode
    this.droneNodes = [];

    // Per-voice active oscillators for retriggerable articulation modes
    // (Feature F — spec §5.6). Each slot: { osc, subOsc, voiceGain, midiNote } | null
    this.activeVoiceNodes = [null, null, null, null];

    // Per-voice pending MIDI Note Off timers so a late-firing timer from
    // a stale half/staccato note cannot cut a fresh note on the same
    // voice (reviewer A1/A2/A11).
    this.pendingMidiNoteOffs = [null, null, null, null];

    // Food orb sound bank + global volume for the pickup timbres.
    this.foodBank = 'analog';   // 'analog' | 'arcade' | 'fm'
    this.foodVolume = 0;      // 0..1 multiplier applied to peakVol per hit

    // Mellotron sample cache (lazy-loaded after init). Base pitch assumed
    // at C4 (261.63 Hz) — the sample is re-pitched by setting playbackRate.
    this.mellotronBuffers = {}; // { mellotron1: AudioBuffer, mellotron2: AudioBuffer }
    this.mellotronBaseFreq = 261.63;
    // Per-sample playback metadata.
    //   startOffset: trim leading silence / attack transient
    //   loopStart:   match startOffset so the loop never revisits dead zone
    //   releaseExtra: extra seconds added to env.release — gives samples a
    //                 natural "arrastre" tail beyond the tick-level duration.
    this.mellotronMeta = {
      mellotron1: { startOffset: 0,    loopStart: 0,    releaseExtra: 1.5 },
      mellotron2: { startOffset: 0.55, loopStart: 0.55, releaseExtra: 0.4 }
    };
  }

  async _loadMellotronSamples() {
    if (!this.ctx) return;
    const samples = [
      ['mellotron1', 'assets/samples/mellotron1.wav'],
      ['mellotron2', 'assets/samples/mellotron2.wav']
    ];
    for (const [key, url] of samples) {
      if (this.mellotronBuffers[key]) continue;
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const arrayBuf = await resp.arrayBuffer();
        this.mellotronBuffers[key] = await this.ctx.decodeAudioData(arrayBuf);
      } catch (e) {
        console.warn(`[mellotron] failed to load ${url}:`, e);
      }
    }
  }

  setFoodBank(bank) {
    if (['analog', 'arcade', 'fm'].includes(bank)) this.foodBank = bank;
  }

  setFoodVolume(v) {
    this.foodVolume = Math.max(0, Math.min(1, v));
  }

  async init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();

    // Pause/release the voice lifecycle when the AudioContext is suspended
    // by the browser (tab blur, iOS Safari background, etc) so no event
    // pileup fires on resume (reviewer A6).
    this.ctx.onstatechange = () => {
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted') {
        this.releaseAllVoices(0.02);
      }
    };

    // Master Gain & Limiter
    this.masterGainNode = this.ctx.createGain();
    this.masterGainNode.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);

    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.setValueAtTime(-2.0, this.ctx.currentTime);
    this.limiter.knee.setValueAtTime(6.0, this.ctx.currentTime);
    this.limiter.ratio.setValueAtTime(12.0, this.ctx.currentTime);
    this.limiter.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.limiter.release.setValueAtTime(0.15, this.ctx.currentTime);

    // Filter
    this.mainFilter = this.ctx.createBiquadFilter();
    this.mainFilter.type = 'lowpass';
    this.mainFilter.frequency.setValueAtTime(this.filterCutoff, this.ctx.currentTime);
    this.mainFilter.Q.setValueAtTime(this.filterResonance, this.ctx.currentTime);

    // LFO (tempo-synced filter sweep)
    this.lfoOsc = this.ctx.createOscillator();
    this.lfoOsc.type = 'sine';
    this.lfoOsc.frequency.value = 1.5; // Hz, updated when BPM changes
    this.lfoGain = this.ctx.createGain();
    this.lfoGain.gain.value = 0; // silent until activated
    this.lfoOsc.connect(this.lfoGain);
    this.lfoGain.connect(this.mainFilter.frequency);
    this.lfoOsc.start();

    // Delay Node Setup
    this.setupDelay();

    // Reverb Impulse Setup
    this.setupReverb();

    // Routing
    // Synth -> Filter -> Delay & Reverb & Dry -> Limiter -> Master -> Destination
    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.setValueAtTime(0.8, this.ctx.currentTime);

    this.mainFilter.connect(this.dryGain);
    this.mainFilter.connect(this.delayIn);
    this.mainFilter.connect(this.reverbIn);

    this.dryGain.connect(this.limiter);
    this.delayOut.connect(this.limiter);
    this.reverbOut.connect(this.limiter);

    // Dedicated food-sound bus attenuates the triple-connected food voices
    // (direct + delay + reverb all summing at the limiter) so orb pickups
    // don't push ~2-3 dB hotter than the main synth (reviewer A7).
    this.foodBus = this.ctx.createGain();
    this.foodBus.gain.setValueAtTime(0.6, this.ctx.currentTime);
    this.foodBus.connect(this.limiter);

    this.limiter.connect(this.masterGainNode);
    this.masterGainNode.connect(this.ctx.destination);

    // Try MIDI initialization
    this.initMidi();

    // Kick off mellotron sample load in the background; the trigger path
    // falls back to a sawtooth if a selection hits before loading finishes.
    this._loadMellotronSamples();
  }

  setupDelay() {
    this.delayIn = this.ctx.createGain();
    this.delayNode = this.ctx.createDelay(2.0);
    this.delayNode.delayTime.setValueAtTime(this.delayTime, this.ctx.currentTime);

    this.delayFeedbackNode = this.ctx.createGain();
    this.delayFeedbackNode.gain.setValueAtTime(this.delayFeedback, this.ctx.currentTime);

    // Delay damping filter
    this.delayDamping = this.ctx.createBiquadFilter();
    this.delayDamping.type = 'lowpass';
    this.delayDamping.frequency.setValueAtTime(3200, this.ctx.currentTime);

    this.delayOut = this.ctx.createGain();
    this.delayOut.gain.setValueAtTime(this.delayMix, this.ctx.currentTime);

    this.delayIn.connect(this.delayNode);
    this.delayNode.connect(this.delayDamping);
    this.delayDamping.connect(this.delayFeedbackNode);
    this.delayFeedbackNode.connect(this.delayNode);
    this.delayDamping.connect(this.delayOut);
  }

  setupReverb() {
    this.reverbIn = this.ctx.createGain();
    this.reverbOut = this.ctx.createGain();
    this.reverbOut.gain.setValueAtTime(this.reverbMix, this.ctx.currentTime);

    this.convolver = this.ctx.createConvolver();
    this.generateReverbImpulse(this.reverbDecay);

    this.reverbIn.connect(this.convolver);
    this.convolver.connect(this.reverbOut);
  }

  generateReverbImpulse(duration = 2.8) {
    if (!this.ctx) return;
    const rate = this.ctx.sampleRate;
    const length = rate * duration;
    const impulse = this.ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const decay = Math.exp(-i / (rate * (duration / 3)));
      // Stereo ambient noise with exponential decay
      left[i] = (Math.random() * 2 - 1) * decay;
      right[i] = (Math.random() * 2 - 1) * decay;
    }
    this.convolver.buffer = impulse;
  }

  async initMidi() {
    if (navigator.requestMIDIAccess) {
      try {
        const midiAccess = await navigator.requestMIDIAccess();
        const outputs = Array.from(midiAccess.outputs.values());
        if (outputs.length > 0) {
          this.midiOutput = outputs[0];
          this.midiEnabled = true;
          console.log('MIDI Output connected:', this.midiOutput.name);
        }
      } catch (e) {
        console.warn('Web MIDI not available or permission denied', e);
      }
    }
  }

  setMute(mute) {
    this.isMuted = mute;
    if (this.masterGainNode && this.ctx) {
      this.masterGainNode.gain.setTargetAtTime(
        this.isMuted ? 0 : this.masterVolume,
        this.ctx.currentTime,
        0.05
      );
    }
    // I3 fix: muting while a fullLegato voice is active leaves the
    // oscillator running silenced (up to the 60 s safety stop) and,
    // worse, never sends a MIDI Note Off to external synths. Flush the
    // lifecycle on mute so external gear and internal state both reset.
    if (mute) {
      this.releaseAllVoices(0.12);
    }
  }

  setMasterVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (this.masterGainNode && this.ctx && !this.isMuted) {
      this.masterGainNode.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05);
    }
  }

  setWaveform(type) {
    this.waveform = type;
  }

  setFilterCutoff(freq) {
    this.filterCutoff = Math.max(80, Math.min(12000, freq));
    if (this.mainFilter && this.ctx) {
      this.mainFilter.frequency.setTargetAtTime(this.filterCutoff, this.ctx.currentTime, 0.04);
    }
  }

  setLFOActive(active, bpm, baseCutoff) {
    if (!this.lfoGain || !this.lfoOsc || !this.mainFilter) return;
    if (active) {
      // Center the filter at a low frequency so the LFO sweeps upward dramatically.
      // intrinsic value = center, LFO gain = same → sweeps from 0 to 2× center.
      const center = Math.max(200, baseCutoff * 0.25);
      this.mainFilter.frequency.setTargetAtTime(center, this.ctx.currentTime, 0.05);
      this.lfoOsc.frequency.setValueAtTime(bpm / 60, this.ctx.currentTime);
      this.lfoGain.gain.setTargetAtTime(center, this.ctx.currentTime, 0.1);
      this.mainFilter.Q.setTargetAtTime(12, this.ctx.currentTime, 0.1);
    } else {
      this.lfoGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
    }
  }

  setLFOFreq(bpm) {
    if (this.lfoOsc && this.lfoGain && this.lfoGain.gain.value > 0) {
      this.lfoOsc.frequency.setValueAtTime(bpm / 60, this.ctx.currentTime);
    }
  }

  setDelayParams(time, feedback, mix) {
    this.delayTime = time;
    this.delayFeedback = feedback;
    this.delayMix = mix;
    if (this.ctx && this.delayNode) {
      this.delayNode.delayTime.setTargetAtTime(this.delayTime, this.ctx.currentTime, 0.05);
      this.delayFeedbackNode.gain.setTargetAtTime(this.delayFeedback, this.ctx.currentTime, 0.05);
      this.delayOut.gain.setTargetAtTime(this.delayMix, this.ctx.currentTime, 0.05);
    }
  }

  setReverbMix(mix) {
    this.reverbMix = mix;
    if (this.reverbOut && this.ctx) {
      this.reverbOut.gain.setTargetAtTime(this.reverbMix, this.ctx.currentTime, 0.05);
    }
  }

  /**
   * Plays a single note for a specific voice. Articulation decides whether
   * the oscillator fades out on a scheduled stop (staccato / halfLegato) or
   * sustains until the next retrigger (fullLegato).
   *
   * @param {number} freq - Hz
   * @param {number} voiceIndex - 0..3
   * @param {number} duration - base duration seconds (caller's beat quantum)
   * @param {number} velocity - 0..1
   * @param {string} articulation - 'staccato' | 'halfLegato' | 'fullLegato'
   */
  triggerVoiceNote(freq, voiceIndex, duration = 0.3, velocity = 0.8, articulation = 'halfLegato') {
    if (!this.ctx || this.isMuted || !freq || freq <= 0) return;
    // Don't schedule notes while the context is paused — they would pile
    // up and fire together on resume (reviewer A6).
    if (this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    // Always pre-release the prior voice on this slot so rapid retriggers
    // at high BPM never stack oscillators or sample sources on top of
    // each other (reviewer A4). FullLegato gets a slightly longer fade
    // because it is typically sustaining, not percussive.
    if (this.activeVoiceNodes[voiceIndex]) {
      const preRelease = articulation === 'fullLegato' ? 0.08 : 0.02;
      this.releaseVoice(voiceIndex, preRelease);
    }

    // Articulation → effective sustain length.
    // staccato: shortened to a tiny click
    // halfLegato: as the caller supplied (preserves prior behavior)
    // fullLegato: effectively infinite, we schedule a far-future stop as safety
    let sustainLen;
    if (articulation === 'staccato') {
      sustainLen = Math.min(0.2, duration * 0.35);
    } else if (articulation === 'fullLegato') {
      sustainLen = 60; // 60 seconds; a retrigger or releaseVoice will truncate
    } else {
      sustainLen = duration;
    }

    // Polyphonic Stereo Panning
    const panNode = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    const pans = [-0.65, 0.65, -0.25, 0.25];
    if (panNode) {
      panNode.pan.setValueAtTime(pans[voiceIndex % 4], now);
    }

    // Mellotron sample path — playbackRate shifts a looped buffer to pitch.
    const isMellotron = this.waveform === 'mellotron1' || this.waveform === 'mellotron2';
    const mellotronBuffer = isMellotron ? this.mellotronBuffers[this.waveform] : null;

    let osc = null;
    let subOsc = null;
    let sampleSource = null;

    if (mellotronBuffer) {
      sampleSource = this.ctx.createBufferSource();
      sampleSource.buffer = mellotronBuffer;
      sampleSource.loop = true;
      sampleSource.playbackRate.setValueAtTime(freq / this.mellotronBaseFreq, now);
      const meta = this.mellotronMeta[this.waveform] || { startOffset: 0, loopStart: 0 };
      if (meta.loopStart > 0) sampleSource.loopStart = meta.loopStart;
      // loopEnd defaults to 0 which the browser interprets as buffer end.
    } else {
      // Waveform path (triangle / saw / sine / square). Falls back to
      // sawtooth if a mellotron slot is requested but the buffer isn't
      // loaded yet.
      const wf = isMellotron ? 'sawtooth' : this.waveform;
      osc = this.ctx.createOscillator();
      osc.type = wf;
      osc.frequency.setValueAtTime(freq, now);

      subOsc = this.ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(freq * 0.5, now); // 1 octave lower sub
    }

    const voiceGain = this.ctx.createGain();
    const env = this.envelope;
    const peakGain = (velocity * 0.22);

    // Mellotron samples get a longer release tail than the tick clock
    // would normally give them, so the note "arrastra" past the step.
    const mellotronReleaseExtra = sampleSource
      ? ((this.mellotronMeta[this.waveform] || {}).releaseExtra || 0)
      : 0;
    const effectiveRelease = env.release + mellotronReleaseExtra;

    // ADSR Envelope — sustain plateau for fullLegato is just the sustain
    // level held at sustainLen (no ramp to 0 until releaseVoice fires).
    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.exponentialRampToValueAtTime(peakGain, now + env.attack);
    voiceGain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, peakGain * env.sustain),
      now + env.attack + env.decay
    );
    if (articulation !== 'fullLegato') {
      voiceGain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + sustainLen + effectiveRelease
      );
    }

    // Connect sources to voiceGain.
    if (sampleSource) {
      sampleSource.connect(voiceGain);
    } else {
      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.2, now);
      subOsc.connect(subGain);
      subGain.connect(voiceGain);
      osc.connect(voiceGain);
    }

    if (panNode) {
      voiceGain.connect(panNode);
      panNode.connect(this.mainFilter);
    } else {
      voiceGain.connect(this.mainFilter);
    }

    const stopTime = now + sustainLen + effectiveRelease + 0.1;
    if (sampleSource) {
      const meta = this.mellotronMeta[this.waveform] || { startOffset: 0 };
      sampleSource.start(now, meta.startOffset || 0);
      sampleSource.stop(stopTime);
    } else {
      osc.start(now);
      subOsc.start(now);
      osc.stop(stopTime);
      subOsc.stop(stopTime);
    }

    // Track the active slot so releaseVoice / releaseAllVoices can reach it.
    const midiNote = Math.round(69 + 12 * Math.log2(freq / 440));
    this.activeVoiceNodes[voiceIndex] = { osc, subOsc, sampleSource, voiceGain, midiNote, articulation };

    // Non-legato slots self-clear after their scheduled stop so later
    // retriggers don't try to release a dead source.
    if (articulation !== 'fullLegato') {
      const nullAfterMs = (sustainLen + effectiveRelease + 0.12) * 1000;
      const sentinel = osc ?? sampleSource;
      setTimeout(() => {
        const slot = this.activeVoiceNodes[voiceIndex];
        if (slot && (slot.osc === sentinel || slot.sampleSource === sentinel)) {
          this.activeVoiceNodes[voiceIndex] = null;
        }
      }, nullAfterMs);
    }

    // MIDI output lifecycle (Review Focus #3 + reviewer A1/A2/A11):
    //   staccato / halfLegato → paired Note Off via setTimeout, tracked
    //     per voice so a retrigger can cancel the stale timer.
    //   fullLegato → Note On now, Note Off deferred to releaseVoice.
    if (this.midiEnabled && this.midiOutput) {
      if (articulation === 'fullLegato') {
        this.midiOutput.send([0x90, midiNote, Math.floor(velocity * 127)]);
      } else {
        this.sendMidiNote(midiNote, Math.floor(velocity * 127), sustainLen, voiceIndex);
      }
    }
  }

  /**
   * Release a specific active voice. Sends MIDI Note Off, fades voiceGain
   * over releaseSec, and schedules osc.stop. Safe to call on an empty slot.
   */
  releaseVoice(voiceIndex, releaseSec = 0.15) {
    const slot = this.activeVoiceNodes[voiceIndex];
    if (!slot || !this.ctx) return;
    const now = this.ctx.currentTime;
    const { osc, subOsc, sampleSource, voiceGain, midiNote } = slot;

    try {
      voiceGain.gain.cancelScheduledValues(now);
      voiceGain.gain.setValueAtTime(Math.max(0.0001, voiceGain.gain.value), now);
      voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + releaseSec);
    } catch (_) { /* node may be disconnected */ }

    const stopAt = now + releaseSec + 0.02;
    try { osc?.stop(stopAt); } catch (_) { /* already stopped */ }
    try { subOsc?.stop(stopAt); } catch (_) {}
    try { sampleSource?.stop(stopAt); } catch (_) {}

    if (this.midiEnabled && this.midiOutput && typeof midiNote === 'number') {
      try { this.midiOutput.send([0x80, midiNote, 0]); } catch (_) {}
    }

    // Cancel any pending setTimeout-based Note Off for this slot so it
    // can't fire later and cut a future retrigger (reviewer A1).
    this._clearPendingMidiNoteOff(voiceIndex, { send: false });

    this.activeVoiceNodes[voiceIndex] = null;
  }

  _clearPendingMidiNoteOff(voiceIndex, { send = true } = {}) {
    const pending = this.pendingMidiNoteOffs[voiceIndex];
    if (!pending) return;
    clearTimeout(pending.timerId);
    if (send && this.midiEnabled && this.midiOutput) {
      try { this.midiOutput.send([0x80, pending.note, 0]); } catch (_) {}
    }
    this.pendingMidiNoteOffs[voiceIndex] = null;
  }

  /**
   * Release every active voice. Used on scale/root change (Review Focus #2)
   * and on muda-de-piel repli­egue (spec §5.3 updated for Feature F).
   */
  releaseAllVoices(releaseSec = 0.15) {
    for (let i = 0; i < this.activeVoiceNodes.length; i++) {
      this.releaseVoice(i, releaseSec);
    }
  }

  /**
   * One-shot timbre fired when the snake eats an orb. Dispatches to one
   * of the three sound banks (analog / arcade / fm). Each orb type has
   * a distinct voice within each bank so the ear can read what was
   * just picked up.
   */
  triggerFoodSound(foodType = 'scale') {
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state !== 'running') return; // reviewer A6
    switch (this.foodBank) {
      case 'arcade': return this._foodArcade(foodType);
      case 'fm':     return this._foodFM(foodType);
      case 'analog':
      default:       return this._foodAnalog(foodType);
    }
  }

  /**
   * Analog classic-synth bank: a single consistent pluck voice. Every
   * orb triggers the same timbre so the player hears "ate one" without
   * the sound varying per food type.
   */
  _foodAnalog(_foodType) {
    const now = this.ctx.currentTime;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const gain = this.ctx.createGain();

    // Juno-style pluck: saw + sub-sine, filter closes over the decay.
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(329.63, now); // E4

    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(164.81, now); // E3 sub

    filter.frequency.setValueAtTime(2800, now);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.45);
    filter.Q.setValueAtTime(4, now);

    const duration = 0.55;
    const peakVol = 0.22;
    const vol = Math.max(0.0001, peakVol * this.foodVolume);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(vol, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(vol * 0.5, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    // Sub mix into the filter alongside the main saw.
    const subMix = this.ctx.createGain();
    subMix.gain.setValueAtTime(0.45, now);
    sub.connect(subMix);
    subMix.connect(filter);
    osc.connect(filter);

    filter.connect(gain);
    gain.connect(this.delayIn);
    gain.connect(this.reverbIn);
    gain.connect(this.foodBus);

    const stopAt = now + duration + 0.1;
    osc.start(now);
    sub.start(now);
    osc.stop(stopAt);
    sub.stop(stopAt);
  }

  /**
   * Arcade bank: Nokia / 8-bit snap. One sine osc with a quick upward
   * pitch sweep. Same sound every orb.
   */
  _foodArcade(_foodType) {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);

    const vol = Math.max(0.0001, 0.25 * this.foodVolume);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.delayIn);
    gain.connect(this.reverbIn);
    gain.connect(this.foodBus);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  /**
   * FM bank: classic 2-operator frequency modulation (DX7 vocabulary).
   * Carrier + modulator sine oscs, modulator's output drives the
   * carrier's frequency AudioParam via a gain node (modulation index).
   * Metallic, bell-like, glassy. Same bell every orb.
   */
  _foodFM(_foodType) {
    const now = this.ctx.currentTime;

    const carrier = this.ctx.createOscillator();
    carrier.type = 'sine';
    const modulator = this.ctx.createOscillator();
    modulator.type = 'sine';
    const modGain = this.ctx.createGain(); // modulation index (Hz deviation)
    const gain = this.ctx.createGain();

    // Bright bell on E4.
    const f = 329.63;
    const duration = 0.7;
    const peakVol = 0.2;
    carrier.frequency.setValueAtTime(f, now);
    modulator.frequency.setValueAtTime(f * 1.5, now);

    // Modulation index envelope (controls brightness over time).
    modGain.gain.setValueAtTime(500, now);
    modGain.gain.exponentialRampToValueAtTime(30, now + duration);

    // FM routing: modulator -> gain -> carrier.frequency
    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    // Amplitude envelope on carrier.
    const vol = Math.max(0.0001, peakVol * this.foodVolume);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(vol, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    carrier.connect(gain);
    gain.connect(this.delayIn);
    gain.connect(this.reverbIn);
    gain.connect(this.foodBus);

    const stopAt = now + duration + 0.12;
    carrier.start(now);
    modulator.start(now);
    carrier.stop(stopAt);
    modulator.stop(stopAt);
  }

  /**
   * Sound effect for wall bounce / wrap
   */
  triggerImpactSound() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.18);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.limiter);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  sendMidiNote(note, velocity = 90, duration = 0.3, voiceIndex = null) {
    if (!this.midiOutput) return;
    // Flush any older pending Note Off for this voice BEFORE sending
    // Note On, so the external synth hears Off-On rather than letting a
    // stale timer fire mid-way through the new note (reviewer A1).
    if (voiceIndex != null) this._clearPendingMidiNoteOff(voiceIndex);

    const ch = 0x90;    // Note On ch 1
    const chOff = 0x80; // Note Off ch 1
    this.midiOutput.send([ch, note, velocity]);

    const timerId = setTimeout(() => {
      if (this.midiOutput) {
        try { this.midiOutput.send([chOff, note, 0]); } catch (_) {}
      }
      if (voiceIndex != null && this.pendingMidiNoteOffs[voiceIndex]?.timerId === timerId) {
        this.pendingMidiNoteOffs[voiceIndex] = null;
      }
    }, duration * 1000);

    if (voiceIndex != null) {
      this.pendingMidiNoteOffs[voiceIndex] = { timerId, note };
    }
  }
}
