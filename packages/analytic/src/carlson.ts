import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { type EvalOptions, isFiniteNum, numberResult, wantsNumber } from "./box.ts";
import { abs, add, cpow, cx, type Cx, div, mul, scale, sub } from "./complex.ts";

// Carlson symmetric elliptic integrals RF, RD, RJ, RC, RG (Carlson 1995, "Numerical
// computation of real or complex elliptic integrals"; DLMF §19.16, §19.36). These are
// the modern basis the classical Legendre integrals K, E, Π reduce to, and Fungrim's
// elliptic identities are stated over them.
//
// Every one of these functions is invariant, EXACTLY, under Carlson's duplication step
//   λ = √x·√y + √y·√z + √z·√x,   x₁ = (x+λ)/4,  y₁ = (y+λ)/4,  z₁ = (z+λ)/4
// (DLMF 19.26.5), and in the limit the arguments converge to a common value μ where the
// function is elementary: RF(μ,μ,μ) = μ^(−1/2), RD(μ,μ,μ) = RJ(μ,μ,μ,μ) = μ^(−3/2) (each
// a one-line check of the defining integral at equal arguments). RD and RJ pick up one
// more exact term per step on the way down (DLMF 19.26.6-7), so both are a convergent sum
// plus a shrinking tail. So no series-in-the-deviation expansion is needed anywhere below
// — just duplicating until the arguments coincide to machine precision (quadratic
// convergence, so a few dozen steps is always enough) and reading off the elementary
// value; this trades a handful of extra √ evaluations for not having to encode Carlson's
// higher-order correction coefficients from memory.
//
// All four take complex arguments; √ is the principal branch (branch cut on the negative
// reals), which is exactly `cpow(z, ½)` here — the same branch DLMF and mpmath use. That
// makes every head correct off the branch cuts, including for genuinely complex arguments.
// The one place a cut actually bites in ordinary use is `CarlsonRC(x, y)` with real x > 0
// and real y < 0, whose principal value is a Cauchy principal value (DLMF 19.2.19) rather
// than what plugging a negative real straight into RF(x,y,y) would give; that case is
// special-cased below. The analogous real-negative-p principal value for RJ (DLMF
// 19.16.5) is NOT special-cased — it is a rarer edge case, and its substitution needs its
// own careful derivation; a real p < 0 currently gets whatever the direct duplication
// produces off the branch point, which is not the Cauchy principal value there.

const MAX_ITERS = 100;
const TOL = 1e-15;

/** Fixed step count for `carlsonRJ`'s sum (see there for why this can't be convergence-gated). */
const RJ_ITERS = 40;

/**
 * Principal-branch square root: `cpow(z, ½)`, cut on the negative reals. `z = 0` is
 * special-cased — `cpow`'s `0 · (−∞)` in `w·log(z)` would otherwise come back NaN — which
 * matters here since RF, RD, RJ, RG all accept a zero argument (the "complete" cases).
 */
const csqrt = (z: Cx): Cx => (z.re === 0 && z.im === 0 ? z : cpow(z, cx(0.5)));

/**
 * Are all the given values within `tol` of their mean (the duplication has converged)?
 * RJ's fourth argument `p` must be checked alongside x, y, z here — it is pulled toward
 * the common limit only LINEARLY (ratio ¼ per step, since λ is built from x, y, z alone),
 * where x, y, z converge to each other quadratically; a convergence check over x, y, z
 * alone stops the loop while p is still measurably off, which is exactly what under-ran
 * `CarlsonRJ`'s accuracy before this was caught against the mpmath/Wolfram goldens.
 */
function converged(...values: Cx[]): boolean {
  const mu = scale(values.reduce(add), 1 / values.length);
  const scaleAbs = abs(mu) || 1;
  return values.every((v) => abs(sub(v, mu)) <= TOL * scaleAbs);
}

/** RF(x,y,z) = ½∫₀^∞ dt / √((t+x)(t+y)(t+z)) — symmetric in all three arguments. */
export function carlsonRF(x0: Cx, y0: Cx, z0: Cx): Cx {
  let x = x0;
  let y = y0;
  let z = z0;
  for (let i = 0; i < MAX_ITERS && !converged(x, y, z); i++) {
    const sx = csqrt(x);
    const sy = csqrt(y);
    const sz = csqrt(z);
    const lam = add(add(mul(sx, sy), mul(sy, sz)), mul(sz, sx));
    x = scale(add(x, lam), 0.25);
    y = scale(add(y, lam), 0.25);
    z = scale(add(z, lam), 0.25);
  }
  const mu = scale(add(add(x, y), z), 1 / 3);
  return cpow(mu, cx(-0.5));
}

/**
 * RC(x,y) = ½∫₀^∞ dt / [(t+y)√(t+x)] — the degenerate case RF(x,y,y), a rational/log/
 * trig "elementary" elliptic integral. For real y < 0 < x this routes through the Cauchy
 * principal value (DLMF 19.2.19): RC(x,y) = √(x/(x−y))·RC(x−y, −y), which lands the
 * recursive call on a positive second argument where the direct definition applies.
 */
