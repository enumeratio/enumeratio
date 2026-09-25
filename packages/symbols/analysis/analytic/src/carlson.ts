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
// special-cased below. `CarlsonRJ`'s analogous real-negative-p principal value (Carlson
// 1995 eq. (33); DLMF 19.20.14) IS special-cased, in `carlsonRJ` itself — see there.

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
  if (y.im === 0 && y.re < 0 && x.im === 0 && x.re > 0) {
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
 * fourth argument p plays z's role in RD (RD(x,y,z) = RJ(x,y,z,z)).
 *
 * The per-step term (Carlson 1995 §3; DLMF 19.36.2 — the same normal form mpmath's
 * `elliprj` uses) needs √p_m itself, not just the (x,y,z)-symmetric λ:
 *   d_m = (√p_m+√x_m)(√p_m+√y_m)(√p_m+√z_m),   e_m = δ·4^{3m} / d_m²   (δ = (p₀−x₀)(p₀−y₀)(p₀−z₀)
 *   fixed, from the ORIGINAL arguments — not recomputed per step),
 *   RJ(x0,y0,z0,p0) = 6 Σ_{m=0}^∞ 4^{-m}·RC(1, 1+e_m)/d_m.
 * This close cousin — DLMF 19.26.7's sum of `RC(α_m, β_m)` built from α_m = (p_m·(√x_m+
 * √y_m+√z_m) + √x_m√y_m√z_m)² and β_m = p_m(p_m+λ_m)², entirely avoiding √p_m — LOOKS
 * equivalent (both are exact identities for RJ) but is not numerically interchangeable:
 * 19.26.7 squares away p_m's own sign before ever taking a root, so nothing in that sum
 * "sees" which side of `csqrt`'s branch cut p_m's square root belongs on. That is invisible
 * whenever p stays in the right half-plane (α_m, β_m end up wherever the correct branch
 * would have put them anyway) but wrong whenever p0 starts with Re < 0 and only ONE of the
 * four arguments does — `RJ(0, 0.7, 1, −0.17−0.45i)` came back an order of magnitude off
 * against mpmath's `elliprj` under 19.26.7, while this d_m/e_m form (needing an explicit,
 * correctly-branched √p_m every step) matches mpmath there and across a 3000-point
 * complex grid with at most one argument at Re < 0 to machine precision. `fac` (≡ 4^-m)
 * decays geometrically regardless of convergence, same reasoning as before, so this still
 * runs a fixed `RJ_ITERS` rather than a convergence-gated loop — no separate closing term
 * needed at double precision.
 *
 * All four arguments real and ≤ 0 (not all zero) is the reflection RJ(−x,−y,−z,−w) =
 * i·RJ(x,y,z,w), x,y,z,w ≥ 0 (DLMF 19.7.5's sign-reflection specialized to RJ; confirmed
 * against mpmath at both boundary and generic points). Duplicating negative reals directly
 * lands every √ exactly on `csqrt`'s branch cut, where the per-step sum does not actually
 * reduce to this value — reflecting first avoids the cut entirely.
 *
 * Real p < 0, with x, y, z real, nonnegative and at most one 0, is the Cauchy principal
 * value (Carlson 1995 eq. (33); DLMF 19.20.14) rather than whatever the direct duplication
 * would produce off the branch point at t = −p (the d_m/e_m form above still lands √p_m
 * exactly on the branch cut there — a genuinely two-valued point, not a numerical bug — so
 * this needs its own case regardless of the per-step formula). Permuting x, y, z so that y
 * is the median value — `(z−y)(y−x) ≥ 0`, which sorting ascending always satisfies — lets a
 * positive substitute `p` stand in:
 *   p = y + (z−y)(y−x)/(y+q),   q = −p₀,
 *   (y+q)·RJ(x,y,z,−q) = (p−y)·RJ(x,y,z,p) − 3·RF(x,y,z) + 3√(xyz/(xz+pq))·RC(xz+pq, pq).
 * RJ is fully symmetric in its first three arguments (unlike RD), so relabeling them by
 * sorted value changes nothing about which value this computes. Confirmed against a
 * Wolfram kernel, whose own `CarlsonRJ` already returns this same real principal value
 * (not the complex analytic continuation mpmath's `elliprj` gives for real p < 0, whose
 * real part agrees with this to machine precision — Sokhotski–Plemelj's real part, as
 * expected of a principal value).
 */
