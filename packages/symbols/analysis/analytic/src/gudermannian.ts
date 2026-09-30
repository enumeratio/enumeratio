import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/engine";
import { type EvalOptions, isFiniteNum, wantsNumber } from "@enumeratio/ce-patches";

// Gudermannian(x) = 2 arctan(tanh(x/2)) = arctan(sinh(x)) — links the circular and
// hyperbolic functions without complex numbers. Exact at 0 and at the horizontal
// asymptotes ±π/2 (at ±∞); an odd function, so `Gudermannian(-x)` is pulled apart into
// `-Gudermannian(x)` symbolically, same as `Arcsin`/`Ln` do in widened.ts. Real behaviour
// is otherwise numeric only, unchanged by the extension below.
//
// Extended to complex arguments via gd(z) = 2 arctan(tanh(z/2)) (DLMF 4.23.44 gives the real
// form; the complex extension is the same closed form, tanh and arctan both already analytic
// on the whole plane bar their own poles). Wolfram: Gudermannian(Log(I)) hits the pole at
// z = iπ/2 exactly, where tanh(z/2) = i and arctan(i) is itself a pole — the general pole
// lattice is z = i(π/2 + kπ), where ComplexInfinity is exact, checked before the numeric path
// since a float z can only ever land NEAR a pole, never exactly on one.

const HALF_PI = (ce: ComputeEngine): BoxedExpression => ce.function("Multiply", [ce.number([1, 2]), ce.Pi]).evaluate();

/** How close a numeric evaluation must land to a breakpoint before it's trusted — same wide
 *  margin convention as signals.ts / closed-forms-113.ts's `Mod` block: a double carries
 *  ~15-17 significant digits, so this leaves ten orders of magnitude of slack. */
const POLE_MARGIN = 1e-6;

/** Is EXACT `x` at one of Gudermannian's poles, z = i(π/2 + kπ)? Certified via a numeric
 *  evaluation of `x`: purely imaginary (real part within the margin of 0) with its imaginary
 *  part, divided by π, within the margin of a half-odd-integer. A genuine float `x` (`isExact
 *  === false`) never qualifies — it can land close to a pole but, being a float, not exactly
 *  on one, so it takes the ordinary (large but finite) numeric path below instead. */
function isAtPole(x: BoxedExpression): boolean {
  if ((x as Partial<{ isExact: boolean }>).isExact === false) return false;
  const approx = isFiniteNum(x) ? x : x.N();
  if (!isFiniteNum(approx)) return false;
  if (Math.abs(approx.re) > POLE_MARGIN) return false;
  const t = approx.im / Math.PI - 0.5;
  return Math.abs(t - Math.round(t)) <= POLE_MARGIN;
}

function evaluateGudermannian(
  ce: ComputeEngine,
  ops: readonly BoxedExpression[],
  options: EvalOptions,
): BoxedExpression | undefined {
  const x = ops[0];
  if (x === undefined) return undefined;
  if (x.is(0)) return ce.Zero;
  if (x.re === Infinity && x.im === 0) return HALF_PI(ce);
  if (x.re === -Infinity && x.im === 0) return ce.function("Negate", [HALF_PI(ce)]).evaluate();
  if (x.operator === "Negate") {
    const inner = operandsOf(x)[0];
    if (inner !== undefined) {
      return ce.function("Negate", [ce.function("Gudermannian", [inner])]).evaluate();
    }
  }
  if (isAtPole(x)) return ce.symbol("ComplexInfinity");
  if (wantsNumber(ops, options)) {
    const approx = isFiniteNum(x) ? x : x.N();
    if (isFiniteNum(approx)) {
      if (approx.im === 0) return ce.number(Math.atan(Math.sinh(approx.re)));
      // Complex: gd(z) = 2 arctan(tanh(z/2)) — compute-engine's own Tanh/Arctan resolve a
      // general complex argument numerically (`.N()`) even though their `evaluate()` doesn't.
      const half = ce.function("Divide", [approx, 2]);
      const result = ce.function("Multiply", [2, ce.function("Arctan", [ce.function("Tanh", [half])])]).N();
      if (isFiniteNum(result)) return result;
    }
  }
  return undefined; // stay symbolic
}

export function declareGudermannian(ce: ComputeEngine): void {
  ce.declare("Gudermannian", {
    signature: "(number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) => evaluateGudermannian(ce, ops, options),
  });
}