export function carlsonRC(x: Cx, y: Cx): Cx {
  if (y.im === 0 && y.re < 0 && x.im === 0) {
    const shifted = carlsonRF(cx(x.re - y.re), cx(-y.re), cx(-y.re));
    return mul(cpow(cx(x.re / (x.re - y.re)), cx(0.5)), shifted);
  }
  return carlsonRF(x, y, y);
}

/**
 * RD(x,y,z) = (3/2)∫₀^∞ dt / [(t+z)√((t+x)(t+y)(t+z))] — symmetric in x, y, and (unlike
 * RF) distinguishing z. Accumulates the exact per-step term of DLMF 19.26.6 and closes
 * with the elementary value at the common limit for the (vanishingly small) remainder.
 */
export function carlsonRD(x0: Cx, y0: Cx, z0: Cx): Cx {
  let x = x0;
  let y = y0;
  let z = z0;
  let sum = cx(0);
  let fac = cx(1);
  for (let i = 0; i < MAX_ITERS && !converged(x, y, z); i++) {
    const sx = csqrt(x);
    const sy = csqrt(y);
    const sz = csqrt(z);
    const lam = add(add(mul(sx, sy), mul(sy, sz)), mul(sz, sx));
    sum = add(sum, scale(mul(fac, cpow(mul(sz, add(z, lam)), cx(-1))), 3));
    fac = scale(fac, 0.25);
    x = scale(add(x, lam), 0.25);
    y = scale(add(y, lam), 0.25);
    z = scale(add(z, lam), 0.25);
  }
  const mu = scale(add(add(x, y), z), 1 / 3);
  return add(sum, mul(fac, cpow(mu, cx(-1.5))));
}

/**
 * RJ(x,y,z,p) = (3/2)∫₀^∞ dt / [(t+p)√((t+x)(t+y)(t+z))] — symmetric in x, y, z; the
 * fourth argument p plays z's role in RD (RD(x,y,z) = RJ(x,y,z,z)). Unlike RD's sum,
 * whose per-step term is an elementary reciprocal, RJ's per-step term is itself an
 * `RC` call (DLMF 19.26.7):
 *   α_m = (p_m(√x_m+√y_m+√z_m) + √x_m√y_m√z_m)²,   β_m = p_m(p_m+λ_m)²,
 *   RJ(x0,y0,z0,p0) = 3 Σ_{m=0}^∞ 4^{-m}·RC(α_m, β_m).
 * (A naive analogue of RD's own reciprocal term, 6·4^{-m}/[(√p+√x)(√p+√y)(√p+√z)], is
 * close but not this — RC's own duplication does real work here, not just packaging a
 * reciprocal.) p converges to the common limit only linearly, so this needs the
 * (x,y,z,p)-convergence check, same as the loop below; once that holds, `fac` is already
 * negligible and the partial sum needs no separate closing term.
 */
export function carlsonRJ(x0: Cx, y0: Cx, z0: Cx, p0: Cx): Cx {
  let x = x0;
  let y = y0;
  let z = z0;
  let p = p0;
  let sum = cx(0);
  let fac = cx(1);
  // RJ's answer lives entirely in this sum, whose terms shrink by exactly 4× a step
  // (fac = 4^−m) REGARDLESS of whether x, y, z, p have converged — unlike RF/RD, there
  // is no elementary closing value at the common limit to fall back on, so an
  // (x,y,z,p)-converged check is the wrong stopping rule (at x=y=z=p it is true from the
  // very first step, while the terms it would cut off still sum to a geometric series
  // that is 3/4 of the answer). So this runs a fixed number of steps — cheap, since
  // fac's decay is deterministic and 4^−RJ_ITERS is negligible at any double-precision
  // input — rather than stopping on a convergence test.
  for (let i = 0; i < RJ_ITERS; i++) {
    const sx = csqrt(x);
    const sy = csqrt(y);
    const sz = csqrt(z);
    const lam = add(add(mul(sx, sy), mul(sy, sz)), mul(sz, sx));
    const alpha = add(mul(p, add(add(sx, sy), sz)), mul(sx, mul(sy, sz)));
    const alphaSq = mul(alpha, alpha);
    const beta = mul(p, mul(add(p, lam), add(p, lam)));
    sum = add(sum, mul(fac, carlsonRC(alphaSq, beta)));
    fac = scale(fac, 0.25);
    x = scale(add(x, lam), 0.25);
    y = scale(add(y, lam), 0.25);
    z = scale(add(z, lam), 0.25);
    p = scale(add(p, lam), 0.25);
  }
  return scale(sum, 3);
}

