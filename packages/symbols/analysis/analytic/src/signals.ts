import { type BoxedExpression, type ComputeEngine, isSymbol } from "@cortex-js/compute-engine";
import { bigRationalAt, operandsOf } from "@enumeratio/boxed";
import type { Json } from "./bernoulli.ts";
import type { BoxInput, EvalOptions, NativeEval } from "./box.ts";
import { isFiniteNum } from "./box.ts";

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
const ZERO = R(0);
const ONE = R(1);
const NEG_ONE = R(-1);
const TWO = R(2);
const FOUR = R(4);

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
function floorOf(a: Real): Real {
  if ("frac" in a) {
    const [n, d] = a.frac;
    const q = n / d;
    const r = n % d;
    return { frac: [r !== 0n && r < 0n ? q - 1n : q, 1n] };
  }
  return { num: Math.floor(a.num) };
}
const absR = (a: Real): Real =>
  "frac" in a ? { frac: [a.frac[0] < 0n ? -a.frac[0] : a.frac[0], a.frac[1]] } : { num: Math.abs(a.num) };
const isZero = (a: Real): boolean => ("frac" in a ? a.frac[0] === 0n : a.num === 0);
const isNeg = (a: Real): boolean => ("frac" in a ? a.frac[0] < 0n : a.num < 0);

function box(ce: ComputeEngine, r: Real): BoxedExpression {
  if ("frac" in r) {
    const [n, d] = r.frac;
    return d === 1n ? ce.number(n) : ce.number([n, d]);
  }
  return ce.number(r.num);
}

// ---------------------------------------------------------------------------------------------
// Per-head math, in terms of `Real` only — evaluate handlers below just box the result.

/** UnitBox(v): 1 on the closed [-1/2, 1/2], 0 outside. Defined everywhere; unlike
 *  [[HeavisidePi]] the boundary is included, not left open. */
function unitBoxValue(v: Real): Real {
  return cmp(v, R(-1, 2)) < 0 || cmp(v, R(1, 2)) > 0 ? ZERO : ONE;
}

/** The tent Max(1 - |v|, 0) — shared by UnitTriangle and HeavisideLambda (same function,
 *  two names Wolfram uses in different contexts; both are continuous, so 0 at v = ±1 falls
 *  out on its own, no special case needed). */
function tentValue(v: Real): Real {
  const t = sub(ONE, absR(v));
  return isNeg(t) ? ZERO : t;
}

const rampValue = (v: Real): Real => (isNeg(v) ? ZERO : v);

/** v - floor(v), always in [0, 1) — Wolfram's convention for the wave functions' base period,
 *  unlike `FractionalPart` (declared in integer-fractional-part.ts), which keeps v's sign. */
const fracPart = (v: Real): Real => sub(v, floorOf(v));

/** SawtoothWave's own natural range: [0, 1). */
const sawtoothBase = (v: Real): Real => fracPart(v);
const SAWTOOTH_RANGE: readonly [Real, Real] = [ZERO, ONE];

/**
 * TriangleWave's own natural range: [-1, 1], sine-like phase (rising through 0 at f = 0,
 * peak 1 at f = 1/4, falling through 0 at f = 1/2, trough -1 at f = 3/4) — NOT the plain tent
 * [0, 1] shape [[UnitTriangle]]/[[HeavisideLambda]] use.
 */
function triangleBase(v: Real): Real {
  const f = fracPart(v); // in [0, 1)
  if (cmp(f, R(1, 4)) <= 0) return mul(FOUR, f); // [0, 1/4]: 0 -> 1
  if (cmp(f, R(3, 4)) <= 0) return sub(TWO, mul(FOUR, f)); // [1/4, 3/4]: 1 -> -1
  return sub(mul(FOUR, f), FOUR); // [3/4, 1): -1 -> 0
}
const TRIANGLE_RANGE: readonly [Real, Real] = [NEG_ONE, ONE];

/** SquareWave's own natural range: {-1, 1} — 1 on [0, 1/2), -1 on [1/2, 1); SquareWave(0) = 1. */
function squareBase(v: Real): Real {
  const f = fracPart(v);
  return cmp(mul(TWO, f), ONE) < 0 ? ONE : NEG_ONE;
}
const SQUARE_RANGE: readonly [Real, Real] = [NEG_ONE, ONE];

// ---------------------------------------------------------------------------------------------
// Evaluate handlers.

