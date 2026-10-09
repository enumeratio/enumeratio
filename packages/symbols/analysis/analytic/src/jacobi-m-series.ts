import type { Json } from "@enumeratio/ce-patches";

// Taylor coefficients in the parameter m, at m = 0, of the Jacobi functions at a fixed u.
//
// The closed forms for ∂ₘ (jacobi-derivatives.ts) divide by m, so at m = 0 itself they are 0/0
// and `Series` in m would get no concrete coefficients from them. Here the coefficients come
// from the amplitude φ = am(u, m) instead, whose m-expansion needs no division by m:
//
//   ∂ᵤφ = dn(φ) = √(1 − m·sin²φ),  φ(0) = 0,
//
// is triangular in the powers of m (the coefficient of mᵏ needs sin²φ only through mᵏ⁻¹), so each
// φₖ is one antiderivative of the previous ones. Then sn = sin φ, cn = cos φ, dn = ∂ᵤφ and
// ε = E(φ, m) = ∫₀ᵘ dn² are compositions and antiderivatives of the same series. Every
// coefficient is a polynomial in u times cos(ju), sin(ju): an element of the ring spanned by
// uᵃ·e^{iju} over the rationals, closed under products and antiderivatives, which keeps the
// arithmetic exact. A quotient head divides these series, in the ring when the divisor starts at 1
// (dn) and as expressions when it starts at cos u or sin u.

// --- exact rationals ---------------------------------------------------------------------------

type Q = readonly [bigint, bigint];

