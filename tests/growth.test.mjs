import { test } from 'node:test';
import assert from 'node:assert/strict';
import { voiceCountForLength, computeTimbreByLength } from '../js/growth.js';

test('computeTimbreByLength at length=1 returns base multipliers (1.0x cutoff, 0.9x reverb, 0.85x delay)', () => {
  const r = computeTimbreByLength(1, 2400, 0.4, 0.45);
  assert.equal(r.cutoff, 2400); // 1.0 * 2400
  assert.ok(Math.abs(r.reverb - 0.36) < 1e-9); // 0.9 * 0.4
  assert.ok(Math.abs(r.delay - 0.3825) < 1e-9); // 0.85 * 0.45
});

test('computeTimbreByLength at length=32 reaches cap multipliers (3.5x cutoff, 1.6x reverb, 1.35x delay)', () => {
  const r = computeTimbreByLength(32, 1000, 0.3, 0.3);
  assert.ok(Math.abs(r.cutoff - 3500) < 1e-6); // 3.5 * 1000
  assert.ok(Math.abs(r.reverb - 0.48) < 1e-9); // 1.6 * 0.3
  assert.ok(Math.abs(r.delay - 0.405) < 1e-9); // 1.35 * 0.3
});

test('computeTimbreByLength clamps cutoff to 9500 Hz ceiling', () => {
  const r = computeTimbreByLength(64, 5000, 0.3, 0.3); // 3.5x = 17500 → clamp
  assert.equal(r.cutoff, 9500);
});

test('computeTimbreByLength clamps reverb to 0.9 ceiling', () => {
  const r = computeTimbreByLength(32, 2400, 0.8, 0.3); // 1.6x = 1.28 → clamp
  assert.equal(r.reverb, 0.9);
});

test('computeTimbreByLength clamps delay feedback to 0.75 ceiling', () => {
  const r = computeTimbreByLength(32, 2400, 0.3, 0.7); // 1.35x = 0.945 → clamp
  assert.equal(r.delay, 0.75);
});

test('computeTimbreByLength is monotonically non-decreasing in length', () => {
  let prev = computeTimbreByLength(1, 2400, 0.4, 0.45);
  for (let n = 2; n <= 32; n++) {
    const curr = computeTimbreByLength(n, 2400, 0.4, 0.45);
    assert.ok(curr.cutoff >= prev.cutoff, `cutoff decreased at n=${n}`);
    assert.ok(curr.reverb >= prev.reverb, `reverb decreased at n=${n}`);
    assert.ok(curr.delay >= prev.delay, `delay decreased at n=${n}`);
    prev = curr;
  }
});

test('computeTimbreByLength plateaus at length ≥ 32 (further growth does not change multipliers)', () => {
  const at32 = computeTimbreByLength(32, 1000, 0.3, 0.3);
  const at100 = computeTimbreByLength(100, 1000, 0.3, 0.3);
  assert.ok(Math.abs(at32.cutoff - at100.cutoff) < 1e-6);
  assert.ok(Math.abs(at32.reverb - at100.reverb) < 1e-9);
  assert.ok(Math.abs(at32.delay - at100.delay) < 1e-9);
});
