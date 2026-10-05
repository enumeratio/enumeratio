// unstable: BigDecimal, the class compute-engine's boxed numbers hold; no /numerics subpath yet
import { type BoxedExpression, type ComputeEngine, isSymbol } from "@cortex-js/compute-engine";
import { bigRationalAt, operandsOf } from "@enumeratio/engine";
import type { Json } from "@enumeratio/ce-patches";
import type { BoxInput, EvalOptions, NativeEval } from "@enumeratio/ce-patches";
import { bigRealOperand, bigResult, exceedsDoublePrecision, isFiniteNum } from "@enumeratio/ce-patches";
import { BigDecimal } from "@enumeratio/engine/unstable";

// The Wolfram signal / piecewise-waveform family: UnitBox, UnitTriangle, HeavisideTheta,
// HeavisideLambda, HeavisidePi, Ramp, SawtoothWave, TriangleWave, SquareWave, Rescale,
// DiracDelta, DiscreteDelta, DiscreteShift. `Clip` is NOT here — `Clip[x, {lo, hi}]` (and its
// 3-arg threshold-value form) already round-trips onto compute-engine's native `Clamp`, see
// `@enumeratio/wolfram`'s SPECIAL/STRUCTURAL tables.
//
// All new heads decline (stay symbolic) on a complex or otherwise undecided argument. Where an
// argument IS decided, arithmetic runs on an exact rational (`Frac`) when the operand itself is
// exactly rational, falling back to a plain float only once an operand already is one — same
// convention as `unit-step.ts`'s `unitStepOf`.
//
// Boundary values follow Wolfram exactly and are NOT uniform across this family:
//   UnitBox(±1/2)      = 1     (closed: [-1/2, 1/2] is the box's own defined range)
//   HeavisidePi(±1/2)  unevaluated (the same rectangle, but the boundary is left open --
//                       this is exactly where UnitBox and HeavisidePi differ)
//   HeavisideTheta(0)  unevaluated (unlike compute-engine's own native `Heaviside`, which
//                       this package deliberately does not touch or extend: `Heaviside(0) = 0`
//                       there, a different convention this package must not inherit)
//   UnitStep(0)        = 1     (declared separately in unit-step.ts, already Wolfram-correct)
//   HeavisideLambda(±1) = 0    (continuous, so no special case)
//   DiracDelta(0)      unevaluated; DiracDelta(nonzero real) = 0
//   DiscreteDelta(0, …, 0) = 1; any nonzero argument = 0

// ---------------------------------------------------------------------------------------------
// Exact-rational-or-float arithmetic shared by every head below.

type Frac = readonly [bigint, bigint]; // denominator always > 0, not necessarily reduced

