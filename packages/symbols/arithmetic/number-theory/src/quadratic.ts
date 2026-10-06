// The ring of integers O_K of a quadratic field K = ℚ(√d), over bigints.
//
// O_K = ℤ[ω] with ω = (−1 + √d)/2 when d ≡ 1 (mod 4) and ω = √d otherwise; an element is the
// pair [x, y] for x + yω. For d = −3 this ω is e^{2πi/3}, the Eisenstein integers' own. With
// ω² = sω + r (s = −1, r = (d − 1)/4, or s = 0, r = d) the discriminant is D = s² + 4r, and every
// element is also (X + Y√D)/2 with X = 2x + sy, Y = y.
//
// Most O_K are not unique factorization domains, so primality is read off ideals rather than
// elements: (α) factors uniquely into prime ideals, α is prime iff (α) is itself prime, and α is
// irreducible iff no proper sub-product of its prime ideals is principal. Principality is
// membership of the ideal's class in the class group, computed with binary quadratic forms of
// discriminant D (an ideal [a, (−b + √D)/2] is the form (a, b, (b² − D)/4a)).

import { extendedGcd, factorInteger, gcd, isqrt, powMod, powerModRoots } from "@enumeratio/residues";

/** x + yω. */
export type QuadraticElement = readonly [x: bigint, y: bigint];

export interface QuadraticRing {
  /** The squarefree d with K = ℚ(√d); never 0 or 1. */
  readonly d: bigint;
  /** The field discriminant: d when d ≡ 1 (mod 4), else 4d. */
  readonly discriminant: bigint;
  /** ω² = sω + r. */
  readonly s: bigint;
  readonly r: bigint;
}

/** Past this |D| the class group is not enumerated, and irreducibility in a non-UFD declines. */
export const CLASS_GROUP_LIMIT = 4_000_000n;
/** Iterations allowed to an element search (a generator, a divisor) before it declines. */
export const SEARCH_LIMIT = 2_000_000n;

const abs = (n: bigint): bigint => (n < 0n ? -n : n);
const mod = (a: bigint, m: bigint): bigint => ((a % m) + m) % m;

/** n with its square factors removed, sign kept; undefined when |n| cannot be factored. */
export function squarefreePart(n: bigint): bigint | undefined {
  if (n === 0n) return 0n;
  const factors = factorInteger(n);
  if (factors === undefined) return undefined;
  let core = n < 0n ? -1n : 1n;
  for (const [p, e] of factors) if (e % 2 === 1) core *= p;
  return core;
}

const rings = new Map<bigint, QuadraticRing>();

/** O_K for K = ℚ(√n); n need not be squarefree (ℚ(√8) = ℚ(√2)). Undefined for a square n. */
export function quadraticRing(n: bigint): QuadraticRing | undefined {
  const d = squarefreePart(n);
  if (d === undefined || d === 0n || d === 1n) return undefined;
  let ring = rings.get(d);
  if (ring === undefined) {
    const hexagonal = mod(d, 4n) === 1n;
    const [s, r] = hexagonal ? [-1n, (d - 1n) / 4n] : [0n, d];
    ring = { d, discriminant: hexagonal ? d : 4n * d, s, r };
    rings.set(d, ring);
  }
  return ring;
}

export const isImaginary = (R: QuadraticRing): boolean => R.d < 0n;

export const ZERO: QuadraticElement = [0n, 0n];
export const ONE: QuadraticElement = [1n, 0n];

export const add = (a: QuadraticElement, b: QuadraticElement): QuadraticElement => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: QuadraticElement, b: QuadraticElement): QuadraticElement => [a[0] - b[0], a[1] - b[1]];
export const neg = (a: QuadraticElement): QuadraticElement => [-a[0], -a[1]];
export const equal = (a: QuadraticElement, b: QuadraticElement): boolean => a[0] === b[0] && a[1] === b[1];
export const isZero = (a: QuadraticElement): boolean => a[0] === 0n && a[1] === 0n;

export const mul = (R: QuadraticRing, a: QuadraticElement, b: QuadraticElement): QuadraticElement => [
  a[0] * b[0] + R.r * a[1] * b[1],
  a[0] * b[1] + a[1] * b[0] + R.s * a[1] * b[1],
];

