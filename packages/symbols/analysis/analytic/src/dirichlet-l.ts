import { bernoulliPolyAt } from "./bernoulli.ts";
import { add, cexp, cpow, cx, type Cx, mul, scale } from "./complex.ts";
import { hurwitzZeta } from "./hurwitz-zeta.ts";
import { stieltjesGamma } from "./stieltjes.ts";

// Dirichlet characters mod k and their L-functions, in Wolfram's indexing:
// DirichletCharacter[k, j, n], DirichletL[k, j, s], j = 1 … φ(k), j = 1 principal.
//
// The indexing is not documented as a formula, so it was read off the kernel and is
// pinned by the oracle goldens: write (ℤ/k)^× as a product of cyclic groups, one per
// prime-power factor of k in ascending prime order — an odd p^e contributes ⟨g⟩ with g the
// least primitive root, 2² contributes ⟨−1⟩, and 2^e (e ≥ 3) contributes ⟨−1⟩ × ⟨5⟩ in
// that order. A character is an exponent vector (a_i) against those generators, and
// j − 1 is its mixed-radix reading with the FIRST component most significant:
//   χ_j(n) = Π exp(2πi · a_i b_i / ord_i),   n ≡ Π g_i^{b_i}.
// So for a prime k with primitive root g, χ_j(g) = e^{2πi (j−1)/φ(k)}.
//
// L(s, χ) = Σ χ(n) n^{−s} = k^{−s} Σ_{r=1}^{k} χ(r) ζ(s, r/k), through the Hurwitz kernel
// (complex s). Two places need something else, both because that sum cancels:
//  - near s = 1 the Hurwitz poles cancel for a non-principal χ, costing 1/|s−1| digits, so
//    the Laurent expansion in the generalized Stieltjes constants is summed instead:
//    L(s, χ) = k^{−s} Σ_r χ(r) Σ_n (−1)^n γ_n(r/k) (s−1)^n / n!;
//  - at a nonpositive integer s the ζ values are of size ~k^n and the answer is O(1), so
//    the exact Bernoulli-polynomial closed form replaces the numeric kernel.

interface Component {
  /** Generator of this cyclic factor, as a residue mod its prime power. */
  readonly gen: number;
  readonly ord: number;
  readonly modulus: number; // the prime power
}

const modPow = (b: number, e: number, m: number): number => {
  let r = 1 % m;
  b %= m;
  while (e > 0) {
    if (e & 1) r = (r * b) % m;
    b = (b * b) % m;
    e >>= 1;
  }
  return r;
};

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** Prime-power factorisation of k, ascending: [[p, e], …]. */
function factorize(k: number): [number, number][] {
  const out: [number, number][] = [];
  for (let p = 2; p * p <= k; p++) {
    if (k % p) continue;
    let e = 0;
    while (k % p === 0) {
      k /= p;
      e++;
    }
    out.push([p, e]);
  }
  if (k > 1) out.push([k, 1]);
  return out;
}

/** Least primitive root mod p^e, p an odd prime. */
function primitiveRoot(p: number, e: number): number {
  const m = p ** e;
  const phi = (p - 1) * p ** (e - 1);
  const primes = factorize(phi).map(([q]) => q);
  for (let g = 2; g < m; g++) {
    if (g % p === 0) continue;
    if (primes.every((q) => modPow(g, phi / q, m) !== 1)) return g;
  }
  throw new Error(`no primitive root mod ${m}`);
}

const componentCache = new Map<number, Component[]>();

/** The cyclic decomposition of (ℤ/k)^×, in Wolfram's order. */
function components(k: number): Component[] {
  const hit = componentCache.get(k);
  if (hit) return hit;
  const out: Component[] = [];
  for (const [p, e] of factorize(k)) {
    const modulus = p ** e;
    if (p === 2) {
      if (e === 2) out.push({ gen: 3, ord: 2, modulus });
      else if (e >= 3) {
        out.push({ gen: modulus - 1, ord: 2, modulus });
        out.push({ gen: 5, ord: modulus / 4, modulus });
      }
    } else {
      out.push({ gen: primitiveRoot(p, e), ord: (p - 1) * p ** (e - 1), modulus });
    }
  }
  componentCache.set(k, out);
  return out;
}

/** φ(k), as the product of the component orders. */
export const eulerPhi = (k: number): number => components(k).reduce((p, c) => p * c.ord, 1);

