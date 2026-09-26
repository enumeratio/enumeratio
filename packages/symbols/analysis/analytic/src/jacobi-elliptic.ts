import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import { type EvalOptions, isFiniteNum, numberResult, wantsNumber } from "./box.ts";
import { add, casin, ccos, csech, csin, csqrt, ctanh, cx, type Cx, div, mul, scale, sub } from "./complex.ts";

// The twelve Jacobi elliptic functions (Glaisher's `pq(u,m)` notation: `sn`, `cn`, `dn`
// and their nine quotients/reciprocals), `JacobiAmplitude` and `JacobiZN` (Wolfram's
// Jacobi zeta). Wolfram/mpmath's PARAMETER convention throughout: `m = k²`, not the
// modulus `k` (checked against mpmath.ellipfun(kind, u, m=m) at every point below).
//
// Numeric core: the descending Landen/AGM method (Abramowitz & Stegun 16.4; DLMF
// 22.20(ii)) for real `m ∈ [0, 1]`, extended to complex `u` by carrying the amplitude
// recursion in complex arithmetic (the AGM constants a_n, b_n, c_n stay real — only
// `sin`/`cos`/`asin` need complex versions) — verified against mpmath at real and complex
// u, m ∈ [0, 1] including near-boundary m. `m` outside `[0, 1]` reduces to that case via
// the reciprocal-modulus (m > 1, DLMF 22.17.1) and imaginary-modulus (m < 0, DLMF 22.17.2)
// transformations — both verified against mpmath at real AND complex u. A complex `m` is
// declined: neither transformation nor the AGM descent itself has been verified there.
//
// `dn` comes from the Pythagorean identity `dn² = 1 − m·sn²`, not a second AGM recursion:
// exact for real u (dn ≥ 0 there, no branch ambiguity) and checked directly against
// mpmath for every complex-u case exercised below, including through both parameter
// transforms — but NOT proven branch-correct far from the real axis (dn has no branch cut
// as a function of u, but this formula's principal square root does, and nothing here
// tracks continuity across it), so complex-u claims are limited to the region checked in
// tests/jacobi-elliptic.test.ts (roughly |Im u| well inside a quarter-period).
//
// `JacobiAmplitude`/`JacobiZN` need the amplitude φ = am(u,m) directly (not just sn, cn),
// which the AGM recursion produces as a byproduct for m ∈ [0, 1] — no equally-verified
// amplitude transform exists here for m outside that range, so both heads decline there
// (the pq family itself does not; see above).

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

/** Descending Landen/AGM amplitude am(u,m), real m ∈ [0, 1], u possibly complex
 * (Abramowitz & Stegun 16.4). `m = 0`/`m = 1` are exact (no AGM needed — the recursion
 * degenerates at m = 0 and never converges at m = 1). */
function agmAmplitude(u: Cx, m: number): Cx {
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

/** {sn, cn, dn} for real m ∈ [0, 1], u possibly complex — sn/cn from the amplitude,
 * dn from dn² = 1 − m·sn² (see the file header for why this is only claimed where
 * verified). `m = 0`/`m = 1` fold through `agmAmplitude`'s own exact cases. */
function sncndnCore(u: Cx, m: number): SCDN<Cx> {
  if (m === 1) {
    const t = ctanh(u);
    const s = csech(u);
    return { S: t, C: s, D: s, N: cx(1) };
  }
  const phi = agmAmplitude(u, m);
  const S = csin(phi);
  const C = ccos(phi);
  // dn² = 1 − m·sn² (exact identity); real & nonnegative for real u (no branch
  // ambiguity there — see the file header for the complex-u caveat).
  const D = m === 0 ? cx(1) : csqrt(sub(cx(1), scale(mul(S, S), m)));
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