/** The Galois conjugate: ω̄ = s − ω. */
export const conj = (R: QuadraticRing, a: QuadraticElement): QuadraticElement => [a[0] + R.s * a[1], -a[1]];

/** N(x + yω) = x² + sxy − ry², negative for some elements of a real field. */
export const norm = (R: QuadraticRing, a: QuadraticElement): bigint =>
  a[0] * a[0] + R.s * a[0] * a[1] - R.r * a[1] * a[1];

export const trace = (R: QuadraticRing, a: QuadraticElement): bigint => 2n * a[0] + R.s * a[1];

export const isUnit = (R: QuadraticRing, a: QuadraticElement): boolean => abs(norm(R, a)) === 1n;

/** [X, Y] with the element equal to (X + Y√D)/2. */
export const halfCoordinates = (R: QuadraticRing, a: QuadraticElement): [bigint, bigint] => [
  2n * a[0] + R.s * a[1],
  a[1],
];

/** The element (X + Y√D)/2, or undefined when that is not in O_K. */
export function fromHalfCoordinates(R: QuadraticRing, X: bigint, Y: bigint): QuadraticElement | undefined {
  const twice = X - R.s * Y;
  return twice % 2n === 0n ? [twice / 2n, Y] : undefined;
}

/** a/b when b divides a in O_K. */
export function divideExact(R: QuadraticRing, a: QuadraticElement, b: QuadraticElement): QuadraticElement | undefined {
  const n = norm(R, b);
  if (n === 0n) return undefined;
  const [x, y] = mul(R, a, conj(R, b));
  return x % n === 0n && y % n === 0n ? [x / n, y / n] : undefined;
}

export const divides = (R: QuadraticRing, b: QuadraticElement, a: QuadraticElement): boolean =>
  divideExact(R, a, b) !== undefined;

export function power(R: QuadraticRing, a: QuadraticElement, k: number): QuadraticElement {
  let result = ONE;
  let base = a;
  for (let e = k; e > 0; e >>= 1) {
    if (e & 1) result = mul(R, result, base);
    base = mul(R, base, base);
  }
  return result;
}

// ── Units ────────────────────────────────────────────────────────────────────────────────

const fundamentalUnits = new Map<bigint, QuadraticElement>();

/**
 * The fundamental unit ε > 1 of a real field, from the continued fraction of
 * ξ = (b + √D)/2 (b the largest integer below √D with b ≡ D mod 2): ξ is reduced, so its
 * expansion is purely periodic, and over one period ℓ, ξ = (p₍ℓ₋₁₎ξ + p₍ℓ₋₂₎)/(q₍ℓ₋₁₎ξ + q₍ℓ₋₂₎);
 * the eigenvalue q₍ℓ₋₁₎ξ + q₍ℓ₋₂₎ of that unimodular matrix is ε, of norm (−1)^ℓ.
 */
export function fundamentalUnit(R: QuadraticRing): QuadraticElement | undefined {
  if (R.d < 0n) return undefined;
  const cached = fundamentalUnits.get(R.d);
  if (cached !== undefined) return cached;
  const D = R.discriminant;
  const root = isqrt(D);
  const b = mod(root - D, 2n) === 0n ? root : root - 1n;
  const [P0, Q0] = [b, 2n];
  let [P, Q] = [P0, Q0];
  let [q1, q2] = [0n, 1n]; // q₍k₋₁₎, q₍k₋₂₎, from q₋₁ = 0, q₋₂ = 1
  for (;;) {
    const a = (P + root) / Q;
    [q1, q2] = [a * q1 + q2, q1];
    P = a * Q - P;
    Q = (D - P * P) / Q;
    if (P === P0 && Q === Q0) break;
  }
  // ε = q₍ℓ₋₁₎ξ + q₍ℓ₋₂₎ with ξ = ω + (b − s)/2.
  const unit: QuadraticElement = [q1 * ((b - R.s) / 2n) + q2, q1];
  fundamentalUnits.set(R.d, unit);
  return unit;
}

