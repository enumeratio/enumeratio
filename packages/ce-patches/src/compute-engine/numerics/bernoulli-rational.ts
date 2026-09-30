// Exact Bernoulli numbers (B₁ = −1/2 convention) as reduced bigint rationals,
// plus the Bernoulli polynomial Bₘ(a) emitted as MathJSON. Two consumers:
//   • the exact ζ(−n, a) = −B_{n+1}(a)/(n+1) closed form (symbolic in a), and
//   • the Euler–Maclaurin tail, which wants B₂ₖ as doubles.

export type Rat = readonly [bigint, bigint]; // [num, den], den > 0, reduced

/** MathJSON node — loose enough for the small polynomials we build here. */
export type Json = number | string | { num: string } | Json[];

const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
};

const normalize = ([n, d]: readonly [bigint, bigint]): Rat => {
  if (d < 0n) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1n;
  return [n / g, d / g];
};

/** Binomial coefficient C(n, k) as a bigint. */
const binom = (n: number, k: number): bigint => {
  if (k < 0 || k > n) return 0n;
  k = Math.min(k, n - k);
  let num = 1n;
  let den = 1n;
  for (let i = 0; i < k; i++) {
    num *= BigInt(n - i);
    den *= BigInt(i + 1);
  }
  return num / den;
};

// Tangent numbers T₁, T₂, … (1, 2, 16, 272, …), by Brent and Harvey's integer-only
// recurrence. B₂ₖ = (−1)^{k−1} 2k Tₖ / (4ᵏ(4ᵏ − 1)), which is far cheaper than the
// all-rational Bernoulli recurrence when the Euler–Maclaurin tail wants B₂₀₀ and beyond.
let tangent: bigint[] = [];
function tangentNumber(k: number): bigint {
  if (k < tangent.length) return tangent[k];
  const n = Math.max(k, 2 * (tangent.length - 1), 16);
  const t: bigint[] = [0n, 1n];
  for (let i = 2; i <= n; i++) t[i] = BigInt(i - 1) * t[i - 1];
  for (let i = 2; i <= n; i++) for (let j = i; j <= n; j++) t[j] = BigInt(j - i) * t[j - 1] + BigInt(j - i + 2) * t[j];
  tangent = t;
  return t[k];
}

const cache: Rat[] = [];

/** Bernoulli number Bₘ as an exact reduced rational (B₁ = −1/2). */
export function bernoulliRational(m: number): Rat {
  if (cache[m]) return cache[m];
  if (m === 0) return (cache[0] = [1n, 1n]);
  if (m === 1) return (cache[1] = [-1n, 2n]);
  if (m % 2 === 1) return (cache[m] = [0n, 1n]);
  const k = m / 2;
  const four = 4n ** BigInt(k);
  const num = BigInt(m) * tangentNumber(k);
  return (cache[m] = normalize([k % 2 === 1 ? num : -num, four * (four - 1n)]));
}

/** Bernoulli number Bₘ as a double (for the Euler–Maclaurin coefficients). */
export const bernoulliNumber = (m: number): number => {
  const [n, d] = bernoulliRational(m);
  return Number(n) / Number(d);
};

const intNode = (v: bigint): Json =>
  v <= BigInt(Number.MAX_SAFE_INTEGER) && v >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(v) : { num: v.toString() };

const ratNode = ([n, d]: Rat): Json => (d === 1n ? intNode(n) : ["Rational", intNode(n), intNode(d)]);

/**
 * The Bernoulli polynomial Bₘ(a) as a double, from the exact rational coefficients.
 * Used where an exact ζ(−n, a) beats Euler–Maclaurin's relative accuracy: a sum of
 * ζ(−n, r/k) over r cancels by a factor of k^n, which turns 1e-13 into 1e-10.
 */
export function bernoulliPolyAt(m: number, a: number): number {
  let sum = 0;
  for (let k = 0; k <= m; k++) {
    const [bn, bd] = bernoulliRational(k);
    if (bn === 0n) continue;
    sum += (Number(binom(m, k) * bn) / Number(bd)) * Math.pow(a, m - k);
  }
  return sum;
}

/**
 * The Bernoulli polynomial Bₘ(a) = Σ_{k=0}^{m} C(m,k) B_k a^{m-k}, as a MathJSON
 * expression in the operand `a` (which may itself be symbolic). Zero coefficients
 * (odd k > 1) are dropped.
 */
export function bernoulliPolyExpr(m: number, a: Json): Json {
  const terms: Json[] = [];
  for (let k = 0; k <= m; k++) {
    const b = bernoulliRational(k);
    if (b[0] === 0n) continue;
    const coeff = normalize([binom(m, k) * b[0], b[1]]);
    const e = m - k;
    const c = ratNode(coeff);
    if (e === 0) terms.push(c);
    else if (coeff[0] === 1n && coeff[1] === 1n) terms.push(e === 1 ? a : ["Power", a, e]);
    else terms.push(["Multiply", c, e === 1 ? a : ["Power", a, e]]);
  }
  return terms.length === 1 ? terms[0] : ["Add", ...terms];
}
