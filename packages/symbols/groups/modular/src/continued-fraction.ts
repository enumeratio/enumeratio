// Exact continued fractions of quadratic irrationals via the PQa algorithm, and
// high-precision (BigDecimal, certified) continued fractions of anything else compute-engine
// can evaluate numerically — the machinery behind the extended `ContinuedFraction` /
// `FromContinuedFraction` in declare.ts. Kept apart so the bigint arithmetic is testable
// without an engine, the same reasoning as `convergents.ts`.

import { isqrt } from "@enumeratio/residues";

/** Floor division for bigints (rounds toward −∞, unlike `/`, which truncates toward 0). */
function floorDiv(n: bigint, d: bigint): bigint {
  const q = n / d;
  const r = n % d;
  return r !== 0n && r < 0n !== d < 0n ? q - 1n : q;
}

/** −1, 0 or 1 comparing the integer `x` against the real `√D` (`D ≥ 0`), exactly. */
function cmpToSqrt(x: bigint, D: bigint): -1 | 0 | 1 {
  if (x < 0n) return -1;
  const sq = x * x;
  return sq < D ? -1 : sq > D ? 1 : 0;
}

/**
 * `⌊(P + √D)/Q⌋` for integers `P`, `Q ≠ 0`, `D ≥ 0`. `sqrtD` is `⌊√D⌋`, passed in so callers
 * that loop don't recompute it. Starts from a floating-point estimate (exact whenever `P`,
 * `Q`, `D` fit a double) and corrects it by exact bigint comparison, so the result is exact
 * regardless of how big the operands get.
 */
function floorPQ(P: bigint, Q: bigint, D: bigint, sqrtD: bigint): bigint {
  let a = floorDiv(P + sqrtD, Q);
  const holds = (candidate: bigint): boolean => {
    const L = candidate * Q - P;
    const R = (candidate + 1n) * Q - P;
    return Q > 0n ? cmpToSqrt(L, D) <= 0 && cmpToSqrt(R, D) > 0 : cmpToSqrt(L, D) >= 0 && cmpToSqrt(R, D) < 0;
  };
  for (let guard = 0; guard < 64 && !holds(a); guard++) {
    const L = a * Q - P;
    const tooBig = Q > 0n ? cmpToSqrt(L, D) > 0 : cmpToSqrt(L, D) < 0;
    a = tooBig ? a - 1n : a + 1n;
  }
  return a;
}

export interface PqaExpansion {
  /** The leading, non-periodic terms — ordinarily just `[a0]`. */
  readonly pre: readonly bigint[];
  /** The periodic block that follows `pre`, repeating forever. */
  readonly period: readonly bigint[];
}

/**
 * The PQa expansion of `x = (a + b·√d)/c` — integers, `d` squarefree `> 1`, `b, c ≠ 0` — the
 * eventually-periodic regular continued fraction, exact bigint arithmetic throughout.
 *
 * Standard algorithm: normalize to `x0 = (P0 + √D)/Q0` with `Q0 | (D − P0²)`, then iterate
 * `a_i = ⌊(P_i + √D)/Q_i⌋`, `P_{i+1} = a_i·Q_i − P_i`, `Q_{i+1} = (D − P_{i+1}²)/Q_i`
 * (exact, given the invariant). Lagrange's theorem guarantees a `(P_i, Q_i)` pair repeats.
 */
export function pqaExpansion(a: bigint, b: bigint, c: bigint, d: bigint): PqaExpansion {
  if (b === 0n || c === 0n) throw new Error("pqaExpansion: b and c must be nonzero");
  const absB = b < 0n ? -b : b;
  let D = absB * absB * d;
  // (a + b√d)/c = (a|b| + b|b|√d)/(c|b|) = (a|b| ± √D)/(c|b|), sign = sign(b). A minus sign
  // on √D is folded away by negating both P0 and Q0 (see the module's design notes): dividing
  // (P − √D)/Q is the same real number as (−P + √D)/(−Q).
  let P0 = a * absB;
  let Q0 = c * absB;
  if (b < 0n) {
    P0 = -P0;
    Q0 = -Q0;
  }
  // Normalize so Q0 | (D − P0²): scale num/denom by |Q0| (multiplies D by Q0², P0 and Q0 by
  // |Q0|) whenever the divisibility the recurrence relies on doesn't already hold.
  if ((D - P0 * P0) % Q0 !== 0n) {
    const scale = Q0 < 0n ? -Q0 : Q0;
    P0 *= scale;
    Q0 *= scale;
    D *= scale * scale;
  }
  const sqrtD = isqrt(D);

  const terms: bigint[] = [];
  const seen = new Map<string, number>();
  let P = P0;
  let Q = Q0;
  for (let i = 0; i < 1_000_000; i++) {
    const key = `${P},${Q}`;
    const prev = seen.get(key);
    if (prev !== undefined) return { pre: terms.slice(0, prev), period: terms.slice(prev) };
    seen.set(key, i);
    const ai = floorPQ(P, Q, D, sqrtD);
    terms.push(ai);
    const Pnext = ai * Q - P;
    Q = (D - Pnext * Pnext) / Q;
    P = Pnext;
  }
  throw new Error("pqaExpansion: no period found (unreachable for a genuine quadratic irrational)");
}
