// Kernels for `Mod(f(args), m)` (registered in declare-modular-kernels.ts): f(args) modulo
// m > 0 without building f(args). Each takes exact integer arguments and answers a residue
// in [0, m), or `undefined` to decline (outside its range, or past the step budget) so the
// ordinary evaluation runs. Fibonacci and LucasL are fast-recurrence.ts's `fibonacciMod`
// and `lucasLMod`.
import { checkpoint } from "@enumeratio/engine";
import { crt, factorInteger, invMod, isPrime } from "@enumeratio/residues";

/** Multiplications a kernel may spend before declining, in double-product units: seconds, and far
 *  past what building the exact value could do. */
const STEP_BUDGET = 50_000_000;

/** A bigint multiplication costs about this many double ones. */
const BIGINT_WEIGHT = 4;

/** Iterations between budget and deadline checks inside one product. */
const CHUNK = 100_000;

/** Thrown past the budget; every public kernel catches it and declines. */
class OverBudget extends Error {}

/** Residues up to this fit a double product exactly (m² < 2⁵³). */
const SAFE_MODULUS = 1n << 26n;

const residue = (a: bigint, m: bigint): bigint => {
  const r = a % m;
  return r < 0n ? r + m : r;
};

/** Counts steps against one kernel call's budget. */
class Meter {
  private left = STEP_BUDGET;
  /** Throws now if `steps` more would overrun the budget, so a hopeless product declines before it starts. */
  require(steps: number): void {
    if (steps > this.left) throw new OverBudget();
  }
  spend(steps: number): void {
    this.left -= steps;
    if (this.left < 0) throw new OverBudget();
    checkpoint();
  }
}

/** ∏ k for lo ≤ k ≤ hi, k not a multiple of `skip` (when given), modulo m; 0 stays 0. */
function productRange(lo: bigint, hi: bigint, m: bigint, meter: Meter, skip?: bigint): bigint {
  if (hi < lo) return 1n % m;
  const fast = m <= SAFE_MODULUS;
  const weight = fast ? 1 : BIGINT_WEIGHT;
  meter.require((Number(hi - lo) + 1) * weight);
  if (fast) {
    const [mm, p] = [Number(m), skip === undefined ? 0 : Number(skip)];
    let r = 1 % mm;
    for (let start = Number(lo), last = Number(hi); start <= last; start += CHUNK) {
      const end = Math.min(last, start + CHUNK - 1);
      meter.spend(end - start + 1);
      for (let k = start; k <= end; k++) {
        if (p !== 0 && k % p === 0) continue;
        r = (r * (k % mm)) % mm;
        if (r === 0) return 0n;
      }
    }
    return BigInt(r);
  }
  const step = BigInt(CHUNK);
  let r = 1n;
  for (let start = lo; start <= hi; start += step) {
    const end = start + step - 1n < hi ? start + step - 1n : hi;
    meter.spend(Number(end - start + 1n) * weight);
    for (let k = start; k <= end; k++) {
      if (skip !== undefined && k % skip === 0n) continue;
      r = (r * (k % m)) % m;
      if (r === 0n) return 0n;
    }
  }
  return r;
}

/** n! mod m for n ≥ 0, m ≥ 1. */
export function factorialMod(n: bigint, m: bigint): bigint | undefined {
  if (n < 0n) return undefined;
  if (m === 1n || n >= m) return 0n;
  try {
    const meter = new Meter();
    // Wilson: n!·(p−1−n)! ≡ (−1)ⁿ⁺¹ (mod p), so past halfway the short product is inverted.
    const rest = m - 1n - n;
    if (n > 64n && rest < n && isPrime(m)) {
      const inverse = invMod(productRange(2n, rest, m, meter), m)!;
      return n % 2n === 0n ? residue(-inverse, m) : inverse;
    }
    return productRange(2n, n, m, meter);
  } catch (e) {
    if (e instanceof OverBudget) return undefined;
    throw e;
  }
}

/** The p-adic valuation of n! (Legendre). */
function factorialValuation(n: bigint, p: bigint): bigint {
  let v = 0n;
  for (let q = n / p; q > 0n; q /= p) v += q;
  return v;
}

/** C(n, k) mod a prime p, 0 ≤ k ≤ n, by Lucas's theorem: digit by digit in base p. */
function binomialModPrime(n: bigint, k: bigint, p: bigint, meter: Meter): bigint {
  let result = 1n;
  for (let a = n, b = k; a > 0n; a /= p, b /= p) {
    const [ai, bi] = [a % p, b % p];
    if (bi > ai) return 0n;
    const t = bi < ai - bi ? bi : ai - bi;
    if (t === 0n) continue;
    const numerator = productRange(ai - t + 1n, ai, p, meter);
    const denominator = productRange(1n, t, p, meter);
    result = (result * numerator * invMod(denominator, p)!) % p;
  }
  return result;
}

