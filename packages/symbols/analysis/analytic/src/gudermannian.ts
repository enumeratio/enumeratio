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
// lattice is z = i(π/2 + kπ), checked before the numeric path since a float z can only ever
// land NEAR a pole, never exactly on one.
//
// The pole is DIRECTED, not the plain unsigned ComplexInfinity: writing w = z/2, at the k-th
// pole w -> i(π/4 + kπ/2), and tanh(iθ) = i tan(θ), so tanh(w) -> i tan(π/4 + kπ/2) — period π
// makes tan(π/4 + kπ/2) exactly 1 for even k and -1 for odd k (k = 2m: tan(π/4 + mπ) = tan(π/4)
// = 1; k = 2m+1: tan(3π/4 + mπ) = tan(3π/4) = -1). So arctan's own argument approaches i for
// even k, -i for odd k, and arctan(w) ~ i·∞ as w -> i (a logarithmic branch point, but along
// this path the direction is clean): gd(z) -> DirectedInfinity(i) for even k,
// DirectedInfinity(-i) for odd k. Checked numerically (this package's own complex Tanh/Arctan,
// approaching each of k = -2..2 from both sides along the real axis) before writing the sign
// pattern down; matches Wolfram's own DirectedInfinity(i) at k = 0 (enumeratio/enumeratio#478
// landed `DirectedInfinity` on main since the first version of this file, which only had
// undirected `ComplexInfinity` here).

const HALF_PI = (ce: ComputeEngine): BoxedExpression => ce.function("Multiply", [ce.number([1, 2]), ce.Pi]).evaluate();

/** How close a numeric evaluation must land to a breakpoint before it's trusted — same wide
 *  margin convention as signals.ts / closed-forms-113.ts's `Mod` block: a double carries
 *  ~15-17 significant digits, so this leaves ten orders of magnitude of slack. */
const POLE_MARGIN = 1e-6;

/** The absolute uncertainty a double carries at magnitude `approx` — same adaptive-resolution
 *  guard as signals.ts's `resolutionOf`, needed for the same reason: `k` growing large (a pole
 *  far out the imaginary axis) makes `approx.im` large, and a fixed absolute `POLE_MARGIN`
 *  alone would eventually "certify" a pole from pure rounding noise. */
const RESOLUTION_HEADROOM = 2 ** 10;
const resolutionOf = (approx: number): number => Math.abs(approx) * 2 ** -52 * RESOLUTION_HEADROOM;

/** The pole index `k` for EXACT `x` at z = i(π/2 + kπ), or `undefined` off the lattice (or too
 *  close to call, or too far out for a double to resolve which `k`). Certified via a numeric
 *  evaluation of `x`: purely imaginary (real part within the margin of 0) with its imaginary
 *  part, divided by π, within the margin of a half-odd-integer. A genuine float `x` (`isExact
 *  === false`) never qualifies — it can land close to a pole but, being a float, not exactly on
 *  one, so it takes the ordinary (large but finite) numeric path below instead. */
function poleK(x: BoxedExpression): bigint | undefined {
  if ((x as Partial<{ isExact: boolean }>).isExact === false) return undefined;
  const approx = isFiniteNum(x) ? x : x.N();
  if (!isFiniteNum(approx)) return undefined;
  if (resolutionOf(approx.im) >= POLE_MARGIN) return undefined;
  if (Math.abs(approx.re) > POLE_MARGIN) return undefined;
  const t = approx.im / Math.PI - 0.5;
  const k = Math.round(t);
  return Math.abs(t - k) <= POLE_MARGIN ? BigInt(k) : undefined;
}

/** `DirectedInfinity(i)` for an even pole index, `DirectedInfinity(-i)` for an odd one — see
 *  the sign derivation above. JS's `%` keeps a bigint operand's own sign, so `k % 2n === 0n`
 *  already picks out "even" correctly for a negative `k` too (`-4n % 2n === 0n`,
 *  `-3n % 2n === -1n`). */
function directedPoleInfinity(ce: ComputeEngine, k: bigint): BoxedExpression {
  const direction =
    k % 2n === 0n ? ce.symbol("ImaginaryUnit") : ce.function("Negate", [ce.symbol("ImaginaryUnit")]).evaluate();
  return ce.function("DirectedInfinity", [direction]).evaluate();
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
  const k = poleK(x);
  if (k !== undefined) return directedPoleInfinity(ce, k);
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
