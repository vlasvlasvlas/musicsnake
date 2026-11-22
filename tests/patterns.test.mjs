import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MusicTheory, MM_PATTERNS } from '../js/music.js';

const EXPECTED_DELTAS = {
  off: [0],
  p1: [0, 4, 5, 0, 4, 3, 4, 5, 0, 4],
  p2: [0, 2, 4, 7, 4, 2],
  p3: [0, 1, 2, 3, 4, 3, 2, 1],
  p4: [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1],
  p5: [0, 4, 7, 11, 7, 4, 7, 4],
  p6: [0, 1, 0, 1, 2, 1, 2, 3, 2, 3, 4, 3, 2, 1, 2, 1],
  p7: [0, 2, 3, 4, 5, 6, 5, 4, 3, 2],
  p8: [0, 7, 1, 6, 2, 5, 3, 4, 5, 2, 4, 5, 2, 6, 1, 7],
  p9: [0, 1, 4, 1, 0, 4, 0, 4],
  p10: [0, 7, 0, 0, 2, 1, 2, 4, 3, 2, 1, 2, 0, 0]
};

test('MM_PATTERNS contains off + 10 patterns with correct canonical deltas', () => {
  const keys = Object.keys(MM_PATTERNS);
  assert.equal(keys.length, 11);
  for (const [key, deltas] of Object.entries(EXPECTED_DELTAS)) {
    assert.ok(MM_PATTERNS[key], `missing pattern ${key}`);
    assert.deepEqual(MM_PATTERNS[key].deltas, deltas, `wrong deltas for ${key}`);
  }
});

function buildVoices(music, idx) {
  const note = music.gridNotes[idx];
  return [
    { id: 1, name: 'Soprano', note, pan: -0.65 },
    { id: 2, name: 'Alto',    note, pan: 0.65 },
    { id: 3, name: 'Tenor',   note, pan: -0.25 },
    { id: 4, name: 'Bass',    note, pan: 0.25 }
  ];
}

test('applyPattern with off returns identical pitches (pattern disabled)', () => {
  const music = new MusicTheory(0, 'pentatonicMajor', 2, 4);
  const voices = buildVoices(music, 10);
  const result = music.applyPattern(voices, 'off', 5, 'parallel');
  for (let i = 0; i < 4; i++) {
    assert.equal(result[i].note.midi, voices[i].note.midi);
  }
});

test('applyPattern parallel: all voices receive the same scale-degree delta', () => {
  const music = new MusicTheory(0, 'pentatonicMajor', 2, 4);
  const voices = buildVoices(music, 10);
  // p1[1] = 4
  const result = music.applyPattern(voices, 'p1', 1, 'parallel');
  const expectedIdx = 10 + 4;
  const expectedMidi = music.gridNotes[expectedIdx].midi;
  for (let i = 0; i < 4; i++) {
    assert.equal(result[i].note.midi, expectedMidi, `voice ${i} mismatch`);
  }
});

test('applyPattern contrary: voices at array index 1 and 3 receive -delta, others +delta', () => {
  const music = new MusicTheory(0, 'pentatonicMajor', 2, 4);
  const voices = buildVoices(music, 10);
  // p2[2] = 4
  const result = music.applyPattern(voices, 'p2', 2, 'contrary');
  const upMidi   = music.gridNotes[10 + 4].midi;
  const downMidi = music.gridNotes[10 - 4].midi;
  assert.equal(result[0].note.midi, upMidi,   'soprano should go +4');
  assert.equal(result[1].note.midi, downMidi, 'alto should go -4');
  assert.equal(result[2].note.midi, upMidi,   'tenor should go +4');
  assert.equal(result[3].note.midi, downMidi, 'bass should go -4');
});

test('applyPattern wraps modulo gridNotes.length for large deltas (p5[3]=11)', () => {
  const music = new MusicTheory(0, 'pentatonicMajor', 2, 4);
  const len = music.gridNotes.length; // 20
  const voices = buildVoices(music, 15);
  // p5[3] = 11; (15+11) % 20 = 6
  const result = music.applyPattern(voices, 'p5', 3, 'parallel');
  assert.equal(result[0].note.midi, music.gridNotes[(15 + 11) % len].midi);
});

test('applyPattern wraps modulo at the low end for negative signed deltas (contrary)', () => {
  const music = new MusicTheory(0, 'pentatonicMajor', 2, 4);
  const len = music.gridNotes.length; // 20
  const voices = buildVoices(music, 2);
  // p1[1] = 4; voice index 1 (alto) under contrary gets -4
  // (2 - 4 + 20) % 20 = 18
  const result = music.applyPattern(voices, 'p1', 1, 'contrary');
  assert.equal(result[1].note.midi, music.gridNotes[(2 - 4 + len) % len].midi);
});

test('applyPattern leaves non-active voices untouched (handles length < 4)', () => {
  const music = new MusicTheory(0, 'pentatonicMajor', 2, 4);
  const voices = buildVoices(music, 10).slice(0, 2); // only soprano + alto
  const result = music.applyPattern(voices, 'p1', 1, 'contrary');
  assert.equal(result.length, 2);
  // parallel says both +; contrary says soprano +, alto -
  assert.equal(result[0].note.midi, music.gridNotes[10 + 4].midi);
  assert.equal(result[1].note.midi, music.gridNotes[10 - 4].midi);
});
