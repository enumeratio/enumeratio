import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import { type EvalOptions, isFiniteNum, numberResult, wantsNumber } from "./box.ts";
import { add, casin, ccos, clog, csech, csin, csqrt, ctanh, cx, type Cx, div, mul, scale, sub } from "./complex.ts";

// The twelve Jacobi elliptic functions (Glaisher's `pq(u,m)` notation: `sn`, `cn`, `dn`
// and their nine quotients/reciprocals), `JacobiAmplitude` and `JacobiZN` (Wolfram's
// Jacobi zeta). Wolfram/mpmath's PARAMETER convention throughout: `m = k²`, not the
// modulus `k` (checked against mpmath.ellipfun(kind, u, m=m) at every point below).
//
// Numeric core: the descending Landen/AGM method (Abramowitz & Stegun 16.4; DLMF
// 22.20(ii)) for real `u`, real `m ∈ [0, 1]` — verified against mpmath there to double
// precision. `m` outside `[0, 1]` reduces to that case via the reciprocal-modulus
// (m > 1, DLMF 22.17.1) and imaginary-modulus (m < 0, DLMF 22.17.2) transformations. A
// complex `m` is declined: neither transformation nor the AGM descent has been verified
// there.
//
// Complex `u = x + iy`: NOT the AGM recursion carried in complex arithmetic (an earlier
// version of this file did that, and lost 3-4 digits — `cosh`/`sinh` of the accumulating
// angle grow with each of the recursion's ~5-10 steps, and the final combination cancels
// most of the growth back out, taking working precision with it). Instead, DLMF 22.8's
// real addition formulas (`sncndnComplexU`, "Jacobi's imaginary transformation"): evaluate
// the real-u kernel at (x, m) and at (y, 1−m), and combine algebraically — no growing
// trig factors, so no cancellation. Verified against mpmath to ~1e-14 relative or better
// (tighter very close to sn's poles, where the reference value itself is enormous) across
// all four quadrants of u and large |Im u| (tests/jacobi-elliptic.test.ts).
//
// `dn` comes from the Pythagorean identity `dn² = 1 − m·sn²` in the real-u kernel only
// (exact there — dn ≥ 0, no branch ambiguity); the complex-u combination above computes
// dn directly from the real kernel's own dn values, so it never needs that identity (or
// its principal-branch square root) at complex u at all.
//
// `JacobiAmplitude`/`JacobiZN` need the amplitude φ = am(u,m) directly (not just sn, cn).
// Real u: the AGM recursion produces φ as a byproduct, for m ∈ [0, 1] — no equally-
// verified amplitude transform exists here for m outside that range, so both heads
// decline there (the pq family itself does not; see above). Complex u: φ is recovered
// from the now-accurate complex sn/cn via e^{iφ} = cos φ + i sin φ = cn + i·sn, i.e.
// φ = −i·Log(cn + i·sn) — verified against a Wolfram kernel (mpmath has no direct
// amplitude function) at several complex points, including large |Im u| and u past the
// first quarter period.

const AGM_TOL = 1e-15;
const MAX_AGM_ITERS = 60;

/** p/q/1, keyed by Glaisher's four function letters — `N` is the constant 1, so all
 * twelve `pq` functions (including sn = s/n, cn = c/n, dn = d/n themselves) are one
 * division away from the same {S, C, D} triple. */
export type PQLetter = "S" | "C" | "D" | "N";
interface SCDN<T> {
  S: T;
  C: T;
  D: T;
  N: T;
}

/** Descending Landen/AGM amplitude am(u,m), REAL u, real m ∈ [0, 1] (Abramowitz &
 * Stegun 16.4). `m = 0`/`m = 1` are exact (no AGM needed — the recursion degenerates at
 * m = 0 and never converges at m = 1). Precise for real u (verified against mpmath); do
 * not call with complex u — see `agmAmplitude` below for that case. */
function agmAmplitudeReal(u: Cx, m: number): Cx {
  if (m === 0) return u; // am(u,0) = u
  if (m === 1) return casin(ctanh(u)); // am(u,1) = gd(u) = asin(tanh(u)), bounded so principal asin is exact

  let a = 1;
  let b = Math.sqrt(1 - m);
  let c = Math.sqrt(m);
  const seqA: number[] = [a];
  const seqC: number[] = [c];
  let n = 0;
  for (; n < MAX_AGM_ITERS; n++) {
    const a2 = (a + b) / 2;
    const b2 = Math.sqrt(a * b);
    const c2 = (a - b) / 2;
    a = a2;
    b = b2;
    c = c2;
    seqA.push(a);
    seqC.push(c);
    if (Math.abs(c) <= AGM_TOL * Math.abs(a)) break;
  }
  const iters = n === MAX_AGM_ITERS ? n : n + 1; // number of completed AGM steps

  let phi = scale(u, 2 ** iters * seqA[iters]!);
  for (let k = iters; k >= 1; k--) {
    const ratio = seqC[k]! / seqA[k]!;
    phi = scale(add(phi, casin(scale(csin(phi), ratio))), 0.5);
  }
  return phi;
}

