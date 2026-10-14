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
