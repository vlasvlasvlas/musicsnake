/**
 * Growth-gated instrument capacity.
 * Maps snake body length to the number of active polyphonic voices
 * and to timbral modulation parameters (filter / reverb / delay).
 *
 * Per spec §5.1: 1 segment = soprano only (human-played), 2–3 = +alto,
 * 4–7 = +tenor (Spiegel supplies), 8+ = +bass (Spiegel supplies).
 */

export function voiceCountForLength(n) {
  if (n <= 1) return 1;
  if (n <= 3) return 2;
  if (n <= 7) return 3;
  return 4;
}

/**
 * Timbral modulation by snake length (spec §5.8).
 *
 * Multiplier curves mapping length 1..32 to base multipliers:
 *   filterCutoff: 1.0x → 3.5x along sqrt(t) (concave — opens fast, then plateaus)
 *   reverbMix:    0.9x → 1.6x linear
 *   delayFb:      0.85x → 1.35x linear
 *
 * Absolute ceilings (independent of base):
 *   cutoff ≤ 9500 Hz · reverb ≤ 0.9 · delay ≤ 0.75
 *
 * Plateau: length ≥ 32 produces the same multipliers as length = 32
 * so unbounded growth does not keep expanding timbre indefinitely.
 */
export function computeTimbreByLength(length, baseCutoff, baseReverb, baseDelayFb) {
  const n = Math.max(1, length);
  const t = Math.min(1, (n - 1) / 31);

  const cutoffMult = 1.0 + 2.5 * Math.sqrt(t);
  const reverbMult = 0.9 + 0.7 * t;
  const delayMult  = 0.85 + 0.5 * t;

  return {
    cutoff: Math.min(9500, baseCutoff * cutoffMult),
    reverb: Math.min(0.9,  baseReverb * reverbMult),
    delay:  Math.min(0.75, baseDelayFb * delayMult)
  };
}