/** The units of an imaginary field: the roots of unity, 4 for d = −1, 6 for d = −3, else ±1. */
export function rootsOfUnity(R: QuadraticRing): QuadraticElement[] {
  if (R.d === -1n) return [ONE, [0n, 1n], [-1n, 0n], [0n, -1n]];
  // The sixth roots of unity, in turn: 1, −ω², ω, −1, ω², −ω, with ω² = −1 − ω.
  if (R.d === -3n) return [ONE, [1n, 1n], [0n, 1n], [-1n, 0n], [-1n, -1n], [0n, -1n]];
  return [ONE, [-1n, 0n]];
}

/** log|σ(a)| for the real embedding √D ↦ +√D, from the half coordinates. */
function logEmbedding(R: QuadraticRing, a: QuadraticElement, sign: 1 | -1): number {
  const [X, Y] = halfCoordinates(R, a);
  const value = Number(X) + sign * Number(Y) * Math.sqrt(Number(R.discriminant));
  if (Number.isFinite(value) && value !== 0 && Math.abs(value) > 1e-6 * Math.abs(Number(X))) {
    return Math.log(Math.abs(value) / 2);
  }
  // Cancellation (or overflow): N(a) = σ₁σ₂, so take the larger embedding and divide.
  const other = Math.abs(Number(X) - sign * Number(Y) * Math.sqrt(Number(R.discriminant)));
  return Math.log(Math.abs(Number(norm(R, a)))) - Math.log(other / 2);
}

/**
 * The canonical associate of a ≠ 0, and the unit u with a·u equal to it. Imaginary fields take
 * the associate with argument in [0, 2π/|units|) — the first quadrant for ℤ[i], as Gaussian
 * normal forms are. Real fields take the most balanced one, |σ₁| and |σ₂| as close as the unit
 * group allows, with σ₁ > 0.
 */
export function normalize(R: QuadraticRing, a: QuadraticElement): [QuadraticElement, QuadraticElement] {
  if (isZero(a)) return [ZERO, ONE];
  if (R.d < 0n) {
    for (const u of rootsOfUnity(R)) {
      const w = mul(R, a, u);
      const [X, Y] = halfCoordinates(R, w);
      const inSector =
        R.d === -1n ? X > 0n && Y >= 0n : R.d === -3n ? Y >= 0n && X > Y : Y > 0n || (Y === 0n && X > 0n);
      if (inSector) return [w, u];
    }
    return [a, ONE]; // unreachable
  }
  const eps = fundamentalUnit(R)!;
  const logEps = logEmbedding(R, eps, 1);
  // log|σ₁/σ₂| moves by 2·log ε per factor of ε.
  const k = -Math.round((logEmbedding(R, a, 1) - logEmbedding(R, a, -1)) / (2 * logEps));
  let u: QuadraticElement = k >= 0 ? power(R, eps, k) : power(R, conj(R, eps), -k);
  if (k < 0 && norm(R, eps) === -1n && -k % 2 === 1) u = neg(u); // ε̄ = −ε⁻¹ when N(ε) = −1
  let w = mul(R, a, u);
  const [X, Y] = halfCoordinates(R, w);
  // σ₁(w) > 0 ⟺ X + Y√D > 0.
  const positive = Y >= 0n ? X > 0n || X * X < Y * Y * R.discriminant : X > 0n && X * X > Y * Y * R.discriminant;
  if (!positive) {
    w = neg(w);
    u = neg(u);
  }
  return [w, u];
}

export const areAssociates = (R: QuadraticRing, a: QuadraticElement, b: QuadraticElement): boolean => {
  const q = divideExact(R, a, b);
  return q !== undefined && isUnit(R, q);
};

// ── Prime ideals ─────────────────────────────────────────────────────────────────────────

/**
 * A prime ideal of O_K above p: (p) itself when p is inert, else (p, ω − c) for a root c of
 * t² − st − r mod p — the ideal of x + yω with x + yc ≡ 0 (mod p).
 */
export interface PrimeIdeal {
  readonly p: bigint;
  readonly kind: "split" | "inert" | "ramified";
  /** The root c, for split and ramified p. */
  readonly c?: bigint;
}

/** The Kronecker symbol (D/p) for a prime p. */
export function kronecker(D: bigint, p: bigint): -1 | 0 | 1 {
  if (p === 2n) {
    if (D % 2n === 0n) return 0;
    const r = mod(D, 8n);
    return r === 1n || r === 7n ? 1 : -1;
  }
  const t = powMod(mod(D, p), (p - 1n) / 2n, p);
  return t === 0n ? 0 : t === 1n ? 1 : -1;
}

