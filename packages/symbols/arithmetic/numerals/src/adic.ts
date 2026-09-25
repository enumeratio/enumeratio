// b-adic numbers: the completion of the rationals under "divisible by a high power of b
// means small". For prime b this is Q_p, a field; for composite b it is the ring Z_b, which
// has zero divisors (…890625 · …109376 = 0 in Z_10) and no field of fractions, so the
// composite case stays an integer ring with division by units only.
//
// Two kinds of value share one shape. An EXACT adic is a rational whose expansion we can
// produce to any depth (it is eventually periodic). A CAPPED adic is known only modulo
// b^prec — what a Hensel lift produces, and what any arithmetic with a capped operand
// yields. Capped values are stored NORMALISED: the unique representative m·b^v with
// 0 ≤ m < b^(prec−v), so two equal values have one spelling.
//
// Everything is bigint: 20 digits of base 10 is already past 2^53.

import { gcd, invMod, isPrime, mod, valuation as integerValuation } from "@enumeratio/residues";

export interface Adic {
  readonly base: bigint;
  /** The value as an exact rational; for a capped value, its normalised representative. */
  readonly num: bigint;
  readonly den: bigint;
  /** Absolute precision: the value is known modulo base^prec. Absent when exact. */
  readonly prec?: number;
}

/** The precision an unbounded computation (a Hensel lift) is carried to. */
export const DEFAULT_PRECISION = 20;

export const pow = (b: bigint, e: number): bigint => b ** BigInt(e);

/** The largest `k` with `b^k | n` (`Infinity` for `n = 0`). */
const order = (base: bigint, n: bigint): number => (n === 0n ? Number.POSITIVE_INFINITY : integerValuation(n, base)[0]);

/**
 * The b-adic valuation of `num/den`. For prime `b` this is `ord(num) − ord(den)`; for
 * composite `b` a denominator sharing a factor with `b` has no b-adic expansion at all
 * (1/2 is not a 10-adic integer, and there is no 10-adic field to put it in), so the
 * answer is `undefined` unless the denominator is coprime to `b`.
 */
export function valuation(base: bigint, num: bigint, den: bigint): number | undefined {
  if (num === 0n) return Number.POSITIVE_INFINITY;
  const up = order(base, num);
  if (isPrime(base)) return up - order(base, den);
  return gcd(den, base) === 1n ? up : undefined;
}

/** Reduce and sign-normalise a rational. */
export function rational(num: bigint, den: bigint): readonly [bigint, bigint] {
  if (den === 0n) throw new RangeError("zero denominator");
  const g = gcd(num, den) || 1n;
  const sign = den < 0n ? -1n : 1n;
  return [(sign * num) / g, (sign * den) / g];
}

/** An exact adic from a rational, or `undefined` if `b` cannot expand it. */
export function exact(base: bigint, num: bigint, den: bigint): Adic | undefined {
  if (base < 2n) return undefined;
  const [n, d] = rational(num, den);
  return valuation(base, n, d) === undefined ? undefined : { base, num: n, den: d };
}

/**
 * The capped adic `x + O(b^prec)`, normalised. The representative is `m · b^v` with `m`
 * the residue of the unit part modulo `b^(prec−v)`; when `v ≥ prec` nothing is known and
 * the value is `O(b^prec)`, stored as zero.
 */
export function capped(base: bigint, num: bigint, den: bigint, prec: number): Adic | undefined {
  const [n, d] = rational(num, den);
  const v = valuation(base, n, d);
  if (v === undefined) return undefined;
  if (v >= prec) return { base, num: 0n, den: 1n, prec };
  // Split off b^v so the rest is a unit: n/d = b^v · (n'/d') with n', d' coprime to b.
  const scale = pow(base, Math.abs(v));
  const [un, ud] = v >= 0 ? [n / scale, d] : [n, d / scale];
  const modulus = pow(base, prec - v);
  const inverse = invMod(ud, modulus);
  if (inverse === undefined) return undefined; // cannot happen once valuation() passed
  const m = mod(un * inverse, modulus);
  return v >= 0 ? { base, num: m * scale, den: 1n, prec } : { base, num: m, den: scale, prec };
}

/** Re-normalise any adic at (at most) the given precision; exact values pass through. */
export function at(x: Adic, prec: number | undefined): Adic | undefined {
  if (prec === undefined) return x;
  const bound = x.prec === undefined ? prec : Math.min(prec, x.prec);
  return capped(x.base, x.num, x.den, bound);
}

export const valuationOf = (x: Adic): number => {
  const v = valuation(x.base, x.num, x.den);
  // A capped zero is O(b^prec): its valuation is only known to be at least prec.
  return v === Number.POSITIVE_INFINITY && x.prec !== undefined ? x.prec : (v as number);
};