/** n! / p^v(n!) modulo q = pᵉ: the product of what is prime to p, recursing on ⌊n/p⌋. */
function unitFactorial(n: bigint, p: bigint, e: number, q: bigint, meter: Meter): bigint {
  // Over a full period the units multiply to −1, except mod 2ᵉ for e ≥ 3 where it is 1.
  const period = p === 2n && e >= 3 ? 1n : q - 1n;
  let result = 1n;
  for (let a = n; a > 0n; a /= p) {
    let u = productRange(1n, a % q, q, meter, p);
    if (period !== 1n && (a / q) % 2n === 1n) u = residue(-u, q);
    result = (result * u) % q;
  }
  return result;
}

/** C(n, k) mod pᵉ, 0 ≤ k ≤ n (Granville): the p-part from Kummer, the unit part from `unitFactorial`. */
function binomialModPrimePower(n: bigint, k: bigint, p: bigint, e: number, meter: Meter): bigint {
  const q = p ** BigInt(e);
  const carries = factorialValuation(n, p) - factorialValuation(k, p) - factorialValuation(n - k, p);
  if (carries >= BigInt(e)) return 0n;
  const [top, low, high] = [n, k, n - k].map((a) => unitFactorial(a, p, e, q, meter)) as [bigint, bigint, bigint];
  const unit = (((top * invMod(low, q)!) % q) * invMod(high, q)!) % q;
  return (unit * p ** carries) % q;
}

/** The prime factorisation of m ≥ 2 when it is cheap to find, else undefined. */
function factorsOf(m: bigint): [bigint, number][] | undefined {
  if (isPrime(m)) return [[m, 1]];
  return m < 1n << 64n ? factorInteger(m) : undefined;
}

/** `combine` evaluated mod each prime power of m, put back together by CRT. */
function overFactors(
  m: bigint,
  combine: (p: bigint, e: number, q: bigint, meter: Meter) => bigint,
): bigint | undefined {
  const factors = factorsOf(m);
  if (factors === undefined) return undefined;
  try {
    const meter = new Meter();
    return crt(factors.map(([p, e]) => [combine(p, e, p ** BigInt(e), meter), p ** BigInt(e)] as const));
  } catch (e) {
    if (e instanceof OverBudget) return undefined;
    throw e;
  }
}

/** C(n, k) modulo pᵉ for n ≥ 0, any k. */
const binomialAt = (n: bigint, k: bigint) => (p: bigint, e: number, q: bigint, meter: Meter) => {
  if (k < 0n || k > n) return 0n;
  const low = k < n - k ? k : n - k; // C(n, k) = C(n, n − k): the shorter product
  if (low === 0n) return 1n % q;
  return e === 1 ? binomialModPrime(n, low, p, meter) : binomialModPrimePower(n, low, p, e, meter);
};

/** C(n, k) mod m for n ≥ 0 (k outside 0..n gives 0), m ≥ 1. */
export function binomialMod(n: bigint, k: bigint, m: bigint): bigint | undefined {
  if (n < 0n) return undefined;
  if (m === 1n || k < 0n || k > n) return 0n;
  return overFactors(m, binomialAt(n, k));
}

/** The nth Catalan number mod m, as C(2n, n) − C(2n, n + 1), for n ≥ 0, m ≥ 1. */
export function catalanMod(n: bigint, m: bigint): bigint | undefined {
  if (n < 0n) return undefined;
  if (m === 1n) return 0n;
  const [central, next] = [binomialAt(2n * n, n), binomialAt(2n * n, n + 1n)];
  return overFactors(m, (p, e, q, meter) => residue(central(p, e, q, meter) - next(p, e, q, meter), q));
}

/** The parts' multinomial coefficient mod m, as ∏ C(n₁ + … + nᵢ, nᵢ) with the largest part first, so
 *  every binomial is the short one. Parts are non-negative; m ≥ 1. */
export function multinomialMod(parts: readonly bigint[], m: bigint): bigint | undefined {
  if (parts.some((n) => n < 0n)) return undefined;
  if (m === 1n) return 0n;
  const sorted = parts.filter((n) => n > 0n).toSorted((a, b) => (a > b ? -1 : a < b ? 1 : 0));
  const terms: (readonly [bigint, bigint])[] = [];
  for (let i = 1, total = sorted[0] ?? 0n; i < sorted.length; i++) {
    total += sorted[i]!;
    terms.push([total, sorted[i]!]);
  }
  return overFactors(m, (p, e, q, meter) => {
    let result = 1n % q;
    for (const [n, k] of terms) {
      result = (result * binomialAt(n, k)(p, e, q, meter)) % q;
      if (result === 0n) break;
    }
    return result;
  });
}

