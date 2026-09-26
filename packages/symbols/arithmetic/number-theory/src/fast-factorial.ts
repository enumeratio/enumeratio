// Binary splitting for n!: multiply the range [2, n] as a balanced product tree instead of
// compute-engine's native sequential `result *= k` loop. The sequential loop multiplies a
// steadily-growing bigint by a single small factor n times — O(n) multiplications, each
// touching the whole (already large) accumulator, which is the same O(n · digits) shape
// that makes the native Fibonacci/LucasL loops slow (see fast-recurrence.ts). Binary
// splitting instead multiplies pairs of comparably-sized bigints, letting compute-engine's
// (V8's) sub-quadratic bigint multiplication actually pay off: 100000! in ~28ms measured,
// against ~2.8s for the native loop.

/** Product of the integers in [lo, hi) — half-open, so the empty range is 1. */
function rangeProduct(lo: bigint, hi: bigint): bigint {
  const span = hi - lo;
  if (span <= 0n) return 1n;
  if (span === 1n) return lo;
  if (span === 2n) return lo * (lo + 1n);
  const mid = lo + span / 2n;
  return rangeProduct(lo, mid) * rangeProduct(mid, hi);
}

/** n! for n ≥ 0, exact. */
export function factorial(n: bigint): bigint {
  if (n <= 1n) return 1n;
  return rangeProduct(2n, n + 1n);
}