/** The prime ideals above a rational prime p: two when p splits, else one. */
export function primeIdealsAbove(R: QuadraticRing, p: bigint): PrimeIdeal[] {
  const k = kronecker(R.discriminant, p);
  if (k === -1) return [{ p, kind: "inert" }];
  let roots: bigint[];
  if (p === 2n) {
    roots = [0n, 1n].filter((t) => mod(t * t - R.s * t - R.r, 2n) === 0n);
  } else {
    // t = (s ± √D)/2 mod p.
    const half = (p + 1n) / 2n;
    const sqrt = powerModRoots(mod(R.discriminant, p), 2n, p) ?? [];
    roots = [...new Set(sqrt.map((q) => mod((R.s + q) * half, p)))];
  }
  if (k === 0) return [{ p, kind: "ramified", c: roots[0]! }];
  return roots.toSorted((a, b) => (a < b ? -1 : 1)).map((c) => ({ p, kind: "split", c }));
}

export const idealNorm = (P: PrimeIdeal): bigint => (P.kind === "inert" ? P.p * P.p : P.p);

export const contains = (P: PrimeIdeal, a: QuadraticElement): boolean =>
  P.kind === "inert" ? a[0] % P.p === 0n && a[1] % P.p === 0n : mod(a[0] + a[1] * P.c!, P.p) === 0n;

export const sameIdeal = (P: PrimeIdeal, Q: PrimeIdeal): boolean => P.p === Q.p && P.c === Q.c;

/**
 * The factorization of (a) into prime ideals, a ≠ 0, ascending by p and then c; undefined when
 * N(a) cannot be factored within budget.
 */
export function idealFactorization(R: QuadraticRing, a: QuadraticElement): [PrimeIdeal, number][] | undefined {
  const n = abs(norm(R, a));
  if (n === 0n) return undefined;
  if (n === 1n) return [];
  const factors = factorInteger(n);
  if (factors === undefined) return undefined;
  const result: [PrimeIdeal, number][] = [];
  for (const [p, e] of factors) {
    const ideals = primeIdealsAbove(R, p);
    const first = ideals[0]!;
    if (first.kind === "inert") {
      result.push([first, e / 2]);
    } else if (first.kind === "ramified") {
      result.push([first, e]);
    } else {
      // p^k divides a exactly; past that, a lies in at most one of P and P̄, which takes
      // the rest of the exponent.
      let k = 0;
      let rest = a;
      while (rest[0] % p === 0n && rest[1] % p === 0n) {
        rest = [rest[0] / p, rest[1] / p];
        k++;
      }
      const left = e - 2 * k;
      for (const P of ideals) {
        const exponent = k + (left > 0 && contains(P, rest) ? left : 0);
        if (exponent > 0) result.push([P, exponent]);
      }
    }
  }
  return result;
}

// ── Class group ──────────────────────────────────────────────────────────────────────────

/** The binary quadratic form ax² + bxy + cy². */
export type Form = readonly [a: bigint, b: bigint, c: bigint];

const formKey = (f: Form): string => `${f[0]},${f[1]}`;

export interface ClassGroup {
  readonly discriminant: bigint;
  /** The narrow (proper-equivalence) classes, by canonical reduced form; 0 is the principal. */
  readonly classes: readonly Form[];
  /** The classes of principal ideals: the principal form's, and the form representing −1's. */
  readonly principal: ReadonlySet<number>;
  /** The class number h: narrow classes modulo principal ones. */
  readonly order: number;
}

function reduceDefinite(D: bigint, [a0, b0]: Form): Form {
  let [a, b] = [a0, b0];
  let c = (b * b - D) / (4n * a);
  for (;;) {
    // b into (−a, a].
    const twoA = 2n * a;
    let nb = mod(b, twoA);
    if (nb > a) nb -= twoA;
    c = (nb * nb - D) / (4n * a);
    b = nb;
    if (a > c) {
      [a, b] = [c, -b];
      continue;
    }
    if (a === c && b < 0n) b = -b;
    return [a, b, c];
  }
}