function evaluateHeavisideTheta(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression | undefined {
  if (ops.length === 0) return undefined;
  let sawZero = false;
  let undecided = false;
  for (const op of ops) {
    const v = realOf(op);
    if (v === undefined) {
      undecided = true;
      continue;
    }
    if (isNeg(v)) return ce.number(0); // any negative factor makes the whole product 0
    if (isZero(v)) sawZero = true;
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
  let acc: Real = ONE;
  for (const op of ops) {
    const v = realOf(op);
    if (v === undefined) {
      undecided = true;
      continue;
    }
    const u = unitBoxValue(v);
    if (isZero(u)) return ce.number(0); // absorbing, regardless of undecided operands seen so far
    acc = mul(acc, u);
  }
  if (undecided) return undefined;
  return box(ce, acc);
}

function evaluateTent(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression | undefined {
  if (ops.length !== 1 || ops[0] === undefined) return undefined;
  const v = realOf(ops[0]);
  if (v === undefined) return undefined;
  return box(ce, tentValue(v));
}

function evaluateRamp(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression | undefined {
  if (ops.length !== 1 || ops[0] === undefined) return undefined;
  const v = realOf(ops[0]);
  if (v === undefined) return undefined;
  return box(ce, rampValue(v));
}

function evaluateDiracDelta(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression | undefined {
  if (ops.length === 0) return undefined;
  for (const op of ops) {
    const v = realOf(op);
    if (v === undefined) continue; // undecided -- keep scanning; a later nonzero still dominates
    if (!isZero(v)) return ce.number(0);
  }
  return undefined; // every decided argument is 0 (or none were decided) -- stays symbolic
}

function evaluateDiscreteDelta(ce: ComputeEngine, ops: readonly BoxedExpression[]): BoxedExpression | undefined {
  if (ops.length === 0) return undefined;
  let undecided = false;
  for (const op of ops) {
    const v = realOf(op);
    if (v === undefined) {
      undecided = true;
      continue;
    }
    if (!isZero(v)) return ce.number(0);
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
  base: (v: Real) => Real,
  natural: readonly [Real, Real],
): BoxedExpression | undefined {
  const parsed = parseWaveArgs(ops);
  if (parsed === undefined) return undefined;
  const xv = realOf(parsed.x);
  if (xv === undefined) return undefined;
  const b = base(xv);
  if (parsed.range === undefined) return box(ce, b);
  const lo = realOf(parsed.range[0]);
  const hi = realOf(parsed.range[1]);
  if (lo === undefined || hi === undefined) return undefined;
  // Affine map from the wave's own natural range onto the requested {min, max} -- the period
  // stays 1 either way, only the amplitude/offset changes.
  const [natLo, natHi] = natural;
  const t = div(sub(b, natLo), sub(natHi, natLo));
  if (t === undefined) return undefined;
  return box(ce, add(lo, mul(sub(hi, lo), t)));
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
  // D(Ramp(x)) = Piecewise({{0, x < 0}, {1, x > 0}}, Indeterminate) -- Wolfram's own answer;
  // NOT UnitStep(x), which would be a different (defined-at-0) function. The bound parameter
  // is named "u", not "x" -- applying a `Function(body, "x")` to the literal symbol `x` (the
  // common case, `D(Ramp(x), x)`) hits a compute-engine substitution quirk where an Equal/
  // Less/Greater condition on the same-named bound variable spuriously resolves to a
  // definite boolean instead of staying undecided; a distinct bound name sidesteps it.
  Ramp: {
    "1": {
      params: ["u"],
      body: ["Piecewise", ["List", ["List", 0, ["Less", "u", 0]], ["List", 1, ["Greater", "u", 0]]], "Indeterminate"],
    },
  },
  // D(UnitBox(x)) = Piecewise({{Indeterminate, x == 1/2 || x == -1/2}}, 0) -- 0 on the open
  // interior and exterior alike (UnitBox is locally constant away from the boundary),
  // undefined exactly at the two points where it jumps. Bound parameter "u", see Ramp above.
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
    evaluate: (ops: readonly BoxedExpression[]) => evaluateTent(ce, ops),
  });
  ce.declare("UnitBox", {
    signature: "(real, real*) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => evaluateUnitBox(ce, ops),
  });
  ce.declare("UnitTriangle", {
    signature: "(real) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => evaluateTent(ce, ops),
  });
  ce.declare("Ramp", {
    signature: "(real) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => evaluateRamp(ce, ops),
  });
  ce.declare("SawtoothWave", {
    signature: "(value, value?) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => evaluateWave(ce, ops, sawtoothBase, SAWTOOTH_RANGE),
  });
  ce.declare("TriangleWave", {
    signature: "(value, value?) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => evaluateWave(ce, ops, triangleBase, TRIANGLE_RANGE),
  });
  ce.declare("SquareWave", {
    signature: "(value, value?) -> number",
    evaluate: (ops: readonly BoxedExpression[]) => evaluateWave(ce, ops, squareBase, SQUARE_RANGE),
  });
  ce.declare("Rescale", {
    signature: "(value, value?, value?) -> value",
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
    signature: "(value, value) -> value",
    evaluate: (ops: readonly BoxedExpression[]) => evaluateDiscreteShift(ce, ops),
  });

  declareSignalDerivatives(ce);
}