/** The unit part `u` in `x = b^v · u`; for zero, zero. */
export function unitPart(x: Adic): Adic | undefined {
  if (x.num === 0n) return x;
  const v = valuationOf(x);
  const scale = pow(x.base, Math.abs(v));
  const [n, d] = v >= 0 ? [x.num / scale, x.den] : [x.num, x.den / scale];
  const prec = x.prec === undefined ? undefined : x.prec - v;
  return prec === undefined ? { base: x.base, num: n, den: d } : capped(x.base, n, d, prec);
}

// ── arithmetic ──────────────────────────────────────────────────────────────────

const sameBase = (x: Adic, y: Adic): boolean => x.base === y.base;

const minPrec = (...ps: (number | undefined)[]): number | undefined =>
  ps.reduce<number | undefined>(
    (acc, p) => (p === undefined ? acc : acc === undefined ? p : Math.min(acc, p)),
    undefined,
  );

const finish = (base: bigint, num: bigint, den: bigint, prec: number | undefined): Adic | undefined =>
  prec === undefined ? exact(base, num, den) : capped(base, num, den, prec);

export function add(x: Adic, y: Adic): Adic | undefined {
  if (!sameBase(x, y)) return undefined;
  return finish(x.base, x.num * y.den + y.num * x.den, x.den * y.den, minPrec(x.prec, y.prec));
}

export const negate = (x: Adic): Adic | undefined => finish(x.base, -x.num, x.den, x.prec);

export function subtract(x: Adic, y: Adic): Adic | undefined {
  const ny = negate(y);
  return ny === undefined ? undefined : add(x, ny);
}

/**
 * Multiplying capped values loses absolute precision: `(u·b^v + O(b^p))(u'·b^v' + O(b^p'))`
 * is known modulo `b^min(v + p', v' + p)`.
 */
export function multiply(x: Adic, y: Adic): Adic | undefined {
  if (!sameBase(x, y)) return undefined;
  const prec = minPrec(
    x.prec === undefined ? undefined : x.prec + valuationOf(y),
    y.prec === undefined ? undefined : y.prec + valuationOf(x),
  );
  return finish(x.base, x.num * y.num, x.den * y.den, prec);
}

/**
 * Division. For prime b any non-zero divisor works (the result may have negative
 * valuation); for composite b only a UNIT — valuation zero — has an inverse.
 */
export function divide(x: Adic, y: Adic): Adic | undefined {
  if (!sameBase(x, y) || y.num === 0n) return undefined;
  const vy = valuationOf(y);
  // A unit of Z_b for composite b is coprime to b, not merely of valuation zero: 2 has
  // 10-adic valuation 0 and still no inverse.
  if (!isPrime(x.base) && (vy !== 0 || gcd(y.num, x.base) !== 1n)) return undefined;
  const prec = minPrec(
    x.prec === undefined ? undefined : x.prec - vy,
    y.prec === undefined ? undefined : y.prec - 2 * vy + valuationOf(x),
  );
  return finish(x.base, x.num * y.den, x.den * y.num, prec);
}

export function power(x: Adic, e: number): Adic | undefined {
  if (!Number.isInteger(e)) return undefined;
  if (e === 0) return exact(x.base, 1n, 1n);
  const one = exact(x.base, 1n, 1n);
  if (one === undefined) return undefined;
  let result: Adic | undefined = one;
  let base: Adic | undefined = x;
  if (e < 0) {
    base = divide(one, x);
    if (base === undefined) return undefined;
  }
  for (let k = Math.abs(e); k > 0 && base !== undefined && result !== undefined; k >>= 1) {
    if (k & 1) result = multiply(result, base);
    if (k > 1) base = multiply(base, base);
  }
  return result;
}

// ── expansion ───────────────────────────────────────────────────────────────────

export interface Expansion {
  /** Position of the first digit: the valuation (negative for a fractional part). */
  readonly start: number;
  /** Digits from `start` upwards — LEAST significant first, since the left end is infinite. */
  readonly digits: readonly number[];
  /** Whether the digits shown are all that is known (a capped value). */
  readonly capped: boolean;
}

/**
 * The first `count` digits of `x`, from its valuation upwards. Each digit is the residue
 * of the current unit modulo b, then the digit is subtracted and the rest divided by b —
 * long division running rightwards, which is why it never ends for −1 or 1/3.
 */
export function expansion(x: Adic, count: number): Expansion {
  if (x.num === 0n) {
    const n = x.prec === undefined ? count : Math.min(count, x.prec);
    return { start: 0, digits: Array.from({ length: n }, () => 0), capped: x.prec !== undefined };
  }
  const v = valuationOf(x);
  const scale = pow(x.base, Math.abs(v));
  let [n, d] = v >= 0 ? [x.num / scale, x.den] : [x.num, x.den / scale];
  const available = x.prec === undefined ? count : Math.max(0, Math.min(count, x.prec - v));
  const inverse = invMod(d, x.base) ?? 0n; // d is coprime to base by construction
  const digits: number[] = [];
  for (let i = 0; i < available; i += 1) {
    const digit = mod(n * inverse, x.base);
    digits.push(Number(digit));
    n = (n - digit * d) / x.base;
  }
  return { start: v, digits, capped: x.prec !== undefined };
}

