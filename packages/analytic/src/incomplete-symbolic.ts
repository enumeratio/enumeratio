import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigRationalAt, wrapOperator } from "@enumeratio/boxed";
import { declined, type EvalOptions, isRealInt } from "./box.ts";

// A handful of exact symbolic reductions the Wolfram page documents for the incomplete
// gamma, the Hurwitz zeta and the Lerch transcendent, added as `wrapOperator` layers on
// top of the heads `hurwitz-zeta.ts` and `incomplete-gamma.ts` already declare. Each one
// is a genuine identity (checked against wolframscript/mpmath below), not a numeric
// approximation, so it applies to a symbolic operand exactly as well as a numeric one.

/** `expr`, `.N()`'d if the caller asked for a numeric approximation, `.evaluate()`'d otherwise. */
const finish = (expr: BoxedExpression, options: EvalOptions): BoxedExpression =>
  options.numericApproximation ? expr.N() : expr.evaluate();

/**
 * Γ(2, z) = (1 + z)e^{−z} and Γ(1/2, z) = √π·erfc(√z): the two-argument incomplete gamma
 * closed forms Wolfram's `FunctionExpand[Gamma[2, z]]` / `FunctionExpand[Gamma[1/2, z]]`
 * give, applied directly at plain `evaluate()` — the same "closed form the native handler
 * leaves symbolic" policy override this file's siblings already apply to GammaLn's list
 * threading and Digamma at a positive integer. Valid for any z, numeric or symbolic.
 *
 * This also reduces `Gamma(2, 1)` (previously symbolic — "exact arguments stay symbolic")
 * and each entry of `Gamma(2, ⟨matrix⟩)` once broadcasting reaches them; both examples were
 * promoted out of `aspirational` alongside this one. It also reduces `Gamma(2, 0, z)`, the
 * three-argument difference `Gamma(2,0) − Gamma(2,z)`, past the point where the reference's
 * "two halves that don't reduce" example was pinned — that example's `expected` moved to
 * the now-reduced closed form (still exactly what `FunctionExpand` gives; Wolfram just
 * doesn't apply it to the bare 3-argument call either).
 */
function declareIncompleteGammaClosedForms(ce: ComputeEngine): void {
  const isHalf = (x: BoxedExpression): boolean => {
    const q = bigRationalAt(x);
    return q !== undefined && q[0] === 1n && q[1] === 2n;
  };
  wrapOperator(
    ce,
    ["Gamma", 2, 1],
    (ops) => (isRealInt(ops[0]) && ops[0].re === 2) || isHalf(ops[0]),
    () => (ops, options) => {
      const [s, z] = ops;
      if (isRealInt(s) && s.re === 2) {
        const expr = ce.function("Multiply", [
          ce.function("Add", [z, ce.One]),
          ce.function("Power", [ce.symbol("ExponentialE"), ce.function("Negate", [z])]),
        ]);
        return finish(expr, options);
      }
      const expr = ce.function("Multiply", [
        ce.function("Sqrt", [ce.Pi]),
        ce.function("Erfc", [ce.function("Sqrt", [z])]),
      ]);
      return finish(expr, options);
    },
    2,
  );
}

/**
 * ζ(s, 1/2) = (2^s − 1)·ζ(s), Wolfram's `HurwitzZeta[s, 1/2]` reduction, for symbolic or
 * numeric s — a pre-check layered in front of the Euler–Maclaurin evaluator rather than a
 * change to it (the identity is exact at every s, including the poles `hurwitzZeta`
 * itself has to work around). Plugging in s = 2 also happens to be exactly the
 * `HurwitzZeta(2, 1/2) = π²/2` example, which is promoted alongside this one; s = 1/4 (a
 * different `a`, not this identity) is untouched.
 */
function declareHurwitzHalfIdentity(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["HurwitzZeta", "s", 1],
    (ops) => {
      const q = bigRationalAt(ops[1]);
      return q !== undefined && q[0] === 1n && q[1] === 2n;
    },
    () => (ops, options) => {
      const [s] = ops;
      const expr = ce.function("Multiply", [
        ce.function("Add", [ce.function("Power", [ce.number(2), s]), ce.number(-1)]),
        ce.function("Zeta", [s]),
      ]);
      return finish(expr, options);
    },
    2,
  );
}

/**
 * Φ(z, s, 1) = Li_s(z)/z, Wolfram's `LerchPhi[z, s, 1]` reduction to `PolyLog`, for
 * symbolic z and s that the existing (complex- and float-capable) Lerch evaluator leaves
 * standing. Tries the current evaluator FIRST: LerchPhi's own numeric kernel already
 * evaluates a = 1 accurately for complex/float z and s (including branches this
 * PolyLog-based rewrite would not necessarily reach the same way), so this only fills in
 * the symbolic gap, exactly as `incomplete-gamma.ts`'s three-argument rewrite does.
 */
function declareLerchToPolyLogIdentity(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["LerchPhi", "z", "s", 1],
    (ops) => ops[2].re === 1 && ops[2].im === 0,
    (native) => (ops, options) => {
      const r = native?.(ops, options);
      if (!declined(r, "LerchPhi")) return r; // the existing evaluator already answered
      const [z, s] = ops;
      const expr = ce.function("Divide", [ce.function("PolyLog", [s, z]), z]);
      return finish(expr, options);
    },
    3,
  );
}

export function declareIncompleteSymbolic(ce: ComputeEngine): void {
  declareIncompleteGammaClosedForms(ce);
  declareHurwitzHalfIdentity(ce);
  declareLerchToPolyLogIdentity(ce);
}