/**
 * RG(x,y,z) = (1/4π)∫₀^{2π}∫₀^π √(x sin²θcos²φ + y sin²θsin²φ + z cos²θ) sinθ dθ dφ — the
 * fully symmetric one whose integral defines the surface area of an ellipsoid with
 * semi-axes √x, √y, √z. Reduced through RF and RD (DLMF 19.21.10):
 *   2·RG(x,y,z) = z·RF(x,y,z) − (x−z)(y−z)·RD(x,y,z)/3 + √(xy/z),   z ≠ 0.
 * RG is symmetric, so any nonzero argument can play "z" here; picking the
 * largest-magnitude one keeps the divisions well away from cancellation. All three zero
 * is the one case with no nonzero argument to pick, and RG(0,0,0) = 0 directly from the
 * integral.
 */
export function carlsonRG(x: Cx, y: Cx, z: Cx): Cx {
  const args = [x, y, z];
  let pick = 0;
  for (let i = 1; i < 3; i++) if (abs(args[i]) > abs(args[pick])) pick = i;
  const c = args[pick];
  if (abs(c) === 0) return cx(0); // x = y = z = 0
  const [a, b] = args.filter((_, i) => i !== pick);
  const term1 = mul(c, carlsonRF(a, b, c));
  const term2 = scale(mul(sub(a, c), mul(sub(b, c), carlsonRD(a, b, c))), -1 / 3);
  const sqrtTerm = csqrt(div(mul(a, b), c));
  return scale(add(add(term1, term2), sqrtTerm), 0.5);
}

// --- Real-scalar wrappers, for the plotting/compiled pipeline (see box.ts's realCompile) --

export const carlsonRFReal = (x: number, y: number, z: number): number =>
  carlsonRF(cx(x), cx(y), cx(z)).re;
export const carlsonRCReal = (x: number, y: number): number => carlsonRC(cx(x), cx(y)).re;
export const carlsonRDReal = (x: number, y: number, z: number): number =>
  carlsonRD(cx(x), cx(y), cx(z)).re;
export const carlsonRJReal = (x: number, y: number, z: number, p: number): number =>
  carlsonRJ(cx(x), cx(y), cx(z), cx(p)).re;
export const carlsonRGReal = (x: number, y: number, z: number): number =>
  carlsonRG(cx(x), cx(y), cx(z)).re;

// --- compute-engine declarations -----------------------------------------------------

function evaluate3(
  ce: ComputeEngine,
  ops: readonly BoxedExpression[],
  kernel: (x: Cx, y: Cx, z: Cx) => Cx,
  options: EvalOptions,
): BoxedExpression | undefined {
  const [x, y, z] = ops;
  if (x === undefined || y === undefined || z === undefined) return undefined;
  if (!wantsNumber(ops, options) || !isFiniteNum(x) || !isFiniteNum(y) || !isFiniteNum(z)) {
    return undefined;
  }
  return numberResult(ce, kernel(cx(x.re, x.im), cx(y.re, y.im), cx(z.re, z.im)));
}

/**
 * Declare `CarlsonRF`, `CarlsonRC`, `CarlsonRD`, `CarlsonRJ`, `CarlsonRG` — Wolfram's own
 * names for these (`CarlsonRF[x,y,z]` etc.), same argument order. Numeric only: these
 * have no widely useful closed forms to reduce to symbolically (RF(t,t,t) = 1/√t and
 * friends are the exception, not something worth special-casing here), so plain
 * `evaluate()` leaves them symbolic and only a float argument or `N()` computes.
 */
export function declareCarlson(ce: ComputeEngine): void {
  if (ce.lookupDefinition("CarlsonRF") !== undefined) return; // never redeclare a native head

  ce.declare("CarlsonRF", {
    signature: "(number, number, number) -> number",
    evaluate: (ops, options) => evaluate3(ce, ops, carlsonRF, options),
  });

  ce.declare("CarlsonRC", {
    signature: "(number, number) -> number",
    evaluate: (ops, options) => {
      const [x, y] = ops;
      if (x === undefined || y === undefined) return undefined;
      if (!wantsNumber(ops, options) || !isFiniteNum(x) || !isFiniteNum(y)) return undefined;
      return numberResult(ce, carlsonRC(cx(x.re, x.im), cx(y.re, y.im)));
    },
  });

  ce.declare("CarlsonRD", {
    signature: "(number, number, number) -> number",
    evaluate: (ops, options) => evaluate3(ce, ops, carlsonRD, options),
  });

  ce.declare("CarlsonRJ", {
    signature: "(number, number, number, number) -> number",
    evaluate: (ops, options) => {
      const [x, y, z, p] = ops;
      if (x === undefined || y === undefined || z === undefined || p === undefined)
        return undefined;
      if (
        !wantsNumber(ops, options) ||
        !isFiniteNum(x) ||
        !isFiniteNum(y) ||
        !isFiniteNum(z) ||
        !isFiniteNum(p)
      ) {
        return undefined;
      }
      return numberResult(
        ce,
        carlsonRJ(cx(x.re, x.im), cx(y.re, y.im), cx(z.re, z.im), cx(p.re, p.im)),
      );
    },
  });

  ce.declare("CarlsonRG", {
    signature: "(number, number, number) -> number",
    evaluate: (ops, options) => evaluate3(ce, ops, carlsonRG, options),
  });
}