/**
 * am(u,m), any complex u, real m ∈ [0, 1]. Real u: `agmAmplitudeReal` directly. Complex
 * u: recovered from `sncndnCore`'s now-accurate complex sn/cn (see the file header) via
 * e^{iφ} = cos φ + i sin φ = cn + i·sn, so φ = −i·Log(cn + i·sn) — the principal branch
 * of Log matches Wolfram's own `JacobiAmplitude` at every complex point checked,
 * including large |Im u| and u past the first quarter period.
 */
function agmAmplitude(u: Cx, m: number): Cx {
  if (u.im === 0) return agmAmplitudeReal(u, m);
  const { S, C } = sncndnCore(u, m);
  const iS = cx(-S.im, S.re); // i·sn
  return mul(cx(0, -1), clog(add(C, iS)));
}

/** {sn, cn, dn} for real m ∈ [0, 1], u possibly complex. Real u: sn/cn from the AGM
 * amplitude, dn from the exact identity dn² = 1 − m·sn² (real & nonnegative there, no
 * branch ambiguity). Complex u: `sncndnComplexU`'s real addition formulas — see the file
 * header for why this replaced carrying the AGM recursion itself in complex arithmetic.
 */
function sncndnCore(u: Cx, m: number): SCDN<Cx> {
  if (u.im !== 0) return sncndnComplexU(u, m);
  if (m === 1) {
    const t = ctanh(u);
    const s = csech(u);
    return { S: t, C: s, D: s, N: cx(1) };
  }
  const phi = agmAmplitudeReal(u, m);
  const S = csin(phi);
  const C = ccos(phi);
  const D = m === 0 ? cx(1) : csqrt(sub(cx(1), scale(mul(S, S), m)));
  return { S, C, D, N: cx(1) };
}

/**
 * {sn, cn, dn} at complex u = x + iy, real m ∈ [0, 1], via DLMF 22.8's real addition
 * formulas (equivalently, Jacobi's imaginary transformation): with s = sn(x,m),
 * c = cn(x,m), d = dn(x,m), s₁ = sn(y,m₁), c₁ = cn(y,m₁), d₁ = dn(y,m₁) — m₁ = 1 − m —
 * and δ = c₁² + m·s²·s₁²:
 *   sn(u) = (s·d₁ + i·c·d·s₁·c₁)/δ,  cn(u) = (c·c₁ − i·s·d·s₁·d₁)/δ,
 *   dn(u) = (d·c₁·d₁ − i·m·s·c·s₁)/δ.
 * Both real-u evaluations go back through `sncndnCore` (recursing into its real branch,
 * where m and m₁ are both still in [0, 1]), so this needs no numeric method of its own —
 * just the algebra above. Verified against mpmath to ~1e-14 relative (or a comparable
 * absolute error very near a pole of sn, where the reference value is itself enormous)
 * across all four quadrants of u and large |Im u| (tests/jacobi-elliptic.test.ts). δ → 0
 * at u → i·K'(m) (sn's pole) falls out of the algebra on its own — no separate case.
 */
function sncndnComplexU(u: Cx, m: number): SCDN<Cx> {
  const x = u.re;
  const y = u.im;
  const m1 = 1 - m;
  const r1 = sncndnCore(cx(x, 0), m);
  const r2 = sncndnCore(cx(y, 0), m1);
  const s = r1.S.re;
  const c = r1.C.re;
  const d = r1.D.re;
  const s1 = r2.S.re;
  const c1 = r2.C.re;
  const d1 = r2.D.re;
  const delta = c1 * c1 + m * s * s * s1 * s1;
  const S = cx((s * d1) / delta, (c * d * s1 * c1) / delta);
  const C = cx((c * c1) / delta, -(s * d * s1 * d1) / delta);
  const D = cx((d * c1 * d1) / delta, -(m * s * c * s1) / delta);
  return { S, C, D, N: cx(1) };
}