export function carlsonRJ(x0: Cx, y0: Cx, z0: Cx, p0: Cx): Cx {
  if (
    [x0, y0, z0, p0].every((v) => v.im === 0 && v.re <= 0) &&
    [x0, y0, z0, p0].some((v) => v.re < 0)
  ) {
    return mul(cx(0, 1), carlsonRJ(cx(-x0.re), cx(-y0.re), cx(-z0.re), cx(-p0.re)));
  }
  if (
    p0.im === 0 &&
    p0.re < 0 &&
    x0.im === 0 &&
    x0.re >= 0 &&
    y0.im === 0 &&
    y0.re >= 0 &&
    z0.im === 0 &&
    z0.re >= 0
  ) {
    const [x, y, z] = [x0.re, y0.re, z0.re].sort((a, b) => a - b);
    if ([x, y, z].filter((v) => v === 0).length <= 1) {
      const q = -p0.re;
      const p = y + ((z - y) * (y - x)) / (y + q);
      const pq = p * q;
      const xz = x * z;
      const denom = xz + pq;
      if (denom > 0) {
        const rc = carlsonRC(cx(denom), cx(pq));
        const rf = carlsonRF(cx(x), cx(y), cx(z));
        const rjPos = carlsonRJ(cx(x), cx(y), cx(z), cx(p));
        const rcTerm = scale(mul(cx(Math.sqrt((x * y * z) / denom)), rc), 3);
        return scale(add(add(scale(rjPos, p - y), scale(rf, -3)), rcTerm), 1 / (y + q));
      }
    }
  }

  let x = x0;
  let y = y0;
  let z = z0;
  let p = p0;
  let sum = cx(0);
  let fac = cx(1);
  // δ is fixed at the ORIGINAL arguments — recomputing (p_m−x_m)(p_m−y_m)(p_m−z_m) each
  // step would silently converge it to 0 and is not the identity this implements.
  const delta = mul(mul(sub(p0, x0), sub(p0, y0)), sub(p0, z0));
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
    const sp = csqrt(p); // the branch info 19.26.7's α/β form throws away — see above
    const lam = add(add(mul(sx, sy), mul(sy, sz)), mul(sz, sx));
    const dm = mul(mul(add(sp, sx), add(sp, sy)), add(sp, sz));
    const facCubed = mul(mul(fac, fac), fac);
    const em = div(mul(delta, facCubed), mul(dm, dm));
    sum = add(sum, div(mul(fac, carlsonRC(cx(1), add(cx(1), em))), dm));
    fac = scale(fac, 0.25);
    x = scale(add(x, lam), 0.25);
    y = scale(add(y, lam), 0.25);
    z = scale(add(z, lam), 0.25);
    p = scale(add(p, lam), 0.25);
  }
  return scale(sum, 6);
}

/**
 * RG(x,y,z) = (1/4π)∫₀^{2π}∫₀^π √(x sin²θcos²φ + y sin²θsin²φ + z cos²θ) sinθ dθ dφ — the
 * fully symmetric one whose integral defines the surface area of an ellipsoid with
 * semi-axes √x, √y, √z. Reduced through RF and RD (DLMF 19.21.10):
 *   2·RG(x,y,z) = z·RF(x,y,z) − (x−z)(y−z)·RD(x,y,z)/3 + √(xy/z),   z ≠ 0.
 * RG is symmetric, so any nonzero argument can play "z" here; picking the
 * largest-magnitude one keeps the divisions well away from cancellation — PROVIDED the
 * other two aren't both zero, where the reduction breaks down: RF(0,0,z) diverges (two
 * zero arguments is one too many for RF, not just one), so "z" must instead be one of the
 * two coincident zeros there. DLMF 19.20.3 gives the elementary answer directly:
 * RG(0,0,z) = √z/2 (and RG(0,0,0) = 0, the one case with no nonzero argument to pick).
 */
