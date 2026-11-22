import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MusicTheory } from '../js/music.js';
import { voiceCountForLength } from '../js/growth.js';

test('voiceCountForLength: 1→1, 2→2, 3→2, 4→3, 7→3, 8→4, 20→4', () => {
  assert.equal(voiceCountForLength(1), 1);
  assert.equal(voiceCountForLength(2), 2);
  assert.equal(voiceCountForLength(3), 2);
  assert.equal(voiceCountForLength(4), 3);
  assert.equal(voiceCountForLength(7), 3);
  assert.equal(voiceCountForLength(8), 4);
  assert.equal(voiceCountForLength(20), 4);
});

test('getVoices default returns 4 voices (back-compat)', () => {
  const music = new MusicTheory(0, 'pentatonicMajor', 2, 4);
  const voices = music.getVoices({ x: 0.5, y: 0.5 }, []);
  assert.equal(voices.length, 4);
});

test('getVoices with activeVoiceCount=1 returns only soprano', () => {
  const music = new MusicTheory(0, 'pentatonicMajor', 2, 4);
  const voices = music.getVoices({ x: 0.5, y: 0.5 }, [], 'contrary', 1);
  assert.equal(voices.length, 1);
  assert.equal(voices[0].id, 1);
});

test('getVoices with activeVoiceCount=3 returns soprano/alto/tenor and no bass', () => {
  const music = new MusicTheory(0, 'pentatonicMajor', 2, 4);
  const history = [
    { x: 0.5, y: 0.5 },
    { x: 0.4, y: 0.5 },
    { x: 0.3, y: 0.5 },
    { x: 0.2, y: 0.5 }
  ];
  const voices = music.getVoices({ x: 0.5, y: 0.5 }, history, 'contrary', 3);
  assert.equal(voices.length, 3);
  assert.equal(voices[0].id, 1);
  assert.equal(voices[1].id, 2);
  assert.equal(voices[2].id, 3);
  assert.equal(voices.find(v => v.id === 4), undefined);
});

test('getVoices with activeVoiceCount=2 returns soprano+alto only', () => {
  const music = new MusicTheory(0, 'pentatonicMajor', 2, 4);
  const voices = music.getVoices({ x: 0.5, y: 0.5 }, [], 'contrary', 2);
  assert.equal(voices.length, 2);
  assert.equal(voices[0].id, 1);
  assert.equal(voices[1].id, 2);
});

test('Review Focus #1: voiceCountForLength is pure (same input → same output)', () => {
  const r1 = voiceCountForLength(10);
  const r2 = voiceCountForLength(10);
  const r3 = voiceCountForLength(10);
  assert.equal(r1, r2);
  assert.equal(r2, r3);
  assert.equal(r1, 4);
});