/** Gauss's reduction step ρ for an indefinite form: (a, b, c) ~ (c, b′, c′), b′ ≡ −b (mod 2c). */
function rho(D: bigint, root: bigint, [, b, c]: Form): Form {
  const twoC = abs(2n * c);
  // b′ in (−|c|, |c|] when |c| > √D, else the largest b′ < √D.
  let nb: bigint;
  if (abs(c) > root) {
    nb = mod(-b, twoC);
    if (nb > abs(c)) nb -= twoC;
  } else {
    nb = root - mod(root + b, twoC);
  }
  return [c, nb, (nb * nb - D) / (4n * c)];
}

/** Reduced: 0 < b < √D and √D − b < 2|a| < √D + b. */
const isReducedIndefinite = (root: bigint, [a, b]: Form): boolean =>
  b > 0n && b <= root && 2n * abs(a) + b > root && 2n * abs(a) - b <= root;

/** The ρ-cycle through a reduced indefinite form. */
function cycleOf(D: bigint, root: bigint, f: Form): Form[] {
  const cycle = [f];
  for (let g = rho(D, root, f); formKey(g) !== formKey(f); g = rho(D, root, g)) cycle.push(g);
  return cycle;
}

const minForm = (forms: readonly Form[]): Form =>
  forms.reduce((best, f) => (f[0] < best[0] || (f[0] === best[0] && f[1] < best[1]) ? f : best));

/** Dirichlet composition of two forms of discriminant D, unreduced. */
export function compose(D: bigint, [a1, b1]: Form, [a2, b2]: Form): Form {
  const B = (b1 + b2) / 2n;
  const [g1, u1, v1] = extendedGcd(a1, a2);
  const [g, x, w] = extendedGcd(g1, B);
  const [u, v] = [x * u1, x * v1];
  const a3 = (a1 * a2) / (g * g);
  const twoA3 = abs(2n * a3);
  const b3 = mod((u * a1 * b2 + v * a2 * b1 + (w * (b1 * b2 + D)) / 2n) / g, twoA3);
  return [a3, b3, (b3 * b3 - D) / (4n * a3)];
}

const classGroups = new Map<bigint, ClassGroup | undefined>();
const classIndexes = new Map<bigint, Map<string, number>>();

/** The canonical representative of a form's narrow class. */
export function reduceForm(D: bigint, f: Form): Form {
  if (D < 0n) return reduceDefinite(D, f[0] < 0n ? [-f[0], f[1], -f[2]] : f);
  const root = isqrt(D);
  let g = f;
  for (let steps = 0; !isReducedIndefinite(root, g); steps++) {
    if (steps > 10_000) throw new Error(`form ${String(f)} does not reduce`);
    g = rho(D, root, g);
  }
  return minForm(cycleOf(D, root, g));
}

/** The class group of O_K, by enumerating reduced forms; undefined past `CLASS_GROUP_LIMIT`. */
export function classGroup(R: QuadraticRing): ClassGroup | undefined {
  const D = R.discriminant;
  if (classGroups.has(D)) return classGroups.get(D);
  if (abs(D) > CLASS_GROUP_LIMIT) {
    classGroups.set(D, undefined);
    return undefined;
  }
  const forms: Form[] = [];
  const s = mod(D, 2n);
  const principalForm: Form = [1n, s, (s - D) / 4n];
  if (D < 0n) {
    const top = isqrt(-D / 3n);
    for (let a = 1n; a <= top; a++) {
      for (let b = -a + 1n; b <= a; b++) {
        if (mod(b - D, 2n) !== 0n || (b * b - D) % (4n * a) !== 0n) continue;
        const c = (b * b - D) / (4n * a);
        if (c < a || (b < 0n && a === c) || gcd(gcd(a, abs(b)), c) !== 1n) continue;
        forms.push([a, b, c]);
      }
    }
  } else {
    const root = isqrt(D);
    const seen = new Set<string>();
    for (let b = root; b > 0n; b--) {
      if (mod(b - D, 2n) !== 0n) continue;
      const product = (b * b - D) / 4n; // ac, negative
      for (let a = 1n; a <= root; a++) {
        if (product % a !== 0n) continue;
        for (const signed of [a, -a]) {
          const f: Form = [signed, b, product / signed];
          if (!isReducedIndefinite(root, f) || seen.has(formKey(f))) continue;
          if (gcd(gcd(a, b), abs(f[2])) !== 1n) continue;
          const cycle = cycleOf(D, root, f);
          for (const g of cycle) seen.add(formKey(g));
          forms.push(minForm(cycle));
        }
      }
    }
  }
  const principalKey = formKey(reduceForm(D, principalForm));
  forms.sort((f, g) => (formKey(f) === principalKey ? -1 : formKey(g) === principalKey ? 1 : 0));
  const index = new Map(forms.map((f, i) => [formKey(f), i]));
  const principal = new Set([0]);
  if (D > 0n) principal.add(index.get(formKey(reduceForm(D, [-1n, s, (D - s) / 4n])))!);
  const group: ClassGroup = { discriminant: D, classes: forms, principal, order: forms.length / principal.size };
  classGroups.set(D, group);
  classIndexes.set(D, index);
  return group;
}