/**
 * {sn, cn, dn} for ANY real m, u possibly complex: m ∈ [0,1] direct, m > 1 via the
 * reciprocal-modulus transformation (DLMF 22.17.1: m₁ = 1/m),
 *   sn(u,m) = sn(u√m, m₁)/√m,  cn(u,m) = dn(u√m, m₁),  dn(u,m) = cn(u√m, m₁),
 * m < 0 via the imaginary-modulus transformation (DLMF 22.17.2: m₁ = m/(m−1), μ = √(1−m)),
 *   sn(u,m) = sn(uμ,m₁)/(μ·dn(uμ,m₁)),  cn(u,m) = cn(uμ,m₁)/dn(uμ,m₁),  dn(u,m) = 1/dn(uμ,m₁).
 * Both verified against mpmath at real and complex u (tests/jacobi-elliptic.test.ts).
 * `undefined` for a genuinely complex m — neither the AGM descent nor either transform
 * is verified there.
 */
export function sncndn(u: Cx, m: Cx): SCDN<Cx> | undefined {
  if (m.im !== 0) return undefined; // declined — see file header
  const mr = m.re;
  if (mr >= 0 && mr <= 1) return sncndnCore(u, mr);
  if (mr > 1) {
    const m1 = 1 / mr;
    const sqm = Math.sqrt(mr);
    const sub1 = sncndnCore(scale(u, sqm), m1);
    return { S: scale(sub1.S, 1 / sqm), C: sub1.D, D: sub1.C, N: cx(1) };
  }
  // mr < 0
  const m1 = mr / (mr - 1);
  const mu = Math.sqrt(1 - mr);
  const sub1 = sncndnCore(scale(u, mu), m1);
  return { S: scale(div(sub1.S, sub1.D), 1 / mu), C: div(sub1.C, sub1.D), D: div(cx(1), sub1.D), N: cx(1) };
}

/** Jacobi amplitude am(u,m), real m ∈ [0, 1] only — see the file header for why the
 * m-outside-[0,1] transforms aren't extended to the amplitude itself. */
export function amplitude(u: Cx, m: Cx): Cx | undefined {
  if (m.im !== 0 || m.re < 0 || m.re > 1) return undefined;
  return agmAmplitude(u, m.re);
}

// --- compute-engine declarations -----------------------------------------------------

/** Build then finish an expression the way the caller asked: N() for N(...), else
 * evaluate() — same helper as elementary-special-values.ts, so a Pi or Sqrt(rational)
 * inside an exact special value still comes out as a decimal under N(). */
const finish = (expr: BoxedExpression, options: EvalOptions): BoxedExpression =>
  options.numericApproximation ? expr.N() : expr.evaluate();

const isZeroExpr = (x: BoxedExpression): boolean => x.re === 0 && x.im === 0;
const isOneExpr = (x: BoxedExpression): boolean => x.re === 1 && x.im === 0;

/**
 * The four exact building blocks {S, C, D, N} of `pq(u,m)`, as boxed expressions, for
 * every case `details` promises an exact value: u = 0 (any m — sn = 0, cn = dn = 1),
 * m = 0 (any u — sn = sin u, cn = cos u, dn = 1), m = 1 (any u — sn = tanh u,
 * cn = dn = sech u), and the quarter period u = EllipticK(m) (any m — sn = 1, cn = 0,
 * dn = √(1−m)), matching Fungrim/DLMF 22.5. `undefined` when none apply, so the caller
 * falls through to the numeric AGM kernel.
 */
function exactSCDN(ce: ComputeEngine, u: BoxedExpression, m: BoxedExpression): SCDN<BoxedExpression> | undefined {
  if (isZeroExpr(u)) return { S: ce.Zero, C: ce.One, D: ce.One, N: ce.One };
  if (isZeroExpr(m)) return { S: ce.function("Sin", [u]), C: ce.function("Cos", [u]), D: ce.One, N: ce.One };
  if (isOneExpr(m)) {
    const sech = ce.function("Divide", [1, ce.function("Cosh", [u])]);
    return { S: ce.function("Tanh", [u]), C: sech, D: sech, N: ce.One };
  }
  const uOps = operandsOf(u);
  if (u.operator === "EllipticK" && uOps.length === 1 && uOps[0]!.isSame(m)) {
    return { S: ce.One, C: ce.Zero, D: ce.function("Sqrt", [ce.function("Subtract", [1, m])]), N: ce.One };
  }
  return undefined;
}

const cxOf = (x: BoxedExpression): Cx => cx(x.re, x.im);

/** Declare one Jacobi `pq` head — its exact table (`exactSCDN`, works even without
 * `N()`/a float operand) first, then the numeric AGM kernel (`sncndn`) once a number is
 * actually wanted. */
function declarePQ(ce: ComputeEngine, head: string, p: PQLetter, q: PQLetter): void {
  ce.declare(head, {
    signature: "(number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const [u, m] = ops;
      if (u === undefined || m === undefined) return undefined;

      const exact = exactSCDN(ce, u, m);
      if (exact !== undefined) return finish(ce.function("Divide", [exact[p], exact[q]]), options);

      if (!wantsNumber(ops, options) || !isFiniteNum(u) || !isFiniteNum(m)) return undefined;
      const result = sncndn(cxOf(u), cxOf(m));
      if (result === undefined) return undefined;
      return numberResult(ce, div(result[p], result[q]));
    },
  });
}

