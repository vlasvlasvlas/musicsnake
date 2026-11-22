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