/** The rising factorial a(a+1)…(a+n−1) mod m for n ≥ 0, m ≥ 1. */
export function pochhammerMod(a: bigint, n: bigint, m: bigint): bigint | undefined {
  if (n < 0n) return undefined;
  if (m === 1n) return 0n;
  if (n === 0n) return 1n;
  // n consecutive integers hold a multiple of m once they wrap past one.
  const first = residue(a, m);
  if (first === 0n || first + n > m) return 0n;
  // Otherwise 1 ≤ first ≤ first + n − 1 < m: (first+n−1)! / (first−1)!. For a prime each factorial has
  // Wilson's shortcut, which beats the n-term product when the range sits near either end of 1..m−1.
  const near = (k: bigint): bigint => (k < m - 1n - k ? k : m - 1n - k);
  if (n > 64n && near(first + n - 1n) + near(first - 1n) < n && isPrime(m)) {
    const [top, bottom] = [factorialMod(first + n - 1n, m), factorialMod(first - 1n, m)];
    return top === undefined || bottom === undefined ? undefined : (top * invMod(bottom, m)!) % m;
  }
  try {
    return productRange(first, first + n - 1n, m, new Meter());
  } catch (e) {
    if (e instanceof OverBudget) return undefined;
    throw e;
  }
}

/** The derangement count !n mod m for n ≥ 0, m ≥ 1, from !k = k·!(k−1) + (−1)ᵏ. For a prime p,
 *  !(k+p) ≡ −!k, so only n mod p steps are taken. */
export function subfactorialMod(n: bigint, m: bigint): bigint | undefined {
  if (n < 0n) return undefined;
  if (m === 1n) return 0n;
  const prime = isPrime(m);
  const steps = prime ? n % m : n;
  const flip = prime && (n / m) % 2n === 1n;
  try {
    const meter = new Meter();
    const fast = m <= SAFE_MODULUS;
    meter.require(Number(steps) * (fast ? 1 : BIGINT_WEIGHT));
    let d: bigint;
    if (fast) {
      const mm = Number(m);
      let r = 1 % mm;
      for (let start = 1, last = Number(steps); start <= last; start += CHUNK) {
        const end = Math.min(last, start + CHUNK - 1);
        meter.spend(end - start + 1);
        for (let k = start; k <= end; k++) r = ((k % mm) * r + (k % 2 === 0 ? 1 : mm - 1)) % mm;
      }
      d = BigInt(r);
    } else {
      d = 1n;
      const step = BigInt(CHUNK);
      for (let start = 1n; start <= steps; start += step) {
        const end = start + step - 1n < steps ? start + step - 1n : steps;
        meter.spend(Number(end - start + 1n) * BIGINT_WEIGHT);
        for (let k = start; k <= end; k++) d = (k * d + (k % 2n === 0n ? 1n : m - 1n)) % m;
      }
    }
    return flip ? residue(-d, m) : d;
  } catch (e) {
    if (e instanceof OverBudget) return undefined;
    throw e;
  }
}

/** Row n, column k of a Stirling triangle mod m, each cell from the one above and the one above-left. */
function stirlingRows(
  n: bigint,
  k: bigint,
  cell: (row: bigint, col: bigint, above: bigint, aboveLeft: bigint) => bigint,
): bigint {
  const meter = new Meter();
  meter.require(Number(n) * Number(k) * BIGINT_WEIGHT);
  const [rows, cols] = [Number(n), Number(k)];
  let previous: bigint[] = [1n];
  for (let l = 1; l <= rows; l++) {
    const width = Math.min(l, cols);
    meter.spend(width * BIGINT_WEIGHT);
    const row: bigint[] = new Array(width + 1);
    row[0] = 0n;
    for (let d = 1; d <= width; d++) row[d] = cell(BigInt(l), BigInt(d), previous[d] ?? 0n, previous[d - 1] ?? 0n);
    previous = row;
  }
  return previous[cols] ?? 0n;
}

/** The Stirling number of the second (`kind` 2) or signed first (`kind` 1) kind of n and k, mod m;
 *  n, k ≥ 0, m ≥ 1. */
export function stirlingMod(n: bigint, k: bigint, m: bigint, kind: 1 | 2): bigint | undefined {
  if (n < 0n || k < 0n) return undefined;
  if (m === 1n) return 0n;
  if (k > n) return 0n;
  if (n === 0n) return 1n;
  if (k === 0n) return 0n;
  if (k === n || (kind === 2 && k === 1n)) return 1n;
  try {
    return stirlingRows(n, k, (l, d, above, aboveLeft) =>
      kind === 2 ? (d * above + aboveLeft) % m : residue(aboveLeft - (l - 1n) * above, m),
    );
  } catch (e) {
    if (e instanceof OverBudget) return undefined;
    throw e;
  }
}

/** The Bell number B(n) mod m for n ≥ 0, m ≥ 1, along the Bell triangle (n²/2 additions). */
export function bellMod(n: bigint, m: bigint): bigint | undefined {
  if (n < 0n) return undefined;
  if (m === 1n) return 0n;
  try {
    const meter = new Meter();
    meter.require((Number(n) * (Number(n) + 1) * BIGINT_WEIGHT) / 2);
    let row: bigint[] = [1n];
    for (let i = 1; i <= Number(n); i++) {
      meter.spend(i * BIGINT_WEIGHT);
      const next: bigint[] = [row[i - 1]!];
      for (let j = 0; j < i; j++) next.push((next[j]! + row[j]!) % m);
      row = next;
    }
    return row[0]! % m;
  } catch (e) {
    if (e instanceof OverBudget) return undefined;
    throw e;
  }
}