/** Exponent vector of n against the generators: n ≡ Π gen_i^{b_i}. */
function discreteLog(comps: Component[], n: number): number[] {
  const b: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const c = comps[i];
    let target = n % c.modulus;
    // For 2^e (e ≥ 3) the −1 and 5 components share a modulus: peel ⟨−1⟩ off first, so
    // that the 5-component sees a residue ≡ 1 mod 4.
    if (c.modulus % 8 === 0 && c.gen === c.modulus - 1) {
      const sign = target % 4 === 3 ? 1 : 0;
      b.push(sign);
      const next = comps[i + 1];
      target = sign ? (c.modulus - target) % c.modulus : target;
      let e = 0;
      let x = 1;
      while (x !== target) {
        x = (x * next.gen) % c.modulus;
        e++;
      }
      b.push(e);
      i++;
      continue;
    }
    let e = 0;
    let x = 1 % c.modulus;
    while (x !== target) {
      x = (x * c.gen) % c.modulus;
      e++;
    }
    b.push(e);
  }
  return b;
}

/** Exponent vector of the j-th character: j − 1 in mixed radix, first component most significant. */
function exponents(comps: Component[], j: number): number[] {
  let rest = j - 1;
  const a = Array.from<number>({ length: comps.length });
  for (let i = comps.length - 1; i >= 0; i--) {
    a[i] = rest % comps[i].ord;
    rest = Math.floor(rest / comps[i].ord);
  }
  return a;
}

/**
 * χ_j(n) mod k as a rational exponent q ∈ [0, 1): the value is e^{2πi q}. `undefined`
 * when gcd(n, k) > 1 (the character is 0 there), or when j is out of range.
 */
export function characterExponent(k: number, j: number, n: number): [number, number] | undefined {
  if (!(k >= 1 && j >= 1 && j <= eulerPhi(k))) return undefined;
  n = ((n % k) + k) % k;
  if (gcd(n === 0 ? k : n, k) !== 1) return undefined;
  const comps = components(k);
  const a = exponents(comps, j);
  const b = discreteLog(comps, n);
  // Σ a_i b_i / ord_i, reduced mod 1.
  let num = 0;
  let den = 1;
  for (let i = 0; i < comps.length; i++) {
    const ord = comps[i].ord;
    num = num * ord + a[i] * b[i] * den;
    den *= ord;
    const g = gcd(num, den);
    num /= g;
    den /= g;
  }
  num = ((num % den) + den) % den;
  return [num, den];
}

/** χ_j(n) as a complex number. */
export function character(k: number, j: number, n: number): Cx {
  const q = characterExponent(k, j, n);
  if (q === undefined) return cx(0);
  const [num, den] = q;
  // Exact at the quarter turns, so ±1 and ±i come out clean.
  switch ((4 * num) % den === 0 ? (4 * num) / den : -1) {
    case 0:
      return cx(1);
    case 1:
      return cx(0, 1);
    case 2:
      return cx(-1);
    case 3:
      return cx(0, -1);
    default:
      return cexp(cx(0, (2 * Math.PI * num) / den));
  }
}

/** Inside this radius of s = 1 a non-principal L is summed from its Laurent expansion. */
const NEAR_POLE = 0.25;
const LAURENT_TERMS = 24;

/** L(s, χ_j mod k). Non-finite at s = 1 for the principal character. */
export function dirichletL(k: number, j: number, s: Cx): Cx {
  const values: Cx[] = [];
  for (let r = 1; r <= k; r++) values.push(character(k, j, r));
  const nearPole = Math.hypot(s.re - 1, s.im) < NEAR_POLE;
  const kPow = cpow(cx(k), cx(-s.re, -s.im)); // k^{−s}
  let sum = cx(0);
  if (nearPole && j !== 1) {
    const d = cx(s.re - 1, s.im); // s − 1
    for (let r = 1; r <= k; r++) {
      const chi = values[r - 1];
      if (chi.re === 0 && chi.im === 0) continue;
      let term = cx(1); // (−1)^n (s−1)^n / n!
      let acc = cx(0);
      for (let n = 0; n < LAURENT_TERMS; n++) {
        const g = stieltjesGamma(n, cx(r / k));
        acc = add(acc, mul(g, term));
        term = scale(mul(term, d), -1 / (n + 1));
        if (Math.hypot(term.re, term.im) * Math.hypot(g.re, g.im) < 1e-18) break;
      }
      sum = add(sum, mul(chi, acc));
    }
  } else {
    // At s = −n the ζ(−n, r/k) are exact Bernoulli-polynomial values of size ~k^n, and the
    // sum over r is O(1) — so Euler–Maclaurin's relative accuracy is not enough; use the
    // closed form, which keeps the cancellation at roughly machine precision.
    const negInt = s.im === 0 && Number.isInteger(s.re) && s.re <= 0 ? -s.re : undefined;
    for (let r = 1; r <= k; r++) {
      const chi = values[r - 1];
      if (chi.re === 0 && chi.im === 0) continue;
      const z =
        negInt === undefined
          ? hurwitzZeta(s, cx(r / k))
          : cx(-bernoulliPolyAt(negInt + 1, r / k) / (negInt + 1));
      sum = add(sum, mul(chi, z));
    }
  }
  return mul(kPow, sum);
}

export const dirichletLReal = (k: number, j: number, s: number): number =>
  dirichletL(k, j, cx(s)).re;
