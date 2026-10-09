import { doublesForFloats, evaluateHurwitz, exceedsDoublePrecision, wantsNumber } from "@enumeratio/ce-patches";
import { type Engine, type Expr, wrapOperator } from "@enumeratio/engine";

// A float operand gets a float answer. These heads reach compute-engine's bignum arithmetic
// (a closed form, an AGM at m = 1, a Gamma ratio), which pads a double-precision input to
// 21 digits of which the last few are noise; `doublesForFloats` boxes the double instead,
// leaving an explicit digit count past a double's alone.
const FLOAT_IN_HEADS = [
  "LerchPhi",
  "JacobiSN",
  "JacobiCN",
  "JacobiDN",
  "JacobiCD",
  "JacobiCS",
  "JacobiDC",
  "JacobiDS",
  "JacobiNC",
  "JacobiND",
  "JacobiNS",
  "JacobiSC",
  "JacobiSD",
  "JacobiAmplitude",
  "JacobiZN",
] as const;

export function declareFloatInDoubleOut(ce: Engine): void {
  for (const head of FLOAT_IN_HEADS) {
    // compile builtin: rounds a float operand's answer to a double, and leaves a NaN unevaluated: no number differs
    wrapOperator(
      ce,
      [head],
      () => true,
      (native) => (ops, options) => doublesForFloats(ce, ops, options, () => native?.(ops, options)),
      { compile: "builtin" },
    );
  }
}

/**
 * ζ(s, a) at a nonpositive integer a and Re(s) = 0, s ≠ 0: the (n + a) = 0 term is
 * 0^(−s) = 0^(−i·Im s), which winds the unit circle and has no value (Wolfram: Indeterminate).
 * compute-engine answers NaN; no numeric answer stands for that, so the call stays unevaluated.
 */
export function declineHurwitzIndeterminate(ce: Engine): void {
  // compile builtin: rounds a float operand's answer to a double, and leaves a NaN unevaluated: no number differs
  wrapOperator(
    ce,
    ["HurwitzZeta", 2],
    (ops) => {
      const [s, a] = ops;
      return (
        Number.isFinite(s.re) &&
        Number.isFinite(s.im) &&
        s.re === 0 &&
        s.im !== 0 &&
        a.im === 0 &&
        Number.isInteger(a.re) &&
        a.re <= 0
      );
    },
    () => () => undefined,
    { arity: 2, compile: "builtin" },
  );
}

/**
 * ζ(s) and ζ(s, a) at a complex s or a, on the bignum Euler–Maclaurin kernel
 * (hurwitz-zeta-big.ts) rounded once to the double pair a complex number is. compute-engine's
 * own complex kernel runs in doubles and measured 6e-13 relative off mpmath at |Im s| = 400
 * (5e-14 at ζ(1/2 + 14i)). An explicit digit count past a double's leaves the native
 * handler's answer alone.
 */
export function declareComplexZeta(ce: Engine): void {
  const complex = (x: Expr | undefined): boolean =>
    x !== undefined && Number.isFinite(x.re) && Number.isFinite(x.im) && x.im !== 0;
  // compile builtin: rounds a float operand's answer to a double, and leaves a NaN unevaluated: no number differs
  wrapOperator(
    ce,
    ["Zeta", 1],
    (ops) => complex(ops[0]),
    (native) => (ops, options) =>
      !wantsNumber(ops, options) || exceedsDoublePrecision(ce, options.numericApproximation)
        ? native?.(ops, options)
        : (evaluateHurwitz(ce, [ops[0], ce.One], true) ?? native?.(ops, options)),
    { arity: 1, compile: "builtin" },
  );
  // compile builtin: rounds a float operand's answer to a double, and leaves a NaN unevaluated: no number differs
  wrapOperator(
    ce,
    ["HurwitzZeta", 2],
    (ops) => complex(ops[0]) || complex(ops[1]),
    (native) => (ops, options) =>
      !wantsNumber(ops, options) || exceedsDoublePrecision(ce, options.numericApproximation)
        ? native?.(ops, options)
        : (evaluateHurwitz(ce, ops, true) ?? native?.(ops, options)),
    { arity: 2, compile: "builtin" },
  );
}