const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b));
const q = (n: bigint | number, d: bigint | number = 1): Q => {
  let [a, b] = [BigInt(n), BigInt(d)];
  if (b < 0n) [a, b] = [-a, -b];
  const g = gcd(a, b) || 1n;
  return [a / g, b / g];
};
const qAdd = (a: Q, b: Q): Q => q(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const qMul = (a: Q, b: Q): Q => q(a[0] * b[0], a[1] * b[1]);
const qNeg = (a: Q): Q => [-a[0], a[1]];
const qZero = (a: Q): boolean => a[0] === 0n;

/** A Gaussian rational. */
type C = readonly [Q, Q];
const cAdd = (a: C, b: C): C => [qAdd(a[0], b[0]), qAdd(a[1], b[1])];
const cMul = (a: C, b: C): C => [
  qAdd(qMul(a[0], b[0]), qNeg(qMul(a[1], b[1]))),
  qAdd(qMul(a[0], b[1]), qMul(a[1], b[0])),
];
const cZero = (a: C): boolean => qZero(a[0]) && qZero(a[1]);
const real = (n: bigint | number, d: bigint | number = 1): C => [q(n, d), q(0)];

// --- the ring of Σ c·uᵃ·e^{iju} ----------------------------------------------------------------

type Ring = Map<string, C>;
const keyOf = (a: number, j: number) => `${a},${j}`;
const unkey = (key: string): [number, number] => {
  const [a, j] = key.split(",").map(Number);
  return [a!, j!];
};

function put(r: Ring, a: number, j: number, c: C): void {
  const key = keyOf(a, j);
  const sum = cAdd(r.get(key) ?? [q(0), q(0)], c);
  if (cZero(sum)) r.delete(key);
  else r.set(key, sum);
}

const term = (a: number, j: number, c: C): Ring => {
  const r: Ring = new Map();
  put(r, a, j, c);
  return r;
};
const ONE = term(0, 0, real(1));
const U = term(1, 0, real(1));
const SIN: Ring = new Map([...term(0, 1, [q(0), q(-1, 2)]), ...term(0, -1, [q(0), q(1, 2)])]);
const COS: Ring = new Map([...term(0, 1, real(1, 2)), ...term(0, -1, real(1, 2))]);

function plus(...rs: Ring[]): Ring {
  const out: Ring = new Map();
  for (const r of rs) for (const [key, c] of r) put(out, ...unkey(key), c);
  return out;
}
function scale(r: Ring, c: C): Ring {
  const out: Ring = new Map();
  for (const [key, v] of r) put(out, ...unkey(key), cMul(v, c));
  return out;
}
function times(x: Ring, y: Ring): Ring {
  const out: Ring = new Map();
  for (const [kx, vx] of x) {
    const [ax, jx] = unkey(kx);
    for (const [ky, vy] of y) {
      const [ay, jy] = unkey(ky);
      put(out, ax + ay, jx + jy, cMul(vx, vy));
    }
  }
  return out;
}

/** ∫₀ᵘ: ∫ uᵃe^{iju} = e^{iju}·Σₖ (−1)ᵏ a!/(a−k)! · uᵃ⁻ᵏ / (ij)ᵏ⁺¹, then the constant that makes it vanish at 0. */
function integral(r: Ring): Ring {
  const out: Ring = new Map();
  for (const [key, c] of r) {
    const [a, j] = unkey(key);
    if (j === 0) {
      put(out, a + 1, 0, cMul(c, real(1, a + 1)));
      continue;
    }
    const inverse: C = [q(0), q(-1, j)]; // 1/(ij)
    let power = inverse;
    let falling = 1n;
    for (let k = 0; k <= a; k++) {
      if (k > 0) {
        falling *= BigInt(a - k + 1);
        power = cMul(power, inverse);
      }
      const sign = k % 2 === 0 ? 1 : -1;
      put(out, a - k, j, cMul(c, cMul(power, real(sign * Number(falling)))));
    }
  }
  let constant: C = [q(0), q(0)];
  for (const [key, c] of out) if (unkey(key)[0] === 0) constant = cAdd(constant, c);
  put(out, 0, 0, [qNeg(constant[0]), qNeg(constant[1])]);
  return out;
}

// --- truncated series in m, coefficients in the ring -------------------------------------------

type Series = Ring[];
const zeros = (n: number): Series => Array.from({ length: n + 1 }, () => new Map());
const constantSeries = (r: Ring, n: number): Series => {
  const s = zeros(n);
  s[0] = r;
  return s;
};

function seriesTimes(x: Series, y: Series, n: number): Series {
  const out = zeros(n);
  for (let i = 0; i <= n; i++) for (let j = 0; i + j <= n; j++) out[i + j] = plus(out[i + j]!, times(x[i]!, y[j]!));
  return out;
}
const seriesPlus = (x: Series, y: Series): Series => x.map((r, i) => plus(r, y[i]!));
const seriesScale = (x: Series, c: C): Series => x.map((r) => scale(r, c));

/** √a for a series a with a₀ = 1: r₀ = 1, rₖ = (aₖ − Σ₁ᵏ⁻¹ rᵢrₖ₋ᵢ)/2. */
function seriesSqrt(a: Series, n: number): Series {
  const r = zeros(n);
  r[0] = ONE;
  for (let k = 1; k <= n; k++) {
    let sum = a[k]!;
    for (let i = 1; i < k; i++) sum = plus(sum, scale(times(r[i]!, r[k - i]!), real(-1)));
    r[k] = scale(sum, real(1, 2));
  }
  return r;
}

/** sin(u + δ) and cos(u + δ) through order `n`, for a series δ with δ₀ = 0. */
function sinCos(delta: Series, n: number): { s: Series; c: Series } {
  let sinDelta = zeros(n);
  let cosDelta = constantSeries(ONE, n);
  let power = constantSeries(ONE, n);
  let factorial = 1;
  for (let p = 1; p <= n; p++) {
    power = seriesTimes(power, delta, n);
    factorial *= p;
    const sign = (p % 2 === 0 ? p / 2 : (p - 1) / 2) % 2 === 0 ? 1 : -1;
    const term = seriesScale(power, real(sign, factorial));
    if (p % 2 === 1) sinDelta = seriesPlus(sinDelta, term);
    else cosDelta = seriesPlus(cosDelta, term);
  }
  const sinU = constantSeries(SIN, n);
  const cosU = constantSeries(COS, n);
  return {
    s: seriesPlus(seriesTimes(sinU, cosDelta, n), seriesTimes(cosU, sinDelta, n)),
    c: seriesPlus(seriesTimes(cosU, cosDelta, n), seriesScale(seriesTimes(sinU, sinDelta, n), real(-1))),
  };
}

interface Jacobi {
  readonly phi: Series;
  readonly s: Series;
  readonly c: Series;
  readonly d: Series;
  readonly eps: Series;
}

/** am, sn, cn, dn and ε as series in m through order n. */
function jacobiSeries(n: number): Jacobi {
  const phi: Series = zeros(n);
  phi[0] = U;
  const oneMinus = (s2: Series, k: number): Series => {
    const a = zeros(k);
    a[0] = ONE;
    for (let j = 1; j <= k; j++) a[j] = scale(s2[j - 1]!, real(-1));
    return a;
  };
  for (let k = 1; k <= n; k++) {
    const delta = zeros(k - 1);
    for (let i = 1; i < k; i++) delta[i] = phi[i]!;
    const { s } = sinCos(delta, k - 1);
    const a = oneMinus(seriesTimes(s, s, k - 1), k);
    phi[k] = integral(seriesSqrt(a, k)[k]!);
  }
  const delta = zeros(n);
  for (let i = 1; i <= n; i++) delta[i] = phi[i]!;
  const { s, c } = sinCos(delta, n);
  const s2 = seriesTimes(s, s, n);
  const d = seriesSqrt(oneMinus(s2, n), n);
  const eps = zeros(n);
  eps[0] = U;
  for (let k = 1; k <= n; k++) eps[k] = scale(integral(s2[k - 1]!), real(-1));
  return { phi, s, c, d, eps };
}

// --- expressions -------------------------------------------------------------------------------

const isZero = (x: Json): boolean => x === 0;
const add = (...xs: Json[]): Json => {
  const terms = xs.filter((x) => !isZero(x));
  return terms.length === 0 ? 0 : terms.length === 1 ? terms[0]! : ["Add", ...terms];
};
const mul = (x: Json, y: Json): Json => (isZero(x) || isZero(y) ? 0 : x === 1 ? y : y === 1 ? x : ["Multiply", x, y]);
const neg = (x: Json): Json => (isZero(x) ? 0 : ["Negate", x]);
const div = (x: Json, y: Json): Json => (isZero(x) ? 0 : y === 1 ? x : ["Divide", x, y]);

const number = ([n, d]: Q): Json => (d === 1n ? Number(n) : ["Rational", Number(n), Number(d)]);

const qPow = (x: Q, e: number): Q => {
  let out = q(1);
  for (let i = 0; i < e; i++) out = qMul(out, x);
  return out;
};

/**
 * The ring element as an expression in `u`: uᵃ·cos(ju) and uᵃ·sin(ju) terms. A rational `at` for
 * `u` folds the powers into the coefficients, so terms with the same trig factor merge.
 */
function toExpression(r: Ring, u: Json, at: Q | undefined): Json {
  const trig = (name: "Cos" | "Sin", j: number): Json => [name, j === 1 ? u : ["Multiply", j, u]];
  const terms: { coefficient: Q; poly: Json; basis: Json; key: string }[] = [];
  for (const key of [...r.keys()].toSorted()) {
    const [a, j] = unkey(key);
    if (j < 0) continue;
    const [re, im] = r.get(key)!;
    const emit = (coefficient: Q, kind: string, basis: Json): void => {
      if (qZero(coefficient)) return;
      const folded = at === undefined ? coefficient : qMul(coefficient, qPow(at, a));
      const poly: Json = at !== undefined || a === 0 ? 1 : a === 1 ? u : ["Power", u, a];
      terms.push({ coefficient: folded, poly, basis, key: at === undefined ? `${a},${kind}` : kind });
    };
    if (j === 0) emit(re, "k", 1);
    else {
      emit(qMul(re, q(2)), `c${j}`, trig("Cos", j));
      emit(qNeg(qMul(im, q(2))), `s${j}`, trig("Sin", j));
    }
  }
  const merged = new Map<string, (typeof terms)[number]>();
  for (const t of terms) {
    const hit = merged.get(t.key);
    merged.set(t.key, hit === undefined ? t : { ...t, coefficient: qAdd(hit.coefficient, t.coefficient) });
  }
  return add(
    ...[...merged.values()].map(({ coefficient, poly, basis }): Json => {
      if (qZero(coefficient)) return 0;
      const magnitude = q(coefficient[0] < 0n ? -coefficient[0] : coefficient[0], coefficient[1]);
      const unit = magnitude[0] === 1n && magnitude[1] === 1n;
      const body = mul(mul(unit ? 1 : number(magnitude), poly), basis);
      return coefficient[0] < 0n ? neg(body) : body;
    }),
  );
}

/** (−½)ₖ(½)ₖ/(k!)² and ((½)ₖ/k!)²: the coefficients of E(m) and K(m), each over π/2. */
function completeIntegrals(n: number): { e: Q[]; k: Q[] } {
  const e: Q[] = [q(1)];
  const k: Q[] = [q(1)];
  // (a)ᵢ/i! = (a)ᵢ₋₁/(i−1)! · (a + i − 1)/i
  let plusHalf: Q = q(1);
  let minusHalf: Q = q(1);
  for (let i = 1; i <= n; i++) {
    plusHalf = qMul(plusHalf, qMul(qAdd(q(1, 2), q(i - 1)), q(1, i)));
    minusHalf = qMul(minusHalf, qMul(qAdd(q(-1, 2), q(i - 1)), q(1, i)));
    e.push(qMul(plusHalf, minusHalf));
    k.push(qMul(plusHalf, plusHalf));
  }
  return { e, k };
}

/** Heads, by the series that makes up the numerator and denominator (`1` for none). */
type Part = "s" | "c" | "d" | "1";
const QUOTIENTS: Readonly<Record<string, readonly [Part, Part]>> = {
  JacobiSN: ["s", "1"],
  JacobiCN: ["c", "1"],
  JacobiDN: ["d", "1"],
  JacobiNS: ["1", "s"],
  JacobiNC: ["1", "c"],
  JacobiND: ["1", "d"],
  JacobiSC: ["s", "c"],
  JacobiSD: ["s", "d"],
  JacobiCS: ["c", "s"],
  JacobiCD: ["c", "d"],
  JacobiDS: ["d", "s"],
  JacobiDC: ["d", "c"],
};

/** The heads whose m-series at 0 this builds. */
export const JACOBI_M_SERIES_HEADS: readonly string[] = [...Object.keys(QUOTIENTS), "JacobiAmplitude", "JacobiZN"];

/** Highest order built; the coefficients grow quickly and no example goes past a few. */
export const MAX_ORDER = 6;

/**
 * The coefficients of m⁰ … mⁿ in the expansion of `head(u, m)` at m = 0, as expressions in the
 * expression `u`, or undefined for another head, an order past the cap, or a division by a zero
 * of cos u or sin u at a numeric `u` (the quotient has a pole there, and the expansion is not a
 * power series). A `rational` value of `u` merges the terms that share a trig factor.
 */
export function jacobiMCoefficients(
  head: string,
  n: number,
  u: Json,
  atZero: (denominator: Json) => boolean,
  rational?: readonly [bigint, bigint],
): Json[] | undefined {
  if (!Number.isInteger(n) || n < 0 || n > MAX_ORDER) return undefined;
  const at = rational === undefined ? undefined : q(rational[0], rational[1]);
  const { phi, s, c, d, eps } = jacobiSeries(n);
  const express = (series: Series): Json[] => series.map((r) => toExpression(r, u, at));
  if (head === "JacobiAmplitude") return express(phi);
  if (head === "JacobiZN") {
    const { e, k } = completeIntegrals(n);
    const ratio: Q[] = [];
    for (let i = 0; i <= n; i++) {
      let sum = e[i]!;
      for (let j = 1; j <= i; j++) sum = qAdd(sum, qNeg(qMul(k[j]!, ratio[i - j]!)));
      ratio.push(sum);
    }
    const rational: Series = ratio.map((r) => scale(U, [r, q(0)]));
    return express(seriesPlus(eps, seriesScale(rational, real(-1))));
  }
  const parts = QUOTIENTS[head];
  if (parts === undefined) return undefined;
  const series = (p: Part): Series => (p === "s" ? s : p === "c" ? c : p === "d" ? d : constantSeries(ONE, n));
  const [top, bottom] = parts;
  const numerator = series(top);
  const denominator = series(bottom);
  if (bottom === "1" || bottom === "d") {
    // The divisor starts at 1: rₖ = pₖ − Σ₁ᵏ qᵢrₖ₋ᵢ, all in the ring.
    const r = zeros(n);
    for (let k = 0; k <= n; k++) {
      let sum = numerator[k]!;
      for (let i = 1; i <= k; i++) sum = plus(sum, scale(times(denominator[i]!, r[k - i]!), real(-1)));
      r[k] = sum;
    }
    return express(r);
  }
  const lead: Json = [bottom === "c" ? "Cos" : "Sin", u];
  if (atZero(lead)) return undefined;
  // rₖ = Σⱼ Aₖ,ⱼ / leadʲ with the Aₖ,ⱼ in the ring: rₖ = (pₖ − Σ₁ᵏ qᵢrₖ₋ᵢ) / lead moves each A up one power.
  const A: Map<number, Ring>[] = [];
  for (let k = 0; k <= n; k++) {
    const next = new Map<number, Ring>();
    next.set(1, numerator[k]!);
    for (let i = 1; i <= k; i++) {
      for (const [j, ring] of A[k - i]!) {
        next.set(j + 1, plus(next.get(j + 1) ?? new Map(), scale(times(denominator[i]!, ring), real(-1))));
      }
    }
    A.push(next);
  }
  // One fraction per coefficient, over lead^J, so like terms merge and the result stays cheap to simplify.
  const base = bottom === "c" ? COS : SIN;
  return A.map((byPower) => {
    const top = Math.max(...byPower.keys());
    let numerator: Ring = new Map();
    for (const [j, ring] of byPower) {
      let factor = ring;
      for (let i = j; i < top; i++) factor = times(factor, base);
      numerator = plus(numerator, factor);
    }
    return div(toExpression(numerator, u, at), top === 1 ? lead : ["Power", lead, top]);
  });
}