export function carlsonRG(x: Cx, y: Cx, z: Cx): Cx {
  const args = [x, y, z];
  const zeros = args.filter((v) => abs(v) === 0).length;
  if (zeros === 3) return cx(0); // x = y = z = 0
  if (zeros === 2) {
    const nonzero = args.find((v) => abs(v) !== 0)!;
    return scale(csqrt(nonzero), 0.5); // RG(0,0,z) = √z/2
  }
  let pick = 0;
  for (let i = 1; i < 3; i++) if (abs(args[i]) > abs(args[pick])) pick = i;
  const c = args[pick];
  const [a, b] = args.filter((_, i) => i !== pick);
  const term1 = mul(c, carlsonRF(a, b, c));
  const term2 = scale(mul(sub(a, c), mul(sub(b, c), carlsonRD(a, b, c))), -1 / 3);
  const sqrtTerm = csqrt(div(mul(a, b), c));
  return scale(add(add(term1, term2), sqrtTerm), 0.5);
}

/**
 * Is `(x,y,z,p)` outside the argument regions `carlsonRJ` is verified correct on (DLMF
 * 19.16, 19.20)? Three regions ARE covered and return a genuine, mpmath/Wolfram-checked
 * value: all four real and ≥ 0 (no branch cut in reach); all four real and ≤ 0, not all
 * zero (the reflection above); and real p < 0 with x, y, z real ≥ 0 and at most one zero
 * (the Cauchy principal value above — its imaginary part is deliberately 0, matching
 * Wolfram's `CarlsonRJ` there rather than mpmath's complex analytic continuation, even at
 * a tie between two of x, y, z where one internal term vanishes; the real part still
 * checks out against mpmath in every case tested). Everything else that touches a branch
 * cut is unverified: real arguments split across zero in a shape the CPV formula doesn't
 * cover (e.g. a negative x, y or z with p ≥ 0), or genuinely complex arguments with two or
 * more of x, y, z, p on the wrong side of the cut (Re < 0) at once — confirmed (a 1000+ point
 * complex grid, see `tests/carlson.test.ts`) even after the d_m/e_m fix above: at most one
 * argument at Re < 0 matches mpmath's `elliprj` to machine precision, two or more generally
 * does not. The one exception: `p` exactly equal to `x`, `y`, or `z` — δ = (p−x)(p−y)(p−z)
 * has a zero factor there, RJ degenerates to RD(x,y,z) (RJ(x,y,z,z) = RD(x,y,z), and RJ is
 * symmetric in its first three arguments so this holds regardless of which of x,y,z p equals),
 * and the d_m/e_m algorithm reproduces that value to machine precision no matter how many of
 * the four are at Re < 0 (checked, 1000-point grid) — the branch risk above comes from δ's
 * own sign, which a zero factor forecloses. This is the same exemption mpmath's `elliprj`
 * grants (its `x == p or y == p or z == p` check). Declining outside all of this keeps the
 * declared head from asserting a number it hasn't earned; the underlying `carlsonRJ` above is
 * unchanged for internal callers. Exported so callers building on `carlsonRJ` directly (e.g.
 * `elliptic.ts`'s `IncompleteEllipticPi`) share this same, up-to-date boundary rather than
 * keeping their own copy.
 */
export function carlsonRJDeclines(x: Cx, y: Cx, z: Cx, p: Cx): boolean {
  const args = [x, y, z, p];
  const pEqualsOne = [x, y, z].some((v) => v.re === p.re && v.im === p.im);
  if (pEqualsOne) return false; // RJ(x,y,z,z) = RD(x,y,z) — no branch risk, any sign pattern
  if (args.every((v) => v.im === 0)) {
    if (args.every((v) => v.re >= 0)) return false; // no cut in reach
    if (args.every((v) => v.re <= 0) && args.some((v) => v.re !== 0)) return false; // reflection
    const [xr, yr, zr] = [x.re, y.re, z.re].sort((a, b) => a - b);
    const cpv =
      p.re < 0 && xr >= 0 && yr >= 0 && zr >= 0 && [xr, yr, zr].filter((v) => v === 0).length <= 1;
    return !cpv;
  }
  return args.filter((v) => v.re < 0).length >= 2;
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
      const [xc, yc, zc, pc] = [cx(x.re, x.im), cx(y.re, y.im), cx(z.re, z.im), cx(p.re, p.im)];
      if (carlsonRJDeclines(xc, yc, zc, pc)) return undefined; // stays symbolic — see there
      return numberResult(ce, carlsonRJ(xc, yc, zc, pc));
    },
  });

  ce.declare("CarlsonRG", {
    signature: "(number, number, number) -> number",
    evaluate: (ops, options) => evaluate3(ce, ops, carlsonRG, options),
  });
}