/** `JacobiAmplitude(u,m)`: am(u,m), real m ∈ [0,1] (see file header). Exact at u = 0
 * (any m — am = 0) and m = 0 (any u — am = u); the m = 1 and quarter-period exact cases
 * fold out of the same general formula numerically (`agmAmplitude` handles m = 1
 * directly), so they aren't special-cased separately here. */
function declareJacobiAmplitude(ce: ComputeEngine): void {
  ce.declare("JacobiAmplitude", {
    signature: "(number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const [u, m] = ops;
      if (u === undefined || m === undefined) return undefined;
      if (isZeroExpr(u)) return finish(ce.Zero, options);
      if (isZeroExpr(m)) return finish(u, options);

      if (!wantsNumber(ops, options) || !isFiniteNum(u) || !isFiniteNum(m)) return undefined;
      const phi = amplitude(cxOf(u), cxOf(m));
      return phi === undefined ? undefined : numberResult(ce, phi);
    },
  });
}

/**
 * `JacobiZN(u,m)` — Wolfram's Jacobi zeta, Z(u,m) = E(am(u,m),m) − (E(m)/K(m))·u (DLMF
 * 22.16.31), composed from the already-declared `IncompleteEllipticE`/`EllipticE`/
 * `EllipticK` (elliptic.ts) the way `elliptic.ts` itself composes native heads. Real
 * m ∈ [0,1] only (inherits `amplitude`'s restriction). Exact at u = 0 (any m — Z = 0,
 * since am(0,m) = 0 and the linear term vanishes) and m = 0 (any u — Z ≡ 0, a standard
 * identity: am(u,0) = u makes E(am,0) = u exactly, canceling the E(0)/K(0)·u = u term).
 * m = 1 is NOT special-cased: K(1) = ∞ makes E(m)/K(m) → 0 well-behaved in ordinary
 * float arithmetic (a finite numerator over `Infinity`), so the general formula already
 * gives the right answer there without a separate branch.
 */
function declareJacobiZN(ce: ComputeEngine): void {
  ce.declare("JacobiZN", {
    signature: "(number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => {
      const [u, m] = ops;
      if (u === undefined || m === undefined) return undefined;
      if (isZeroExpr(u) || isZeroExpr(m)) return finish(ce.Zero, options);

      if (!wantsNumber(ops, options) || !isFiniteNum(u) || !isFiniteNum(m)) return undefined;
      if (m.im !== 0 || m.re < 0 || m.re > 1) return undefined; // decline — see file header

      // Native EllipticE/EllipticK evaluate at compute-engine's configured (bignum)
      // precision, not a plain double — reading `.re`/`.im` off each composed piece and
      // finishing the arithmetic in plain `Cx` (like every other numeric result in this
      // file) keeps JacobiZN's own output a plain double, matching the rest of this head
      // family instead of leaking the sub-calls' internal precision.
      const phi = agmAmplitude(cxOf(u), m.re);
      const phiExpr = numberResult(ce, phi);
      const eIncomplete = ce.box(["IncompleteEllipticE", phiExpr, m]).N();
      const eComplete = ce.box(["EllipticE", m]).N();
      const kComplete = ce.box(["EllipticK", m]).N();
      const ratio = div(cx(eComplete.re, eComplete.im), cx(kComplete.re, kComplete.im));
      const term = mul(ratio, cxOf(u));
      return numberResult(ce, sub(cx(eIncomplete.re, eIncomplete.im), term));
    },
  });
}

const PQ_HEADS: ReadonlyArray<readonly [string, PQLetter, PQLetter]> = [
  ["JacobiSN", "S", "N"],
  ["JacobiCN", "C", "N"],
  ["JacobiDN", "D", "N"],
  ["JacobiCD", "C", "D"],
  ["JacobiCS", "C", "S"],
  ["JacobiDC", "D", "C"],
  ["JacobiDS", "D", "S"],
  ["JacobiNC", "N", "C"],
  ["JacobiND", "N", "D"],
  ["JacobiNS", "N", "S"],
  ["JacobiSC", "S", "C"],
  ["JacobiSD", "S", "D"],
];

export function declareJacobiElliptic(ce: ComputeEngine): void {
  if (ce.lookupDefinition("JacobiSN") !== undefined) return; // never redeclare
  for (const [head, p, q] of PQ_HEADS) declarePQ(ce, head, p, q);
  declareJacobiAmplitude(ce);
  declareJacobiZN(ce);
}