/** The index in `classGroup(R).classes` of a form's class. */
export function classIndex(group: ClassGroup, f: Form): number {
  return classIndexes.get(group.discriminant)!.get(formKey(reduceForm(group.discriminant, f)))!;
}

/** (p, ω − c) is the ideal [p, (−b + √D)/2] with b = 2c − s. */
export function idealForm(R: QuadraticRing, P: PrimeIdeal): Form {
  if (P.kind === "inert") return [1n, mod(R.discriminant, 2n), (mod(R.discriminant, 2n) - R.discriminant) / 4n];
  const b = 2n * P.c! - R.s;
  return [P.p, b, (b * b - R.discriminant) / (4n * P.p)];
}

const products = new Map<bigint, Map<number, number>>();

/** The class of the product of two classes. */
export function multiplyClasses(group: ClassGroup, i: number, j: number): number {
  if (i === 0) return j;
  if (j === 0) return i;
  const [lo, hi] = i < j ? [i, j] : [j, i];
  let table = products.get(group.discriminant);
  if (table === undefined) products.set(group.discriminant, (table = new Map()));
  const key = lo * group.classes.length + hi;
  let k = table.get(key);
  if (k === undefined) {
    k = classIndex(group, compose(group.discriminant, group.classes[lo]!, group.classes[hi]!));
    table.set(key, k);
  }
  return k;
}

// ── Primality ────────────────────────────────────────────────────────────────────────────

export type QuadraticKind = "zero" | "unit" | "prime" | "irreducible" | "composite";

/**
 * Whether a nonempty proper sub-multiset of the classes multiplies to a principal class; the
 * complement then does too, since the whole product — (a) itself — is principal.
 */
export function splitsPrincipally(group: ClassGroup, classes: readonly number[]): boolean {
  // States: class reached, any item taken (bit 0), any item left out (bit 1).
  let states = new Set<number>([0]);
  const n = group.classes.length;
  for (const k of classes) {
    const next = new Set<number>();
    for (const state of states) {
      const [cls, flags] = [state >> 2, state & 3];
      next.add((cls << 2) | flags | 2);
      next.add((multiplyClasses(group, cls, k) << 2) | flags | 1);
    }
    states = next;
    if (states.size > 4 * n) break; // unreachable: at most 4n states
  }
  for (const state of states) if ((state & 3) === 3 && group.principal.has(state >> 2)) return true;
  return false;
}

/** The classes of an ideal factorization's primes, one entry per unit of exponent. */
export function factorClasses(
  R: QuadraticRing,
  group: ClassGroup,
  factors: readonly (readonly [PrimeIdeal, number])[],
): number[] {
  return factors.flatMap(([P, e]) => Array<number>(e).fill(classIndex(group, idealForm(R, P))));
}

/** Zero, a unit, prime, irreducible but not prime, or composite; undefined when it cannot tell. */
export function classify(R: QuadraticRing, a: QuadraticElement): QuadraticKind | undefined {
  const n = norm(R, a);
  if (n === 0n) return "zero";
  if (abs(n) === 1n) return "unit";
  const factors = idealFactorization(R, a);
  if (factors === undefined) return undefined;
  const omega = factors.reduce((total, [, e]) => total + e, 0);
  if (omega === 1) return "prime";
  if (factors.some(([P]) => P.kind === "inert")) return "composite";
  const group = classGroup(R);
  if (group === undefined) return undefined;
  if (group.order === 1) return "composite";
  return splitsPrincipally(group, factorClasses(R, group, factors)) ? "composite" : "irreducible";
}