/**
 * The expansion as text: `…d₂d₁d₀` for an integer, `…d₁d₀.d₋₁d₋₂` past a point for a
 * negative valuation, `+ O(b^n)` when capped. Digits ≥ 10 are bracketed. The ellipsis
 * marks the infinite left end; it is omitted when the digits shown are followed only by
 * zeros (an ordinary non-negative integer).
 */
export function render(x: Adic, count: number): string {
  const { start, digits, capped: isCapped } = expansion(x, count);
  const glyph = (d: number): string => (d < 10 ? String(d) : `[${d}]`);
  const fractional = Math.max(0, -start);
  const padded = [...Array.from({ length: Math.max(0, start) }, () => 0), ...digits];
  const below = padded.slice(0, fractional).map(glyph).join("");
  const above = padded.slice(fractional).map(glyph).reverse().join("") || "0";
  // Nothing hides to the left when the value is an exact non-negative b^v · integer that
  // fits in the digits shown: the ellipsis would only cover zeros.
  const unit = x.prec === undefined ? unitPart(x) : undefined;
  const terminates =
    unit !== undefined &&
    unit.den === 1n &&
    unit.num >= 0n &&
    expansion(x, count + 1)
      .digits.slice(count)
      .every((d) => d === 0);
  const head = terminates ? above.replace(/^0+(?=\d)/, "") : `…${above}`;
  const body = fractional > 0 ? `${head}.${below.split("").reverse().join("")}` : head;
  return isCapped ? `${body} + O(${x.base}^${x.prec})` : body;
}

// ── Hensel ──────────────────────────────────────────────────────────────────────

/**
 * Lift a simple root: given `f(a) ≡ 0 (mod b)` and `f'(a)` a unit mod b, Newton's iteration
 * `a ← a − f(a)/f'(a)` converges in Z_b, doubling the number of correct digits each step.
 * `f` and `df` are evaluated on bigints so the caller can supply any polynomial. The
 * argument only needs `f'(a)` invertible modulo b, so composite b works too — lifting
 * x² − x from 5 in Z_10 is how the idempotent …890625 is found.
 */
export function henselLift(
  p: bigint,
  f: (x: bigint) => bigint | undefined,
  df: (x: bigint) => bigint | undefined,
  seed: bigint,
  prec: number,
): Adic | undefined {
  let a = mod(seed, p);
  const f0 = f(a);
  const df0 = df(a);
  if (f0 === undefined || df0 === undefined) return undefined;
  if (mod(f0, p) !== 0n || invMod(df0, p) === undefined) return undefined;
  let known = 1;
  while (known < prec) {
    known = Math.min(prec, known * 2);
    const modulus = pow(p, known);
    const fa = f(a);
    const dfa = df(a);
    if (fa === undefined || dfa === undefined) return undefined;
    const inverse = invMod(dfa, modulus);
    if (inverse === undefined) return undefined;
    a = mod(a - fa * inverse, modulus);
  }
  return capped(p, a, 1n, prec);
}

/**
 * A square root of a p-adic UNIT by Hensel. Odd p: `x` must be a quadratic residue mod p.
 * p = 2: `x ≡ 1 (mod 8)` is required, and the iteration starts one level up because
 * `f'(a) = 2a` is not a unit. Non-units: pull out `p^v`, which needs `v` even.
 */
export function sqrt(x: Adic, prec: number = DEFAULT_PRECISION): Adic | undefined {
  const p = x.base;
  if (!isPrime(p)) return undefined;
  if (x.num === 0n) return x;
  const v = valuationOf(x);
  if (v % 2 !== 0) return undefined;
  const unit = unitPart(x);
  if (unit === undefined) return undefined;
  const target = Math.min(prec, unit.prec ?? prec);
  const modulus = pow(p, target);
  const u = mod(unit.num * (invMod(unit.den, modulus) ?? 0n), modulus);
  let root: bigint | undefined;
  if (p === 2n) {
    if (mod(u, 8n) !== 1n) return undefined;
    // Lift from 2^3 upward one bit at a time: r ← r + t·2^(k−1) fixes the k+1-th bit.
    root = 1n;
    for (let k = 3; k < target; k += 1) {
      const m = pow(2n, k + 1);
      if (mod(root * root - u, m) !== 0n) root = mod(root + pow(2n, k - 1), m);
    }
    root = mod(root, modulus);
  } else {
    const residue = mod(u, p);
    let seed: bigint | undefined;
    for (let r = 1n; r < p; r += 1n) {
      if (mod(r * r, p) === residue) {
        seed = r;
        break;
      }
    }
    if (seed === undefined) return undefined;
    const lifted = henselLift(
      p,
      (a) => a * a - u,
      (a) => 2n * a,
      seed,
      target,
    );
    if (lifted === undefined) return undefined;
    root = lifted.num;
  }
  const half = pow(p, Math.abs(v) / 2);
  return v >= 0 ? capped(p, root * half, 1n, target + v / 2) : capped(p, root, half, target + v / 2);
}
