/**
 * Music Mouse & Snake Harmonic Systems
 * Laurie Spiegel inspired scales, voicings and counterpoint algorithms
 */

export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const SCALES = {
  pentatonicMajor: {
    name: 'Pentatonic Major',
    intervals: [0, 2, 4, 7, 9],
    description: 'Bright, consonant, East Asian / Folk / Ambient'
  },
  pentatonicMinor: {
    name: 'Pentatonic Minor',
    intervals: [0, 3, 5, 7, 10],
    description: 'Deep, meditative, bluesy'
  },
  dorian: {
    name: 'Dorian Mode',
    intervals: [0, 2, 3, 5, 7, 9, 10],
    description: 'Medieval, jazzy, soulful minor'
  },
  lydian: {
    name: 'Lydian Mode',
    intervals: [0, 2, 4, 6, 7, 9, 11],
    description: 'Dreamy, ethereal, raised 4th (Spiegel favorite)'
  },
  mixolydian: {
    name: 'Mixolydian Mode',
    intervals: [0, 2, 4, 5, 7, 9, 10],
    description: 'Floating Celtic / Krautrock / Indian drone vibe'
  },
  aeolian: {
    name: 'Aeolian (Natural Minor)',
    intervals: [0, 2, 3, 5, 7, 8, 10],
    description: 'Classic introspective ambient'
  },
  hirajoshi: {
    name: 'Hirajōshi (Japanese)',
    intervals: [0, 2, 3, 7, 8],
    description: 'Traditional koto scale, mysterious & poignant'
  },
  insen: {
    name: 'Insen (Japanese)',
    intervals: [0, 1, 5, 7, 10],
    description: 'Evocative shakuhachi modal character'
  },
  wholeTone: {
    name: 'Whole Tone',
    intervals: [0, 2, 4, 6, 8, 10],
    description: 'Floating, suspended, Debussy dreamscape'
  },
  blues: {
    name: 'Hexatonic Blues',
    intervals: [0, 3, 5, 6, 7, 10],
    description: 'Gritty harmonic tension'
  },
  chromatic: {
    name: 'Chromatic (Free)',
    intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    description: 'Avant-garde, micro-tonal grid freedom'
  }
};

export const TREATMENTS = {
  contrary: {
    name: 'Movimiento contrario',
    description: 'Las voces se mueven en direcciones opuestas (clásico Spiegel)'
  },
  parallel: {
    name: 'Paralelas (quintas)',
    description: 'Las voces siguen el mismo movimiento a distancia fija'
  },
  mirror: {
    name: 'Espejo',
    description: 'Las voces graves reflejan a las agudas alrededor del centro'
  },
  cluster: {
    name: 'Cluster denso',
    description: 'Notas muy juntas, textura brillante y densa'
  },
  canonDelay: {
    name: 'Canon / Eco',
    description: 'Las voces siguen el rastro anterior de la víbora'
  }
};

export class MusicTheory {
  constructor(rootNote = 0, scaleKey = 'pentatonicMajor', baseOctave = 2, octavesCount = 4) {
    this.rootNote = rootNote; // 0 = C, 1 = C#, ...
    this.scaleKey = scaleKey;
    this.baseOctave = baseOctave;
    this.octavesCount = octavesCount;
    this.cacheGridNotes();
  }

  setRoot(root) {
    this.rootNote = (root + 12) % 12;
    this.cacheGridNotes();
  }

  setScale(key) {
    if (SCALES[key]) {
      this.scaleKey = key;
      this.cacheGridNotes();
    }
  }

  setOctaves(base, count) {
    this.baseOctave = base;
    this.octavesCount = count;
    this.cacheGridNotes();
  }

  cacheGridNotes() {
    const scale = SCALES[this.scaleKey] || SCALES.pentatonicMajor;
    const notes = [];
    const minMidi = (this.baseOctave + 1) * 12 + this.rootNote;
    const maxMidi = (this.baseOctave + 1 + this.octavesCount) * 12 + this.rootNote;

    for (let oct = 0; oct < this.octavesCount; oct++) {
      const octBase = (this.baseOctave + 1 + oct) * 12 + this.rootNote;
      for (const interval of scale.intervals) {
        const midi = octBase + interval;
        if (midi <= maxMidi + 12) {
          notes.push({
            midi,
            freq: this.midiToFreq(midi),
            name: this.midiToName(midi),
            octave: Math.floor(midi / 12) - 1,
            degree: interval
          });
        }
      }
    }
    this.gridNotes = notes;
  }

  midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  midiToName(midi) {
    const noteName = NOTES[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    return `${noteName}${octave}`;
  }

  /**
   * Maps a normalized coordinate [0, 1] to a note in the scale
   */
  coordToNote(normValue) {
    if (!this.gridNotes || this.gridNotes.length === 0) {
      this.cacheGridNotes();
    }
    const clamped = Math.max(0, Math.min(0.9999, normValue));
    const index = Math.floor(clamped * this.gridNotes.length);
    return this.gridNotes[index];
  }

  /**
   * Derive polyphonic voices like Laurie Spiegel's Music Mouse.
   * Always computes 4 voices to preserve treatment math (contrary, mirror,
   * cluster, canonDelay all reference the full set), then truncates to
   * activeVoiceCount at return.
   *
   * @param {Object} pos - Normalized coordinates {x, y} of the snake head
   * @param {Array} history - Previous segment normalized coordinates [{x, y}, ...]
   * @param {String} treatment - Harmonic treatment mode
   * @param {Number} activeVoiceCount - 1..4 (default 4 preserves back-compat)
   */
  getVoices(pos, history = [], treatment = 'contrary', activeVoiceCount = 4) {
    const notes = this.gridNotes;
    const len = notes.length;
    if (len === 0) return [];

    const idxX = Math.floor(Math.max(0, Math.min(0.9999, pos.x)) * len);
    const idxY = Math.floor(Math.max(0, Math.min(0.9999, pos.y)) * len);

    // Anatomical nodes of the snake
    const midIdx = history.length > 0 ? Math.floor(history.length / 2) : 0;
    const tailIdx = history.length > 0 ? history.length - 1 : 0;
    const midPos = history[midIdx] || pos;
    const tailPos = history[tailIdx] || pos;

    const midGridIdx = Math.floor(Math.max(0, Math.min(0.9999, (midPos.x + midPos.y) * 0.5)) * len);
    const tailGridIdx = Math.floor(Math.max(0, Math.min(0.9999, tailPos.x)) * len);

    // Voice 1: Soprano follows Head X
    const v1 = notes[idxX];

    // Voice 2: Alto follows Head Y
    const v2 = notes[idxY];

    let v3, v4;

    switch (treatment) {
      case 'parallel': {
        // Parallel motion modulated by midpoint and tail
        const idx3 = (midGridIdx + 4) % len;
        const idx4 = Math.max(0, (tailGridIdx - 7 + len) % len);
        v3 = notes[idx3];
        v4 = notes[idx4];
        break;
      }
      case 'mirror': {
        // Mirrored across center of scale
        const center = Math.floor(len / 2);
        const idx3 = Math.max(0, Math.min(len - 1, center - (midGridIdx - center)));
        const idx4 = Math.max(0, Math.min(len - 1, center - (tailGridIdx - center)));
        v3 = notes[idx3];
        v4 = notes[idx4];
        break;
      }
      case 'cluster': {
        // Close micro-cluster
        const idx3 = Math.min(len - 1, idxX + 1);
        const idx4 = Math.max(0, tailGridIdx - 2);
        v3 = notes[idx3];
        v4 = notes[idx4];
        break;
      }
      case 'canonDelay': {
        // Canon echo directly tracking midpoint and tail positions
        const idx3 = Math.floor(Math.max(0, Math.min(0.9999, midPos.x)) * len);
        const idx4 = Math.floor(Math.max(0, Math.min(0.9999, tailPos.y)) * len);
        v3 = notes[idx3];
        v4 = notes[idx4];
        break;
      }
      case 'contrary':
      default: {
        // Laurie Spiegel's classic contrary motion applied with snake midpoint & tail:
        const invMid = len - 1 - midGridIdx;
        const invTail = Math.max(0, Math.floor(len * 0.35) - Math.floor(tailGridIdx * 0.3));
        v3 = notes[invMid];
        v4 = notes[invTail];
        break;
      }
    }

    // Voice 4 gets a lower bass frequency if available
    let bassNote = v4;
    if (v4) {
      const bassMidi = Math.max(24, v4.midi - 12); // Transpose 1 octave lower for foundation
      bassNote = {
        ...v4,
        midi: bassMidi,
        freq: this.midiToFreq(bassMidi),
        name: this.midiToName(bassMidi)
      };
    }

    const allVoices = [
      { id: 1, name: 'Soprano (Cabeza X)', note: v1, pan: -0.65 },
      { id: 2, name: 'Alto (Cabeza Y)', note: v2, pan: 0.65 },
      { id: 3, name: 'Tenor (Cuerpo Medio)', note: v3, pan: -0.25 },
      { id: 4, name: 'Bajo/Drone (Cola)', note: bassNote, pan: 0.25 }
    ];

    const n = Math.max(1, Math.min(4, activeVoiceCount | 0));
    return allVoices.slice(0, n);
  }
}