export const isPrimeElement = (R: QuadraticRing, a: QuadraticElement): boolean | undefined => {
  const kind = classify(R, a);
  return kind === undefined ? undefined : kind === "prime";
};

// ── Element search ───────────────────────────────────────────────────────────────────────

/**
 * Every element of norm n, up to units — one per associate class — or undefined past
 * `SEARCH_LIMIT`. Solves X² − DY² = 4n; in a real field each class of solutions has a member
 * with 0 ≤ Y ≤ U·√|n|/√(T ± 2), for η = (T + U√D)/2 the least unit > 1 of norm 1 (Nagell).
 */
export function elementsOfNorm(R: QuadraticRing, n: bigint): QuadraticElement[] | undefined {
  if (n === 0n) return [ZERO];
  const D = R.discriminant;
  let top: bigint;
  if (D < 0n) {
    if (n < 0n) return [];
    top = isqrt((4n * n) / -D);
  } else {
    let eta = fundamentalUnit(R)!;
    if (norm(R, eta) === -1n) eta = mul(R, eta, eta);
    const [T, U] = halfCoordinates(R, eta);
    top = isqrt((U * U * abs(n)) / (n > 0n ? T + 2n : T - 2n)) + 1n;
  }
  if (top > SEARCH_LIMIT) return undefined;
  const found: QuadraticElement[] = [];
  for (let Y = 0n; Y <= top; Y++) {
    const square = 4n * n + D * Y * Y;
    if (square < 0n) continue;
    const X = isqrt(square);
    if (X * X !== square) continue;
    for (const [sx, sy] of [
      [X, Y],
      [-X, Y],
    ] as const) {
      const a = fromHalfCoordinates(R, sx, sy);
      if (a === undefined) continue;
      const w = normalize(R, a)[0];
      if (!found.some((b) => areAssociates(R, w, b))) found.push(w);
    }
  }
  return found;
}

/** A generator of a principal prime ideal, normalized; undefined when none was found. */
export function generator(R: QuadraticRing, P: PrimeIdeal): QuadraticElement | undefined {
  if (P.kind === "inert") return [P.p, 0n];
  for (const n of R.d < 0n ? [P.p] : [P.p, -P.p]) {
    const candidates = elementsOfNorm(R, n);
    const pi = candidates?.find((a) => contains(P, a));
    if (pi !== undefined) return pi;
  }
  return undefined;
}

/**
 * The prime factorization of a nonzero non-unit over a unique factorization domain: normalized
 * primes with exponents, ascending by norm, preceded by the unit when it is not 1. Undefined
 * when O_K is not a UFD or a step declines.
 */
export function factorElement(R: QuadraticRing, a: QuadraticElement): [QuadraticElement, number][] | undefined {
  if (isZero(a)) return undefined;
  if (isUnit(R, a)) return [[a, 1]];
  const group = classGroup(R);
  if (group === undefined || group.order !== 1) return undefined;
  const factors = idealFactorization(R, a);
  if (factors === undefined) return undefined;
  const primes: [QuadraticElement, number][] = [];
  let rest = a;
  for (const [P, e] of factors) {
    const pi = generator(R, P);
    if (pi === undefined) return undefined;
    for (let k = 0; k < e; k++) rest = divideExact(R, rest, pi)!;
    primes.push([pi, e]);
  }
  return equal(rest, ONE) ? primes : [[rest, 1], ...primes];
}

/**
 * A factorization into irreducibles, in any O_K — not unique when O_K is not a UFD. Each step
 * splits off a divisor of least norm, which is irreducible. Undefined when a step declines.
 */