function gcdBig(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

function reduce(n: bigint, d: bigint): Frac {
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcdBig(n, d);
  return g === 0n || g === 1n ? [n, d] : [n / g, d / g];
}

const fAdd = (a: Frac, b: Frac): Frac => reduce(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const fSub = (a: Frac, b: Frac): Frac => reduce(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
const fMul = (a: Frac, b: Frac): Frac => reduce(a[0] * b[0], a[1] * b[1]);
const fDiv = (a: Frac, b: Frac): Frac | undefined => (b[0] === 0n ? undefined : reduce(a[0] * b[1], a[1] * b[0]));

/** A decided real value: exact where the operand is, a float once it already was one. */
type Real = { readonly frac: Frac } | { readonly num: number };

const R = (n: number, d = 1): Real => ({ frac: [BigInt(n), BigInt(d)] });

const isConcretelyComplex = (x: BoxedExpression): boolean => Number.isFinite(x.im) && x.im !== 0;

/** Read a decided real value off an operand, or `undefined` to decline (stay symbolic). */
function realOf(x: BoxedExpression): Real | undefined {
  if (isConcretelyComplex(x)) return undefined;
  const q = bigRationalAt(x);
  if (q !== undefined) return { frac: q };
  const approx = isFiniteNum(x) ? x : x.N();
  if (!isFiniteNum(approx) || isConcretelyComplex(approx)) return undefined;
  return { num: approx.re };
}

const toNum = (r: Real): number => ("frac" in r ? Number(r.frac[0]) / Number(r.frac[1]) : r.num);

function add(a: Real, b: Real): Real {
  return "frac" in a && "frac" in b ? { frac: fAdd(a.frac, b.frac) } : { num: toNum(a) + toNum(b) };
}
function sub(a: Real, b: Real): Real {
  return "frac" in a && "frac" in b ? { frac: fSub(a.frac, b.frac) } : { num: toNum(a) - toNum(b) };
}
function mul(a: Real, b: Real): Real {
  return "frac" in a && "frac" in b ? { frac: fMul(a.frac, b.frac) } : { num: toNum(a) * toNum(b) };
}
function div(a: Real, b: Real): Real | undefined {
  if ("frac" in a && "frac" in b) {
    const d = fDiv(a.frac, b.frac);
    return d === undefined ? undefined : { frac: d };
  }
  const bn = toNum(b);
  return bn === 0 ? undefined : { num: toNum(a) / bn };
}
function cmp(a: Real, b: Real): -1 | 0 | 1 {
  if ("frac" in a && "frac" in b) {
    const l = a.frac[0] * b.frac[1];
    const r = b.frac[0] * a.frac[1];
    return l === r ? 0 : l < r ? -1 : 1;
  }
  const an = toNum(a);
  const bn = toNum(b);
  return an === bn ? 0 : an < bn ? -1 : 1;
}
const isZero = (a: Real): boolean => ("frac" in a ? a.frac[0] === 0n : a.num === 0);

function box(ce: ComputeEngine, r: Real): BoxedExpression {
  if ("frac" in r) {
    const [n, d] = r.frac;
    return d === 1n ? ce.number(n) : ce.number([n, d]);
  }
  return ce.number(r.num);
}

// ---------------------------------------------------------------------------------------------
// Exact-or-float decision for the piecewise-linear "wave" family: Ramp, UnitBox,
// HeavisideLambda/UnitTriangle, SawtoothWave, TriangleWave, SquareWave. Every one of them is
// linear in its argument modulo a period, so an exact-but-irrational operand (Pi, a matrix's
// irrational eigenvalue, …) doesn't need to collapse to a float the way plain `realOf` above
// does: only the BRANCH it falls into needs deciding, and the branch only needs a double's
// worth of precision as long as the decision clears every breakpoint by a wide margin.
//
// `decide` keeps an exact-but-irrational operand as `{ expr, approx }`: `expr` is the operand
// itself (or, after a `decidedScaleAdd`, a fresh expression built from it by exact rational
// arithmetic — `x - k`, `4x - 4k + 2`, …), so a piecewise formula's linear result is built
// straight from the input, never rounded; `approx` is the double compute-engine already
// carries for an exact expression (`x.re`), good enough to pick a branch once the margin
// below is cleared. Same convention as `closed-forms-113.ts`'s `Mod` block: a double carries
// ~15-17 significant digits, so a 1e-6 margin leaves ten orders of magnitude of slack. A
// decision that can't clear the margin — indistinguishably close to a breakpoint, or exactly
// on one — declines (`undefined`) rather than guess, same as a genuine boundary case
// (`HeavisidePi(±1/2)`) already does.

type Decided =
  | { readonly frac: Frac }
  | { readonly expr: BoxedExpression; readonly approx: number }
  | { readonly num: number };

/** How wide a margin a double's branch decision must clear before it's trusted. */
const BRANCH_MARGIN = 1e-6;

/** The absolute uncertainty a double carries at magnitude `approx`: its own relative epsilon
 *  (2^-52), scaled by `approx`, with `RESOLUTION_HEADROOM` bits of slack for the handful of
 *  roundings compute-engine's own evaluation compounds before this ever sees it.
 *  `BRANCH_MARGIN` is an ABSOLUTE gap, so it silently stops meaning anything once `approx` is
 *  large enough that a double can't resolve a value that finely any more -- `SawtoothWave(10^20
 *  * Pi)`'s fractional part, read off a double, is rounding noise, not an answer, even though
 *  the raw gap from 0/1 can look comfortably wide. Declining here, not computing at higher
 *  precision, keeps every route through one arithmetic (no `ce.precision` bump to thread
 *  through `.N()`, compiled JS/WGSL, and back out again consistently). */
const RESOLUTION_HEADROOM = 2 ** 10;
const resolutionOf = (approx: number): number => Math.abs(approx) * 2 ** -52 * RESOLUTION_HEADROOM;

const FRAC_ZERO: Frac = [0n, 1n];
const FRAC_ONE: Frac = [1n, 1n];
const FRAC_NEG_ONE: Frac = [-1n, 1n];

/** Read a decided operand off `x`: exact via `frac` for a rational, exact-but-irrational via
 *  `expr`/`approx` for a symbolic exact real (kept as the expression itself, never rounded --
 *  `approx` is a numeric evaluation of it, `x.re` where compute-engine already carries one, a
 *  `.N()` otherwise, used ONLY to decide a branch, never to build a result), or `num` once the
 *  operand already is a float — same three-way split `realOf` makes, except the irrational case
 *  keeps its expression instead of falling to `x.N()` for the result too. */
function decide(x: BoxedExpression): Decided | undefined {
  if (isConcretelyComplex(x)) return undefined;
  const q = bigRationalAt(x);
  if (q !== undefined) return { frac: q };
  if ((x as Partial<{ isExact: boolean }>).isExact === false) {
    const approx = isFiniteNum(x) ? x : x.N();
    if (!isFiniteNum(approx) || isConcretelyComplex(approx)) return undefined;
    return { num: approx.re };
  }
  const approx = Number.isFinite(x.re) ? x : x.N();
  if (!isFiniteNum(approx) || isConcretelyComplex(approx)) return undefined;
  return { expr: x, approx: approx.re };
}

const decidedNum = (d: Decided): number =>
  "frac" in d ? Number(d.frac[0]) / Number(d.frac[1]) : "expr" in d ? d.approx : d.num;

/** `d` compared to the rational `target`: exact (bigint, no margin) when `d` is itself
 *  rational, otherwise a comparison of `d`'s double against `target`'s, gapped by the WIDER of
 *  `BRANCH_MARGIN` and `d`'s own resolution at its magnitude — `undefined` when the gap can't
 *  clear it. The adaptive part matters only when `target` sits near `d`'s own scale (the
 *  periodic waves compare a certified fractional part, itself in [0, 1), so it never grows);
 *  called on a raw, possibly huge, operand against a small fixed `target` (Ramp/UnitBox/tent's
 *  sign checks), `d`'s resolution grows with it but so does the gap, so it stays decidable. */
function certifiedCmpFrac(d: Decided, target: Frac): -1 | 0 | 1 | undefined {
  if ("frac" in d) {
    const l = d.frac[0] * target[1];
    const r = target[0] * d.frac[1];
    return l === r ? 0 : l < r ? -1 : 1;
  }
  const v = decidedNum(d);
  const gap = v - Number(target[0]) / Number(target[1]);
  const threshold = Math.max(BRANCH_MARGIN, resolutionOf(v));
  if (Math.abs(gap) <= threshold) return undefined;
  return gap < 0 ? -1 : 1;
}

/** `Floor(d)`, certified: exact bigint division for a rational `d` (no margin needed), or the
 *  double floor as long as it clears the nearest integer by `BRANCH_MARGIN` — `undefined`
 *  otherwise. Unlike `certifiedCmpFrac`, there's no adaptive fallback here: the "gap" is `v`'s
 *  OWN fractional structure, which a double genuinely loses once `resolutionOf(v)` isn't small
 *  -- there's no fixed, distant breakpoint for a wide raw gap to fall back on the way
 *  `certifiedCmpFrac`'s Ramp/UnitBox callers have. */
function certifiedFloor(d: Decided): bigint | undefined {
  if ("frac" in d) {
    const [n, dd] = d.frac;
    const q = n / dd;
    const r = n % dd;
    return r !== 0n && r < 0n ? q - 1n : q;
  }
  const v = decidedNum(d);
  if (!Number.isFinite(v) || resolutionOf(v) >= BRANCH_MARGIN) return undefined;
  const k = Math.floor(v);
  const gap = Math.min(v - k, k + 1 - v);
  return gap > BRANCH_MARGIN ? BigInt(k) : undefined;
}

/** `d`'s value, boxed: `d.expr` itself for an exact-but-irrational operand — no rounding — a
 *  rational number for `frac`, a float for `num`. */
function decidedBox(ce: ComputeEngine, d: Decided): BoxedExpression {
  if ("expr" in d) return d.expr;
  return box(ce, d);
}

/** `scale·d + offset`, `scale`/`offset` rational constants: exact bigint arithmetic when `d`
 *  is rational, an exact symbolic `scale·expr + offset` when `d` is an exact irrational (built
 *  with the SAME rational arithmetic used everywhere else in this file, via `box`), a plain
 *  float otherwise. This is how every piecewise-linear branch below builds its result — the
 *  one shared construction every route (`evaluate`, `.N()`, and compute-engine's own constant
 *  folding ahead of JS/WGSL compilation, none of which this package gives these heads a
 *  bespoke handler for) goes through. */
function decidedScaleAdd(ce: ComputeEngine, d: Decided, scale: Frac, offset: Frac): Decided {
  if ("frac" in d) return { frac: fAdd(fMul(scale, d.frac), offset) };
  const scaleNum = Number(scale[0]) / Number(scale[1]);
  const offsetNum = Number(offset[0]) / Number(offset[1]);
  if ("expr" in d) {
    const scaled = ce.function("Multiply", [box(ce, { frac: scale }), d.expr]).evaluate();
    const withOffset = ce.function("Add", [scaled, box(ce, { frac: offset })]).evaluate();
    return { expr: withOffset, approx: scaleNum * d.approx + offsetNum };
  }
  return { num: scaleNum * d.num + offsetNum };
}

/** `v`'s fractional part `v - Floor(v) ∈ [0, 1)`, certified, alongside the certified `Floor(v)`
 *  itself — shared by all three periodic waves below. `undefined` when the floor can't be
 *  certified. */
function fracPartDecided(ce: ComputeEngine, v: Decided): { readonly f: Decided; readonly k: bigint } | undefined {
  const k = certifiedFloor(v);
  if (k === undefined) return undefined;
  return { f: decidedScaleAdd(ce, v, FRAC_ONE, [-k, 1n]), k };
}

// ---------------------------------------------------------------------------------------------
// Per-head math, in terms of `Decided` — evaluate handlers below just box the result.

/** UnitBox(v): 1 on the closed [-1/2, 1/2], 0 outside. Defined everywhere; unlike
 *  [[HeavisidePi]] the boundary is included, not left open. Always a constant — no expression
 *  to build — but the decision itself must still be certified. */
function unitBoxDecided(v: Decided): 0 | 1 | undefined {
  const lo = certifiedCmpFrac(v, [-1n, 2n]);
  if (lo === undefined) return undefined;
  if (lo < 0) return 0;
  const hi = certifiedCmpFrac(v, [1n, 2n]);
  if (hi === undefined) return undefined;
  return hi > 0 ? 0 : 1;
}

/** The tent Max(1 - |v|, 0) — shared by UnitTriangle and HeavisideLambda (same function, two
 *  names Wolfram uses in different contexts). `|v| >= 1` declines rather than certify the
 *  continuous edge exactly at v = ±1 (both branches agree there, but a strict decline is
 *  simpler and matches every other boundary in this file). */
function tentDecided(ce: ComputeEngine, v: Decided): Decided | undefined {
  const sign = certifiedCmpFrac(v, FRAC_ZERO);
  if (sign === undefined) return undefined;
  const absV = sign < 0 ? decidedScaleAdd(ce, v, FRAC_NEG_ONE, FRAC_ZERO) : v;
  const cmpOne = certifiedCmpFrac(absV, FRAC_ONE);
  if (cmpOne === undefined) return undefined;
  if (cmpOne >= 0) return { frac: FRAC_ZERO }; // |v| >= 1 -- outside the tent
  return decidedScaleAdd(ce, absV, FRAC_NEG_ONE, FRAC_ONE); // 1 - |v|, exact
}

/** Ramp(v) = v for v >= 0, 0 below — v is handed back untouched (exact, whatever `decide` gave
 *  it), never rebuilt or rounded. */
function rampDecided(v: Decided): Decided | undefined {
  const c = certifiedCmpFrac(v, FRAC_ZERO);
  if (c === undefined) return undefined;
  return c < 0 ? { frac: FRAC_ZERO } : v;
}

/** SawtoothWave's own natural range: [0, 1). */
function sawtoothBaseDecided(ce: ComputeEngine, v: Decided): Decided | undefined {
  return fracPartDecided(ce, v)?.f;
}
const SAWTOOTH_RANGE: readonly [Frac, Frac] = [FRAC_ZERO, FRAC_ONE];

/**
 * TriangleWave's own natural range: [-1, 1], sine-like phase (rising through 0 at f = 0, peak 1
 * at f = 1/4, falling through 0 at f = 1/2, trough -1 at f = 3/4) — NOT the plain tent [0, 1]
 * shape [[UnitTriangle]]/[[HeavisideLambda]] use. Each branch is `a·f + b` for the certified
 * fractional part `f`, so `decidedScaleAdd` builds it exactly whatever `f` turned out to be.
 */
function triangleBaseDecided(ce: ComputeEngine, v: Decided): Decided | undefined {
  const r = fracPartDecided(ce, v);
  if (r === undefined) return undefined;
  const { f } = r;
  const c1 = certifiedCmpFrac(f, [1n, 4n]);
  if (c1 === undefined) return undefined;
  if (c1 <= 0) return decidedScaleAdd(ce, f, [4n, 1n], FRAC_ZERO); // [0, 1/4]: 0 -> 1
  const c2 = certifiedCmpFrac(f, [3n, 4n]);
  if (c2 === undefined) return undefined;
  if (c2 <= 0) return decidedScaleAdd(ce, f, [-4n, 1n], [2n, 1n]); // (1/4, 3/4]: 1 -> -1
  return decidedScaleAdd(ce, f, [4n, 1n], [-4n, 1n]); // (3/4, 1): -1 -> 0
}
const TRIANGLE_RANGE: readonly [Frac, Frac] = [FRAC_NEG_ONE, FRAC_ONE];

/** SquareWave's own natural range: {-1, 1} — 1 on [0, 1/2), -1 on [1/2, 1); SquareWave(0) = 1.
 *  Always a constant, like UnitBox, but still needs the certified fractional part to pick it. */
function squareBaseDecided(ce: ComputeEngine, v: Decided): Decided | undefined {
  const r = fracPartDecided(ce, v);
  if (r === undefined) return undefined;
  const c = certifiedCmpFrac(r.f, [1n, 2n]);
  if (c === undefined) return undefined;
  return c < 0 ? { frac: FRAC_ONE } : { frac: FRAC_NEG_ONE };
}
const SQUARE_RANGE: readonly [Frac, Frac] = [FRAC_NEG_ONE, FRAC_ONE];

// ---------------------------------------------------------------------------------------------
// Evaluate handlers.

/** The sign of an operand, certified: exact for a rational, the double's own for a float, and
 *  for an exact irrational only once its double clears `BRANCH_MARGIN` -- `undefined` when it
 *  can't. ½√(2 − √(2 + √2)) − sin(π/16) is exactly 0, and its double is 2.5e-17, not 0. */
function signOf(x: BoxedExpression): -1 | 0 | 1 | undefined {
  const d = decide(x);
  if (d === undefined) return undefined;
  if ("num" in d) return d.num === 0 ? 0 : d.num < 0 ? -1 : 1;
  return certifiedCmpFrac(d, FRAC_ZERO);
}

function evaluateHeavisideTheta(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression | undefined {
  if (ops.length === 0) return undefined;
  let sawZero = false;
  let undecided = false;
  for (const op of ops) {
    const sign = signOf(op);
    if (sign === undefined) {
      undecided = true;
      continue;
    }
    if (sign < 0) return ce.number(0); // any negative factor makes the whole product 0
    if (sign === 0) sawZero = true;
  }
  if (undecided || sawZero) return undefined; // undecided, or a genuine 0 -- stays unevaluated
  return ce.number(1);
}

function evaluateHeavisidePi(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression | undefined {
  if (ops.length !== 1 || ops[0] === undefined) return undefined;
  const v = realOf(ops[0]);
  if (v === undefined) return undefined;
  if (cmp(v, R(-1, 2)) < 0 || cmp(v, R(1, 2)) > 0) return ce.number(0);
  if (cmp(v, R(-1, 2)) === 0 || cmp(v, R(1, 2)) === 0) return undefined; // boundary stays symbolic
  return ce.number(1);
}

function evaluateUnitBox(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression | undefined {
  if (ops.length === 0) return undefined;
  let undecided = false;
  for (const op of ops) {
    const v = decide(op);
    const u = v === undefined ? undefined : unitBoxDecided(v);
    if (u === undefined) {
      undecided = true;
      continue;
    }
    if (u === 0) return ce.number(0); // absorbing, regardless of undecided operands seen so far
  }
  if (undecided) return undefined;
  return ce.number(1);
}

function evaluateTent(
  ce: ComputeEngine,
  ops: readonly BoxedExpression[],
  options: EvalOptions,
): BoxedExpression | undefined {
  if (ops.length !== 1 || ops[0] === undefined) return undefined;
  // `N(x, d)` hands an inexact operand over at its bignum digits; the tent is 1 - |x| in them.
  if (
    (ops[0] as Partial<{ isExact: boolean }>).isExact === false &&
    exceedsDoublePrecision(ce, options.numericApproximation)
  ) {
    const x = bigRealOperand(ce, ops[0]);
    if (x !== undefined) return x.abs().gte(1) ? ce.Zero : bigResult(ce, BigDecimal.ONE.sub(x.abs()));
  }
  const v = decide(ops[0]);
  if (v === undefined) return undefined;
  const r = tentDecided(ce, v);
  return r === undefined ? undefined : decidedBox(ce, r);
}

function evaluateRamp(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression | undefined {
  if (ops.length !== 1 || ops[0] === undefined) return undefined;
  const v = decide(ops[0]);
  if (v === undefined) return undefined;
  const r = rampDecided(v);
  return r === undefined ? undefined : decidedBox(ce, r);
}

function evaluateDiracDelta(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression | undefined {
  if (ops.length === 0) return undefined;
  for (const op of ops) {
    const sign = signOf(op);
    if (sign === undefined) continue; // undecided -- keep scanning; a later nonzero still dominates
    if (sign !== 0) return ce.number(0);
  }
  return undefined; // every decided argument is 0 (or none were decided) -- stays symbolic
}

function evaluateDiscreteDelta(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression | undefined {
  if (ops.length === 0) return undefined;
  let undecided = false;
  for (const op of ops) {
    const sign = signOf(op);
    if (sign === undefined) {
      undecided = true;
      continue;
    }
    if (sign !== 0) return ce.number(0);
  }
  return undecided ? undefined : ce.number(1);
}

/** `{x}` or `{{min, max}, x}` -- the wave functions' own argument order, range first. */
function parseWaveArgs(
  ops: readonly BoxedExpression[],
): { x: BoxedExpression; range?: readonly [BoxedExpression, BoxedExpression] } | undefined {
  if (ops.length === 1 && ops[0] !== undefined) return { x: ops[0] };
  if (ops.length === 2 && ops[0]?.operator === "List" && ops[1] !== undefined) {
    const [lo, hi] = operandsOf(ops[0]);
    if (lo === undefined || hi === undefined) return undefined;
    return { x: ops[1], range: [lo, hi] };
  }
  return undefined;
}

function evaluateWave(
  ce: ComputeEngine,
  ops: readonly BoxedExpression[],
  base: (ce: ComputeEngine, v: Decided) => Decided | undefined,
  natural: readonly [Frac, Frac],
): BoxedExpression | undefined {
  const parsed = parseWaveArgs(ops);
  if (parsed === undefined) return undefined;
  const xv = decide(parsed.x);
  if (xv === undefined) return undefined;
  const b = base(ce, xv);
  if (b === undefined) return undefined; // can't certify the branch -- decline
  if (parsed.range === undefined) return decidedBox(ce, b);
  const lo = decide(parsed.range[0]);
  const hi = decide(parsed.range[1]);
  if (lo === undefined || hi === undefined) return undefined;
  // Affine map from the wave's own natural range onto the requested {min, max} -- the period
  // stays 1 either way, only the amplitude/offset changes. Exact as long as `lo`/`hi` are
  // rational (the natural bounds always are, so the scale is too) -- `b`'s own exactness, be it
  // rational or an exact irrational `x`, survives the remap untouched.
  const [natLo, natHi] = natural;
  if ("frac" in lo && "frac" in hi) {
    const span = fSub(natHi, natLo);
    const scale = fDiv(fSub(hi.frac, lo.frac), span);
    if (scale === undefined) return undefined;
    const offset = fSub(lo.frac, fMul(scale, natLo));
    return decidedBox(ce, decidedScaleAdd(ce, b, scale, offset));
  }
  // `lo`/`hi` not both rational (a rare custom range with an irrational bound) -- fall back to
  // a plain float remap; there's no exactness to preserve on that side of the map anyway.
  const natLoN = Number(natLo[0]) / Number(natLo[1]);
  const natHiN = Number(natHi[0]) / Number(natHi[1]);
  const span = natHiN - natLoN;
  if (span === 0) return undefined;
  const t = (decidedNum(b) - natLoN) / span;
  const loN = decidedNum(lo);
  const hiN = decidedNum(hi);
  return ce.number(loN + (hiN - loN) * t);
}

/**
 * Rescale(x) only handles a list (min -> 0, max -> 1, element-wise); a bare scalar with no
 * range to rescale against has no sensible reading and stays unevaluated. Rescale(x, {min,
 * max}) maps to {0, 1}; Rescale(x, {min, max}, {ymin, ymax}) maps to the given target range.
 */
function evaluateRescale(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression | undefined {
  const x = ops[0];
  if (x === undefined) return undefined;

  if (ops.length === 1) {
    if (x.operator !== "List") return undefined;
    const elements = operandsOf(x);
    if (elements.length === 0) return undefined;
    const reals = elements.map(realOf);
    if (reals.some((r) => r === undefined)) return undefined;
    const vals = reals as Real[];
    let min = vals[0]!;
    let max = vals[0]!;
    for (const v of vals) {
      if (cmp(v, min) < 0) min = v;
      if (cmp(v, max) > 0) max = v;
    }
    const span = sub(max, min);
    if (isZero(span)) return undefined; // degenerate (every element equal) -- decline
    const mapped: Real[] = [];
    for (const v of vals) {
      const t = div(sub(v, min), span);
      if (t === undefined) return undefined;
      mapped.push(t);
    }
    return ce.function(
      "List",
      mapped.map((m) => box(ce, m)),
    );
  }

  const rangeArg = ops[1];
  if (rangeArg === undefined || rangeArg.operator !== "List") return undefined;
  const [lo, hi] = operandsOf(rangeArg);
  if (lo === undefined || hi === undefined) return undefined;
  const xv = realOf(x);
  const loV = realOf(lo);
  const hiV = realOf(hi);
  if (xv === undefined || loV === undefined || hiV === undefined) return undefined;
  const span = sub(hiV, loV);
  if (isZero(span)) return undefined;
  const t = div(sub(xv, loV), span);
  if (t === undefined) return undefined;

  const targetArg = ops[2];
  if (targetArg === undefined) return box(ce, t);
  if (targetArg.operator !== "List") return undefined;
  const [ymin, ymax] = operandsOf(targetArg);
  if (ymin === undefined || ymax === undefined) return undefined;
  const yminV = realOf(ymin);
  const ymaxV = realOf(ymax);
  if (yminV === undefined || ymaxV === undefined) return undefined;
  return box(ce, add(yminV, mul(sub(ymaxV, yminV), t)));
}

/** DiscreteShift(f, n) = f with every free `n` replaced by n + 1; DiscreteShift(f, {n, h})
 *  shifts by `h` steps instead -- Wolfram's own step form is the `{n, h}` PAIR as the second
 *  argument, not a third argument. A pure substitution, not an arithmetic evaluation, so it
 *  works on `f` as a literal expression (e.g. `a(n)`) rather than requiring `f` itself to
 *  be declared. */
function substitute(
  ce: ComputeEngine,
  e: BoxedExpression,
  name: string,
  replacement: BoxedExpression,
): BoxedExpression {
  if (isSymbol(e) && e.symbol === name) return replacement;
  const ops = operandsOf(e);
  if (ops.length === 0) return e;
  return ce.box([e.operator, ...ops.map((o) => substitute(ce, o, name, replacement).json)] as never);
}

function evaluateDiscreteShift(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression | undefined {
  const [f, second] = ops;
  if (f === undefined || second === undefined) return undefined;
  if (isSymbol(second)) {
    const shifted = ce.function("Add", [second, ce.number(1)]);
    return substitute(ce, f, second.symbol, shifted).evaluate();
  }
  if (second.operator === "List") {
    const [n, h] = operandsOf(second);
    if (n === undefined || h === undefined || !isSymbol(n)) return undefined;
    const shifted = ce.function("Add", [n, h]);
    return substitute(ce, f, n.symbol, shifted).evaluate();
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------
// Derivatives -- attached in place on `Derivative`'s operator, same pattern as derivatives.ts
// but kept self-contained here (another coordinator's lanes touch that file's neighbors).

interface SignalPartial {
  readonly params: readonly string[];
  readonly body: Json;
}

const HALF_JSON: Json = ["Rational", 1, 2];

const SIGNAL_DERIVATIVES: Readonly<Record<string, Readonly<Record<string, SignalPartial>>>> = {
  // D(HeavisideTheta(x)) = DiracDelta(x).
  HeavisideTheta: { "1": { params: ["x"], body: ["DiracDelta", "x"] } },
  // D(Ramp(x)) = Piecewise({{0, x < 0}, {1, x > 0}}, Indeterminate) -- Wolfram's own answer, an
  // exact indeterminate form at the kink, not a floating-point NaN; NOT UnitStep(x), which would
  // be a different (defined-at-0) function. The bound parameter is named "u", not "x" -- applying
  // a `Function(body, "x")` to the literal symbol `x` (the common case, `D(Ramp(x), x)`) hits a
  // compute-engine substitution quirk where an Equal/Less/Greater condition on the same-named
  // bound variable spuriously resolves to a definite boolean instead of staying undecided; a
  // distinct bound name sidesteps it.
  Ramp: {
    "1": {
      params: ["u"],
      body: ["Piecewise", ["List", ["List", 0, ["Less", "u", 0]], ["List", 1, ["Greater", "u", 0]]], "Indeterminate"],
    },
  },
  // D(UnitBox(x)) = Piecewise({{Indeterminate, x == 1/2 || x == -1/2}}, 0) -- 0 on the open
  // interior and exterior alike (UnitBox is locally constant away from the boundary), an exact
  // indeterminate form exactly at the two points where it jumps. Bound parameter "u", see Ramp
  // above.
  UnitBox: {
    "1": {
      params: ["u"],
      body: [
        "Piecewise",
        ["List", ["List", "Indeterminate", ["Or", ["Equal", "u", HALF_JSON], ["Equal", "u", ["Negate", HALF_JSON]]]]],
        0,
      ],
    },
  },
};

function operatorOf(ce: ComputeEngine, name: string) {
  const definition = ce.lookupDefinition(name);
  return definition !== undefined && "operator" in definition ? definition.operator : undefined;
}

function declareSignalDerivatives(ce: ComputeEngine): void {
  const derivative = operatorOf(ce, "Derivative");
  if (derivative === undefined) return;
  const native: NativeEval = derivative.evaluate;
  derivative.evaluate = (ops: readonly BoxedExpression[], options: EvalOptions): BoxedExpression | undefined => {
    const f = ops[0];
    const table = f !== undefined && isSymbol(f) ? SIGNAL_DERIVATIVES[f.symbol] : undefined;
    const partial =
      table?.[
        ops
          .slice(1)
          .map((order) => order.re)
          .join()
      ];
    if (partial !== undefined) {
      return ce.box(["Function", partial.body, ...partial.params] as unknown as BoxInput);
    }
    return native?.(ops, options);
  };
}

// ---------------------------------------------------------------------------------------------

export function declareSignals(ce: ComputeEngine): void {
  ce.declare("HeavisideTheta", {
    signature: "(real, real*) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => evaluateHeavisideTheta(ce, ops),
  });
  ce.declare("HeavisidePi", {
    signature: "(real) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => evaluateHeavisidePi(ce, ops),
  });
  ce.declare("HeavisideLambda", {
    signature: "(real) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => evaluateTent(ce, ops, options),
  });
  ce.declare("UnitBox", {
    signature: "(real, real*) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => evaluateUnitBox(ce, ops),
  });
  ce.declare("UnitTriangle", {
    signature: "(real) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => evaluateTent(ce, ops, options),
  });
  ce.declare("Ramp", {
    signature: "(real) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => evaluateRamp(ce, ops),
  });
  ce.declare("SawtoothWave", {
    signature: "(real | list<real^2>, real?) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => evaluateWave(ce, ops, sawtoothBaseDecided, SAWTOOTH_RANGE),
  });
  ce.declare("TriangleWave", {
    signature: "(real | list<real^2>, real?) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => evaluateWave(ce, ops, triangleBaseDecided, TRIANGLE_RANGE),
  });
  ce.declare("SquareWave", {
    signature: "(real | list<real^2>, real?) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => evaluateWave(ce, ops, squareBaseDecided, SQUARE_RANGE),
  });
  ce.declare("Rescale", {
    signature: "(real | list<real>, list<real^2>?, list<real^2>?) -> real | list<real>",
    evaluate: (ops: readonly BoxedExpression[]) => evaluateRescale(ce, ops),
  });
  ce.declare("DiracDelta", {
    signature: "(real, real*) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => evaluateDiracDelta(ce, ops),
  });
  ce.declare("DiscreteDelta", {
    signature: "(real, real*) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => evaluateDiscreteDelta(ce, ops),
  });
  ce.declare("DiscreteShift", {
    signature: "(expression, expression) -> expression",
    evaluate: (ops: readonly BoxedExpression[]) => evaluateDiscreteShift(ce, ops),
  });

  declareSignalDerivatives(ce);
}