export function irreducibleFactors(R: QuadraticRing, a: QuadraticElement): QuadraticElement[] | undefined {
  if (isZero(a) || isUnit(R, a)) return [];
  const kind = classify(R, a);
  if (kind === undefined) return undefined;
  if (kind === "prime" || kind === "irreducible") return [normalize(R, a)[0]];
  const n = abs(norm(R, a));
  const factors = factorInteger(n);
  if (factors === undefined) return undefined;
  let divisors = [1n];
  for (const [p, e] of factors) {
    divisors = divisors.flatMap((m) => Array.from({ length: e + 1 }, (_, k) => m * p ** BigInt(k)));
  }
  for (const m of divisors.filter((m) => m > 1n && m * m <= n).toSorted((x, y) => (x < y ? -1 : 1))) {
    for (const signed of R.d < 0n ? [m] : [m, -m]) {
      const candidates = elementsOfNorm(R, signed);
      if (candidates === undefined) return undefined;
      for (const b of candidates) {
        const q = divideExact(R, a, b);
        if (q === undefined) continue;
        const rest = irreducibleFactors(R, q);
        return rest === undefined ? undefined : [b, ...rest];
      }
    }
  }
  return undefined;
}

const idealKey = (P: PrimeIdeal): string => `${P.p}:${P.c ?? "inert"}`;

/**
 * Every factorization of a into irreducibles, up to order and units, at most `limit` of them;
 * undefined when a step declines. Each irreducible is a minimal principal sub-product of (a)'s
 * prime ideals — minimal meaning no smaller nonempty part of it is principal — so a
 * factorization is a partition of those ideals into such blocks, each block replaced by its
 * generator.
 */
export function irreducibleFactorizations(
  R: QuadraticRing,
  a: QuadraticElement,
  limit = 8,
): QuadraticElement[][] | undefined {
  if (isZero(a) || isUnit(R, a)) return [[]];
  const factors = idealFactorization(R, a);
  const group = classGroup(R);
  if (factors === undefined || group === undefined) return undefined;
  const items = factors.flatMap(([P, e]) => Array<PrimeIdeal>(e).fill(P));
  if (items.length > 12) return undefined;
  const classes = items.map((P) => classIndex(group, idealForm(R, P)));
  const product = (mask: number): number =>
    classes.reduce((acc, k, i) => (mask & (1 << i) ? multiplyClasses(group, acc, k) : acc), 0);
  const principal = (mask: number): boolean => group.principal.has(product(mask));
  // A block is minimal when no nonempty proper sub-mask is principal.
  const minimal = (mask: number): boolean => {
    for (let sub = (mask - 1) & mask; sub > 0; sub = (sub - 1) & mask) if (principal(sub)) return false;
    return true;
  };
  const generators = new Map<string, QuadraticElement | undefined>();
  const generatorOf = (mask: number): QuadraticElement | undefined => {
    const block = items.filter((_, i) => mask & (1 << i));
    const key = block.map(idealKey).toSorted().join();
    if (generators.has(key)) return generators.get(key);
    const n = block.reduce((acc, P) => acc * idealNorm(P), 1n);
    let found: QuadraticElement | undefined;
    for (const signed of R.d < 0n ? [n] : [n, -n]) {
      for (const b of elementsOfNorm(R, signed) ?? []) {
        const own = idealFactorization(R, b);
        const ownKey = own
          ?.flatMap(([P, e]) => Array<string>(e).fill(idealKey(P)))
          .toSorted()
          .join();
        if (ownKey === key) {
          found = b;
          break;
        }
      }
      if (found) break;
    }
    generators.set(key, found);
    return found;
  };
  const results = new Map<string, number[]>();
  const full = (1 << items.length) - 1;
  const partition = (rest: number, blocks: number[]): void => {
    if (results.size >= limit) return;
    if (rest === 0) {
      const key = blocks
        .map((m) =>
          items
            .filter((_, i) => m & (1 << i))
            .map(idealKey)
            .toSorted()
            .join(),
        )
        .toSorted()
        .join("|");
      if (!results.has(key)) results.set(key, blocks);
      return;
    }
    const first = rest & -rest;
    for (let sub = rest; sub > 0; sub = (sub - 1) & rest) {
      if (!(sub & first) || !principal(sub) || !minimal(sub)) continue;
      partition(rest & ~sub, [...blocks, sub]);
    }
  };
  partition(full, []);
  const out: QuadraticElement[][] = [];
  for (const blocks of results.values()) {
    const parts = blocks.map(generatorOf);
    if (parts.some((p) => p === undefined)) return undefined;
    out.push((parts as QuadraticElement[]).toSorted((x, y) => Number(abs(norm(R, x)) - abs(norm(R, y)))));
  }
  return out;
}
